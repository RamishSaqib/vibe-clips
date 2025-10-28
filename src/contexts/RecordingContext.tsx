import { createContext, useContext, useState, ReactNode, useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { convertFileSrc } from '@tauri-apps/api/core';
import type { RecordingState, ScreenSource, PiPConfig } from '../types/recording';
import { useVideos } from './VideoContext';
import { useTimeline } from './TimelineContext';
import type { VideoFile } from '../types/video';
import type { TimelineClip } from '../types/timeline';

interface RecordingContextType {
  recordingState: RecordingState;
  startScreenRecording: (source: ScreenSource) => Promise<void>;
  startWebcamRecording: (deviceId: string, resolution: { width: number; height: number }) => Promise<void>;
  startCombinedRecording: (
    source: ScreenSource, 
    deviceId: string, 
    resolution: { width: number; height: number },
    pipConfig: PiPConfig
  ) => Promise<void>;
  stopRecording: () => Promise<void>;
  saveRecording: (addToTimeline: boolean, saveOptions?: {
    saveScreen?: boolean;
    saveWebcam?: boolean;
    saveComposite?: boolean;
  }) => Promise<void>;
  listScreenSources: () => Promise<ScreenSource[]>;
}

const RecordingContext = createContext<RecordingContextType | undefined>(undefined);

export function RecordingProvider({ children }: { children: ReactNode }) {
  const [recordingState, setRecordingState] = useState<RecordingState>({
    isRecording: false,
    recordingType: null,
    duration: 0,
    startTime: null,
    outputPath: null,
    audioBlob: null,
    videoPath: null,
    selectedScreenSource: null,
    webcamPath: null,
    screenPath: null,
    pipConfig: null,
  });

  const { addVideo } = useVideos();
  const { timelineState, setTimelineState } = useTimeline();

  // Audio recording state
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const [audioRecorder, setAudioRecorder] = useState<MediaRecorder | null>(null);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);

  // Webcam recording state
  const [webcamStream, setWebcamStream] = useState<MediaStream | null>(null);
  const [webcamRecorder, setWebcamRecorder] = useState<MediaRecorder | null>(null);
  const [webcamChunks, setWebcamChunks] = useState<Blob[]>([]);

  // Timer effect
  useEffect(() => {
    if (!recordingState.isRecording || !recordingState.startTime) return;

    const interval = setInterval(() => {
      const elapsed = Date.now() - recordingState.startTime!;
      setRecordingState(prev => ({ ...prev, duration: Math.floor(elapsed / 1000) }));
    }, 1000);

    return () => clearInterval(interval);
  }, [recordingState.isRecording, recordingState.startTime]);

  const listScreenSources = useCallback(async () => {
    try {
      const sources = await invoke<ScreenSource[]>('list_screen_sources');
      return sources;
    } catch (error) {
      console.error('Failed to list screen sources:', error);
      throw error;
    }
  }, []);

  const startAudioRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setAudioStream(stream);

      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        setRecordingState(prev => ({ ...prev, audioBlob }));
        setAudioChunks([]);
      };

      recorder.start();
      setAudioRecorder(recorder);
      setAudioChunks(chunks);
    } catch (error) {
      console.error('Failed to start audio recording:', error);
      throw new Error('Microphone access denied. Please enable microphone permissions.');
    }
  }, []);

  const stopAudioRecording = useCallback(() => {
    if (audioRecorder && audioRecorder.state !== 'inactive') {
      audioRecorder.stop();
    }
    if (audioStream) {
      audioStream.getTracks().forEach(track => track.stop());
      setAudioStream(null);
    }
  }, [audioRecorder, audioStream]);

  const startScreenRecording = useCallback(async (source: ScreenSource) => {
    try {
      // Get temp directory from Rust
      let tempDir = await invoke<string>('get_temp_dir');
      // Remove trailing backslash if present
      tempDir = tempDir.replace(/[\\\/]$/, '');
      
      const timestamp = Date.now();
      const videoPath = `${tempDir}\\screen_recording_${timestamp}.mp4`;
      const outputPath = `${tempDir}\\screen_recording_final_${timestamp}.mp4`;

      // Start audio recording
      await startAudioRecording();

      // Start screen recording via Rust (FFmpeg spawned as background process)
      await invoke('start_screen_recording_async', { 
        outputPath: videoPath
      });

      setRecordingState({
        isRecording: true,
        recordingType: 'screen',
        duration: 0,
        startTime: Date.now(),
        outputPath,
        audioBlob: null,
        videoPath,
        selectedScreenSource: source,
      });
    } catch (error) {
      console.error('Failed to start screen recording:', error);
      stopAudioRecording();
      throw error;
    }
  }, [startAudioRecording, stopAudioRecording]);

  const startWebcamRecording = useCallback(async (deviceId: string, resolution: { width: number; height: number }) => {
    try {
      // Get temp directory from Rust
      let tempDir = await invoke<string>('get_temp_dir');
      // Remove trailing backslash if present
      tempDir = tempDir.replace(/[\\\/]$/, '');
      
      const timestamp = Date.now();
      const webmPath = `${tempDir}\\webcam_recording_${timestamp}.webm`;
      const mp4Path = `${tempDir}\\webcam_recording_${timestamp}.mp4`;

      // Request webcam access with video and audio
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: { exact: deviceId },
          width: { ideal: resolution.width },
          height: { ideal: resolution.height }
        },
        audio: true
      });

      setWebcamStream(stream);

      // Create MediaRecorder
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm';
      
      const recorder = new MediaRecorder(stream, { mimeType });
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = async () => {
        const webmBlob = new Blob(chunks, { type: 'video/webm' });
        
        // Save WebM to temp file
        const arrayBuffer = await webmBlob.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        
        // Convert to base64 data URL for save_temp_video command
        const reader = new FileReader();
        reader.readAsDataURL(webmBlob);
        reader.onloadend = async () => {
          const dataUrl = reader.result as string;
          const savedPath = await invoke<string>('save_temp_video', { dataUrl });
          
          // Update state with saved WebM path (will convert to MP4 on save)
          setRecordingState(prev => ({
            ...prev,
            videoPath: savedPath, // This is the WebM file
            outputPath: mp4Path,  // This will be the MP4 after conversion
          }));
        };
      };

      recorder.start();
      setWebcamRecorder(recorder);
      setWebcamChunks(chunks);

      setRecordingState({
        isRecording: true,
        recordingType: 'webcam',
        duration: 0,
        startTime: Date.now(),
        outputPath: mp4Path,
        audioBlob: null,
        videoPath: webmPath,
        selectedScreenSource: null,
        webcamPath: null,
        screenPath: null,
        pipConfig: null,
      });
    } catch (error) {
      console.error('Failed to start webcam recording:', error);
      throw error;
    }
  }, []);

  const startCombinedRecording = useCallback(async (
    source: ScreenSource, 
    deviceId: string, 
    resolution: { width: number; height: number },
    pipConfig: PiPConfig
  ) => {
    try {
      // Get temp directory from Rust
      let tempDir = await invoke<string>('get_temp_dir');
      // Remove trailing backslash if present
      tempDir = tempDir.replace(/[\\\/]$/, '');
      
      const timestamp = Date.now();
      const screenPath = `${tempDir}\\combined_screen_${timestamp}.mp4`;
      const webcamWebmPath = `${tempDir}\\combined_webcam_${timestamp}.webm`;
      const webcamPath = `${tempDir}\\combined_webcam_${timestamp}.mp4`;
      const compositePath = `${tempDir}\\combined_composite_${timestamp}.mp4`;

      // Start screen recording via Rust
      await invoke('start_screen_recording_async', { 
        outputPath: screenPath
      });

      // Start webcam recording via MediaRecorder
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: { exact: deviceId },
          width: { ideal: resolution.width },
          height: { ideal: resolution.height }
        },
        audio: false // Don't capture webcam audio for combined recording (screen audio is enough)
      });

      setWebcamStream(stream);

      // Create MediaRecorder
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm';
      
      const recorder = new MediaRecorder(stream, { mimeType });
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = async () => {
        const webmBlob = new Blob(chunks, { type: 'video/webm' });
        
        // Save WebM to temp file
        const reader = new FileReader();
        reader.readAsDataURL(webmBlob);
        reader.onloadend = async () => {
          const dataUrl = reader.result as string;
          const savedWebmPath = await invoke<string>('save_temp_video', { dataUrl });
          
          // Convert WebM to MP4
          try {
            await invoke('convert_webm_to_mp4', {
              inputPath: savedWebmPath,
              outputPath: webcamPath
            });
            
            // Update state with converted webcam path
            setRecordingState(prev => ({
              ...prev,
              webcamPath,
            }));
          } catch (err) {
            console.error('Failed to convert webcam recording:', err);
          }
        };
      };

      recorder.start();
      setWebcamRecorder(recorder);
      setWebcamChunks(chunks);

      setRecordingState({
        isRecording: true,
        recordingType: 'combined',
        duration: 0,
        startTime: Date.now(),
        outputPath: compositePath,
        audioBlob: null,
        videoPath: null,
        selectedScreenSource: source,
        webcamPath,
        screenPath,
        pipConfig,
      });
    } catch (error) {
      console.error('Failed to start combined recording:', error);
      // Cleanup on error
      if (webcamStream) {
        webcamStream.getTracks().forEach(track => track.stop());
        setWebcamStream(null);
      }
      try {
        await invoke('stop_screen_recording_async');
      } catch (e) {
        // Ignore cleanup errors
      }
      throw error;
    }
  }, [webcamStream]);

  const stopRecording = useCallback(async () => {
    if (!recordingState.isRecording) return;

    try {
      if (recordingState.recordingType === 'screen') {
        // Stop audio recording
        stopAudioRecording();

        // Stop screen recording (kills FFmpeg process)
        const videoPath = await invoke<string>('stop_screen_recording_async');

        setRecordingState(prev => ({
          ...prev,
          isRecording: false,
          videoPath, // Update with actual path from stop command
        }));
      } else if (recordingState.recordingType === 'webcam') {
        // Stop webcam recorder
        if (webcamRecorder && webcamRecorder.state !== 'inactive') {
          webcamRecorder.stop();
        }
        
        // Stop webcam stream
        if (webcamStream) {
          webcamStream.getTracks().forEach(track => track.stop());
          setWebcamStream(null);
        }

        setRecordingState(prev => ({
          ...prev,
          isRecording: false,
        }));
      } else if (recordingState.recordingType === 'combined') {
        // Stop screen recording
        const screenPath = await invoke<string>('stop_screen_recording_async');

        // Stop webcam recorder
        if (webcamRecorder && webcamRecorder.state !== 'inactive') {
          webcamRecorder.stop();
        }
        
        // Stop webcam stream
        if (webcamStream) {
          webcamStream.getTracks().forEach(track => track.stop());
          setWebcamStream(null);
        }

        setRecordingState(prev => ({
          ...prev,
          isRecording: false,
          screenPath, // Update with actual path from stop command
        }));
      }
    } catch (error) {
      console.error('Failed to stop recording:', error);
      throw error;
    }
  }, [recordingState.isRecording, recordingState.recordingType, stopAudioRecording, webcamRecorder, webcamStream]);

  const saveRecording = useCallback(async (addToTimeline: boolean, saveOptions?: {
    saveScreen?: boolean;
    saveWebcam?: boolean;
    saveComposite?: boolean;
  }) => {
    const { videoPath, audioBlob, outputPath, recordingType, screenPath, webcamPath, pipConfig } = recordingState;

    // Default save options
    const options = {
      saveScreen: saveOptions?.saveScreen ?? false,
      saveWebcam: saveOptions?.saveWebcam ?? false,
      saveComposite: saveOptions?.saveComposite ?? true, // Always save composite by default
    };

    try {
      const savedVideos: VideoFile[] = [];

      // Handle screen-only recording
      if (recordingType === 'screen') {
        if (!videoPath || !outputPath) {
          throw new Error('No recording to save');
        }

        let finalPath = videoPath;
        
        // Get actual file size
        const fileSize = await invoke<number>('get_file_size', { filePath: finalPath });
        
        // Generate thumbnail
        const thumbnailPath = finalPath.replace(/\.(mp4|webm)$/, '_thumb.jpg');
        let thumbnail: string | undefined;
        try {
          await invoke('generate_video_thumbnail', { 
            videoPath: finalPath, 
            outputPath: thumbnailPath 
          });
          thumbnail = thumbnailPath;
        } catch (err) {
          console.warn('Failed to generate thumbnail:', err);
        }
        
        const videoFile: VideoFile = {
          id: `recording_${Date.now()}`,
          path: finalPath,
          filename: finalPath.split('\\').pop() || 'recording.mp4',
          duration: recordingState.duration,
          size: fileSize,
          resolution: { width: 1920, height: 1080 },
          thumbnail,
        };

        savedVideos.push(videoFile);
      }

      // Handle webcam-only recording
      else if (recordingType === 'webcam') {
        if (!videoPath || !outputPath) {
          throw new Error('No recording to save');
        }

        let finalPath = videoPath;

        // Convert WebM to MP4
        await invoke('convert_webm_to_mp4', {
          inputPath: videoPath,
          outputPath
        });
        finalPath = outputPath;
        
        // Get actual file size
        const fileSize = await invoke<number>('get_file_size', { filePath: finalPath });
        
        // Generate thumbnail
        const thumbnailPath = finalPath.replace(/\.(mp4|webm)$/, '_thumb.jpg');
        let thumbnail: string | undefined;
        try {
          await invoke('generate_video_thumbnail', { 
            videoPath: finalPath, 
            outputPath: thumbnailPath 
          });
          thumbnail = thumbnailPath;
        } catch (err) {
          console.warn('Failed to generate thumbnail:', err);
        }
        
        const videoFile: VideoFile = {
          id: `recording_${Date.now()}`,
          path: finalPath,
          filename: finalPath.split('\\').pop() || 'recording.mp4',
          duration: recordingState.duration,
          size: fileSize,
          resolution: { width: 1920, height: 1080 },
          thumbnail,
        };

        savedVideos.push(videoFile);
      }

      // Handle combined recording
      else if (recordingType === 'combined') {
        if (!screenPath || !webcamPath || !pipConfig || !outputPath) {
          throw new Error('Combined recording data incomplete');
        }

        // Wait for webcam conversion to complete (in case it's still processing)
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Save screen-only if requested
        if (options.saveScreen) {
          const fileSize = await invoke<number>('get_file_size', { filePath: screenPath });
          const thumbnailPath = screenPath.replace(/\.mp4$/, '_thumb.jpg');
          let thumbnail: string | undefined;
          try {
            await invoke('generate_video_thumbnail', { 
              videoPath: screenPath, 
              outputPath: thumbnailPath 
            });
            thumbnail = thumbnailPath;
          } catch (err) {
            console.warn('Failed to generate screen thumbnail:', err);
          }
          
          const screenVideo: VideoFile = {
            id: `screen_${Date.now()}`,
            path: screenPath,
            filename: screenPath.split('\\').pop() || 'screen.mp4',
            duration: recordingState.duration,
            size: fileSize,
            resolution: { width: 1920, height: 1080 },
            thumbnail,
          };
          savedVideos.push(screenVideo);
        }

        // Save webcam-only if requested
        if (options.saveWebcam) {
          const fileSize = await invoke<number>('get_file_size', { filePath: webcamPath });
          const thumbnailPath = webcamPath.replace(/\.mp4$/, '_thumb.jpg');
          let thumbnail: string | undefined;
          try {
            await invoke('generate_video_thumbnail', { 
              videoPath: webcamPath, 
              outputPath: thumbnailPath 
            });
            thumbnail = thumbnailPath;
          } catch (err) {
            console.warn('Failed to generate webcam thumbnail:', err);
          }
          
          const webcamVideo: VideoFile = {
            id: `webcam_${Date.now()}`,
            path: webcamPath,
            filename: webcamPath.split('\\').pop() || 'webcam.mp4',
            duration: recordingState.duration,
            size: fileSize,
            resolution: { width: 1920, height: 1080 },
            thumbnail,
          };
          savedVideos.push(webcamVideo);
        }

        // Create composite PiP video if requested
        if (options.saveComposite) {
          await invoke('composite_pip_video', {
            screenPath,
            webcamPath,
            pipConfig,
            outputPath
          });

          const fileSize = await invoke<number>('get_file_size', { filePath: outputPath });
          const thumbnailPath = outputPath.replace(/\.mp4$/, '_thumb.jpg');
          let thumbnail: string | undefined;
          try {
            await invoke('generate_video_thumbnail', { 
              videoPath: outputPath, 
              outputPath: thumbnailPath 
            });
            thumbnail = thumbnailPath;
          } catch (err) {
            console.warn('Failed to generate composite thumbnail:', err);
          }
          
          const compositeVideo: VideoFile = {
            id: `composite_${Date.now()}`,
            path: outputPath,
            filename: outputPath.split('\\').pop() || 'combined.mp4',
            duration: recordingState.duration,
            size: fileSize,
            resolution: { width: 1920, height: 1080 },
            thumbnail,
          };
          savedVideos.push(compositeVideo);
        }
      }

      // Add all saved videos to media library
      savedVideos.forEach(video => addVideo(video));

      // Add to timeline if requested (only the first/primary video)
      if (addToTimeline && savedVideos.length > 0) {
        const primaryVideo = savedVideos[savedVideos.length - 1]; // Use composite or latest video
        const newClip: TimelineClip = {
          id: `clip_${Date.now()}`,
          videoFileId: primaryVideo.id,
          startTime: timelineState.playheadPosition,
          duration: primaryVideo.duration,
          trimStart: 0,
          trimEnd: primaryVideo.duration,
          track: 0,
        };

        setTimelineState(prev => ({
          ...prev,
          clips: [...prev.clips, newClip],
        }));
      }

      // Reset recording state
      setRecordingState({
        isRecording: false,
        recordingType: null,
        duration: 0,
        startTime: null,
        outputPath: null,
        audioBlob: null,
        videoPath: null,
        selectedScreenSource: null,
        webcamPath: null,
        screenPath: null,
        pipConfig: null,
      });
    } catch (error) {
      console.error('Failed to save recording:', error);
      throw error;
    }
  }, [recordingState, addVideo, timelineState.playheadPosition, setTimelineState]);

  return (
    <RecordingContext.Provider
      value={{
        recordingState,
        startScreenRecording,
        startWebcamRecording,
        startCombinedRecording,
        stopRecording,
        saveRecording,
        listScreenSources,
      }}
    >
      {children}
    </RecordingContext.Provider>
  );
}

export function useRecording() {
  const context = useContext(RecordingContext);
  if (!context) {
    throw new Error('useRecording must be used within RecordingProvider');
  }
  return context;
}

