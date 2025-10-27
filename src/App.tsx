import './App.css'

function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1>Welcome to VibeClips</h1>
        <p>Your desktop video editor</p>
      </header>

      <main className="app-main">
        <div className="placeholder-section import-section">
          <h2>Import</h2>
          <p>Drag & drop videos here or use file picker</p>
        </div>

        <div className="placeholder-section timeline-section">
          <h2>Timeline</h2>
          <p>Timeline will appear here</p>
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
  )
}

export default App

