import { useEffect, useRef } from 'react';
import type { TimelineState } from '../../types/timeline';
import type { VideoFile } from '../../types/video';
import './TimelineCanvas.css';

interface TimelineCanvasProps {
  state: TimelineState;
  videos: VideoFile[];
  onPlayheadDrag: (position: number) => void;
  onVideoDropped: (videoId: string) => void;
  onClipSelect?: (clipId: string | null) => void;
  onClipTrim?: (clipId: string, trimStart: number, trimEnd: number) => void;
}

const PIXELS_PER_SECOND = 30;
const TRACK_HEIGHT = 60;

export function TimelineCanvas({ state, videos, onPlayheadDrag, onVideoDropped, onClipSelect, onClipTrim }: TimelineCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const lastDragUpdateRef = useRef<number>(0);
  const lastTrimUpdateRef = useRef<number>(0);
  const trimHandleRef = useRef<'left' | 'right' | null>(null);
  const trimmingClipRef = useRef<string | null>(null);
  const initialStateRef = useRef<{ clip: any; video: VideoFile } | null>(null);
  const mouseDownPosRef = useRef<{ x: number; y: number } | null>(null);
  const didMoveRef = useRef(false);

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

    // Draw time ruler
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 1;
    
    const timeInterval = getTimeInterval(state.zoom);
    const startTime = 0;
    
    for (let time = startTime; time <= maxDuration; time += timeInterval) {
      const x = time * PIXELS_PER_SECOND * state.zoom;
      
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 20);
      ctx.stroke();
      
      ctx.fillStyle = '#999';
      ctx.font = '12px sans-serif';
      ctx.fillText(formatTime(time), x + 4, 12);
      ctx.fillStyle = '#555';
    }

    // Draw clips
    state.clips.forEach(clip => {
      const video = videos.find(v => v.id === clip.videoFileId);
      if (!video) return;

      const clipX = clip.startTime * PIXELS_PER_SECOND * state.zoom;
      const clipWidth = clip.duration * PIXELS_PER_SECOND * state.zoom;
      const isSelected = state.selectedClipId === clip.id;

      // Check if there are trimmed portions
      const hasLeftTrim = clip.trimStart > 0;
      const hasRightTrim = clip.trimEnd < video.duration;

      // Draw trimmed regions (darker)
      if (hasLeftTrim) {
        const leftTrimWidth = clip.trimStart * PIXELS_PER_SECOND * state.zoom;
        ctx.fillStyle = isSelected ? '#2d5a9e' : '#2d2d2d';
        ctx.fillRect(clipX - leftTrimWidth, 5, leftTrimWidth, TRACK_HEIGHT - 10);
      }

      if (hasRightTrim) {
        const rightTrimStart = clipX + clipWidth;
        const rightTrimDuration = video.duration - clip.trimEnd;
        const rightTrimWidth = rightTrimDuration * PIXELS_PER_SECOND * state.zoom;
        ctx.fillStyle = isSelected ? '#2d5a9e' : '#2d2d2d';
        ctx.fillRect(rightTrimStart, 5, rightTrimWidth, TRACK_HEIGHT - 10);
      }

      // Draw active clip region
      ctx.fillStyle = isSelected ? '#4a9eff' : '#3a3a3a';
      ctx.fillRect(clipX, 5, clipWidth, TRACK_HEIGHT - 10);

      // Clip border
      ctx.strokeStyle = isSelected ? '#6bb5ff' : '#555';
      ctx.lineWidth = 2;
      
      const fullClipStartTime = clip.startTime - clip.trimStart;
      const fullX = fullClipStartTime * PIXELS_PER_SECOND * state.zoom;
      const fullWidth = video.duration * PIXELS_PER_SECOND * state.zoom;
      
      ctx.strokeRect(fullX, 5, fullWidth, TRACK_HEIGHT - 10);

      // Draw trim handles for selected clips
      if (isSelected) {
        const handleWidth = 10;
        const handleHeight = TRACK_HEIGHT - 10;
        
        // Left trim handle (at the start of visible clip)
        ctx.fillStyle = '#ffd700';
        ctx.fillRect(clipX - handleWidth/2, 5, handleWidth, handleHeight);
        
        // Right trim handle (at the end of visible clip)
        ctx.fillRect(clipX + clipWidth - handleWidth/2, 5, handleWidth, handleHeight);
        
        // Handle borders
        ctx.strokeStyle = '#ffed4e';
        ctx.lineWidth = 2;
        ctx.strokeRect(clipX - handleWidth/2, 5, handleWidth, handleHeight);
        ctx.strokeRect(clipX + clipWidth - handleWidth/2, 5, handleWidth, handleHeight);
      }

      // Clip label
      if (clipWidth > 40) {
        ctx.fillStyle = '#ddd';
        ctx.font = '11px sans-serif';
        const maxWidth = clipWidth - 10;
        const text = video.filename.length > maxWidth / 6 
          ? video.filename.substring(0, maxWidth / 6) + '...' 
          : video.filename;
        ctx.fillText(text, clipX + 8, 25);
        
        ctx.fillStyle = '#999';
        ctx.font = '9px sans-serif';
        ctx.fillText(formatTime(clip.duration), clipX + 8, 40);
      }
    });

    // Draw playhead
    if (state.clips.length > 0) {
      const playheadX = state.playheadPosition * PIXELS_PER_SECOND * state.zoom;
      ctx.strokeStyle = '#ff4a4a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, TRACK_HEIGHT);
      ctx.stroke();

      ctx.fillStyle = '#ff4a4a';
      ctx.beginPath();
      ctx.arc(playheadX, TRACK_HEIGHT / 2, 8, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }, [state, videos]);

  // Handle mouse interactions
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    e.preventDefault();
    
    // Track initial mouse position for detecting clicks vs drags
    mouseDownPosRef.current = { x: e.clientX, y: e.clientY };
    didMoveRef.current = false;
    
    const maxTime = state.clips.length > 0 
      ? Math.max(...state.clips.map(c => c.startTime + c.duration))
      : 10;
    
    const containerRect = container.getBoundingClientRect();
    const mouseXRelativeToContainer = e.clientX - containerRect.left;
    const totalCSSX = mouseXRelativeToContainer + container.scrollLeft;
    const scaleX = canvas.width / container.scrollWidth;
    const canvasX = totalCSSX * scaleX;
    const clickTime = canvasX / (PIXELS_PER_SECOND * state.zoom);
    
    // Check for trim handle clicks
    let clickedClip = null;
    let clickedHandle: 'left' | 'right' | null = null;
    
    for (const clip of state.clips) {
      const video = videos.find(v => v.id === clip.videoFileId);
      if (!video) continue;
      
      const clipStartTime = clip.startTime;
      const clipEndTime = clip.startTime + clip.duration;
      const handleToleranceInTime = 8 / (PIXELS_PER_SECOND * state.zoom);
      
      // Check left handle (at visible clip start)
      if (clickTime >= clipStartTime - handleToleranceInTime && 
          clickTime <= clipStartTime + handleToleranceInTime) {
        clickedClip = clip;
        clickedHandle = 'left';
        break;
      }
      
      // Check right handle (at visible clip end)
      if (clickTime >= clipEndTime - handleToleranceInTime && 
          clickTime <= clipEndTime + handleToleranceInTime) {
        clickedClip = clip;
        clickedHandle = 'right';
        break;
      }
      
      // Check clip body
      if (clickTime >= clipStartTime && clickTime <= clipEndTime) {
        clickedClip = clip;
      }
    }
    
    // Handle trim dragging
    if (clickedClip && clickedHandle && onClipTrim) {
      const video = videos.find(v => v.id === clickedClip.videoFileId);
      if (!video) return;
      
      const clipId = clickedClip.id;
      initialStateRef.current = { clip: clickedClip, video };
      trimHandleRef.current = clickedHandle;
      trimmingClipRef.current = clipId;
      isDraggingRef.current = true;
      
      const handleMove = (moveEvent: MouseEvent) => {
        if (!canvas || !container || !initialStateRef.current) return;
        
        // Track that mouse moved (for detecting click vs drag)
        if (mouseDownPosRef.current) {
          const dx = Math.abs(moveEvent.clientX - mouseDownPosRef.current.x);
          const dy = Math.abs(moveEvent.clientY - mouseDownPosRef.current.y);
          if (dx > 3 || dy > 3) { // Movement threshold
            didMoveRef.current = true;
          }
        }
        
        const now = Date.now();
        if (now - lastTrimUpdateRef.current < 16) return;
        lastTrimUpdateRef.current = now;
        
        const containerRect = container.getBoundingClientRect();
        let mouseXRelativeToContainer = moveEvent.clientX - containerRect.left;
        mouseXRelativeToContainer = Math.max(0, Math.min(mouseXRelativeToContainer, containerRect.width));
        
        const totalCSSX = mouseXRelativeToContainer + container.scrollLeft;
        const scaleX = canvas.width / container.scrollWidth;
        const canvasX = totalCSSX * scaleX;
        const mouseTime = canvasX / (PIXELS_PER_SECOND * state.zoom);
        
        const { video, clip: initialClip } = initialStateRef.current;
        
        // Calculate the full clip's fixed position
        const fullClipStartTime = initialClip.startTime - initialClip.trimStart;
        
        // Convert mouse time to position within the full video
        const timeInVideo = mouseTime - fullClipStartTime;
        
        if (clickedHandle === 'left') {
          // Dragging left handle: adjust trimStart
          // Get current trimEnd from state to prevent crossing
          const currentClip = state.clips.find(c => c.id === clipId);
          const currentTrimEnd = currentClip ? currentClip.trimEnd : initialClip.trimEnd;
          
          // Allow dragging all the way back to 0 (untrimming)
          const newTrimStart = Math.max(0, Math.min(timeInVideo, currentTrimEnd - 0.1));
          onClipTrim(clipId, newTrimStart, currentTrimEnd);
        } else {
          // Dragging right handle: adjust trimEnd
          // Get current trimStart from state to prevent crossing
          const currentClip = state.clips.find(c => c.id === clipId);
          const currentTrimStart = currentClip ? currentClip.trimStart : initialClip.trimStart;
          
          // Allow dragging all the way to video.duration (untrimming)
          const newTrimEnd = Math.max(currentTrimStart + 0.1, Math.min(timeInVideo, video.duration));
          onClipTrim(clipId, currentTrimStart, newTrimEnd);
        }
      };
      
      const handleUp = () => {
        // If no movement occurred, treat as a click and snap playhead to handle position
        if (!didMoveRef.current && clickedClip && clickedHandle) {
          const snapPosition = clickedHandle === 'left' 
            ? clickedClip.startTime 
            : clickedClip.startTime + clickedClip.duration;
          onPlayheadDrag(snapPosition);
        }
        
        trimHandleRef.current = null;
        trimmingClipRef.current = null;
        initialStateRef.current = null;
        isDraggingRef.current = false;
        mouseDownPosRef.current = null;
        didMoveRef.current = false;
        document.removeEventListener('mousemove', handleMove);
        document.removeEventListener('mouseup', handleUp);
      };
      
      document.addEventListener('mousemove', handleMove, { passive: false });
      document.addEventListener('mouseup', handleUp);
      return;
    }
    
    // Handle clip selection
    if (clickedClip && onClipSelect) {
      onClipSelect(clickedClip.id);
    } else if (onClipSelect) {
      onClipSelect(null);
    }
    
    // Handle playhead dragging
    const clampedTime = Math.max(0, Math.min(clickTime, maxTime));
    onPlayheadDrag(clampedTime);
    isDraggingRef.current = true;
    
    const handleMove = (moveEvent: MouseEvent) => {
      if (!canvas || !container || !isDraggingRef.current) return;
      
      const now = Date.now();
      if (now - lastDragUpdateRef.current < 33) return;
      lastDragUpdateRef.current = now;
      
      const containerRect = container.getBoundingClientRect();
      let mouseXRelativeToContainer = moveEvent.clientX - containerRect.left;
      mouseXRelativeToContainer = Math.max(0, Math.min(mouseXRelativeToContainer, containerRect.width));
      
      const totalCSSX = mouseXRelativeToContainer + container.scrollLeft;
      const scaleX = canvas.width / container.scrollWidth;
      const canvasX = totalCSSX * scaleX;
      const newTime = canvasX / (PIXELS_PER_SECOND * state.zoom);
      const clampedTime = Math.max(0, Math.min(newTime, maxTime));
      
      onPlayheadDrag(clampedTime);
    };
    
    const handleUp = () => {
      isDraggingRef.current = false;
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };
    
    document.addEventListener('mousemove', handleMove, { passive: false });
    document.addEventListener('mouseup', handleUp);
  };

  // Handle drag and drop
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
    <div ref={containerRef} style={{ overflowX: 'auto', overflowY: 'hidden', width: '100%', height: TRACK_HEIGHT + 'px' }}>
      <canvas
        ref={canvasRef}
        width={canvasWidth}
        height={TRACK_HEIGHT}
        className="timeline-canvas"
        onMouseDown={handleMouseDown}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        style={{ display: 'block', width: canvasWidth + 'px', height: TRACK_HEIGHT + 'px', minWidth: '100%' }}
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
  if (zoom >= 4) return 1;
  if (zoom >= 2) return 5;
  if (zoom >= 1) return 10;
  return 30;
}