import { useCallback, useEffect } from 'react';
import type { TimelineClip } from '../../types/timeline';
import { TimelineCanvas } from './TimelineCanvas';
import { useVideos } from '../../contexts/VideoContext';
import { useTimeline } from '../../contexts/TimelineContext';
import { formatTime } from '../../utils/format';
import './Timeline.css';

export function Timeline() {
  const { videos } = useVideos();
  const { timelineState, setTimelineState, splitClipAtPlayhead } = useTimeline();

  const handlePlayheadDrag = useCallback((position: number) => {
    setTimelineState(prev => {
      return { ...prev, playheadPosition: position };
    });
  }, [setTimelineState]);

  const handleVideoDropped = useCallback((videoId: string) => {
    const video = videos.find(v => v.id === videoId);
    if (!video) return;

    setTimelineState(prev => {
      const newClip: TimelineClip = {
        id: `clip-${Date.now()}`,
        videoFileId: video.id,
        startTime: prev.playheadPosition,
        duration: video.duration,
        trimStart: 0,
        trimEnd: video.duration,
        track: 0,
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
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSplitClip]);

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
        />
      </div>

      <div className="timeline-info">
        <p>Total Duration: {formatTime(getMaxTimelineTime(timelineState.clips))}</p>
        <p>Clips: {timelineState.clips.length}</p>
      </div>
    </div>
  );
}

function getMaxTimelineTime(clips: TimelineClip[]): number {
  if (clips.length === 0) return 0;
  return Math.max(...clips.map(clip => clip.startTime + clip.duration));
}