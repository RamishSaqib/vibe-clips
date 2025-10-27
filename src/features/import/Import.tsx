import { useState, useCallback } from 'react';
import type { VideoFile } from '../../types/video';
import { ImportZone } from './ImportZone';
import { MediaLibrary } from './MediaLibrary';

export function Import() {
  const [videos, setVideos] = useState<VideoFile[]>([]);

  const handleFilesSelected = useCallback((files: FileList) => {
    console.log('handleFilesSelected called with', files.length, 'files');
    Array.from(files).forEach(file => {
      console.log('Processing file:', file.name, 'Type:', file.type);
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.src = dataUrl;

        video.addEventListener('loadedmetadata', () => {
          const newVideo: VideoFile = {
            id: `${Date.now()}-${Math.random()}`,
            path: dataUrl,
            filename: file.name,
            duration: video.duration,
            size: file.size,
            resolution: {
              width: video.videoWidth,
              height: video.videoHeight,
            },
          };
          setVideos(prev => [...prev, newVideo]);
        });

        video.addEventListener('error', () => {
          console.error('Failed to load video metadata:', file.name);
        });
      };
      reader.readAsDataURL(file);
    });
  }, []);

  return (
    <div className="import-section">
      <ImportZone onFilesSelected={handleFilesSelected} />
      <div style={{ marginTop: '1rem', height: '300px', overflow: 'auto' }}>
        <MediaLibrary videos={videos} />
      </div>
    </div>
  );
}

