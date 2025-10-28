import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';
import type { TimelineClip } from '../../types/timeline';
import type { VideoFile } from '../../types/video';
import './ExportDialog.css';

interface ExportDialogProps {
  clips: TimelineClip[];
  videos: VideoFile[];
  onClose: () => void;
  onExportStart: () => void;
}

export function ExportDialog({ clips, videos, onClose, onExportStart }: ExportDialogProps) {
  const [outputPath, setOutputPath] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleExport = async () => {
    if (!outputPath) {
      alert('Please select an output path');
      return;
    }

    // Validate output path has a filename
    if (!outputPath.endsWith('.mp4') && !outputPath.endsWith('.mov')) {
      alert('Please select a filename ending in .mp4 or .mov');
      return;
    }

    if (clips.length === 0) {
      alert('No clips to export');
      return;
    }

    setIsExporting(true);
    onExportStart();

    try {
      // Prepare clip data for FFmpeg (matching Rust struct)
      const clipData = clips.map(clip => {
        const video = videos.find(v => v.id === clip.videoFileId);
        if (!video) return null;
        
        return {
          file_path: video.path,
          trim_start: clip.trimStart,
          duration: clip.duration,
          start_time: clip.startTime,
        };
      }).filter(Boolean) as Array<{
        file_path: string;
        trim_start: number;
        duration: number;
        start_time: number;
      }>;

      // Call Tauri command to export
      const result = await invoke('export_video', {
        clips: clipData,
        outputPath,
      });

      console.log('Export result:', result);
      alert('Export completed successfully!');
      onClose();
    } catch (error) {
      console.error('Export error:', error);
      alert(`Export failed: ${error}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleBrowse = async () => {
    console.log('Browse button clicked');
    try {
      console.log('Calling save dialog...');
      const path = await save({
        title: 'Save Exported Video',
        defaultPath: 'output.mp4',
        filters: [{
          name: 'MP4 Video',
          extensions: ['mp4']
        }]
      });
      
      console.log('Save dialog returned:', path);
      
      if (path) {
        setOutputPath(path);
      } else {
        console.log('User cancelled file dialog');
      }
    } catch (error) {
      console.error('File dialog error:', error);
      alert('Failed to open file dialog: ' + error);
    }
  };

  return (
    <div className="export-dialog-overlay" onClick={onClose}>
      <div className="export-dialog" onClick={(e) => e.stopPropagation()}>
        <h2>Export Video</h2>
        
        <div className="export-info">
          <p>Clips: {clips.length}</p>
          <p>Total Duration: {formatDuration(getTotalDuration(clips))}</p>
        </div>

        <div className="export-path">
          <label>Output Path:</label>
          <div className="path-input-group">
            <input
              type="text"
              value={outputPath}
              onChange={(e) => setOutputPath(e.target.value)}
              placeholder="Select output path..."
              disabled={isExporting}
            />
            <button onClick={handleBrowse} disabled={isExporting}>
              Browse
            </button>
          </div>
        </div>

        <div className="export-actions">
          <button onClick={onClose} disabled={isExporting}>
            Cancel
          </button>
          <button onClick={handleExport} disabled={isExporting || !outputPath}>
            {isExporting ? 'Exporting...' : 'Export'}
          </button>
        </div>

        {isExporting && (
          <div className="export-progress">
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${progress}%` }}
              />
            </div>
            <p>{progress}%</p>
          </div>
        )}
      </div>
    </div>
  );
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function getTotalDuration(clips: TimelineClip[]): number {
  if (clips.length === 0) return 0;
  return Math.max(...clips.map(clip => clip.startTime + clip.duration));
}

