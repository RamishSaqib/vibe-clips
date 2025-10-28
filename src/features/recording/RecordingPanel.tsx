import { useState } from 'react';
import './RecordingPanel.css';
import ScreenRecording from './ScreenRecording';

type RecordingTab = 'screen' | 'webcam' | 'combined';

export default function RecordingPanel() {
  const [activeTab, setActiveTab] = useState<RecordingTab>('screen');
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className={`recording-panel ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="recording-panel-header">
        <h3 className="recording-panel-title">Recording</h3>
        <button
          className="collapse-button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          title={isCollapsed ? 'Expand' : 'Collapse'}
        >
          {isCollapsed ? '▼' : '▲'}
        </button>
      </div>

      <div className="recording-tabs">
        <button
          className={`recording-tab ${activeTab === 'screen' ? 'active' : ''}`}
          onClick={() => setActiveTab('screen')}
        >
          Screen
        </button>
        <button
          className={`recording-tab ${activeTab === 'webcam' ? 'active' : ''}`}
          onClick={() => setActiveTab('webcam')}
          disabled
          title="Coming in PR#9"
        >
          Webcam
        </button>
        <button
          className={`recording-tab ${activeTab === 'combined' ? 'active' : ''}`}
          onClick={() => setActiveTab('combined')}
          disabled
          title="Coming in PR#10"
        >
          Combined
        </button>
      </div>

      <div className="recording-content">
        {activeTab === 'screen' && <ScreenRecording />}
        {activeTab === 'webcam' && <div>Webcam recording coming in PR#9</div>}
        {activeTab === 'combined' && <div>Combined recording coming in PR#10</div>}
      </div>
    </div>
  );
}

