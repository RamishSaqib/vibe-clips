import { useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { VideoFile } from '../../types/video';
import { ImportZone } from './ImportZone';
import { MediaLibrary } from './MediaLibrary';
import { useVideos } from '../../contexts/VideoContext';

export function Import() {
  const { videos, addVideo } = useVideos();

  const handleFilesSelected = useCallback(async (files: FileList) => {
    for (const file of Array.from(files)) {
      try {
        // For Tauri file drop, files will have a path property
        // For browser file picker, we need to use the File API
        const filePath = (file as any).path;
        
        if (!filePath) {
          console.error('No file path available for:', file.name);
          continue;
        }
        
        // Get video metadata directly from the file
        const duration = await invoke<number>('get_video_duration_from_file', { videoPath: filePath });
        const fileSize = await invoke<number>('get_file_size', { filePath: filePath });
        
        // Get video resolution using ffprobe
        const video = document.createElement('video');
        video.src = `asset://localhost/${filePath}`;
        
        await new Promise<void>((resolve, reject) => {
          video.addEventListener('loadedmetadata', () => resolve());
          video.addEventListener('error', () => reject(new Error('Failed to load metadata')));
        });
        
        // Generate thumbnail
        const tempDir = await invoke<string>('get_temp_dir');
        const thumbnailPath = `${tempDir}\\thumbnail_${Date.now()}.png`;
        try {
          await invoke<string>('generate_video_thumbnail', { 
            videoPath: filePath,
            outputPath: thumbnailPath 
          });
        } catch (err) {
          console.warn('Failed to generate thumbnail:', err);
        }

        const newVideo: VideoFile = {
          id: `${Date.now()}-${Math.random()}`,
          path: filePath,
          filename: file.name,
          duration: duration,
          size: fileSize,
          resolution: {
            width: video.videoWidth,
            height: video.videoHeight,
          },
          thumbnail: thumbnailPath,
        };
        
        addVideo(newVideo);
      } catch (error) {
        console.error('Failed to import video:', file.name, error);
      }
    }
  }, [addVideo]);

  return (
    <div className="import-section">
      <ImportZone onFilesSelected={handleFilesSelected} />
      <div style={{ marginTop: '1rem', height: '300px', overflow: 'auto' }}>
        <MediaLibrary videos={videos} />
      </div>
    </div>
  );
}

