import { useState } from 'react';
import { Import } from './features/import';
import { Timeline } from './features/timeline';
import { VideoPlayer } from './features/preview';
import { ExportDialog } from './features/export';
import { RecordingPanel } from './features/recording';
import { Settings } from './features/settings';
import { VideoProvider, useVideos } from './contexts/VideoContext';
import { TimelineProvider, useTimeline } from './contexts/TimelineContext';
import { RecordingProvider } from './contexts/RecordingContext';
import { SubtitleProvider, useSubtitles } from './contexts/SubtitleContext';
import './App.css'

function ExportButton() {
  const { timelineState } = useTimeline();
  const { videos } = useVideos();
  const { subtitleTracks } = useSubtitles();
  const [showDialog, setShowDialog] = useState(false);

  const handleExport = () => {
    setShowDialog(true);
  };

  const handleClose = () => {
    setShowDialog(false);
  };

  const handleExportStart = () => {
    // Could show a global loading state here
  };

  return (
    <>
      <button 
        onClick={handleExport}
        className="export-button"
        disabled={timelineState.clips.length === 0}
      >
        Export Video
      </button>

      {showDialog && (
        <ExportDialog
          clips={timelineState.clips}
          videos={videos}
          overlayPositions={{
            track1: timelineState.tracks[1]?.overlayPosition,
            track2: timelineState.tracks[2]?.overlayPosition,
          }}
          subtitleTracks={subtitleTracks}
          onClose={handleClose}
          onExportStart={handleExportStart}
        />
      )}
    </>
  );
}

function App() {
  const [showSettings, setShowSettings] = useState(false);

  return (
    <VideoProvider>
    <TimelineProvider>
    <SubtitleProvider>
    <RecordingProvider>
    <div className="app">
      <header className="app-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <div>
            <h1>Welcome to VibeClips</h1>
            <p>Your desktop video editor</p>
          </div>
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className="settings-button"
            style={{
              padding: '0.5rem 1rem',
              background: '#333',
              border: '1px solid #555',
              borderRadius: '4px',
              color: '#ddd',
              cursor: 'pointer',
              fontSize: '0.875rem'
            }}
          >
            ⚙️ Settings
          </button>
        </div>
      </header>

      {showSettings && (
        <div className="settings-overlay" onClick={() => setShowSettings(false)}>
          <div className="settings-container" onClick={(e) => e.stopPropagation()}>
            <button 
              onClick={() => setShowSettings(false)}
              className="close-settings"
            >
              ×
            </button>
            <Settings />
          </div>
        </div>
      )}

      <main className="app-main">
        <div className="placeholder-section import-section">
          <Import />
        </div>

        <div className="recording-section">
          <RecordingPanel />
        </div>

        <div className="timeline-section-wrapper">
          <Timeline />
        </div>

        <div className="preview-section">
          <VideoPlayer />
        </div>

        <div className="placeholder-section export-section">
          <h2>Export</h2>
          <ExportButton />
        </div>
      </main>
    </div>
    </RecordingProvider>
    </SubtitleProvider>
    </TimelineProvider>
    </VideoProvider>
  )
}

export default App
