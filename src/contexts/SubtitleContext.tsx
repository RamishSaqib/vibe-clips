import { createContext, useContext, useState, ReactNode } from 'react';
import type { SubtitleTrack, Subtitle, SubtitleStyle } from '../types/subtitle';

interface SubtitleContextType {
  subtitleTracks: Map<string, SubtitleTrack>; // Map of clipId -> SubtitleTrack
  setSubtitleTrack: (clipId: string, track: SubtitleTrack) => void;
  getSubtitleTrack: (clipId: string) => SubtitleTrack | null;
  deleteSubtitleTrack: (clipId: string) => void;
}

const SubtitleContext = createContext<SubtitleContextType | undefined>(undefined);

export function SubtitleProvider({ children }: { children: ReactNode }) {
  const [subtitleTracks, setSubtitleTracks] = useState<Map<string, SubtitleTrack>>(new Map());

  const setSubtitleTrack = (clipId: string, track: SubtitleTrack) => {
    setSubtitleTracks(prev => {
      const updated = new Map(prev);
      updated.set(clipId, track);
      return updated;
    });
  };

  const getSubtitleTrack = (clipId: string): SubtitleTrack | null => {
    return subtitleTracks.get(clipId) || null;
  };

  const deleteSubtitleTrack = (clipId: string) => {
    setSubtitleTracks(prev => {
      const updated = new Map(prev);
      updated.delete(clipId);
      return updated;
    });
  };

  return (
    <SubtitleContext.Provider value={{ subtitleTracks, setSubtitleTrack, getSubtitleTrack, deleteSubtitleTrack }}>
      {children}
    </SubtitleContext.Provider>
  );
}

export function useSubtitles() {
  const context = useContext(SubtitleContext);
  if (!context) {
    throw new Error('useSubtitles must be used within SubtitleProvider');
  }
  return context;
}

