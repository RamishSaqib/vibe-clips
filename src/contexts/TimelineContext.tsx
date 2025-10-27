import { createContext, useContext, useState, ReactNode } from 'react';
import type { TimelineState, TimelineClip } from '../types/timeline';

interface TimelineContextType {
  timelineState: TimelineState;
  setTimelineState: React.Dispatch<React.SetStateAction<TimelineState>>;
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

  return (
    <TimelineContext.Provider value={{ timelineState, setTimelineState }}>
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

