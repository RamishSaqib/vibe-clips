import { convertFileSrc } from '@tauri-apps/api/core';
import type { VideoFile } from '../../types/video';
import './MediaLibrary.css';

interface MediaLibraryProps {
  videos: VideoFile[];
  onSelect?: (video: VideoFile) => void;
}

export function MediaLibrary({ videos, onSelect }: MediaLibraryProps) {
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="media-library">
      <h2 className="media-library-title">
        Media Library ({videos.length})
      </h2>
      
      {videos.length === 0 ? (
        <div className="media-library-empty">
          <p>No videos imported yet</p>
        </div>
      ) : (
        <div className="media-library-list">
          {videos.map(video => (
            <div 
              key={video.id} 
              className="media-library-item"
              onClick={() => onSelect?.(video)}
              draggable={true}
              onDragStart={(e) => {
                e.dataTransfer.setData('video-id', video.id);
                e.dataTransfer.effectAllowed = 'move';
              }}
            >
              <div className="media-thumbnail">
                {video.thumbnail ? (
                  <img 
                    src={convertFileSrc(video.thumbnail)} 
                    alt={video.filename}
                  />
                ) : (
                  <video 
                    src={convertFileSrc(video.path)} 
                    muted
                    preload="metadata"
                  />
                )}
              </div>
              <div className="media-info">
                <div className="media-filename" title={video.filename}>
                  {video.filename}
                </div>
                <div className="media-metadata">
                  <span>{formatDuration(video.duration)}</span>
                  <span>•</span>
                  <span>{video.resolution.width}×{video.resolution.height}</span>
                  <span>•</span>
                  <span>{formatSize(video.size)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

