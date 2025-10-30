import { useState, useEffect } from 'react';
import type { Subtitle, SubtitleTrack, SubtitleStyle } from '../../types/subtitle';
import { SubtitleEditor } from './SubtitleEditor';
import './SubtitlePanel.css';

interface SubtitlePanelProps {
  subtitleTrack: SubtitleTrack | null;
  onUpdate: (subtitles: Subtitle[], style: SubtitleStyle) => void;
  onClose: () => void;
}

export function SubtitlePanel({ subtitleTrack, onUpdate, onClose }: SubtitlePanelProps) {
  const [editingSubtitle, setEditingSubtitle] = useState<Subtitle | null>(null);
  const [style, setStyle] = useState<SubtitleStyle>(
    subtitleTrack?.style || {
      fontFamily: 'Arial',
      fontSize: 24,
      color: '#FFFFFF',
      backgroundColor: '#00000080',
      position: 'bottom',
      alignment: 'center',
    }
  );

  // Sync style when subtitleTrack changes
  useEffect(() => {
    if (subtitleTrack?.style) {
      setStyle(subtitleTrack.style);
    }
  }, [subtitleTrack?.style]);

  if (!subtitleTrack) {
    return null;
  }

  const handleSubtitleEdit = (oldSubtitle: Subtitle, newSubtitle: Subtitle) => {
    const updated = subtitleTrack.subtitles.map(s =>
      s.id === oldSubtitle.id ? newSubtitle : s
    );
    onUpdate(updated, style);
  };

  const handleSubtitleDelete = (subtitleId: string) => {
    const updated = subtitleTrack.subtitles.filter(s => s.id !== subtitleId);
    onUpdate(updated, style);
  };

  const handleStyleChange = (newStyle: Partial<SubtitleStyle>) => {
    const updated = { ...style, ...newStyle };
    setStyle(updated);
    onUpdate(subtitleTrack.subtitles, updated);
  };

  return (
    <div className="subtitle-panel">
      <div className="subtitle-panel-header">
        <h3>Subtitles</h3>
        <button onClick={onClose} className="close-button">×</button>
      </div>

      <div className="subtitle-styles">
        <h4>Style</h4>
        <div className="style-controls">
          <div className="style-group">
            <label>Font Family</label>
            <select
              value={style.fontFamily}
              onChange={(e) => handleStyleChange({ fontFamily: e.target.value })}
            >
              <option value="Arial">Arial</option>
              <option value="Helvetica">Helvetica</option>
              <option value="Times New Roman">Times New Roman</option>
              <option value="Courier New">Courier New</option>
            </select>
          </div>

          <div className="style-group">
            <label>Font Size</label>
            <input
              type="number"
              min="12"
              max="72"
              value={style.fontSize}
              onChange={(e) => handleStyleChange({ fontSize: parseInt(e.target.value) || 24 })}
            />
          </div>

          <div className="style-group">
            <label>Text Color</label>
            <div className="color-picker-container">
              <div 
                className="color-swatch" 
                style={{ backgroundColor: style.color?.startsWith('#') ? style.color : `#${style.color || 'FFFFFF'}` }}
                onClick={() => {
                  const input = document.getElementById('text-color-input') as HTMLInputElement;
                  input?.click();
                }}
              />
              <input
                id="text-color-input"
                type="color"
                value={style.color?.startsWith('#') ? style.color : `#${style.color || 'FFFFFF'}`}
                onChange={(e) => {
                  const hexColor = e.target.value.startsWith('#') ? e.target.value : `#${e.target.value}`;
                  handleStyleChange({ color: hexColor.toUpperCase() });
                }}
              />
            </div>
          </div>

          <div className="style-group">
            <label>Position</label>
            <select
              value={style.position}
              onChange={(e) => handleStyleChange({ position: e.target.value as 'bottom' | 'top' | 'center' })}
            >
              <option value="bottom">Bottom</option>
              <option value="top">Top</option>
              <option value="center">Center</option>
            </select>
          </div>

          <div className="style-group">
            <label>Alignment</label>
            <select
              value={style.alignment}
              onChange={(e) => handleStyleChange({ alignment: e.target.value as 'left' | 'center' | 'right' })}
            >
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </div>
        </div>
      </div>

      <div className="subtitle-list">
        <h4>Subtitles ({subtitleTrack.subtitles.length})</h4>
        <div className="subtitle-items">
          {subtitleTrack.subtitles.map((subtitle) => (
            <div key={subtitle.id} className="subtitle-item">
              <div className="subtitle-time">
                {formatTime(subtitle.startTime)} → {formatTime(subtitle.endTime)}
              </div>
              <div className="subtitle-text">{subtitle.text}</div>
              <div className="subtitle-actions">
                <button onClick={() => setEditingSubtitle(subtitle)}>Edit</button>
                <button onClick={() => handleSubtitleDelete(subtitle.id)} className="delete-button">
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {editingSubtitle && (
        <SubtitleEditor
          subtitle={editingSubtitle}
          onSave={(updated) => {
            handleSubtitleEdit(editingSubtitle, updated);
            setEditingSubtitle(null);
          }}
          onCancel={() => setEditingSubtitle(null)}
        />
      )}
    </div>
  );
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
}

