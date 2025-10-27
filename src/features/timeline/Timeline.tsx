import { useState, useCallback } from 'react';
import type { TimelineState, TimelineClip } from '../../types/timeline';
import { TimelineCanvas } from './TimelineCanvas';
import { useVideos } from '../../contexts/VideoContext';
import './Timeline.css';

export function Timeline() {
  const { videos } = useVideos();
  const [timelineState, setTimelineState] = useState<TimelineState>({
    clips: [],
    playheadPosition: 0,
    zoom: 1,
    scrollOffset: 0,
    selectedClipId: null,
  });

  const handlePlayheadDrag = useCallback((position: number) => {
    setTimelineState(prev => ({ ...prev, playheadPosition: position }));
  }, []);

  const handleVideoDropped = useCallback((videoId: string) => {
    const video = videos.find(v => v.id === videoId);
    if (!video) return;

    const newClip: TimelineClip = {
      id: `clip-${Date.now()}`,
      videoFileId: video.id,
      startTime: timelineState.playheadPosition,
      duration: video.duration,
      trimStart: 0,
      trimEnd: video.duration,
      track: 0,
    };
    
    setTimelineState(prev => ({
      ...prev,
      clips: [...prev.clips, newClip],
    }));
  }, [videos, timelineState.playheadPosition]);

  const handleDragFromLibrary = useCallback((video: VideoFile) => {
    const newClip: TimelineClip = {
      id: `clip-${Date.now()}`,
      videoFileId: video.id,
      startTime: timelineState.playheadPosition,
      duration: video.duration,
      trimStart: 0,
      trimEnd: video.duration,
      track: 0,
    };
    
    setTimelineState(prev => ({
      ...prev,
      clips: [...prev.clips, newClip],
    }));
  }, [timelineState.playheadPosition]);

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

