import { Import } from './features/import';
import { Timeline } from './features/timeline';
import { VideoPlayer } from './features/preview';
import { VideoProvider } from './contexts/VideoContext';
import { TimelineProvider } from './contexts/TimelineContext';
import './App.css'

function App() {
  return (
    <VideoProvider>
    <TimelineProvider>
    <div className="app">
      <header className="app-header">
        <h1>Welcome to VibeClips</h1>
        <p>Your desktop video editor</p>
      </header>

      <main className="app-main">
        <div className="placeholder-section import-section">
          <Import />
        </div>

        <div className="timeline-section-wrapper">
          <Timeline />
        </div>

        <div className="preview-section">
          <VideoPlayer />
        </div>

        <div className="placeholder-section export-section">
          <h2>Export</h2>
          <p>Export settings will appear here</p>
        </div>
      </main>
    </div>
    </TimelineProvider>
    </VideoProvider>
  )
}

export default App
