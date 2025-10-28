import { useState, useEffect } from 'react';
import { useRecording } from '../../contexts/RecordingContext';
import type { ScreenSource } from '../../types/recording';
import { formatTime } from '../../utils/format';
import './ScreenRecording.css';

export default function ScreenRecording() {
  const {
    recordingState,
    startScreenRecording,
    stopRecording,
    saveRecording,
    listScreenSources,
  } = useRecording();

  const [screenSources, setScreenSources] = useState<ScreenSource[]>([]);
  const [selectedSource, setSelectedSource] = useState<ScreenSource | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addToTimeline, setAddToTimeline] = useState(true);
  const [showSaveOptions, setShowSaveOptions] = useState(false);

  // Load screen sources on mount
  useEffect(() => {
    loadScreenSources();
  }, []);

  const loadScreenSources = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const sources = await listScreenSources();
      setScreenSources(sources);
      
      // Select primary by default
      const primary = sources.find(s => s.is_primary) || sources[0];
      if (primary) {
        setSelectedSource(primary);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load screen sources');
      console.error('Failed to load screen sources:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartRecording = async () => {
    if (!selectedSource) {
      setError('Please select a screen source');
      return;
    }

    try {
      setError(null);
      await startScreenRecording(selectedSource);
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save recording');
      console.error('Failed to save recording:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDiscardRecording = () => {
    setShowSaveOptions(false);
  };

  return (
    <div className="screen-recording">
      {error && <div className="error-message">{error}</div>}
      {isLoading && <div className="loading-message">Loading...</div>}

      {!recordingState.isRecording && !showSaveOptions && (
        <>
          <div className="screen-selector">
            <div className="screen-selector-label">Select Screen Source:</div>
            <div className="screen-sources">
              {screenSources.map(source => (
                <div
                  key={source.id}
                  className={`screen-source ${
                    selectedSource?.id === source.id ? 'selected' : ''
                  } ${recordingState.isRecording ? 'disabled' : ''}`}
                  onClick={() => !recordingState.isRecording && setSelectedSource(source)}
                >
                  <div className="screen-source-name">{source.name}</div>
                  <div className="screen-source-details">
                    {source.width}x{source.height}
                    {source.is_primary && ' • Primary'}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="recording-controls">
            <button
              className="record-button"
              onClick={handleStartRecording}
              disabled={!selectedSource || isLoading}
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
            <span className="recording-timer">{formatTime(recordingState.duration)}</span>
          </div>
          <button className="stop-button" onClick={handleStopRecording}>
            ■ Stop Recording
          </button>
        </div>
      )}

      {showSaveOptions && !recordingState.isRecording && (
        <div className="save-options">
          <div className="save-options-title">Recording Complete</div>
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

