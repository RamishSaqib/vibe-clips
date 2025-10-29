import { useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { VideoFile } from '../../types/video';
import { ImportZone } from './ImportZone';
import { MediaLibrary } from './MediaLibrary';
import { useVideos } from '../../contexts/VideoContext';

export function Import() {
  const { videos, addVideo } = useVideos();

  // Handle files with native paths (from Tauri file picker)
  const handleFilesWithPaths = useCallback(async (filePaths: string[]) => {
    console.log('Processing files with native paths:', filePaths);
    
    for (let index = 0; index < filePaths.length; index++) {
      let filePath = filePaths[index];
      const originalFilename = filePath.split(/[/\\]/).pop() || 'unknown';
      
      try {
        console.log('Processing file with native path:', filePath);
        
        // Auto-convert MOV files to MP4 for compatibility
        if (filePath.toLowerCase().endsWith('.mov')) {
          console.log('MOV file detected, converting to MP4...');
          try {
            const convertedPath = await invoke<string>('import_video_file', { filePath });
            console.log('Converted from:', filePath);
            console.log('Converted to:', convertedPath);
            filePath = convertedPath;
            
            // Wait for file to be fully written
            await new Promise(resolve => setTimeout(resolve, 500));
          } catch (convError) {
            console.error('MOV conversion failed:', convError);
            // Continue with original path
          }
        }
        
        console.log('Using FFmpeg for metadata extraction:', filePath);
        
        // Get file size
        const { stat } = await import('@tauri-apps/plugin-fs');
        const fileStats = await stat(filePath);
        
        // Get video duration using FFmpeg
        const duration = await invoke<number>('get_video_duration_from_file', { videoPath: filePath });
        
        const newVideo: VideoFile = {
          id: `${Date.now()}-${index}-${Math.random()}`,
          path: filePath,
          filename: originalFilename.replace('.mov', '.mp4').replace('.MOV', '.mp4'),
          duration: duration,
          size: Number(fileStats.size),
          resolution: {
            width: 1920,
            height: 1080,
          },
        };
        
        addVideo(newVideo);
        console.log('Successfully loaded video:', originalFilename);
      } catch (error) {
        console.error('Failed to load video:', originalFilename, error);
      }
    }
  }, [addVideo]);

  // Fallback handler for files without native paths (drag & drop)
  const handleFilesSelected = useCallback(async (files: FileList) => {
    console.log('Processing files without native paths (fallback)');
    
    for (let index = 0; index < files.length; index++) {
      const file = files[index];
      
      try {
        console.warn('Using data URL fallback for:', file.name, '- MOV conversion not available');
        const dataUrl = await readFileAsDataURL(file);
        await loadVideoMetadata(dataUrl, file, index, addVideo);
      } catch (error) {
        console.error('Failed to load video:', file.name, error);
        // Add with default metadata
        const dataUrl = await readFileAsDataURL(file);
        const newVideo: VideoFile = {
          id: `${Date.now()}-${index}-${Math.random()}`,
          path: dataUrl,
          filename: file.name,
          duration: 60,
          size: file.size,
          resolution: {
            width: 1920,
            height: 1080,
          },
        };
        addVideo(newVideo);
        console.warn('Added video with default metadata:', file.name);
      }
    }
  }, [addVideo]);

  return (
    <div className="import-section">
      <ImportZone 
        onFilesSelected={handleFilesSelected}
        onFilesWithPaths={handleFilesWithPaths}
      />
      <div style={{ marginTop: '1rem', height: '300px', overflow: 'auto' }}>
        <MediaLibrary videos={videos} />
      </div>
    </div>
  );
}

// Helper functions
async function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function loadVideoMetadata(
  dataUrl: string,
  file: File,
  index: number,
  addVideo: (video: VideoFile) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.src = dataUrl;

    const timeoutId = setTimeout(() => {
      console.warn('Metadata timeout for:', file.name);
      reject(new Error('Metadata timeout'));
    }, 3000);

    video.addEventListener('loadedmetadata', () => {
      clearTimeout(timeoutId);
      const newVideo: VideoFile = {
        id: `${Date.now()}-${index}-${Math.random()}`,
        path: dataUrl,
        filename: file.name,
        duration: video.duration,
        size: file.size,
        resolution: {
          width: video.videoWidth,
          height: video.videoHeight,
        },
      };
      addVideo(newVideo);
      console.log('Successfully loaded video via browser:', file.name);
      resolve();
    });

    video.addEventListener('error', (e) => {
      clearTimeout(timeoutId);
      console.error('Failed to load video metadata via browser:', file.name, e);
      reject(new Error('Video load error'));
    });
  });
}

