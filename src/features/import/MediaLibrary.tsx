import { useState } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import type { VideoFile } from '../../types/video';
import { useVideos } from '../../contexts/VideoContext';
import { useTimeline } from '../../contexts/TimelineContext';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { formatTime, formatFileSize } from '../../utils/format';
import './MediaLibrary.css';

interface MediaLibraryProps {
  videos: VideoFile[];
  onSelect?: (video: VideoFile) => void;
}

export function MediaLibrary({ videos, onSelect }: MediaLibraryProps) {
  const { removeVideo } = useVideos();
  const { removeClipsByVideoId } = useTimeline();
  const [deleteConfirm, setDeleteConfirm] = useState<{ videoId: string; videoName: string } | null>(null);

  const handleDeleteClick = (e: React.MouseEvent, video: VideoFile) => {
    e.stopPropagation();
    setDeleteConfirm({ videoId: video.id, videoName: video.filename });
  };

  const handleConfirmDelete = () => {
    if (deleteConfirm) {
      removeClipsByVideoId(deleteConfirm.videoId);
      removeVideo(deleteConfirm.videoId);
      setDeleteConfirm(null);
    }
  };

  const handleCancelDelete = () => {
    setDeleteConfirm(null);
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
                    src={video.thumbnail.startsWith('data:') ? video.thumbnail : convertFileSrc(video.thumbnail)}
                    alt={video.filename}
                    onError={(e) => console.error('Thumbnail load error:', video.filename)}
                  />
                ) : (
                  <video 
                    src={video.path.startsWith('data:') ? video.path : convertFileSrc(video.path)}
                    muted
                    preload="metadata"
                    onError={(e) => console.error('Video preview load error:', video.filename)}
                  />
                )}
              </div>
              <div className="media-info">
                <div className="media-filename" title={video.filename}>
                  {video.filename}
                </div>
                <div className="media-metadata">
                  <span>{formatTime(video.duration)}</span>
                  <span>•</span>
                  <span>{video.resolution.width}×{video.resolution.height}</span>
                  <span>•</span>
                  <span>{formatFileSize(video.size)}</span>
                </div>
              </div>
              <button 
                className="media-delete-button"
                onClick={(e) => handleDeleteClick(e, video)}
                title="Delete video"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      
      <ConfirmDialog
        isOpen={deleteConfirm !== null}
        title="Delete Video"
        message={`Are you sure you want to delete "${deleteConfirm?.videoName}"? This will also remove all clips using this video from the timeline.`}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
        confirmText="Delete"
        cancelText="Cancel"
        isDangerous={true}
      />
    </div>
  );
}

