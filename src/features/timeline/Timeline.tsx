import { useCallback } from 'react';
import type { TimelineClip } from '../../types/timeline';
import { TimelineCanvas } from './TimelineCanvas';
import { useVideos } from '../../contexts/VideoContext';
import { useTimeline } from '../../contexts/TimelineContext';
import './Timeline.css';

export function Timeline() {
  const { videos } = useVideos();
  const { timelineState, setTimelineState } = useTimeline();

  const handlePlayheadDrag = useCallback((position: number) => {
    setTimelineState(prev => {
      // Only update if value actually changed (threshold of 0.001 seconds)
      if (Math.abs(prev.playheadPosition - position) < 0.001) {
        return prev;
      }
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
        </div>
      </div>
      
      <div className="timeline-content">
        <TimelineCanvas 
          state={timelineState}
          videos={videos}
          onPlayheadDrag={handlePlayheadDrag}
          onVideoDropped={handleVideoDropped}
        />
      </div>

      <div className="timeline-info">
        <p>Total Duration: {getMaxTimelineTime(timelineState.clips)}</p>
        <p>Clips: {timelineState.clips.length}</p>
      </div>
    </div>
  );
}

function getMaxTimelineTime(clips: TimelineClip[]): string {
  if (clips.length === 0) return '0:00';
  
  const maxTime = Math.max(...clips.map(clip => clip.startTime + clip.duration));
  const mins = Math.floor(maxTime / 60);
  const secs = Math.floor(maxTime % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

