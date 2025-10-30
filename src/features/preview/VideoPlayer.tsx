import { useEffect, useRef, useState, useCallback } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import type { VideoFile } from '../../types/video';
import type { TimelineClip } from '../../types/timeline';
import { useTimeline } from '../../contexts/TimelineContext';
import { useVideos } from '../../contexts/VideoContext';
import { useSubtitles } from '../../contexts/SubtitleContext';
import { calculateOverlayPosition } from '../../utils/overlayPosition';
import type { Subtitle, SubtitleStyle } from '../../types/subtitle';
import './VideoPlayer.css';

// Helper function to draw subtitle on canvas
function drawSubtitle(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  subtitle: Subtitle,
  style: SubtitleStyle
) {
  const padding = 10;
  const maxWidth = canvas.width * 0.8;
  
  // Set font properties
  ctx.font = `${style.fontSize}px ${style.fontFamily}`;
  ctx.textAlign = style.alignment === 'left' ? 'left' : style.alignment === 'right' ? 'right' : 'center';
  ctx.textBaseline = 'middle';
  
  // Calculate text metrics
  const lines = wrapText(ctx, subtitle.text, maxWidth);
  const lineHeight = style.fontSize * 1.2;
  const totalHeight = lines.length * lineHeight + padding * 2;
  
  // Calculate position
  let y: number;
  switch (style.position) {
    case 'top':
      y = padding + totalHeight / 2;
      break;
    case 'center':
      y = canvas.height / 2;
      break;
    case 'bottom':
    default:
      y = canvas.height - padding - totalHeight / 2;
      break;
  }
  
  let x: number;
  switch (style.alignment) {
    case 'left':
      x = padding;
      break;
    case 'right':
      x = canvas.width - padding;
      break;
    case 'center':
    default:
      x = canvas.width / 2;
      break;
  }
  
  // Draw background if specified
  if (style.backgroundColor) {
    // Parse hex color with alpha (e.g., #00000080 -> rgba(0,0,0,0.5))
    let bgColor = style.backgroundColor;
    let alpha = 1;
    
    // Handle hex colors with alpha channel (8 digits)
    if (bgColor.length === 9 && bgColor.startsWith('#')) {
      const alphaHex = bgColor.slice(7, 9);
      alpha = parseInt(alphaHex, 16) / 255;
      bgColor = bgColor.slice(0, 7); // Remove alpha hex digits
    } else if (bgColor.length === 8 && !bgColor.startsWith('#')) {
      // Handle if someone uses "00000080" format
      const alphaHex = bgColor.slice(6, 8);
      alpha = parseInt(alphaHex, 16) / 255;
      bgColor = '#' + bgColor.slice(0, 6);
    }
    
    ctx.globalAlpha = alpha;
    ctx.fillStyle = bgColor;
    
    const bgX = style.alignment === 'left' ? x - padding : 
                style.alignment === 'right' ? x - maxWidth + padding : 
                x - maxWidth / 2;
    const bgY = y - totalHeight / 2;
    
    ctx.fillRect(bgX, bgY, maxWidth, totalHeight);
    ctx.globalAlpha = 1;
  }
  
  // Draw text with outline for readability
  ctx.strokeStyle = '#000';
  ctx.lineWidth = style.fontSize * 0.1;
  ctx.fillStyle = style.color;
  
  lines.forEach((line, index) => {
    const lineY = y - (lines.length - 1) * lineHeight / 2 + index * lineHeight;
    ctx.strokeText(line, x, lineY);
    ctx.fillText(line, x, lineY);
  });
}

// Helper function to wrap text to fit within max width
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = words[0];
  
  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    const testLine = currentLine + ' ' + word;
    const metrics = ctx.measureText(testLine);
    
    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  
  if (currentLine) {
    lines.push(currentLine);
  }
  
  return lines.length > 0 ? lines : [text];
}

export function VideoPlayer() {
  const { timelineState, setTimelineState } = useTimeline();
  const { videos } = useVideos();
  const { subtitleTracks } = useSubtitles();
  const baseVideoRef = useRef<HTMLVideoElement>(null);
  const overlay1VideoRef = useRef<HTMLVideoElement>(null);
  const overlay2VideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [baseClip, setBaseClip] = useState<{ id: string; video: VideoFile; offset: number; clip: TimelineClip } | null>(null);
  const [overlay1Clip, setOverlay1Clip] = useState<{ id: string; video: VideoFile; offset: number; clip: TimelineClip } | null>(null);
  const [overlay2Clip, setOverlay2Clip] = useState<{ id: string; video: VideoFile; offset: number; clip: TimelineClip } | null>(null);
  const seekTimeoutRef = useRef<number | null>(null);
  const lastSeekTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);

  // Find clips at playhead position across all tracks
  useEffect(() => {
    const playheadTime = timelineState.playheadPosition;
    
    // Find base clip (Track 0)
    const base = timelineState.clips.find(c => 
      c.track === 0 &&
      playheadTime >= c.startTime && 
      playheadTime < c.startTime + c.duration
    );
    
    // Find overlay clips (Track 1 & 2)
    const overlay1 = timelineState.clips.find(c => 
      c.track === 1 &&
      playheadTime >= c.startTime && 
      playheadTime < c.startTime + c.duration
    );
    
    const overlay2 = timelineState.clips.find(c => 
      c.track === 2 &&
      playheadTime >= c.startTime && 
      playheadTime < c.startTime + c.duration
    );

    // Set base clip
    if (base) {
      const video = videos.find(v => v.id === base.videoFileId);
      if (video) {
        const positionInClip = playheadTime - base.startTime;
        const offsetInOriginalVideo = base.trimStart + positionInClip;
        setBaseClip({ id: base.id, video, clip: base, offset: offsetInOriginalVideo });
      } else {
        setBaseClip(null);
      }
    } else {
      setBaseClip(null);
    }

    // Set overlay 1 clip
    if (overlay1) {
      const video = videos.find(v => v.id === overlay1.videoFileId);
      if (video) {
        const positionInClip = playheadTime - overlay1.startTime;
        const offsetInOriginalVideo = overlay1.trimStart + positionInClip;
        setOverlay1Clip({ id: overlay1.id, video, clip: overlay1, offset: offsetInOriginalVideo });
      } else {
        setOverlay1Clip(null);
      }
    } else {
      setOverlay1Clip(null);
    }

    // Set overlay 2 clip
    if (overlay2) {
      const video = videos.find(v => v.id === overlay2.videoFileId);
      if (video) {
        const positionInClip = playheadTime - overlay2.startTime;
        const offsetInOriginalVideo = overlay2.trimStart + positionInClip;
        setOverlay2Clip({ id: overlay2.id, video, clip: overlay2, offset: offsetInOriginalVideo });
      } else {
        setOverlay2Clip(null);
      }
    } else {
      setOverlay2Clip(null);
    }
  }, [timelineState.playheadPosition, timelineState.clips, videos]);

  // Composite videos on canvas
  const drawComposite = useCallback(() => {
    const canvas = canvasRef.current;
    const baseVideo = baseVideoRef.current;
    const overlay1Video = overlay1VideoRef.current;
    const overlay2Video = overlay2VideoRef.current;
    
    if (!canvas || !baseVideo) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Set canvas size to match base video
    if (baseVideo.videoWidth > 0 && baseVideo.videoHeight > 0) {
      canvas.width = baseVideo.videoWidth;
      canvas.height = baseVideo.videoHeight;
    }
    
    // Clear canvas
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw base video (Track 0)
    if (baseVideo.readyState >= 2) {
      ctx.drawImage(baseVideo, 0, 0, canvas.width, canvas.height);
    }
    
    // Draw overlay 1 (Track 1) - use configured position
    if (overlay1Video && overlay1Clip && overlay1Video.readyState >= 2) {
      const overlayW = canvas.width * 0.3;
      const overlayH = canvas.height * 0.3;
      const position = timelineState.tracks[1]?.overlayPosition || 'bottom-right';
      const { x, y } = calculateOverlayPosition(position, canvas.width, canvas.height, overlayW, overlayH);
      ctx.drawImage(overlay1Video, x, y, overlayW, overlayH);
    }
    
    // Draw overlay 2 (Track 2) - use configured position
    if (overlay2Video && overlay2Clip && overlay2Video.readyState >= 2) {
      const overlayW = canvas.width * 0.3;
      const overlayH = canvas.height * 0.3;
      const position = timelineState.tracks[2]?.overlayPosition || 'bottom-left';
      const { x, y } = calculateOverlayPosition(position, canvas.width, canvas.height, overlayW, overlayH);
      ctx.drawImage(overlay2Video, x, y, overlayW, overlayH);
    }
    
    // Draw subtitles
    const playheadTime = timelineState.playheadPosition;
    subtitleTracks.forEach((track) => {
      if (!track.enabled) return;
      
      // Find active subtitle at current playhead position
      const activeSubtitle = track.subtitles.find(sub => 
        playheadTime >= sub.startTime && playheadTime < sub.endTime
      );
      
      if (activeSubtitle) {
        drawSubtitle(ctx, canvas, activeSubtitle, track.style);
      }
    });
    
    if (isPlaying) {
      animationFrameRef.current = requestAnimationFrame(drawComposite);
    }
  }, [baseClip, overlay1Clip, overlay2Clip, isPlaying, timelineState.tracks, timelineState.playheadPosition, subtitleTracks]);

  // Update canvas when videos update
  useEffect(() => {
    drawComposite();
  }, [drawComposite]);

  // Setup video loaded event listeners to trigger drawing
  useEffect(() => {
    const baseVideo = baseVideoRef.current;
    const overlay1Video = overlay1VideoRef.current;
    const overlay2Video = overlay2VideoRef.current;

    const handleLoadedData = () => {
      drawComposite();
    };

    if (baseVideo) {
      baseVideo.addEventListener('loadeddata', handleLoadedData);
      baseVideo.addEventListener('seeked', handleLoadedData);
    }
    if (overlay1Video) {
      overlay1Video.addEventListener('loadeddata', handleLoadedData);
      overlay1Video.addEventListener('seeked', handleLoadedData);
    }
    if (overlay2Video) {
      overlay2Video.addEventListener('loadeddata', handleLoadedData);
      overlay2Video.addEventListener('seeked', handleLoadedData);
    }

    return () => {
      if (baseVideo) {
        baseVideo.removeEventListener('loadeddata', handleLoadedData);
        baseVideo.removeEventListener('seeked', handleLoadedData);
      }
      if (overlay1Video) {
        overlay1Video.removeEventListener('loadeddata', handleLoadedData);
        overlay1Video.removeEventListener('seeked', handleLoadedData);
      }
      if (overlay2Video) {
        overlay2Video.removeEventListener('loadeddata', handleLoadedData);
        overlay2Video.removeEventListener('seeked', handleLoadedData);
      }
    };
  }, [baseClip, overlay1Clip, overlay2Clip, drawComposite]);

  // Update video positions when clips change (with debouncing)
  useEffect(() => {
    if (baseVideoRef.current && baseClip && !isPlaying) {
      if (seekTimeoutRef.current !== null) {
        clearTimeout(seekTimeoutRef.current);
      }

      seekTimeoutRef.current = window.setTimeout(() => {
        if (baseVideoRef.current && baseClip && baseClip.clip) {
          const video = baseVideoRef.current;
          const clip = baseClip.clip;
          const clampedOffset = Math.max(clip.trimStart, Math.min(baseClip.offset, clip.trimEnd - 0.1));
          const timeDiff = Math.abs(video.currentTime - clampedOffset);
          
          if (timeDiff > 0.2) {
            try {
              video.currentTime = clampedOffset;
              lastSeekTimeRef.current = clampedOffset;
            } catch (e) {
              console.error('Seek error:', e);
            }
          }
        }
      }, 150);
    }

    // Sync overlay videos
    if (overlay1VideoRef.current && overlay1Clip && !isPlaying) {
      const video = overlay1VideoRef.current;
      const clip = overlay1Clip.clip;
      const clampedOffset = Math.max(clip.trimStart, Math.min(overlay1Clip.offset, clip.trimEnd - 0.1));
      try {
        video.currentTime = clampedOffset;
      } catch (e) {
        console.error('Overlay 1 seek error:', e);
      }
    }

    if (overlay2VideoRef.current && overlay2Clip && !isPlaying) {
      const video = overlay2VideoRef.current;
      const clip = overlay2Clip.clip;
      const clampedOffset = Math.max(clip.trimStart, Math.min(overlay2Clip.offset, clip.trimEnd - 0.1));
      try {
        video.currentTime = clampedOffset;
      } catch (e) {
        console.error('Overlay 2 seek error:', e);
      }
    }

    return () => {
      if (seekTimeoutRef.current !== null) {
        clearTimeout(seekTimeoutRef.current);
      }
    };
  }, [baseClip, overlay1Clip, overlay2Clip, isPlaying]);

  // Update playhead as video plays
  useEffect(() => {
    const baseVideo = baseVideoRef.current;
    if (!baseVideo || !isPlaying || !baseClip) return;

    const handleTimeUpdate = () => {
      if (baseClip.clip) {
        const positionInClip = baseVideo.currentTime - baseClip.clip.trimStart;
        const newPlayheadPosition = baseClip.clip.startTime + positionInClip;
        setTimelineState(prev => ({ ...prev, playheadPosition: newPlayheadPosition }));
      }
      
      // Sync overlay videos
      if (overlay1VideoRef.current && overlay1Clip) {
        const overlay1Video = overlay1VideoRef.current;
        const offsetInClip = timelineState.playheadPosition - overlay1Clip.clip.startTime;
        const targetTime = overlay1Clip.clip.trimStart + offsetInClip;
        if (Math.abs(overlay1Video.currentTime - targetTime) > 0.2) {
          overlay1Video.currentTime = targetTime;
        }
      }
      
      if (overlay2VideoRef.current && overlay2Clip) {
        const overlay2Video = overlay2VideoRef.current;
        const offsetInClip = timelineState.playheadPosition - overlay2Clip.clip.startTime;
        const targetTime = overlay2Clip.clip.trimStart + offsetInClip;
        if (Math.abs(overlay2Video.currentTime - targetTime) > 0.2) {
          overlay2Video.currentTime = targetTime;
        }
      }
      
      drawComposite();
    };

    baseVideo.addEventListener('timeupdate', handleTimeUpdate);
    return () => baseVideo.removeEventListener('timeupdate', handleTimeUpdate);
  }, [isPlaying, baseClip, overlay1Clip, overlay2Clip, setTimelineState, timelineState.playheadPosition, drawComposite]);

  // Ensure video doesn't play beyond trim bounds
  useEffect(() => {
    const baseVideo = baseVideoRef.current;
    if (!baseVideo || !baseClip || !baseClip.clip) return;

    const handleTimeUpdate = () => {
      const clip = baseClip.clip;
      if (baseVideo.currentTime >= clip.trimEnd) {
        baseVideo.pause();
        setIsPlaying(false);
      }
    };

    baseVideo.addEventListener('timeupdate', handleTimeUpdate);
    return () => baseVideo.removeEventListener('timeupdate', handleTimeUpdate);
  }, [isPlaying, baseClip, setIsPlaying]);

  const handlePlayPause = () => {
    const baseVideo = baseVideoRef.current;
    if (!baseVideo) return;
    
    if (isPlaying) {
      baseVideo.pause();
      if (overlay1VideoRef.current) overlay1VideoRef.current.pause();
      if (overlay2VideoRef.current) overlay2VideoRef.current.pause();
      setIsPlaying(false);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    } else {
      baseVideo.play()
        .then(() => {
          if (overlay1VideoRef.current && overlay1Clip) overlay1VideoRef.current.play();
          if (overlay2VideoRef.current && overlay2Clip) overlay2VideoRef.current.play();
          setIsPlaying(true);
          drawComposite();
        })
        .catch((error) => {
          console.error('Failed to play video:', error);
          setIsPlaying(false);
        });
    }
  };

  // Get video source URL helper
  const getVideoSrc = (video: VideoFile) => {
    return video.path.startsWith('data:') ? video.path : convertFileSrc(video.path);
  };

  if (timelineState.clips.length === 0) {
    return (
      <div className="video-player-empty">
        <p>Import video and add to timeline</p>
      </div>
    );
  }
  
  if (!baseClip) {
    return (
      <div className="video-player-empty">
        <p>No clip at playhead position on Track 0</p>
      </div>
    );
  }

  return (
    <div className="video-player">
      <div className="video-composite-container">
        {/* Hidden video elements for composition */}
        <video
          ref={baseVideoRef}
          src={getVideoSrc(baseClip.video)}
          style={{ display: 'none' }}
          muted={false}
        />
        {overlay1Clip && (
          <video
            ref={overlay1VideoRef}
            src={getVideoSrc(overlay1Clip.video)}
            style={{ display: 'none' }}
            muted={true}
          />
        )}
        {overlay2Clip && (
          <video
            ref={overlay2VideoRef}
            src={getVideoSrc(overlay2Clip.video)}
            style={{ display: 'none' }}
            muted={true}
          />
        )}
        
        {/* Canvas for composited preview */}
        <canvas
          ref={canvasRef}
          className="video-composite-canvas"
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        />
      </div>
      
      <div className="video-player-controls">
        <button onClick={handlePlayPause} className="control-button">
          {isPlaying ? '⏸️' : '▶️'}
        </button>
        <span className="video-info">
          {baseClip.video.filename}
          {overlay1Clip && ` + Overlay 1`}
          {overlay2Clip && ` + Overlay 2`}
        </span>
      </div>
    </div>
  );
}






































