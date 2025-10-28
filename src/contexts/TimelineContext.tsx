import { createContext, useContext, useState, ReactNode } from 'react';
import type { TimelineState, TimelineClip } from '../types/timeline';

interface TimelineContextType {
  timelineState: TimelineState;
  setTimelineState: React.Dispatch<React.SetStateAction<TimelineState>>;
  removeClipsByVideoId: (videoFileId: string) => void;
  splitClipAtPlayhead: (clipId: string, playheadPosition: number) => void;
}

const TimelineContext = createContext<TimelineContextType | undefined>(undefined);

export function TimelineProvider({ children }: { children: ReactNode }) {
  const [timelineState, setTimelineState] = useState<TimelineState>({
    clips: [],
    playheadPosition: 0,
    zoom: 1,
    scrollOffset: 0,
    selectedClipId: null,
  });

  const removeClipsByVideoId = (videoFileId: string) => {
    setTimelineState(prev => {
      const remainingClips = prev.clips.filter(clip => clip.videoFileId !== videoFileId);
      
      // Calculate the new maximum timeline duration
      const maxTime = remainingClips.length > 0 
        ? Math.max(...remainingClips.map(c => c.startTime + c.duration))
        : 0;
      
      // If playhead is beyond the new timeline end, reset it
      const newPlayheadPosition = prev.playheadPosition > maxTime ? 0 : prev.playheadPosition;
      
      return {
        ...prev,
        clips: remainingClips,
        playheadPosition: newPlayheadPosition,
        selectedClipId: prev.selectedClipId && prev.clips.find(c => c.id === prev.selectedClipId)?.videoFileId === videoFileId 
          ? null 
          : prev.selectedClipId
      };
    });
  };

  const splitClipAtPlayhead = (clipId: string, playheadPosition: number) => {
    setTimelineState(prev => {
      const clipToSplit = prev.clips.find(c => c.id === clipId);
      if (!clipToSplit) return prev;

      // Calculate position within the clip
      const positionInClip = playheadPosition - clipToSplit.startTime;
      
      // Don't split if too close to edges (minimum 0.5 seconds on each side)
      const MIN_CLIP_DURATION = 0.5;
      if (positionInClip < MIN_CLIP_DURATION || 
          (clipToSplit.duration - positionInClip) < MIN_CLIP_DURATION) {
        console.warn('Cannot split: clip would be too small');
        return prev;
      }

      // Calculate split point in the original video
      const splitPointInOriginalVideo = clipToSplit.trimStart + positionInClip;

      // Add a small gap between clips (0.1 seconds) for visual separation
      const GAP = 0.1;

      // Create first clip (left side) - ends before the gap
      const firstClip: TimelineClip = {
        ...clipToSplit,
        id: `clip-${Date.now()}-1`,
        duration: positionInClip,
        trimStart: clipToSplit.trimStart,
        trimEnd: splitPointInOriginalVideo,
      };

      // Create second clip (right side) - starts after the gap
      const secondClip: TimelineClip = {
        ...clipToSplit,
        id: `clip-${Date.now()}-2`,
        startTime: playheadPosition + GAP, // Move right by gap
        duration: clipToSplit.duration - positionInClip,
        trimStart: splitPointInOriginalVideo,
        trimEnd: clipToSplit.trimEnd,
      };

      console.log('Split complete:', {
        originalClip: clipToSplit,
        firstClip: {
          id: firstClip.id,
          startTime: firstClip.startTime,
          endTime: firstClip.startTime + firstClip.duration,
          duration: firstClip.duration
        },
        secondClip: {
          id: secondClip.id,
          startTime: secondClip.startTime,
          endTime: secondClip.startTime + secondClip.duration,
          duration: secondClip.duration
        },
        gapBetween: secondClip.startTime - (firstClip.startTime + firstClip.duration)
      });

      // Replace the original clip with the two new clips
      const newClips = prev.clips.map(clip => {
        if (clip.id === clipId) {
          return firstClip;
        }
        return clip;
      });

      // Add the second clip right after the first
      const clipIndex = newClips.findIndex(c => c.id === firstClip.id);
      newClips.splice(clipIndex + 1, 0, secondClip);

      return {
        ...prev,
        clips: newClips,
        selectedClipId: secondClip.id, // Select the second clip after split
      };
    });
  };

  return (
    <TimelineContext.Provider value={{ timelineState, setTimelineState, removeClipsByVideoId, splitClipAtPlayhead }}>
      {children}
    </TimelineContext.Provider>
  );
}

export function useTimeline() {
  const context = useContext(TimelineContext);
  if (!context) {
    throw new Error('useTimeline must be used within TimelineProvider');
  }
  return context;
}

