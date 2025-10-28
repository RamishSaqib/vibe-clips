import { createContext, useContext, useState, ReactNode } from 'react';
import type { TimelineState, TimelineClip } from '../types/timeline';

interface TimelineContextType {
  timelineState: TimelineState;
  setTimelineState: React.Dispatch<React.SetStateAction<TimelineState>>;
  removeClipsByVideoId: (videoFileId: string) => void;
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

  return (
    <TimelineContext.Provider value={{ timelineState, setTimelineState, removeClipsByVideoId }}>
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

