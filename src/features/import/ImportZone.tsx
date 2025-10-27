import { useState, useRef, useEffect } from 'react';
import './ImportZone.css';

interface ImportZoneProps {
  onFilesSelected: (files: FileList) => void;
}

export function ImportZone({ onFilesSelected }: ImportZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle Tauri's global file drop event
  useEffect(() => {
    const handleGlobalDrop = async () => {
      // Tauri may handle drag and drop at the window level
      // This would need to be implemented in the Rust backend
      console.log('Global drop handler would be called here if implemented in Tauri backend');
    };

    // Listen for drag events on the whole window
    window.addEventListener('dragover', (e) => {
      e.preventDefault();
    });

    window.addEventListener('drop', (e) => {
      e.preventDefault();
      console.log('Window level drop event');
    });

    return () => {
      window.removeEventListener('dragover', () => {});
      window.removeEventListener('drop', () => {});
    };
  }, []);

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

