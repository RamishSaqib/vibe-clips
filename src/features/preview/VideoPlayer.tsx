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

  // Update video position when clip or playhead changes
  useEffect(() => {
    if (videoRef.current && currentClip) {
      videoRef.current.currentTime = currentClip.offset;
    }
  }, [currentClip]);

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

