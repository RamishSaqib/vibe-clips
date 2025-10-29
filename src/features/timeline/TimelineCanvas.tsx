import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import type { TimelineState, OverlayPosition } from '../../types/timeline';
import type { VideoFile } from '../../types/video';
import { formatTime } from '../../utils/format';
import { TIMELINE_CONSTANTS, DRAG_THRESHOLD, TRIM_THROTTLE_MS, DRAG_THROTTLE_MS } from '../../utils/constants';
import './TimelineCanvas.css';

interface TimelineCanvasProps {
  state: TimelineState;
  videos: VideoFile[];
  onPlayheadDrag: (position: number) => void;
  onVideoDropped: (videoId: string, track?: number) => void;
  onClipSelect?: (clipId: string | null) => void;
  onClipTrim?: (clipId: string, trimStart: number, trimEnd: number) => void;
  onClipTrackChange?: (clipId: string, track: number) => void;
  onTrackToggle?: (trackIndex: number, type: 'mute' | 'solo') => void;
  onOverlayPositionChange?: (trackIndex: number, position: OverlayPosition) => void;
  onClipMove?: (clipId: string, newStartTime: number) => void;
}

const {
  PIXELS_PER_SECOND,
  RULER_HEIGHT,
  TRACK_HEIGHT,
  TRACK_HEADER_WIDTH,
  NUM_TRACKS,
  HANDLE_WIDTH,
  HANDLE_TOLERANCE,
  MIN_CLIP_DURATION,
  SNAP_THRESHOLD,
  TRACK_DRAG_THRESHOLD,
} = TIMELINE_CONSTANTS;

const TOTAL_HEIGHT = RULER_HEIGHT + (TRACK_HEIGHT * NUM_TRACKS);
const TRACK_LABELS = ['Main Video', 'Overlay 1', 'Overlay 2'];

export function TimelineCanvas({ state, videos, onPlayheadDrag, onVideoDropped, onClipSelect, onClipTrim, onClipTrackChange, onTrackToggle, onOverlayPositionChange, onClipMove }: TimelineCanvasProps) {
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
  const [hoveredHandle, setHoveredHandle] = useState<{ clipId: string; handle: 'left' | 'right' } | null>(null);
  const [snapIndicator, setSnapIndicator] = useState<number | null>(null); // Position in seconds where snap is occurring
  const draggingClipRef = useRef<{ clipId: string; initialTrack: number } | null>(null);
  const movingClipRef = useRef<{ clipId: string; initialStartTime: number; clickOffset: number } | null>(null);
  
  // Helper function to get track number from Y coordinate
  const getTrackFromY = useCallback((y: number): number | null => {
    if (y < RULER_HEIGHT) return null; // In ruler area
    const trackY = y - RULER_HEIGHT;
    const trackIndex = Math.floor(trackY / TRACK_HEIGHT);
    if (trackIndex >= 0 && trackIndex < NUM_TRACKS) {
      return trackIndex;
    }
    return null;
  }, []);

  // Helper function to find nearest snap point
  const findSnapPoint = useCallback((time: number, snapEnabled: boolean): { time: number; snapped: boolean } => {
    if (!snapEnabled) {
      return { time, snapped: false };
    }

    // Collect all clip edges (start and end times)
    const clipEdges: number[] = [];
    for (const clip of state.clips) {
      clipEdges.push(clip.startTime); // Clip start
      clipEdges.push(clip.startTime + clip.duration); // Clip end
    }
    clipEdges.push(0); // Timeline start

    // Find the nearest edge within snap threshold
    let nearestEdge: number | null = null;
    let minDistance: number = SNAP_THRESHOLD;

    for (const edge of clipEdges) {
      const distance = Math.abs(time - edge);
      if (distance < minDistance) {
        minDistance = distance;
        nearestEdge = edge;
      }
    }

    if (nearestEdge !== null) {
      return { time: nearestEdge, snapped: true };
    }

    return { time, snapped: false };
  }, [state.clips]);

  // Memoize maxDuration to avoid recalculation on every render
  const maxDuration = useMemo(() => {
    return Math.max(...state.clips.map(c => c.startTime + c.duration), 10);
  }, [state.clips]);

  // Memoize canvas width to avoid recalculation
  const canvasWidth = useMemo(() => {
    return Math.max(maxDuration * PIXELS_PER_SECOND * state.zoom, 800);
  }, [maxDuration, state.zoom]);

  // Draw the timeline
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Calculate canvas width based on content
    canvas.width = canvasWidth;
    
    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw background
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, width, height);

    // Draw ruler background (separate section)
    ctx.fillStyle = '#0f0f0f';
    ctx.fillRect(0, 0, width, RULER_HEIGHT);
    
    // Draw ruler bottom border
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, RULER_HEIGHT);
    ctx.lineTo(width, RULER_HEIGHT);
    ctx.stroke();

    // Draw track headers on left side
    for (let trackIndex = 0; trackIndex < NUM_TRACKS; trackIndex++) {
      const trackY = RULER_HEIGHT + (trackIndex * TRACK_HEIGHT);
      const trackState = state.tracks[trackIndex] || { muted: false, solo: false };
      
      // Track header background
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(0, trackY, TRACK_HEADER_WIDTH, TRACK_HEIGHT);
      
      // Track header border
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 1;
      ctx.strokeRect(0, trackY, TRACK_HEADER_WIDTH, TRACK_HEIGHT);
      
      // Track label
      ctx.fillStyle = trackState.muted ? '#666' : '#ddd';
      ctx.font = '12px sans-serif';
      ctx.textBaseline = 'middle';
      ctx.fillText(TRACK_LABELS[trackIndex], 8, trackY + TRACK_HEIGHT / 2);
      
      // Mute/Solo indicators
      if (trackState.muted) {
        ctx.fillStyle = '#ff6666';
        ctx.font = '10px sans-serif';
        ctx.fillText('M', TRACK_HEADER_WIDTH - 30, trackY + 15);
      }
      if (trackState.solo) {
        ctx.fillStyle = '#66ff66';
        ctx.font = '10px sans-serif';
        ctx.fillText('S', TRACK_HEADER_WIDTH - 15, trackY + 15);
      }
    }
    
    // Draw timeline track backgrounds
    for (let trackIndex = 0; trackIndex < NUM_TRACKS; trackIndex++) {
      const trackY = RULER_HEIGHT + (trackIndex * TRACK_HEIGHT);
      const trackState = state.tracks[trackIndex] || { muted: false, solo: false };
      
      // Track background (darker if muted)
      ctx.fillStyle = trackState.muted ? '#1a1a1a' : '#252525';
      ctx.fillRect(TRACK_HEADER_WIDTH, trackY, width - TRACK_HEADER_WIDTH, TRACK_HEIGHT);
      
      // Track border
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 1;
      ctx.strokeRect(TRACK_HEADER_WIDTH, trackY, width - TRACK_HEADER_WIDTH, TRACK_HEIGHT);
    }

    // Draw time ruler markers and labels (accounting for track header width)
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 1;
    
    const timeInterval = getTimeInterval(state.zoom);
    const startTime = 0;
    
    for (let time = startTime; time <= maxDuration; time += timeInterval) {
      const x = time * PIXELS_PER_SECOND * state.zoom + TRACK_HEADER_WIDTH;
      
      // Draw tick marks in ruler section
      ctx.beginPath();
      ctx.moveTo(x, RULER_HEIGHT - 12);
      ctx.lineTo(x, RULER_HEIGHT);
      ctx.stroke();
      
      // Draw time labels in ruler section (higher up)
      ctx.fillStyle = '#999';
      ctx.font = '11px sans-serif';
      ctx.textBaseline = 'top';
      ctx.fillText(formatTime(time), x + 4, 4);
      ctx.fillStyle = '#555';
    }

    // Draw clips (grouped by track)
    for (let trackIndex = 0; trackIndex < NUM_TRACKS; trackIndex++) {
      const trackClips = state.clips.filter(c => c.track === trackIndex);
      const trackY = RULER_HEIGHT + (trackIndex * TRACK_HEIGHT);
      
      trackClips.forEach(clip => {
        const video = videos.find(v => v.id === clip.videoFileId);
        if (!video) return;

        const clipX = clip.startTime * PIXELS_PER_SECOND * state.zoom + TRACK_HEADER_WIDTH;
        const clipWidth = clip.duration * PIXELS_PER_SECOND * state.zoom;
        const isSelected = state.selectedClipId === clip.id;
        const clipY = trackY + 5;
        const clipHeight = TRACK_HEIGHT - 10;

      // Check if there are trimmed portions
      const hasLeftTrim = clip.trimStart > 0;
      const hasRightTrim = clip.trimEnd < video.duration;
      
      // For split clips, NEVER show the hatching pattern
      const fullClipStartTime = clip.startTime - clip.trimStart;
      
      // Don't show hatching - always show clips as independent entities
      const showAsFullClip = false;
      const canExtendLeft = false;
      const canExtendRight = false;

      // Draw trimmed regions with hatching pattern for better distinction
      if (canExtendLeft) {
        const leftTrimWidth = clip.trimStart * PIXELS_PER_SECOND * state.zoom;
        const leftTrimX = clipX - leftTrimWidth;
        
        // Dark background for trimmed area
        ctx.fillStyle = isSelected ? '#1a3a6e' : '#1a1a1a';
        ctx.fillRect(leftTrimX, clipY, leftTrimWidth, clipHeight);
        
        // Add diagonal hatching pattern with clipping
        ctx.save();
        ctx.beginPath();
        ctx.rect(leftTrimX, clipY, leftTrimWidth, clipHeight);
        ctx.clip();
        
        ctx.strokeStyle = isSelected ? '#2d5a9e' : '#2a2a2a';
        ctx.lineWidth = 1;
        for (let i = 0; i < leftTrimWidth + clipHeight; i += 8) {
          ctx.beginPath();
          ctx.moveTo(leftTrimX + i, clipY);
          ctx.lineTo(leftTrimX + i - clipHeight, clipY + clipHeight);
          ctx.stroke();
        }
        
        ctx.restore();
      }

      if (canExtendRight) {
        const rightTrimStart = clipX + clipWidth;
        const rightTrimDuration = video.duration - clip.trimEnd;
        const rightTrimWidth = rightTrimDuration * PIXELS_PER_SECOND * state.zoom;
        
        // Dark background for trimmed area
        ctx.fillStyle = isSelected ? '#1a3a6e' : '#1a1a1a';
        ctx.fillRect(rightTrimStart, clipY, rightTrimWidth, clipHeight);
        
        // Add diagonal hatching pattern with clipping
        ctx.save();
        ctx.beginPath();
        ctx.rect(rightTrimStart, clipY, rightTrimWidth, clipHeight);
        ctx.clip();
        
        ctx.strokeStyle = isSelected ? '#2d5a9e' : '#2a2a2a';
        ctx.lineWidth = 1;
        for (let i = 0; i < rightTrimWidth + clipHeight; i += 8) {
          ctx.beginPath();
          ctx.moveTo(rightTrimStart + i, clipY);
          ctx.lineTo(rightTrimStart + i - clipHeight, clipY + clipHeight);
          ctx.stroke();
        }
        
        ctx.restore();
      }

      // Draw active clip region (brighter)
      ctx.fillStyle = isSelected ? '#4a9eff' : '#3a3a3a';
      ctx.fillRect(clipX, clipY, clipWidth, clipHeight);

      // Clip border - only show border around visible clip (independent clip style)
      ctx.strokeStyle = isSelected ? '#6bb5ff' : '#555';
      ctx.lineWidth = 2;
      ctx.strokeRect(clipX, clipY, clipWidth, clipHeight);

      // Draw trim handles for ALL clips (not just selected)
      // This makes it clear each clip is independent and editable
      const handleWidth = 8; // Reduced from 14 to prevent overlap
      const isLeftHovered = hoveredHandle?.clipId === clip.id && hoveredHandle?.handle === 'left';
      const isRightHovered = hoveredHandle?.clipId === clip.id && hoveredHandle?.handle === 'right';
      
      // Make handles more subtle for non-selected clips
      const handleOpacity = isSelected ? 1.0 : 0.6;
      
      // Left trim handle (at the start of visible clip) - inside the clip edge
      const leftHandleX = clipX;
      
      // Draw handle shadow for depth
      ctx.fillStyle = `rgba(0, 0, 0, ${0.3 * handleOpacity})`;
      ctx.fillRect(leftHandleX + 2, clipY + 2, handleWidth, clipHeight);
      
      // Draw handle with gradient effect
      const leftGradient = ctx.createLinearGradient(leftHandleX, 0, leftHandleX + handleWidth, 0);
      if (isLeftHovered || isSelected) {
        leftGradient.addColorStop(0, '#ffe55c');
        leftGradient.addColorStop(1, '#ffd700');
      } else {
        leftGradient.addColorStop(0, '#ccaa00');
        leftGradient.addColorStop(1, '#aa8800');
      }
      ctx.fillStyle = leftGradient;
      ctx.globalAlpha = handleOpacity;
      ctx.fillRect(leftHandleX, clipY, handleWidth, clipHeight);
      ctx.globalAlpha = 1.0;
      
      // Handle border
      ctx.strokeStyle = (isLeftHovered || isSelected) ? '#fff' : '#ffed4e';
      ctx.lineWidth = 1;
      ctx.globalAlpha = handleOpacity;
      ctx.strokeRect(leftHandleX, clipY, handleWidth, clipHeight);
      ctx.globalAlpha = 1.0;
      
      // Add grip lines for better affordance
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.5 * handleOpacity})`;
      ctx.lineWidth = 1;
      const gripSpacing = clipHeight / 4;
      ctx.globalAlpha = handleOpacity;
      for (let i = 1; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(leftHandleX + 2, clipY + gripSpacing * i);
        ctx.lineTo(leftHandleX + handleWidth - 2, clipY + gripSpacing * i);
        ctx.stroke();
      }
      ctx.globalAlpha = 1.0;
      
      // Right trim handle (at the end of visible clip) - inside the clip edge
      const rightHandleX = clipX + clipWidth - handleWidth;
      
      // Draw handle shadow for depth
      ctx.fillStyle = `rgba(0, 0, 0, ${0.3 * handleOpacity})`;
      ctx.fillRect(rightHandleX + 2, clipY + 2, handleWidth, clipHeight);
      
      // Draw handle with gradient effect
      const rightGradient = ctx.createLinearGradient(rightHandleX, 0, rightHandleX + handleWidth, 0);
      if (isRightHovered || isSelected) {
        rightGradient.addColorStop(0, '#ffe55c');
        rightGradient.addColorStop(1, '#ffd700');
      } else {
        rightGradient.addColorStop(0, '#ccaa00');
        rightGradient.addColorStop(1, '#aa8800');
      }
      ctx.fillStyle = rightGradient;
      ctx.globalAlpha = handleOpacity;
      ctx.fillRect(rightHandleX, clipY, handleWidth, clipHeight);
      ctx.globalAlpha = 1.0;
      
      // Handle border
      ctx.strokeStyle = (isRightHovered || isSelected) ? '#fff' : '#ffed4e';
      ctx.lineWidth = 1;
      ctx.globalAlpha = handleOpacity;
      ctx.strokeRect(rightHandleX, clipY, handleWidth, clipHeight);
      ctx.globalAlpha = 1.0;
      
      // Add grip lines
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.5 * handleOpacity})`;
      ctx.lineWidth = 1;
      ctx.globalAlpha = handleOpacity;
      for (let i = 1; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(rightHandleX + 2, clipY + gripSpacing * i);
        ctx.lineTo(rightHandleX + handleWidth - 2, clipY + gripSpacing * i);
        ctx.stroke();
      }
      ctx.globalAlpha = 1.0;

      // Clip label
      if (clipWidth > 40) {
        ctx.fillStyle = '#ddd';
        ctx.font = '11px sans-serif';
        const maxWidth = clipWidth - 10;
        const text = video.filename.length > maxWidth / 6 
          ? video.filename.substring(0, maxWidth / 6) + '...' 
          : video.filename;
        ctx.fillText(text, clipX + 8, clipY + 20);
        
        ctx.fillStyle = '#999';
        ctx.font = '9px sans-serif';
        ctx.fillText(formatTime(clip.duration), clipX + 8, clipY + 35);
      }
      });
    }

    // Draw playhead
    if (state.clips.length > 0) {
      const playheadX = state.playheadPosition * PIXELS_PER_SECOND * state.zoom;
      
      // Draw playhead line from ruler through all tracks
      ctx.strokeStyle = '#ff4a4a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(playheadX + TRACK_HEADER_WIDTH, 0);
      ctx.lineTo(playheadX + TRACK_HEADER_WIDTH, TOTAL_HEIGHT);
      ctx.stroke();

      // Draw playhead circle in the middle of each track
      for (let trackIndex = 0; trackIndex < NUM_TRACKS; trackIndex++) {
        const trackY = RULER_HEIGHT + (trackIndex * TRACK_HEIGHT);
        ctx.fillStyle = '#ff4a4a';
        ctx.beginPath();
        ctx.arc(playheadX + TRACK_HEADER_WIDTH, trackY + TRACK_HEIGHT / 2, 8, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    // Draw snap indicator (dashed line)
    if (snapIndicator !== null) {
      const snapX = snapIndicator * PIXELS_PER_SECOND * state.zoom + TRACK_HEADER_WIDTH;
      
      ctx.strokeStyle = '#ffff00'; // Yellow
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]); // Dashed line
      ctx.beginPath();
      ctx.moveTo(snapX, 0);
      ctx.lineTo(snapX, TOTAL_HEIGHT);
      ctx.stroke();
      ctx.setLineDash([]); // Reset to solid line
    }
  }, [state, videos, hoveredHandle, maxDuration, canvasWidth, snapIndicator]);

  // Handle mouse move for hover effects - use useCallback to prevent recreation
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const containerRect = container.getBoundingClientRect();
    const mouseXRelativeToContainer = e.clientX - containerRect.left;
    const mouseYRelativeToContainer = e.clientY - containerRect.top;
    const totalCSSX = mouseXRelativeToContainer + container.scrollLeft;
    const scaleX = canvas.width / container.scrollWidth;
    const canvasX = totalCSSX * scaleX;
    // Account for track header width in time calculation
    const adjustedCanvasX = Math.max(0, canvasX - TRACK_HEADER_WIDTH);
    const mouseTime = adjustedCanvasX / (PIXELS_PER_SECOND * state.zoom);
    
    // Check if hovering over trim handles
    let newHoveredHandle: { clipId: string; handle: 'left' | 'right' } | null = null;
    
    for (const clip of state.clips) {
      if (state.selectedClipId !== clip.id) continue; // Only check selected clip
      
      const video = videos.find(v => v.id === clip.videoFileId);
      if (!video) continue;
      
      const clipStartTime = clip.startTime;
      const clipEndTime = clip.startTime + clip.duration;
      const handleToleranceInTime = 10 / (PIXELS_PER_SECOND * state.zoom);
      
      // Check left handle
      if (mouseTime >= clipStartTime - handleToleranceInTime && 
          mouseTime <= clipStartTime + handleToleranceInTime) {
        newHoveredHandle = { clipId: clip.id, handle: 'left' };
        break;
      }
      
      // Check right handle
      if (mouseTime >= clipEndTime - handleToleranceInTime && 
          mouseTime <= clipEndTime + handleToleranceInTime) {
        newHoveredHandle = { clipId: clip.id, handle: 'right' };
        break;
      }
    }
    
    setHoveredHandle(newHoveredHandle);
  }, [state.clips, state.selectedClipId, state.zoom, videos]);

  // Handle mouse interactions - use useCallback
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    e.preventDefault();
    
    // Track initial mouse position for detecting clicks vs drags
    mouseDownPosRef.current = { x: e.clientX, y: e.clientY };
    didMoveRef.current = false;
    
    // Reset clip move reference
    movingClipRef.current = null;
    
    const maxTime = state.clips.length > 0 
      ? Math.max(...state.clips.map(c => c.startTime + c.duration))
      : 10;
    
    const containerRect = container.getBoundingClientRect();
    const mouseXRelativeToContainer = e.clientX - containerRect.left;
    const mouseYRelativeToContainer = e.clientY - containerRect.top;
    const totalCSSX = mouseXRelativeToContainer + container.scrollLeft;
    const scaleX = canvas.width / container.scrollWidth;
    const canvasX = totalCSSX * scaleX;
    // Account for track header width
    const adjustedCanvasX = Math.max(0, canvasX - TRACK_HEADER_WIDTH);
    const clickTime = adjustedCanvasX / (PIXELS_PER_SECOND * state.zoom);
    const clickTrack = getTrackFromY(mouseYRelativeToContainer);
    
    // Check for trim handle clicks - only check clips on the clicked track
    let clickedClip = null;
    let clickedHandle: 'left' | 'right' | null = null;
    
    // First, filter clips by track (only check clips on the track that was clicked)
    const clipsOnTrack = clickTrack !== null 
      ? state.clips.filter(clip => clip.track === clickTrack)
      : [];
    
    for (const clip of clipsOnTrack) {
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
        break; // Prioritize handle clicks
      }
      
      // Check right handle (at visible clip end)
      if (clickTime >= clipEndTime - handleToleranceInTime && 
          clickTime <= clipEndTime + handleToleranceInTime) {
        clickedClip = clip;
        clickedHandle = 'right';
        break; // Prioritize handle clicks
      }
    }
    
    // If no handle was clicked, check clip body on the clicked track
    if (!clickedHandle && clickTrack !== null) {
      for (const clip of clipsOnTrack) {
        const clipStartTime = clip.startTime;
        const clipEndTime = clip.startTime + clip.duration;
        
        // Check clip body
        if (clickTime >= clipStartTime && clickTime <= clipEndTime) {
          clickedClip = clip;
          break;
        }
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
          if (dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD) { // Movement threshold
            didMoveRef.current = true;
          }
        }
        
        const now = Date.now();
        if (now - lastTrimUpdateRef.current < TRIM_THROTTLE_MS) return;
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
          const newTrimStart = Math.max(0, Math.min(timeInVideo, currentTrimEnd - MIN_CLIP_DURATION));
          onClipTrim(clipId, newTrimStart, currentTrimEnd);
        } else {
          // Dragging right handle: adjust trimEnd
          // Get current trimStart from state to prevent crossing
          const currentClip = state.clips.find(c => c.id === clipId);
          const currentTrimStart = currentClip ? currentClip.trimStart : initialClip.trimStart;
          
          // Allow dragging all the way to video.duration (untrimming)
          const newTrimEnd = Math.max(currentTrimStart + MIN_CLIP_DURATION, Math.min(timeInVideo, video.duration));
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
    
    // Handle track header clicks (mute/solo buttons)
    if (mouseXRelativeToContainer < TRACK_HEADER_WIDTH && clickTrack !== null && onTrackToggle) {
      // Check if click is in mute/solo button area (right side of header)
      const buttonX = mouseXRelativeToContainer;
      if (buttonX > TRACK_HEADER_WIDTH - 40) {
        // In button area
        if (buttonX > TRACK_HEADER_WIDTH - 20) {
          // Solo button
          onTrackToggle(clickTrack, 'solo');
        } else if (buttonX > TRACK_HEADER_WIDTH - 40) {
          // Mute button
          onTrackToggle(clickTrack, 'mute');
        }
      }
      return; // Don't process as playhead drag or clip select
    }
    
    // Handle clip selection first (on click)
    // clickedClip is already filtered to the correct track
    if (clickedClip && onClipSelect) {
      onClipSelect(clickedClip.id);
    } else if (onClipSelect && clickTrack !== null) {
      // Only deselect if clicking on a track (not the ruler)
      onClipSelect(null);
    }
    
    // If clicked on a clip body (not handle), prepare for potential drag
    // But only start dragging after movement threshold is met
    // clickedClip is already filtered to the correct track, so we can use it directly
    if (clickedClip && !clickedHandle && onClipMove) {
      const clickOffset = clickTime - clickedClip.startTime;
      movingClipRef.current = {
        clipId: clickedClip.id,
        initialStartTime: clickedClip.startTime,
        clickOffset: clickOffset,
      };
      
      const handleMove = (moveEvent: MouseEvent) => {
        if (!canvas || !container || !movingClipRef.current) return;
        
        // Check if movement threshold is met before starting drag
        if (mouseDownPosRef.current) {
          const dx = Math.abs(moveEvent.clientX - mouseDownPosRef.current.x);
          const dy = Math.abs(moveEvent.clientY - mouseDownPosRef.current.y);
          
          // Only start dragging if moved more than threshold (prefer horizontal movement for clip dragging)
          // Allow some vertical movement to account for imperfect mouse control
          if (dx > DRAG_THRESHOLD || (dx > 2 && dy < 5)) {
            didMoveRef.current = true;
            
            const containerRect = container.getBoundingClientRect();
            let mouseXRelativeToContainer = moveEvent.clientX - containerRect.left;
            mouseXRelativeToContainer = Math.max(0, Math.min(mouseXRelativeToContainer, containerRect.width));
            
            const totalCSSX = mouseXRelativeToContainer + container.scrollLeft;
            const scaleX = canvas.width / container.scrollWidth;
            const canvasX = totalCSSX * scaleX;
            const adjustedCanvasX = Math.max(0, canvasX - TRACK_HEADER_WIDTH);
            const mouseTime = adjustedCanvasX / (PIXELS_PER_SECOND * state.zoom);
            
            // Calculate new start time
            let newStartTime = mouseTime - movingClipRef.current.clickOffset;
            newStartTime = Math.max(0, newStartTime);
            
            // Apply snap if enabled
            if (state.snapEnabled) {
              const snapResult = findSnapPoint(newStartTime, true);
              newStartTime = snapResult.time;
              if (snapResult.snapped) {
                setSnapIndicator(snapResult.time);
              } else {
                setSnapIndicator(null);
              }
            } else {
              setSnapIndicator(null);
            }
            
            // Update clip position
            if (onClipMove) {
              onClipMove(movingClipRef.current.clipId, newStartTime);
            }
          }
        }
      };
      
      const handleUp = () => {
        // Only clear if we didn't actually drag
        if (!didMoveRef.current && movingClipRef.current) {
          // Just a click, selection already happened above
        }
        movingClipRef.current = null;
        setSnapIndicator(null);
        document.removeEventListener('mousemove', handleMove);
        document.removeEventListener('mouseup', handleUp);
      };
      
      document.addEventListener('mousemove', handleMove);
      document.addEventListener('mouseup', handleUp);
      
      // Don't process playhead drag if clicked on clip
      return;
    }
    
    // Handle playhead dragging (only if not clicking on a clip)
    // This should work regardless of which track we're on
    const clampedTime = Math.max(0, Math.min(clickTime, maxTime));
    const snapResult = findSnapPoint(clampedTime, state.snapEnabled);
    onPlayheadDrag(snapResult.time);
    if (snapResult.snapped) {
      setSnapIndicator(snapResult.time);
    } else {
      setSnapIndicator(null);
    }
    isDraggingRef.current = true;
    
    const handleMove = (moveEvent: MouseEvent) => {
      if (!canvas || !container || !isDraggingRef.current) return;
      
      const now = Date.now();
      if (now - lastDragUpdateRef.current < DRAG_THROTTLE_MS) return;
      lastDragUpdateRef.current = now;
      
      const containerRect = container.getBoundingClientRect();
      let mouseXRelativeToContainer = moveEvent.clientX - containerRect.left;
      mouseXRelativeToContainer = Math.max(0, Math.min(mouseXRelativeToContainer, containerRect.width));
      
      const totalCSSX = mouseXRelativeToContainer + container.scrollLeft;
      const scaleX = canvas.width / container.scrollWidth;
      const canvasX = totalCSSX * scaleX;
      // Account for track header width in time calculation
      const adjustedCanvasX = Math.max(0, canvasX - TRACK_HEADER_WIDTH);
      const newTime = adjustedCanvasX / (PIXELS_PER_SECOND * state.zoom);
      const clampedTime = Math.max(0, Math.min(newTime, maxTime));
      
      // Apply snapping
      const snapResult = findSnapPoint(clampedTime, state.snapEnabled);
      onPlayheadDrag(snapResult.time);
      
      // Show snap indicator when snapping
      if (snapResult.snapped) {
        setSnapIndicator(snapResult.time);
      } else {
        setSnapIndicator(null);
      }
    };
    
    const handleUp = () => {
      isDraggingRef.current = false;
      setSnapIndicator(null); // Clear snap indicator on mouse up
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };
    
    document.addEventListener('mousemove', handleMove, { passive: false });
    document.addEventListener('mouseup', handleUp);
  }, [state.clips, videos, onClipTrim, onPlayheadDrag, onClipSelect, state.zoom, state.snapEnabled, maxDuration, findSnapPoint]);

  // Handle drag and drop - use useCallback
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const container = containerRef.current;
    if (!container) return;
    
    const containerRect = container.getBoundingClientRect();
    const mouseYRelativeToContainer = e.clientY - containerRect.top;
    const track = getTrackFromY(mouseYRelativeToContainer);
    
    const videoId = e.dataTransfer.getData('video-id');
    if (videoId) {
      onVideoDropped(videoId, track !== null ? track : 0);
    }
  }, [onVideoDropped, getTrackFromY]);

  const handleOverlayPositionClick = (trackIndex: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onOverlayPositionChange) return;
    
    const currentPosition = state.tracks[trackIndex]?.overlayPosition || 'bottom-right';
    const positions: OverlayPosition[] = ['bottom-left', 'bottom-right', 'top-left', 'top-right', 'center'];
    const currentIndex = positions.indexOf(currentPosition);
    const nextIndex = (currentIndex + 1) % positions.length;
    onOverlayPositionChange(trackIndex, positions[nextIndex]);
  };

  return (
    <div ref={containerRef} style={{ overflowX: 'auto', overflowY: 'auto', width: '100%', maxHeight: '400px', position: 'relative' }}>
      <canvas
        ref={canvasRef}
        width={canvasWidth}
        height={TOTAL_HEIGHT}
        className="timeline-canvas"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        style={{ 
          display: 'block', 
          width: canvasWidth + 'px', 
          height: TOTAL_HEIGHT + 'px', 
          minWidth: '100%',
          cursor: hoveredHandle ? 'ew-resize' : 'pointer'
        }}
      />
      {/* Overlay position controls for overlay tracks */}
      {[1, 2].map(trackIndex => {
        const trackY = RULER_HEIGHT + (trackIndex * TRACK_HEIGHT);
        const trackState = state.tracks[trackIndex];
        const position = trackState?.overlayPosition || (trackIndex === 1 ? 'bottom-right' : 'bottom-left');
        const positionLabels: Record<OverlayPosition, string> = {
          'bottom-left': 'BL',
          'bottom-right': 'BR',
          'top-left': 'TL',
          'top-right': 'TR',
          'center': 'C',
        };
        
        return (
          <button
            key={trackIndex}
            onClick={(e) => handleOverlayPositionClick(trackIndex, e)}
            style={{
              position: 'absolute',
              left: '70px', // Position after "Overlay 1"/"Overlay 2" text with small gap
              top: trackY + (TRACK_HEIGHT / 2) - 10 + 'px', // Center vertically in track
              width: '18px', // Narrower to fit before mute indicator
              height: '20px',
              fontSize: '9px',
              fontWeight: 'bold',
              padding: '0',
              background: position === 'center' ? '#555' : '#3a5a7a',
              border: '1px solid #666',
              color: '#ddd',
              cursor: 'pointer',
              borderRadius: '3px',
              zIndex: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = position === 'center' ? '#666' : '#4a6a8a';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = position === 'center' ? '#555' : '#3a5a7a';
            }}
            title={`Overlay position: ${position}. Click to cycle through positions.`}
          >
            {positionLabels[position]}
          </button>
        );
      })}
    </div>
  );
}

// Helper function for formatting time - using shared utility

function getTimeInterval(zoom: number): number {
  if (zoom >= 4) return 1;
  if (zoom >= 2) return 5;
  if (zoom >= 1) return 10;
  return 30;
}