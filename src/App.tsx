import { Import } from './features/import';
import { Timeline } from './features/timeline';
import { VideoProvider } from './contexts/VideoContext';
import './App.css'

function App() {
  return (
    <VideoProvider>
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

        <div className="placeholder-section preview-section">
          <h2>Preview</h2>
          <p>Video preview will appear here</p>
        </div>

        <div className="placeholder-section export-section">
          <h2>Export</h2>
          <p>Export settings will appear here</p>
        </div>
      </main>
    </div>
    </VideoProvider>
  )
}

export default App
