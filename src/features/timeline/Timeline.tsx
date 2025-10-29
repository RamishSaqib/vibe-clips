import { useCallback, useEffect, useState } from 'react';
import type { TimelineClip } from '../../types/timeline';
import { TimelineCanvas } from './TimelineCanvas';
import { useVideos } from '../../contexts/VideoContext';
import { useTimeline } from '../../contexts/TimelineContext';
import { formatTime } from '../../utils/format';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import './Timeline.css';

export function Timeline() {
  const { videos } = useVideos();
  const { timelineState, setTimelineState, splitClipAtPlayhead, deleteClip, setOverlayPosition } = useTimeline();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [clipToDelete, setClipToDelete] = useState<string | null>(null);

  const handlePlayheadDrag = useCallback((position: number) => {
    setTimelineState(prev => {
      return { ...prev, playheadPosition: position };
    });
  }, [setTimelineState]);

  const handleVideoDropped = useCallback((videoId: string, track?: number) => {
    const video = videos.find(v => v.id === videoId);
    if (!video) return;

    setTimelineState(prev => {
      const targetTrack = track !== undefined ? track : 0; // Default to track 0 if not specified
      const newClip: TimelineClip = {
        id: `clip-${Date.now()}`,
        videoFileId: video.id,
        startTime: prev.playheadPosition,
        duration: video.duration,
        trimStart: 0,
        trimEnd: video.duration,
        track: targetTrack,
      };
      
      return {
        ...prev,
        clips: [...prev.clips, newClip],
      };
    });
  }, [videos, setTimelineState]);

  const handleClipSelect = useCallback((clipId: string | null) => {
    setTimelineState(prev => ({
      ...prev,
      selectedClipId: clipId,
    }));
  }, [setTimelineState]);

  const handleClipTrim = useCallback((clipId: string, trimStart: number, trimEnd: number) => {
    setTimelineState(prev => {
      const updatedClips = prev.clips.map(clip => {
        if (clip.id === clipId) {
          const originalVideo = videos.find(v => v.id === clip.videoFileId);
          if (!originalVideo) return clip;
          
          // Ensure valid trim values
          const newTrimStart = Math.max(0, Math.min(trimStart, originalVideo.duration));
          const newTrimEnd = Math.max(newTrimStart + 0.1, Math.min(trimEnd, originalVideo.duration));
          
          // Calculate new duration (visible portion)
          const newDuration = newTrimEnd - newTrimStart;
          
          // IMPORTANT: Keep the full clip position fixed
          // The full clip always starts at: startTime - trimStart
          // This position should NEVER change during trimming
          const fullClipStartTime = clip.startTime - clip.trimStart;
          
          // The visible clip starts at: fullClipStartTime + newTrimStart
          const newStartTime = fullClipStartTime + newTrimStart;
          
          console.log('Trimming:', {
            clipId,
            oldTrimStart: clip.trimStart,
            newTrimStart,
            oldTrimEnd: clip.trimEnd,
            newTrimEnd,
            fullClipStartTime,
            oldStartTime: clip.startTime,
            newStartTime
          });
          
          return {
            ...clip,
            startTime: newStartTime,
            trimStart: newTrimStart,
            trimEnd: newTrimEnd,
            duration: newDuration,
          };
        }
        return clip;
      });
      
      return {
        ...prev,
        clips: updatedClips,
      };
    });
  }, [videos, setTimelineState]);

  const handleClipTrackChange = useCallback((clipId: string, newTrack: number) => {
    setTimelineState(prev => {
      const updatedClips = prev.clips.map(clip => {
        if (clip.id === clipId) {
          return { ...clip, track: newTrack };
        }
        return clip;
      });
      return { ...prev, clips: updatedClips };
    });
  }, [setTimelineState]);

  const handleClipMove = useCallback((clipId: string, newStartTime: number) => {
    setTimelineState(prev => {
      const updatedClips = prev.clips.map(clip => {
        if (clip.id === clipId) {
          return { ...clip, startTime: newStartTime };
        }
        return clip;
      });
      return { ...prev, clips: updatedClips };
    });
  }, [setTimelineState]);

  const handleTrackToggle = useCallback((trackIndex: number, type: 'mute' | 'solo') => {
    setTimelineState(prev => {
      const updatedTracks = prev.tracks.map((track, idx) => {
        if (idx === trackIndex) {
          if (type === 'solo') {
            return { ...track, solo: !track.solo };
          } else {
            return { ...track, muted: !track.muted };
          }
        } else if (type === 'solo' && prev.tracks[trackIndex]?.solo) {
          return { ...track, solo: false };
        }
        return track;
      });
      
      // If enabling solo, disable solo on all other tracks
      if (type === 'solo' && !prev.tracks[trackIndex].solo) {
        updatedTracks.forEach((track, idx) => {
          if (idx !== trackIndex) {
            track.solo = false;
          }
        });
      }
      
      return { ...prev, tracks: updatedTracks };
    });
  }, [setTimelineState]);

  // Handle split clip
  const handleSplitClip = useCallback(() => {
    const { playheadPosition, selectedClipId, clips } = timelineState;
    
    if (!selectedClipId) {
      console.warn('No clip selected');
      return;
    }

    // Find the clip at playhead position
    const clipAtPlayhead = clips.find(clip => 
      playheadPosition >= clip.startTime && 
      playheadPosition < clip.startTime + clip.duration
    );

    if (!clipAtPlayhead || clipAtPlayhead.id !== selectedClipId) {
      console.warn('Playhead is not over the selected clip');
      return;
    }

    splitClipAtPlayhead(selectedClipId, playheadPosition);
  }, [timelineState, splitClipAtPlayhead]);

  // Handle delete clip
  const handleDeleteClip = useCallback(() => {
    if (!timelineState.selectedClipId) {
      console.warn('No clip selected to delete');
      return;
    }
    
    // Show confirmation dialog
    setClipToDelete(timelineState.selectedClipId);
    setShowDeleteConfirm(true);
  }, [timelineState.selectedClipId]);

  const confirmDeleteClip = useCallback(() => {
    if (clipToDelete) {
      deleteClip(clipToDelete);
    }
    setShowDeleteConfirm(false);
    setClipToDelete(null);
  }, [clipToDelete, deleteClip]);

  const cancelDeleteClip = useCallback(() => {
    setShowDeleteConfirm(false);
    setClipToDelete(null);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if not typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        handleSplitClip();
      }

      // Delete or Backspace to delete selected clip
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        handleDeleteClip();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSplitClip, handleDeleteClip]);

  return (
    <div className="timeline-container">
      <div className="timeline-header">
        <h2>Timeline</h2>
        <div className="timeline-controls">
          <button onClick={() => setTimelineState(prev => ({ ...prev, zoom: prev.zoom * 1.5 }))}>
            Zoom In
          </button>
          <button onClick={() => setTimelineState(prev => ({ ...prev, zoom: Math.max(0.5, prev.zoom / 1.5) }))}>
            Zoom Out
          </button>
          <span>Zoom: {timelineState.zoom.toFixed(1)}x</span>
          <button 
            onClick={() => setTimelineState(prev => ({ ...prev, snapEnabled: !prev.snapEnabled }))}
            className={timelineState.snapEnabled ? 'snap-button active' : 'snap-button'}
            title={timelineState.snapEnabled ? 'Snap enabled' : 'Snap disabled'}
          >
            🧲 {timelineState.snapEnabled ? 'Snap On' : 'Snap Off'}
          </button>
          <button 
            onClick={handleSplitClip}
            disabled={!timelineState.selectedClipId || !timelineState.clips.find(c => 
              c.id === timelineState.selectedClipId &&
              timelineState.playheadPosition >= c.startTime && 
              timelineState.playheadPosition < c.startTime + c.duration
            )}
            title="Split clip at playhead (S)"
          >
            ✂️ Split
          </button>
          <button 
            onClick={handleDeleteClip}
            disabled={!timelineState.selectedClipId}
            title="Delete selected clip (Delete/Backspace)"
            className="delete-button"
          >
            🗑️ Delete
          </button>
        </div>
      </div>
      
      <div className="timeline-content">
      <TimelineCanvas 
        state={timelineState}
        videos={videos}
        onPlayheadDrag={handlePlayheadDrag}
        onVideoDropped={handleVideoDropped}
        onClipSelect={handleClipSelect}
        onClipTrim={handleClipTrim}
        onClipTrackChange={handleClipTrackChange}
        onTrackToggle={handleTrackToggle}
        onOverlayPositionChange={setOverlayPosition}
        onClipMove={handleClipMove}
      />
      </div>

      <div className="timeline-info">
        <p>Total Duration: {formatTime(getMaxTimelineTime(timelineState.clips))}</p>
        <p>Clips: {timelineState.clips.length}</p>
      </div>

      <ConfirmDialog 
        isOpen={showDeleteConfirm}
        title="Delete Clip"
        message="Are you sure you want to delete this clip from the timeline? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        isDangerous={true}
        onConfirm={confirmDeleteClip}
        onCancel={cancelDeleteClip}
      />
    </div>
  );
}

function getMaxTimelineTime(clips: TimelineClip[]): number {
  if (clips.length === 0) return 0;
  return Math.max(...clips.map(clip => clip.startTime + clip.duration));
}