import { useState } from 'react';
import { Import } from './features/import';
import { Timeline } from './features/timeline';
import { VideoPlayer } from './features/preview';
import { ExportDialog } from './features/export';
import { RecordingPanel } from './features/recording';
import { VideoProvider, useVideos } from './contexts/VideoContext';
import { TimelineProvider, useTimeline } from './contexts/TimelineContext';
import { RecordingProvider } from './contexts/RecordingContext';
import './App.css'

function ExportButton() {
  const { timelineState } = useTimeline();
  const { videos } = useVideos();
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
          onClose={handleClose}
          onExportStart={handleExportStart}
        />
      )}
    </>
  );
}

function App() {
  return (
    <VideoProvider>
    <TimelineProvider>
    <RecordingProvider>
    <div className="app">
      <header className="app-header">
        <h1>Welcome to VibeClips</h1>
        <p>Your desktop video editor</p>
      </header>

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
    </TimelineProvider>
    </VideoProvider>
  )
}

export default App
