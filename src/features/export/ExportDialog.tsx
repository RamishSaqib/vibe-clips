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
  const [exportMessage, setExportMessage] = useState<'success' | 'error' | null>(null);

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
    setExportMessage(null);
    onExportStart();

    try {
      // Prepare clip data for FFmpeg (matching Rust struct)
      // If videos are data URLs, convert them to temp files first
      const clipData = await Promise.all(clips.map(async (clip) => {
        const video = videos.find(v => v.id === clip.videoFileId);
        if (!video) return null;
        
        let filePath = video.path;
        
        // If the path is a data URL, convert it to a temp file
        if (filePath.startsWith('data:')) {
          console.log('Converting data URL to temp file...');
          try {
            filePath = await invoke('save_temp_video', { dataUrl: filePath });
            console.log('Temp file created:', filePath);
          } catch (error) {
            console.error('Failed to convert data URL:', error);
            throw error;
          }
        }
        
        return {
          file_path: filePath,
          trim_start: clip.trimStart,
          duration: clip.duration,
          start_time: clip.startTime,
        };
      }));
      
      const validClipData = clipData.filter(Boolean) as Array<{
        file_path: string;
        trim_start: number;
        duration: number;
        start_time: number;
      }>;

      console.log('About to call invoke export_video...');
      console.log('Clips:', clipData);
      console.log('OutputPath:', outputPath);
      
      console.log('Invoking export_video command...');
      console.log('Calling invoke with:', { clips: validClipData, outputPath });
      
      let result;
      try {
        // Call Tauri command to export with explicit timeout handling
        result = await Promise.race([
          invoke('export_video', {
            clips: validClipData,
            outputPath,
          }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Export timeout after 120 seconds')), 120000)
          )
        ]);
      } catch (invokeError) {
        console.error('Invoke error:', invokeError);
        throw invokeError;
      }

      console.log('Export result:', result);
      setExportMessage('success');
      setIsExporting(false);
      
      // Auto-close after 3 seconds
      setTimeout(() => {
        onClose();
      }, 3000);
    } catch (error) {
      console.error('Export error:', error);
      setExportMessage('error');
      setIsExporting(false);
    }
  };

  const handleBrowse = async () => {
    console.log('Browse button clicked');
    try {
      console.log('Calling save dialog...');
      
      const path = await save({
        title: 'Save Exported Video',
        defaultPath: 'my-video.mp4', // More specific default name
        filters: [{
          name: 'Video Files',
          extensions: ['mp4', 'mov', 'avi']
        }]
      });
      
      console.log('Save dialog returned:', path);
      
      if (path) {
        // Ensure the path has .mp4 extension
        let finalPath = path;
        if (!finalPath.toLowerCase().endsWith('.mp4')) {
          finalPath = `${finalPath}.mp4`;
        }
        setOutputPath(finalPath);
        console.log('Final output path:', finalPath);
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
            <div className="export-spinner">
              <div className="spinner"></div>
            </div>
            <p>Exporting video... This may take a moment.</p>
          </div>
        )}

        {exportMessage === 'success' && (
          <div className="export-message export-message-success">
            <p>✓ Export completed successfully!</p>
            <p className="message-detail">Video saved to: {outputPath}</p>
          </div>
        )}

        {exportMessage === 'error' && (
          <div className="export-message export-message-error">
            <p>✗ Export failed</p>
            <p className="message-detail">Please try again or check if FFmpeg is installed.</p>
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

