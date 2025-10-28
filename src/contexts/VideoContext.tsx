import { createContext, useContext, useState, ReactNode } from 'react';
import type { VideoFile } from '../types/video';

interface VideoContextType {
  videos: VideoFile[];
  addVideo: (video: VideoFile) => void;
  removeVideo: (videoId: string) => void;
}

const VideoContext = createContext<VideoContextType | undefined>(undefined);

export function VideoProvider({ children }: { children: ReactNode }) {
  const [videos, setVideos] = useState<VideoFile[]>([]);

  const addVideo = (video: VideoFile) => {
    setVideos(prev => [...prev, video]);
  };

  const removeVideo = (videoId: string) => {
    setVideos(prev => prev.filter(v => v.id !== videoId));
  };

  return (
    <VideoContext.Provider value={{ videos, addVideo, removeVideo }}>
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

