import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';
import type { TimelineClip } from '../../types/timeline';
import type { VideoFile } from '../../types/video';
import type { SubtitleTrack } from '../../types/subtitle';
import { formatTime } from '../../utils/format';
import { EXPORT_PRESETS, QUALITY_PRESETS } from '../../utils/constants';
import './ExportDialog.css';

interface ExportDialogProps {
  clips: TimelineClip[];
  videos: VideoFile[];
  overlayPositions?: { track1?: string; track2?: string }; // Overlay positions for tracks 1 and 2
  subtitleTracks?: Map<string, SubtitleTrack>; // Map of clipId -> SubtitleTrack
  onClose: () => void;
  onExportStart: () => void;
}

export function ExportDialog({ clips, videos, overlayPositions, subtitleTracks, onClose, onExportStart }: ExportDialogProps) {
  const [outputPath, setOutputPath] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState<'success' | 'error' | null>(null);
  const [resolutionPreset, setResolutionPreset] = useState<keyof typeof EXPORT_PRESETS>('source');
  const [qualityPreset, setQualityPreset] = useState<keyof typeof QUALITY_PRESETS>('balanced');
  const [burnSubtitles, setBurnSubtitles] = useState(false);

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
          track: clip.track,
        };
      }));
      
      const validClipData = clipData.filter(Boolean) as Array<{
        file_path: string;
        trim_start: number;
        duration: number;
        start_time: number;
        track: number;
      }>;

      console.log('About to call invoke export_video...');
      console.log('Clips:', clipData);
      console.log('OutputPath:', outputPath);
      
      console.log('Invoking export_video command...');
      console.log('Calling invoke with:', { clips: validClipData, outputPath });
      
      const selectedResolution = EXPORT_PRESETS[resolutionPreset];
      const selectedQuality = QUALITY_PRESETS[qualityPreset];
      
      // Generate SRT file if burning subtitles
      let srtFilePath: string | null = null;
      if (burnSubtitles && subtitleTracks && subtitleTracks.size > 0) {
        console.log('Generating SRT file for subtitle burn-in...');
        srtFilePath = await generateSRTFile(subtitleTracks, clips);
        console.log('SRT file generated at:', srtFilePath);
      } else {
        console.log('Burn subtitles:', burnSubtitles, 'Subtitle tracks:', subtitleTracks?.size || 0);
      }
      
      let result;
      try {
        // Call Tauri command to export with explicit timeout handling
        console.log('Calling export_video with subtitle_srt_path:', srtFilePath);
        console.log('SRT file path value:', srtFilePath, 'Type:', typeof srtFilePath, 'Is null:', srtFilePath === null, 'Is undefined:', srtFilePath === undefined);
        result = await Promise.race([
          invoke('export_video', {
            clips: validClipData,
            outputPath,
            width: selectedResolution.width,
            height: selectedResolution.height,
            crf: selectedQuality.crf,
            preset: selectedQuality.preset,
            overlayPositions: overlayPositions || { track1: 'bottom-right', track2: 'bottom-left' },
            subtitleSrtPath: srtFilePath, // camelCase to match Rust with #[allow(non_snake_case)]
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
      
      // Show alert with error details
      const errorMessage = error instanceof Error ? error.message : String(error);
      alert(`Export error: ${errorMessage}\n\nPlease ensure FFmpeg is installed and try again.`);
    }
  };

  const handleBrowse = async () => {
    try {
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
          <p>Total Duration: {formatTime(getTotalDuration(clips))}</p>
        </div>

        <div className="export-settings">
          <div className="export-setting">
            <label>Resolution:</label>
            <select 
              value={resolutionPreset} 
              onChange={(e) => setResolutionPreset(e.target.value as keyof typeof EXPORT_PRESETS)}
              disabled={isExporting}
            >
              {Object.entries(EXPORT_PRESETS).map(([key, preset]) => (
                <option key={key} value={key}>
                  {preset.label} - {preset.description}
                </option>
              ))}
            </select>
          </div>

          <div className="export-setting">
            <label>Quality:</label>
            <select 
              value={qualityPreset} 
              onChange={(e) => setQualityPreset(e.target.value as keyof typeof QUALITY_PRESETS)}
              disabled={isExporting}
            >
              {Object.entries(QUALITY_PRESETS).map(([key, preset]) => (
                <option key={key} value={key}>
                  {preset.label} - {preset.description}
                </option>
              ))}
            </select>
          </div>

          {subtitleTracks && subtitleTracks.size > 0 && (
            <div className="export-setting">
              <label>
                <input
                  type="checkbox"
                  checked={burnSubtitles}
                  onChange={(e) => setBurnSubtitles(e.target.checked)}
                  disabled={isExporting}
                />
                Burn Subtitles into Video
              </label>
            </div>
          )}
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

function getTotalDuration(clips: TimelineClip[]): number {
  if (clips.length === 0) return 0;
  return Math.max(...clips.map(clip => clip.startTime + clip.duration));
}

// Generate SRT file from subtitle tracks
async function generateSRTFile(
  subtitleTracks: Map<string, SubtitleTrack>,
  clips: TimelineClip[]
): Promise<string> {
  // Collect all subtitles from all tracks, sorted by time
  const allSubtitles: Array<{ startTime: number; endTime: number; text: string; clipId: string }> = [];
  
  subtitleTracks.forEach((track, clipId) => {
    if (track.enabled) {
      track.subtitles.forEach(sub => {
        allSubtitles.push({
          ...sub,
          clipId,
        });
      });
    }
  });
  
  // Sort by start time
  allSubtitles.sort((a, b) => a.startTime - b.startTime);
  
  // Generate SRT content
  let srtContent = '';
  allSubtitles.forEach((sub, index) => {
    srtContent += `${index + 1}\n`;
    srtContent += `${formatSRTTime(sub.startTime)} --> ${formatSRTTime(sub.endTime)}\n`;
    srtContent += `${sub.text}\n\n`;
  });
  
  // Write to temp file using Rust command (has proper permissions)
  const srtPath = await invoke<string>('write_srt_file', { srtContent });
  
  return srtPath;
}

// Format time in SRT format: HH:MM:SS,mmm
function formatSRTTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const milliseconds = Math.floor((seconds % 1) * 1000);
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${milliseconds.toString().padStart(3, '0')}`;
}
