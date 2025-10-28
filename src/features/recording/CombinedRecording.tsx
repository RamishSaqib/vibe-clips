import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useRecording } from '../../contexts/RecordingContext';
import type { ScreenSource, PiPConfig } from '../../types/recording';
import { formatTime } from '../../utils/format';
import './CombinedRecording.css';

export default function CombinedRecording() {
  const { recordingState, startCombinedRecording, stopRecording, saveRecording, listScreenSources } = useRecording();
  
  const [screenSources, setScreenSources] = useState<ScreenSource[]>([]);
  const [selectedScreen, setSelectedScreen] = useState<ScreenSource | null>(null);
  const [cameraDevices, setCameraDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>('');
  const [resolution, setResolution] = useState({ width: 1920, height: 1080 });
  const [pipConfig, setPipConfig] = useState<PiPConfig>({
    position: 'bottom-right',
    size: 'small',
    padding: 20,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Audio options
  const [includeSystemAudio, setIncludeSystemAudio] = useState(true);
  const [includeMicAudio, setIncludeMicAudio] = useState(true);
  
  // Save options
  const [saveScreen, setSaveScreen] = useState(false);
  const [saveWebcam, setSaveWebcam] = useState(false);
  const [saveComposite, setSaveComposite] = useState(true);
  
  // Camera preview
  const previewRef = useRef<HTMLVideoElement>(null);
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);

  // Load screen sources and camera devices
  useEffect(() => {
    loadSources();
    loadCameras();
    checkAudioDevices(); // Debug: check available audio devices
  }, []);

  const checkAudioDevices = async () => {
    try {
      const devices = await invoke<string[]>('list_audio_devices');
      console.log('Available audio devices:', devices);
      if (devices.length === 0) {
        console.warn('No audio devices detected by FFmpeg!');
      }
    } catch (err) {
      console.error('Failed to list audio devices:', err);
    }
  };

  const loadSources = async () => {
    try {
      const sources = await listScreenSources();
      setScreenSources(sources);
      if (sources.length > 0) {
        setSelectedScreen(sources[0]);
      }
    } catch (err) {
      console.error('Failed to load screen sources:', err);
      setError('Failed to load screen sources');
    }
  };

  const loadCameras = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      setCameraDevices(videoDevices);
      if (videoDevices.length > 0) {
        setSelectedCamera(videoDevices[0].deviceId);
      }
    } catch (err) {
      console.error('Failed to enumerate cameras:', err);
      setError('Failed to access cameras');
    }
  };

  // Start camera preview
  useEffect(() => {
    if (!selectedCamera || recordingState.isRecording) return;

    const startPreview = async () => {
      try {
        // Stop existing preview
        if (previewStream) {
          previewStream.getTracks().forEach(track => track.stop());
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: { exact: selectedCamera },
            width: { ideal: resolution.width },
            height: { ideal: resolution.height }
          },
          audio: false
        });

        setPreviewStream(stream);
        if (previewRef.current) {
          previewRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error('Failed to start preview:', err);
      }
    };

    startPreview();

    return () => {
      if (previewStream) {
        previewStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [selectedCamera, resolution.width, resolution.height, recordingState.isRecording]);

  const handleStartRecording = async () => {
    if (!selectedScreen || !selectedCamera) {
      setError('Please select both screen and camera');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Stop preview before starting recording
      if (previewStream) {
        previewStream.getTracks().forEach(track => track.stop());
        setPreviewStream(null);
      }

      await startCombinedRecording(selectedScreen, selectedCamera, resolution, pipConfig, {
        includeSystemAudio,
        includeMicAudio
      });
    } catch (err) {
      console.error('Failed to start recording:', err);
      setError(err instanceof Error ? err.message : 'Failed to start recording');
    } finally {
      setLoading(false);
    }
  };

  const handleStopRecording = async () => {
    setLoading(true);
    try {
      await stopRecording();
    } catch (err) {
      console.error('Failed to stop recording:', err);
      setError(err instanceof Error ? err.message : 'Failed to stop recording');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveRecording = async () => {
    setLoading(true);
    setError(null);

    try {
      await saveRecording(true, {
        saveScreen,
        saveWebcam,
        saveComposite,
      });
      
      // Restart preview
      if (selectedCamera) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: { exact: selectedCamera },
            width: { ideal: resolution.width },
            height: { ideal: resolution.height }
          },
          audio: false
        });
        setPreviewStream(stream);
        if (previewRef.current) {
          previewRef.current.srcObject = stream;
        }
      }
    } catch (err) {
      console.error('Failed to save recording:', err);
      setError(err instanceof Error ? err.message : 'Failed to save recording');
    } finally {
      setLoading(false);
    }
  };

  const handleDiscardRecording = () => {
    setError(null);
    // The recording state will be reset by the context when save is not called
    // Just restart the preview
    if (selectedCamera) {
      navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: { exact: selectedCamera },
          width: { ideal: resolution.width },
          height: { ideal: resolution.height }
        },
        audio: false
      }).then(stream => {
        setPreviewStream(stream);
        if (previewRef.current) {
          previewRef.current.srcObject = stream;
        }
      }).catch(err => {
        console.error('Failed to restart preview:', err);
        setError('Failed to restart camera preview');
      });
    }
  };

  const showRecordedState = !recordingState.isRecording && recordingState.recordingType === 'combined';

  return (
    <div className="combined-recording">
      {error && (
        <div className="recording-error">
          {error}
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      {!recordingState.isRecording && !showRecordedState && (
        <>
          <div className="combined-setup">
            <div className="setup-section">
              <h4>Screen Source</h4>
              <select 
                value={selectedScreen?.id || ''} 
                onChange={(e) => {
                  const source = screenSources.find(s => s.id === e.target.value);
                  setSelectedScreen(source || null);
                }}
                disabled={loading}
              >
                {screenSources.map(source => (
                  <option key={source.id} value={source.id}>
                    {source.name} {source.is_primary && '(Primary)'}
                  </option>
                ))}
              </select>
            </div>

            <div className="setup-section">
              <h4>Camera</h4>
              <select 
                value={selectedCamera} 
                onChange={(e) => setSelectedCamera(e.target.value)}
                disabled={loading}
              >
                {cameraDevices.length === 0 && <option>No cameras detected</option>}
                {cameraDevices.map(device => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `Camera ${device.deviceId.slice(0, 8)}`}
                  </option>
                ))}
              </select>
            </div>

            <div className="setup-section">
              <h4>Camera Resolution</h4>
              <select 
                value={`${resolution.width}x${resolution.height}`}
                onChange={(e) => {
                  const [w, h] = e.target.value.split('x').map(Number);
                  setResolution({ width: w, height: h });
                }}
                disabled={loading}
              >
                <option value="640x480">480p (640×480)</option>
                <option value="1280x720">720p (1280×720)</option>
                <option value="1920x1080">1080p (1920×1080)</option>
              </select>
            </div>
          </div>

          <div className="pip-config">
            <h4>Picture-in-Picture Settings</h4>
            
            <div className="pip-option">
              <label>Position:</label>
              <select 
                value={pipConfig.position}
                onChange={(e) => setPipConfig({...pipConfig, position: e.target.value as PiPConfig['position']})}
                disabled={loading}
              >
                <option value="top-left">Top Left</option>
                <option value="top-right">Top Right</option>
                <option value="bottom-left">Bottom Left</option>
                <option value="bottom-right">Bottom Right</option>
              </select>
            </div>

            <div className="pip-option">
              <label>Size:</label>
              <select 
                value={pipConfig.size}
                onChange={(e) => setPipConfig({...pipConfig, size: e.target.value as PiPConfig['size']})}
                disabled={loading}
              >
                <option value="small">Small (320×180)</option>
                <option value="medium">Medium (480×270)</option>
                <option value="large">Large (640×360)</option>
              </select>
            </div>

            <div className="pip-option">
              <label>Padding:</label>
              <input 
                type="number"
                min="0"
                max="100"
                value={pipConfig.padding}
                onChange={(e) => setPipConfig({...pipConfig, padding: Number(e.target.value)})}
                disabled={loading}
              />
              <span>px</span>
            </div>
          </div>

          <div className="audio-options">
            <h4>Audio Options</h4>
            <label className="audio-option-checkbox">
              <input 
                type="checkbox" 
                checked={includeSystemAudio}
                onChange={(e) => setIncludeSystemAudio(e.target.checked)}
                disabled={loading}
              />
              Include System Audio (desktop/apps)
            </label>
            <label className="audio-option-checkbox">
              <input 
                type="checkbox" 
                checked={includeMicAudio}
                onChange={(e) => setIncludeMicAudio(e.target.checked)}
                disabled={loading}
              />
              Include Microphone
            </label>
          </div>

          <div className="camera-preview-container">
            <h4>Camera Preview</h4>
            <video 
              ref={previewRef} 
              autoPlay 
              muted
              playsInline
              className="camera-preview"
            />
          </div>

          <button
            className="start-recording-button"
            onClick={handleStartRecording}
            disabled={loading || !selectedScreen || !selectedCamera}
          >
            {loading ? 'Starting...' : 'Start Recording'}
          </button>
        </>
      )}

      {recordingState.isRecording && (
        <div className="recording-active">
          <div className="recording-indicator">
            <span className="recording-dot"></span>
            <span>Recording... {formatTime(recordingState.duration)}</span>
          </div>
          
          <div className="recording-info">
            <p>Screen: {selectedScreen?.name}</p>
            <p>Camera: {cameraDevices.find(d => d.deviceId === selectedCamera)?.label}</p>
            <p>PiP: {pipConfig.position} - {pipConfig.size}</p>
          </div>

          <button
            className="stop-recording-button"
            onClick={handleStopRecording}
            disabled={loading}
          >
            {loading ? 'Stopping...' : 'Stop Recording'}
          </button>
        </div>
      )}

      {showRecordedState && (
        <div className="recording-complete">
          <h4>Recording Complete</h4>
          <p>Duration: {formatTime(recordingState.duration)}</p>
          
          <div className="save-options">
            <h4>Save Options (select which files to keep):</h4>
            <label className="save-option-checkbox">
              <input 
                type="checkbox" 
                checked={saveComposite}
                onChange={(e) => setSaveComposite(e.target.checked)}
              />
              Save Composite (Screen + Webcam PiP)
            </label>
            <label className="save-option-checkbox">
              <input 
                type="checkbox" 
                checked={saveScreen}
                onChange={(e) => setSaveScreen(e.target.checked)}
              />
              Save Screen-only
            </label>
            <label className="save-option-checkbox">
              <input 
                type="checkbox" 
                checked={saveWebcam}
                onChange={(e) => setSaveWebcam(e.target.checked)}
              />
              Save Webcam-only
            </label>
          </div>

          <div className="recording-actions">
            <button
              className="save-button"
              onClick={handleSaveRecording}
              disabled={loading || (!saveComposite && !saveScreen && !saveWebcam)}
            >
              {loading ? 'Saving...' : 'Save & Add to Timeline'}
            </button>
            <button
              className="discard-button"
              onClick={handleDiscardRecording}
              disabled={loading}
            >
              Discard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

