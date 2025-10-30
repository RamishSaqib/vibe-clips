import { useState, useEffect } from 'react';
import type { Subtitle } from '../../types/subtitle';
import './SubtitleEditor.css';

interface SubtitleEditorProps {
  subtitle: Subtitle;
  onSave: (subtitle: Subtitle) => void;
  onCancel: () => void;
}

export function SubtitleEditor({ subtitle, onSave, onCancel }: SubtitleEditorProps) {
  const [text, setText] = useState(subtitle.text);
  const [startTime, setStartTime] = useState(subtitle.startTime);
  const [endTime, setEndTime] = useState(subtitle.endTime);

  useEffect(() => {
    setText(subtitle.text);
    setStartTime(subtitle.startTime);
    setEndTime(subtitle.endTime);
  }, [subtitle]);

  const handleSave = () => {
    if (endTime <= startTime) {
      alert('End time must be after start time');
      return;
    }
    onSave({
      ...subtitle,
      text: text.trim(),
      startTime,
      endTime,
    });
  };

  return (
    <div className="subtitle-editor-overlay">
      <div className="subtitle-editor">
        <h3>Edit Subtitle</h3>
        
        <div className="editor-field">
          <label>Text</label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            placeholder="Subtitle text..."
          />
        </div>

        <div className="editor-field">
          <label>Start Time (seconds)</label>
          <input
            type="number"
            step="0.001"
            value={startTime}
            onChange={(e) => setStartTime(parseFloat(e.target.value) || 0)}
          />
        </div>

        <div className="editor-field">
          <label>End Time (seconds)</label>
          <input
            type="number"
            step="0.001"
            value={endTime}
            onChange={(e) => setEndTime(parseFloat(e.target.value) || 0)}
          />
        </div>

        <div className="editor-actions">
          <button onClick={handleSave} className="save-button">Save</button>
          <button onClick={onCancel} className="cancel-button">Cancel</button>
        </div>
      </div>
    </div>
  );
}

