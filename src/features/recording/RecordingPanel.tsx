import { useState } from 'react';
import './RecordingPanel.css';
import ScreenRecording from './ScreenRecording';
import WebcamRecording from './WebcamRecording';
import CombinedRecording from './CombinedRecording';

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
        >
          Webcam
        </button>
        <button
          className={`recording-tab ${activeTab === 'combined' ? 'active' : ''}`}
          onClick={() => setActiveTab('combined')}
        >
          Combined
        </button>
      </div>

      <div className="recording-content">
        {activeTab === 'screen' && <ScreenRecording />}
        {activeTab === 'webcam' && <WebcamRecording />}
        {activeTab === 'combined' && <CombinedRecording />}
      </div>
    </div>
  );
}

