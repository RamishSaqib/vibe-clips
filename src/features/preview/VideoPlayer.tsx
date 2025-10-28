import { useEffect, useRef, useState } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import type { VideoFile } from '../../types/video';
import { useTimeline } from '../../contexts/TimelineContext';
import { useVideos } from '../../contexts/VideoContext';
import './VideoPlayer.css';

export function VideoPlayer() {
  const { timelineState, setTimelineState } = useTimeline();
  const { videos } = useVideos();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentClip, setCurrentClip] = useState<{ id: string; video: VideoFile; offset: number; clip: any } | null>(null);
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
        // Calculate the position within the trimmed clip
        const positionInClip = timelineState.playheadPosition - clip.startTime;
        
        // Add the trim start to get the position in the original video
        const offsetInOriginalVideo = clip.trimStart + positionInClip;
        
        setCurrentClip({
          id: clip.id,
          video,
          clip,
          offset: offsetInOriginalVideo
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
        if (videoRef.current && currentClip && currentClip.clip) {
          const video = videoRef.current;
          const clip = currentClip.clip;
          
          // Clamp to trimmed bounds
          const clampedOffset = Math.max(clip.trimStart, Math.min(currentClip.offset, clip.trimEnd - 0.1));
          
          // Only seek if the time difference is significant (more than 0.2 seconds)
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
      }, 150); // Increased to 150ms debounce

      return () => {
        if (seekTimeoutRef.current !== null) {
          clearTimeout(seekTimeoutRef.current);
        }
      };
    }
  }, [currentClip, isPlaying]);

  // Update playhead as video plays
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isPlaying || !currentClip) return;

    const handleTimeUpdate = () => {
      if (currentClip.clip) {
        // Calculate playhead position based on video playback
        const positionInClip = video.currentTime - currentClip.clip.trimStart;
        const newPlayheadPosition = currentClip.clip.startTime + positionInClip;
        
        // Update playhead
        setTimelineState(prev => ({ ...prev, playheadPosition: newPlayheadPosition }));
      }
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    return () => video.removeEventListener('timeupdate', handleTimeUpdate);
  }, [isPlaying, currentClip, setTimelineState]);

  // Ensure video doesn't play beyond trim bounds
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !currentClip || !currentClip.clip) return;

    const handleTimeUpdate = () => {
      const clip = currentClip.clip;
      // Check if we've reached the end of the trimmed portion
      if (video.currentTime >= clip.trimEnd) {
        video.pause();
        setIsPlaying(false);
      }
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    return () => video.removeEventListener('timeupdate', handleTimeUpdate);
  }, [isPlaying, currentClip, setIsPlaying]);

  const handlePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        videoRef.current.play()
          .then(() => {
            setIsPlaying(true);
          })
          .catch((error) => {
            console.error('Failed to play video:', error);
            setIsPlaying(false);
          });
      }
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
        src={convertFileSrc(currentClip.video.path)}
        className="video-element"
        onError={(e) => {
          console.error('Video load error:', e);
          console.error('Attempted to load:', currentClip.video.path);
        }}
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