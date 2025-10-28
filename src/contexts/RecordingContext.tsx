import { createContext, useContext, useState, ReactNode, useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { RecordingState, ScreenSource } from '../types/recording';
import { useVideos } from './VideoContext';
import { useTimeline } from './TimelineContext';
import type { VideoFile } from '../types/video';
import type { TimelineClip } from '../types/timeline';

interface RecordingContextType {
  recordingState: RecordingState;
  startScreenRecording: (source: ScreenSource) => Promise<void>;
  stopRecording: () => Promise<void>;
  saveRecording: (addToTimeline: boolean) => Promise<void>;
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
  });

  const { addVideo } = useVideos();
  const { timelineState, setTimelineState } = useTimeline();

  // Audio recording state
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const [audioRecorder, setAudioRecorder] = useState<MediaRecorder | null>(null);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);

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
      // Generate temp output path
      const timestamp = Date.now();
      const tempDir = await invoke<string>('plugin:fs|resolve', { path: '$TEMP' }).catch(() => 'C:\\Temp');
      const videoPath = `${tempDir}\\screen_recording_${timestamp}.mp4`;
      const outputPath = `${tempDir}\\screen_recording_final_${timestamp}.mp4`;

      // Start audio recording
      await startAudioRecording();

      // Start screen recording via Rust (using FFmpeg)
      await invoke('capture_screen_ffmpeg', { 
        outputPath: videoPath,
        durationSecs: null // Record indefinitely until stopped
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

  const stopRecording = useCallback(async () => {
    if (!recordingState.isRecording) return;

    try {
      // Stop audio recording
      stopAudioRecording();

      // The FFmpeg recording needs to be stopped via process termination
      // For now, we'll handle this in a simpler way
      // In a full implementation, we'd track the FFmpeg process and terminate it

      setRecordingState(prev => ({
        ...prev,
        isRecording: false,
      }));
    } catch (error) {
      console.error('Failed to stop recording:', error);
      throw error;
    }
  }, [recordingState.isRecording, stopAudioRecording]);

  const saveRecording = useCallback(async (addToTimeline: boolean) => {
    const { videoPath, audioBlob, outputPath } = recordingState;

    if (!videoPath || !outputPath) {
      throw new Error('No recording to save');
    }

    try {
      let finalPath = videoPath;

      // If we have audio, mux it with the video
      if (audioBlob) {
        // Save audio blob to temp file
        const audioArrayBuffer = await audioBlob.arrayBuffer();
        const audioBytes = new Uint8Array(audioArrayBuffer);
        const audioPath = videoPath.replace('.mp4', '_audio.webm');
        
        // Write audio file
        await invoke('plugin:fs|write', {
          path: audioPath,
          data: Array.from(audioBytes)
        });

        // Mux video and audio
        await invoke('mux_video_audio', {
          videoPath,
          audioPath,
          outputPath
        });

        finalPath = outputPath;
      }

      // Extract metadata
      const video = document.createElement('video');
      video.preload = 'metadata';
      
      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => resolve();
        video.onerror = () => reject(new Error('Failed to load video metadata'));
        video.src = `file://${finalPath}`;
      });

      const videoFile: VideoFile = {
        id: `recording_${Date.now()}`,
        path: finalPath,
        filename: finalPath.split('\\').pop() || 'recording.mp4',
        duration: video.duration,
        size: 0, // Would need to get from file system
        resolution: {
          width: video.videoWidth,
          height: video.videoHeight,
        },
      };

      // Add to media library
      addVideo(videoFile);

      // Add to timeline if requested
      if (addToTimeline) {
        const newClip: TimelineClip = {
          id: `clip_${Date.now()}`,
          videoFileId: videoFile.id,
          startTime: timelineState.playheadPosition,
          duration: videoFile.duration,
          trimStart: 0,
          trimEnd: videoFile.duration,
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

