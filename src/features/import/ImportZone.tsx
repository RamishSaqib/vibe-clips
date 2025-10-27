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
          console.log('Tauri file-drop event:', event);
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
        console.log('Not in Tauri environment or API not available');
      }
    };
    
    setupTauriFileDrop();

    // Also handle standard web drag and drop
    const handleDragover = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    window.addEventListener('dragover', handleDragover);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('dragover', handleDragover);
      window.removeEventListener('drop', handleDrop);
    };
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

    const files = e.dataTransfer.files;
    console.log('Files dropped:', files.length, Array.from(files).map(f => f.name));
    
    if (files && files.length > 0) {
      // Filter to video files
      const videoFiles = Array.from(files).filter(file => {
        const isVideo = file.type.startsWith('video/') || 
                       file.name.endsWith('.mp4') || 
                       file.name.endsWith('.mov');
        console.log('File:', file.name, 'Type:', file.type, 'IsVideo:', isVideo);
        return isVideo;
      });
      
      console.log('Video files after filtering:', videoFiles.length);
      
      if (videoFiles.length > 0) {
        // Simply pass the files from dataTransfer directly
        onFilesSelected(files);
      }
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
        <h3>Drop video files here</h3>
        <p>or click to browse</p>
        <span className="file-types">Supports: MP4, MOV</span>
      </div>
    </div>
  );
}

