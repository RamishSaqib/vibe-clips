import { useCallback, useState } from 'react';
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
        // Read file as array buffer
        const arrayBuffer = await file.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        
        // Convert to base64 for sending to backend
        let binary = '';
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);
        const dataUrl = `data:video/mp4;base64,${base64}`;
        
        // Save to temp file via Tauri backend
        const tempPath = await invoke<string>('save_temp_video', { dataUrl });
        
        // Get video metadata
        const duration = await invoke<number>('get_video_duration_from_file', { videoPath: tempPath });
        
        // Get video resolution using a video element
        const video = document.createElement('video');
        video.src = dataUrl;
        await new Promise((resolve) => {
          video.addEventListener('loadedmetadata', resolve);
        });
        
        // Generate thumbnail
        const tempDir = await invoke<string>('get_temp_dir');
        const thumbnailPath = `${tempDir}\\thumbnail_${Date.now()}.png`;
        try {
          await invoke<string>('generate_video_thumbnail', { 
            videoPath: tempPath,
            outputPath: thumbnailPath 
          });
        } catch (err) {
          console.warn('Failed to generate thumbnail:', err);
        }

        const newVideo: VideoFile = {
          id: `${Date.now()}-${Math.random()}`,
          path: tempPath,
          filename: file.name,
          duration: duration,
          size: file.size,
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

