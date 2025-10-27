import { useEffect, useRef, useState } from 'react';
import type { VideoFile } from '../../types/video';
import { useTimeline } from '../../contexts/TimelineContext';
import { useVideos } from '../../contexts/VideoContext';
import './VideoPlayer.css';

export function VideoPlayer() {
  const { timelineState } = useTimeline();
  const { videos } = useVideos();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentClip, setCurrentClip] = useState<{ id: string; video: VideoFile; offset: number } | null>(null);
  const seekTimeoutRef = useRef<number | null>(null);
  const lastSeekTimeRef = useRef<number>(0);

  // Find the current clip at the playhead position
  useEffect(() => {
    const clip = timelineState.clips.find(c => {
      const clipStart = c.startTime;
      const clipEnd = clipStart + c.duration;
      return timelineState.playheadPosition >= clipStart && 
             timelineState.playheadPosition < clipEnd;
    });

    if (clip) {
      const video = videos.find(v => v.id === clip.videoFileId);
      if (video) {
        setCurrentClip({
          id: clip.id,
          video,
          offset: timelineState.playheadPosition - clip.startTime + clip.trimStart
        });
      } else {
        setCurrentClip(null);
      }
    } else {
      setCurrentClip(null);
    }
  }, [timelineState.playheadPosition, timelineState.clips, videos]);

  // Update video position when clip or playhead changes (with debouncing)
  useEffect(() => {
    if (videoRef.current && currentClip && !isPlaying) {
      // Clear any pending seek
      if (seekTimeoutRef.current !== null) {
        clearTimeout(seekTimeoutRef.current);
      }

      // Debounce seeks to avoid excessive seeking during dragging
      seekTimeoutRef.current = window.setTimeout(() => {
        if (videoRef.current && currentClip) {
          const video = videoRef.current;
          
          // Clamp to valid video duration (leave 0.1s buffer at end)
          const maxSeekTime = Math.max(0, video.duration - 0.1);
          const clampedOffset = Math.max(0, Math.min(currentClip.offset, maxSeekTime));
          
          // Only seek if the time difference is significant (more than 0.2 seconds)
          const timeDiff = Math.abs(video.currentTime - clampedOffset);
          
          // Skip seeking if we're at the very end of the video
          const isNearEnd = clampedOffset >= maxSeekTime - 0.2;
          
          if (timeDiff > 0.2 && !isNearEnd) {
            try {
              video.currentTime = clampedOffset;
              lastSeekTimeRef.current = clampedOffset;
            } catch (e) {
              console.error('Seek error:', e);
            }
          }
        }
      }, 150); // Increased to 150ms debounce

      return () => {
        if (seekTimeoutRef.current !== null) {
          clearTimeout(seekTimeoutRef.current);
        }
      };
    }
  }, [currentClip, isPlaying]);

  const handlePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleSeek = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
  };

  if (timelineState.clips.length === 0) {
    return (
      <div className="video-player-empty">
        <p>Import video and add to timeline</p>
      </div>
    );
  }
  
  if (!currentClip) {
    return (
      <div className="video-player-empty">
        <p>No clip at playhead position</p>
      </div>
    );
  }

  return (
    <div className="video-player">
      <video
        ref={videoRef}
        src={currentClip.video.path}
        className="video-element"
      />
      
      <div className="video-player-controls">
        <button onClick={handlePlayPause} className="control-button">
          {isPlaying ? '⏸️' : '▶️'}
        </button>
        <span className="video-info">
          {currentClip.video.filename}
        </span>
      </div>
    </div>
  );
}