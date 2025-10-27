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

const PIXELS_PER_SECOND = 100;
const TRACK_HEIGHT = 60;

export function TimelineCanvas({ state, videos, onPlayheadDrag, onVideoDropped }: TimelineCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);

  // Draw the timeline
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

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

    // Draw time ruler
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 1;
    
    const timeInterval = getTimeInterval(state.zoom);
    const startTime = Math.floor(state.scrollOffset / (PIXELS_PER_SECOND * state.zoom));
    
    for (let time = startTime; time <= startTime + (width / (PIXELS_PER_SECOND * state.zoom)); time += timeInterval) {
      const x = (time - state.scrollOffset / (PIXELS_PER_SECOND * state.zoom)) * PIXELS_PER_SECOND * state.zoom;
      
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

    // Draw clips
    state.clips.forEach(clip => {
      const video = videos.find(v => v.id === clip.videoFileId);
      if (!video) return;

      const clipX = clip.startTime * PIXELS_PER_SECOND * state.zoom - state.scrollOffset;
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

    // Draw playhead
    const playheadX = state.playheadPosition * PIXELS_PER_SECOND * state.zoom - state.scrollOffset;
    ctx.strokeStyle = '#ff4a4a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(playheadX, 0);
    ctx.lineTo(playheadX, TRACK_HEIGHT);
    ctx.stroke();

    // Draw playhead handle
    ctx.fillStyle = '#ff4a4a';
    ctx.beginPath();
    ctx.arc(playheadX, TRACK_HEIGHT - 5, 5, 0, Math.PI * 2);
    ctx.fill();
  }, [state, videos]);

  // Handle mouse interactions
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    console.log('Click at:', clickX);
    
    // Always start dragging
    setIsDraggingPlayhead(true);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    // Update playhead immediately
    const scrollX = containerRef.current?.scrollLeft || 0;
    const totalX = clickX + scrollX;
    const newTime = totalX / (PIXELS_PER_SECOND * state.zoom);
    console.log('Setting time to:', newTime, 'from clickX:', clickX, 'scrollX:', scrollX);
    onPlayheadDrag(Math.max(0, newTime));
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDraggingPlayhead) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const scrollX = containerRef.current?.scrollLeft || 0;
    const totalX = mouseX + scrollX;
    const newTime = totalX / (PIXELS_PER_SECOND * state.zoom);
    
    onPlayheadDrag(Math.max(0, newTime));
  };

  const handleMouseUp = () => {
    setIsDraggingPlayhead(false);
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
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

  return (
    <div ref={containerRef} style={{ overflowX: 'auto' }}>
      <canvas
        ref={canvasRef}
        width={800}
        height={TRACK_HEIGHT}
        className="timeline-canvas"
        onMouseDown={handleMouseDown}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
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

