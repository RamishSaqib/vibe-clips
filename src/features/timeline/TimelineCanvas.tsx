import { useEffect, useRef, useState } from 'react';
import type { TimelineState } from '../../types/timeline';
import type { VideoFile } from '../../types/video';
import './TimelineCanvas.css';

interface TimelineCanvasProps {
  state: TimelineState;
  videos: VideoFile[];
  onPlayheadDrag: (position: number) => void;
  onVideoDropped: (videoId: string) => void;
}

const PIXELS_PER_SECOND = 30; // Reduced from 100 to show more content without scrolling
const TRACK_HEIGHT = 60;

export function TimelineCanvas({ state, videos, onPlayheadDrag, onVideoDropped }: TimelineCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);

  // Draw the timeline
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Calculate canvas width based on content
    const maxDuration = Math.max(...state.clips.map(c => c.startTime + c.duration), 10);
    const canvasWidth = Math.max(maxDuration * PIXELS_PER_SECOND * state.zoom, 800);
    canvas.width = canvasWidth;
    
    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw background
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, width, height);

    // Draw timeline track background
    ctx.fillStyle = '#252525';
    ctx.fillRect(0, 0, width, TRACK_HEIGHT);

    // Draw time ruler (on bottom layer)
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 1;
    
    const timeInterval = getTimeInterval(state.zoom);
    const startTime = 0;
    
    for (let time = startTime; time <= maxDuration; time += timeInterval) {
      const x = time * PIXELS_PER_SECOND * state.zoom;
      
      // Draw tick mark
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 20);
      ctx.stroke();
      
      // Draw time label
      ctx.fillStyle = '#999';
      ctx.font = '12px sans-serif';
      ctx.fillText(formatTime(time), x + 4, 12);
      ctx.fillStyle = '#555';
    }

    // Draw clips (on top of time markers)
    state.clips.forEach(clip => {
      const video = videos.find(v => v.id === clip.videoFileId);
      if (!video) return;

      const clipX = clip.startTime * PIXELS_PER_SECOND * state.zoom;
      const clipWidth = clip.duration * PIXELS_PER_SECOND * state.zoom;

      // Clip background
      ctx.fillStyle = state.selectedClipId === clip.id ? '#4a9eff' : '#3a3a3a';
      ctx.fillRect(clipX, 5, clipWidth, TRACK_HEIGHT - 10);

      // Clip border
      ctx.strokeStyle = state.selectedClipId === clip.id ? '#6bb5ff' : '#555';
      ctx.lineWidth = 2;
      ctx.strokeRect(clipX, 5, clipWidth, TRACK_HEIGHT - 10);

      // Clip label
      ctx.fillStyle = '#ddd';
      ctx.font = '11px sans-serif';
      const maxWidth = Math.max(clipWidth - 10, 50);
      const text = video.filename.length > maxWidth / 6 
        ? video.filename.substring(0, maxWidth / 6) + '...' 
        : video.filename;
      ctx.fillText(text, clipX + 8, 25);
      
      // Clip duration
      ctx.fillStyle = '#999';
      ctx.font = '9px sans-serif';
      ctx.fillText(formatTime(clip.duration), clipX + 8, 40);
    });

    // Only draw playhead if there are clips on the timeline
    if (state.clips.length > 0) {
      // Draw playhead
      const playheadX = state.playheadPosition * PIXELS_PER_SECOND * state.zoom;
      ctx.strokeStyle = '#ff4a4a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, TRACK_HEIGHT);
      ctx.stroke();

      // Draw playhead handle (red circle)
      ctx.fillStyle = '#ff4a4a';
      ctx.beginPath();
      ctx.arc(playheadX, TRACK_HEIGHT / 2, 8, 0, Math.PI * 2);
      ctx.fill();
      
      // Draw handle border for visibility
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }, [state, videos]);

  // Handle mouse interactions
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    e.preventDefault();
    
    // Get scroll position and mouse position relative to the container
    const scrollX = containerRef.current?.scrollLeft || 0;
    const rect = canvas.getBoundingClientRect();
    
    // Calculate the actual position in canvas coordinates (accounting for scroll)
    const clickX = (e.clientX - rect.left) + scrollX;
    const newTime = clickX / (PIXELS_PER_SECOND * state.zoom);
    
    // Update playhead immediately
    onPlayheadDrag(Math.max(0, newTime));
    
    // Start dragging
    isDraggingRef.current = true;
    
    // Add global listeners for drag
    const handleMove = (moveEvent: MouseEvent) => {
      if (!canvas || !isDraggingRef.current) return;
      
      // Get scroll position and mouse position relative to the container
      const scrollX = containerRef.current?.scrollLeft || 0;
      const rect = canvas.getBoundingClientRect();
      
      // Calculate the actual position in canvas coordinates (accounting for scroll)
      const mouseX = (moveEvent.clientX - rect.left) + scrollX;
      const newTime = mouseX / (PIXELS_PER_SECOND * state.zoom);
      
      // Always update during drag to follow cursor
      onPlayheadDrag(Math.max(0, newTime));
    };
    
    const handleUp = () => {
      isDraggingRef.current = false;
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };
    
    document.addEventListener('mousemove', handleMove, { passive: false });
    document.addEventListener('mouseup', handleUp);
  };


  // Handle drag and drop from media library
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const videoId = e.dataTransfer.getData('video-id');
    if (videoId) {
      onVideoDropped(videoId);
    }
  };

  const maxDuration = Math.max(...state.clips.map(c => c.startTime + c.duration), 10);
  const canvasWidth = Math.max(maxDuration * PIXELS_PER_SECOND * state.zoom, 1200);

  return (
    <div ref={containerRef} style={{ overflowX: 'auto', width: '100%' }}>
      <canvas
        ref={canvasRef}
        width={canvasWidth}
        height={TRACK_HEIGHT}
        className="timeline-canvas"
        onMouseDown={handleMouseDown}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        style={{ display: 'block', width: canvasWidth + 'px', height: TRACK_HEIGHT + 'px' }}
      />
    </div>
  );
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function getTimeInterval(zoom: number): number {
  if (zoom >= 4) return 1; // 1 second
  if (zoom >= 2) return 5; // 5 seconds
  if (zoom >= 1) return 10; // 10 seconds
  return 30; // 30 seconds
}

