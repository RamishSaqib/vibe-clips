import { useState, useEffect, useRef } from 'react';
import { useRecording } from '../../contexts/RecordingContext';
import './WebcamRecording.css';
import './ScreenRecording.css'; // Reuse some styles

interface CameraDevice {
  deviceId: string;
  label: string;
}

interface Resolution {
  width: number;
  height: number;
  label: string;
}

const RESOLUTIONS: Resolution[] = [
  { width: 640, height: 480, label: '480p' },
  { width: 1280, height: 720, label: '720p' },
  { width: 1920, height: 1080, label: '1080p' },
];

export default function WebcamRecording() {
  const {
    recordingState,
    startWebcamRecording,
    stopRecording,
    saveRecording,
  } = useRecording();

  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>('');
  const [selectedResolution, setSelectedResolution] = useState<Resolution>(RESOLUTIONS[1]); // Default 720p
  const [isMirrored, setIsMirrored] = useState(true);
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [addToTimeline, setAddToTimeline] = useState(true);
  const [showSaveOptions, setShowSaveOptions] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);

  // Enumerate cameras on mount
  useEffect(() => {
    loadCameras();
  }, []);

  // Update preview when camera or resolution changes
  useEffect(() => {
    if (selectedCamera && !recordingState.isRecording) {
      startPreview();
    }
    
    return () => {
      stopPreview();
    };
  }, [selectedCamera, selectedResolution]);

  // Update video element when preview stream changes
  useEffect(() => {
    if (videoRef.current && previewStream) {
      videoRef.current.srcObject = previewStream;
    }
  }, [previewStream]);

  const loadCameras = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Request permission first
      await navigator.mediaDevices.getUserMedia({ video: true });
      
      // Then enumerate devices
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices
        .filter(device => device.kind === 'videoinput')
        .map(device => ({
          deviceId: device.deviceId,
          label: device.label || `Camera ${device.deviceId.slice(0, 8)}`,
        }));
      
      setCameras(videoDevices);
      
      // Select first camera by default
      if (videoDevices.length > 0) {
        setSelectedCamera(videoDevices[0].deviceId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to access cameras');
      console.error('Failed to enumerate cameras:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const startPreview = async () => {
    try {
      // Stop any existing preview
      stopPreview();
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: { exact: selectedCamera },
          width: { ideal: selectedResolution.width },
          height: { ideal: selectedResolution.height }
        }
      });
      
      setPreviewStream(stream);
    } catch (err) {
      console.error('Failed to start preview:', err);
    }
  };

  const stopPreview = () => {
    if (previewStream) {
      previewStream.getTracks().forEach(track => track.stop());
      setPreviewStream(null);
    }
  };

  const handleStartRecording = async () => {
    if (!selectedCamera) {
      setError('Please select a camera');
      return;
    }

    try {
      setError(null);
      // Stop preview before starting recording
      stopPreview();
      await startWebcamRecording(selectedCamera, selectedResolution);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start recording');
      console.error('Failed to start recording:', err);
    }
  };

  const handleStopRecording = async () => {
    try {
      setError(null);
      await stopRecording();
      setShowSaveOptions(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stop recording');
      console.error('Failed to stop recording:', err);
    }
  };

  const handleSaveRecording = async () => {
    try {
      setError(null);
      setIsLoading(true);
      await saveRecording(addToTimeline);
      setShowSaveOptions(false);
      // Restart preview
      if (selectedCamera) {
        startPreview();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save recording');
      console.error('Failed to save recording:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDiscardRecording = () => {
    setShowSaveOptions(false);
    // Restart preview
    if (selectedCamera) {
      startPreview();
    }
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="webcam-recording">
      {error && <div className="error-message">{error}</div>}
      {isLoading && <div className="loading-message">Loading...</div>}

      {!recordingState.isRecording && !showSaveOptions && (
        <>
          <div className="camera-selector">
            <div className="camera-selector-label">Select Camera:</div>
            <select
              className="camera-select"
              value={selectedCamera}
              onChange={(e) => setSelectedCamera(e.target.value)}
              disabled={cameras.length === 0}
            >
              {cameras.length === 0 && (
                <option>No cameras found</option>
              )}
              {cameras.map(camera => (
                <option key={camera.deviceId} value={camera.deviceId}>
                  {camera.label}
                </option>
              ))}
            </select>
          </div>

          <div className="camera-preview-container">
            <div className={`camera-preview ${isMirrored ? 'mirrored' : ''}`}>
              {previewStream ? (
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                />
              ) : (
                <div className="preview-placeholder">
                  {cameras.length === 0 ? 'No camera available' : 'Starting preview...'}
                </div>
              )}
            </div>
          </div>

          <div className="recording-options">
            <div className="option-group">
              <div className="option-label">Resolution:</div>
              <div className="resolution-selector">
                {RESOLUTIONS.map(res => (
                  <button
                    key={res.label}
                    className={`resolution-button ${
                      selectedResolution.label === res.label ? 'active' : ''
                    }`}
                    onClick={() => setSelectedResolution(res)}
                  >
                    {res.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="option-group">
              <label className="mirror-checkbox">
                <input
                  type="checkbox"
                  checked={isMirrored}
                  onChange={(e) => setIsMirrored(e.target.checked)}
                />
                <span>Mirror preview</span>
              </label>
            </div>
          </div>

          <div className="recording-controls">
            <button
              className="record-button"
              onClick={handleStartRecording}
              disabled={!selectedCamera || cameras.length === 0 || isLoading}
            >
              ● Start Recording
            </button>
          </div>
        </>
      )}

      {recordingState.isRecording && (
        <div className="recording-controls">
          <div className="recording-status">
            <div className="recording-indicator"></div>
            <span>Recording</span>
            <span className="recording-timer">{formatDuration(recordingState.duration)}</span>
          </div>
          <button className="stop-button" onClick={handleStopRecording}>
            ■ Stop Recording
          </button>
        </div>
      )}

      {showSaveOptions && !recordingState.isRecording && (
        <div className="save-options">
          <div className="save-options-title">Recording Complete (Converting to MP4...)</div>
          <label className="save-option-checkbox">
            <input
              type="checkbox"
              checked={addToTimeline}
              onChange={(e) => setAddToTimeline(e.target.checked)}
            />
            <span>Add to timeline automatically</span>
          </label>
          <div className="recording-controls-buttons">
            <button
              className="save-button"
              onClick={handleSaveRecording}
              disabled={isLoading}
            >
              Save Recording
            </button>
            <button
              className="discard-button"
              onClick={handleDiscardRecording}
              disabled={isLoading}
            >
              Discard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

