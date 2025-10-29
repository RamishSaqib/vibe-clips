import { createContext, useContext, useState, ReactNode } from 'react';
import type { TimelineState, TimelineClip, OverlayPosition } from '../types/timeline';

interface TimelineContextType {
  timelineState: TimelineState;
  setTimelineState: React.Dispatch<React.SetStateAction<TimelineState>>;
  removeClipsByVideoId: (videoFileId: string) => void;
  splitClipAtPlayhead: (clipId: string, playheadPosition: number) => void;
  deleteClip: (clipId: string) => void;
  setOverlayPosition: (trackIndex: number, position: OverlayPosition) => void;
}

const TimelineContext = createContext<TimelineContextType | undefined>(undefined);

export function TimelineProvider({ children }: { children: ReactNode }) {
  const [timelineState, setTimelineState] = useState<TimelineState>({
    clips: [],
    playheadPosition: 0,
    zoom: 1,
    scrollOffset: 0,
    selectedClipId: null,
    snapEnabled: true, // Snap enabled by default
    tracks: [
      { muted: false, solo: false }, // Track 0: Main video
      { muted: false, solo: false, overlayPosition: 'bottom-right' as OverlayPosition }, // Track 1: Overlay 1 - default bottom-right
      { muted: false, solo: false, overlayPosition: 'bottom-left' as OverlayPosition }, // Track 2: Overlay 2 - default bottom-left
    ],
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

  const deleteClip = (clipId: string) => {
    setTimelineState(prev => {
      const clipToDelete = prev.clips.find(c => c.id === clipId);
      if (!clipToDelete) return prev;

      // Remove the clip
      const remainingClips = prev.clips.filter(clip => clip.id !== clipId);
      
      // Calculate the new maximum timeline duration
      const maxTime = remainingClips.length > 0 
        ? Math.max(...remainingClips.map(c => c.startTime + c.duration))
        : 0;
      
      // If playhead is on the deleted clip, reposition it to the clip's start time
      let newPlayheadPosition = prev.playheadPosition;
      if (prev.playheadPosition >= clipToDelete.startTime && 
          prev.playheadPosition < clipToDelete.startTime + clipToDelete.duration) {
        newPlayheadPosition = clipToDelete.startTime;
      }
      
      // If playhead is beyond the new timeline end, reset it
      if (newPlayheadPosition > maxTime) {
        newPlayheadPosition = maxTime;
      }
      
      return {
        ...prev,
        clips: remainingClips,
        playheadPosition: newPlayheadPosition,
        selectedClipId: prev.selectedClipId === clipId ? null : prev.selectedClipId,
      };
    });
  };

  const setOverlayPosition = (trackIndex: number, position: OverlayPosition) => {
    setTimelineState(prev => {
      if (trackIndex <= 0 || trackIndex >= prev.tracks.length) return prev;
      
      const updatedTracks = prev.tracks.map((track, idx) => {
        if (idx === trackIndex) {
          return { ...track, overlayPosition: position };
        }
        return track;
      });
      
      return { ...prev, tracks: updatedTracks };
    });
  };

  return (
    <TimelineContext.Provider value={{ timelineState, setTimelineState, removeClipsByVideoId, splitClipAtPlayhead, deleteClip, setOverlayPosition }}>
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

