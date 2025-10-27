import { createContext, useContext, useState, ReactNode } from 'react';
import type { VideoFile } from '../types/video';

interface VideoContextType {
  videos: VideoFile[];
  addVideo: (video: VideoFile) => void;
}

const VideoContext = createContext<VideoContextType | undefined>(undefined);

export function VideoProvider({ children }: { children: ReactNode }) {
  const [videos, setVideos] = useState<VideoFile[]>([]);

  const addVideo = (video: VideoFile) => {
    setVideos(prev => [...prev, video]);
  };

  return (
    <VideoContext.Provider value={{ videos, addVideo }}>
      {children}
    </VideoContext.Provider>
  );
}

export function useVideos() {
  const context = useContext(VideoContext);
  if (!context) {
    throw new Error('useVideos must be used within VideoProvider');
  }
  return context;
}

