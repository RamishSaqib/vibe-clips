import { useState, useRef, useEffect } from 'react';
import './ImportZone.css';

interface ImportZoneProps {
  onFilesSelected: (files: FileList) => void;
}

export function ImportZone({ onFilesSelected }: ImportZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Listen for Tauri file-drop events
  useEffect(() => {
    const setupTauriFileDrop = async () => {
      try {
        const { listen } = await import('@tauri-apps/api/event');
        
        // Listen for file-drop event from Tauri backend
        await listen('file-drop', (event) => {
          const filePaths = event.payload as string[];
          
          if (filePaths && filePaths.length > 0) {
            // Convert file paths to File objects
            Promise.all(
              filePaths.map(async (path) => {
                try {
                  // Use Tauri's fs API to read the file
                  const { readBinaryFile } = await import('@tauri-apps/plugin-fs');
                  const data = await readBinaryFile(path);
                  
                  // Create a File object from the data
                  const fileName = path.split(/[/\\]/).pop() || 'unknown';
                  const file = new File([data], fileName, { 
                    type: 'video/mp4' // Default to video
                  });
                  
                  return file;
                } catch (error) {
                  console.error('Error reading file:', path, error);
                  return null;
                }
              })
            ).then(files => {
              const validFiles = files.filter(f => f !== null) as File[];
              if (validFiles.length > 0) {
                // Create a FileList-like object
                const dataTransfer = new DataTransfer();
                validFiles.forEach(file => dataTransfer.items.add(file));
                onFilesSelected(dataTransfer.files);
              }
            });
          }
        });
      } catch (error) {
      }
    };
    
    setupTauriFileDrop();
  }, [onFilesSelected]);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    console.log('handleDrop called');
    console.log('dataTransfer.files:', e.dataTransfer.files);
    console.log('dataTransfer.types:', Array.from(e.dataTransfer.types));
    
    const files = e.dataTransfer.files;
    
    if (files && files.length > 0) {
      console.log('Files found:', files.length);
      
      // Filter to video files
      const videoFiles = Array.from(files).filter(file => {
        const isVideo = file.type.startsWith('video/') || 
                       file.name.endsWith('.mp4') || 
                       file.name.endsWith('.mov');
        console.log('Checking file:', file.name, 'type:', file.type, 'isVideo:', isVideo);
        return isVideo;
      });
      
      console.log('Video files after filtering:', videoFiles.length);
      
      if (videoFiles.length > 0) {
        // Pass the files from dataTransfer
        onFilesSelected(files);
      }
    } else {
      console.log('No files in dataTransfer');
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFilesSelected(e.target.files);
    }
  };

  return (
    <div 
      className={`import-zone ${isDragging ? 'dragging' : ''}`}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={handleClick}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="video/mp4,video/quicktime,.mp4,.mov"
        multiple
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
      <div className="import-zone-content">
        <svg className="import-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        <h3>Click to import video files</h3>
        <p>Browse for MP4 or MOV files</p>
        <span className="file-types">Supports: MP4, MOV</span>
      </div>
    </div>
  );
}

