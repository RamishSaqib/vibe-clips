import { useState, useEffect } from 'react';
import type { VideoFile } from '../types/video';

export function useVideoMetadata(filePath: string): Partial<VideoFile> | null {
  const [metadata, setMetadata] = useState<Partial<VideoFile> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!filePath) return;

    const video = document.createElement('video');
    video.preload = 'metadata';

    const handleLoadedMetadata = () => {
      setMetadata({
        duration: video.duration,
        resolution: {
          width: video.videoWidth,
          height: video.videoHeight,
        },
      });
    };

    const handleError = () => {
      setError('Failed to load video metadata');
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('error', handleError);
    video.src = filePath;

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('error', handleError);
    };
  }, [filePath]);

  return metadata;
}

