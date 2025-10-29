import { useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import './ImportZone.css';

interface ImportZoneProps {
  onFilesSelected: (files: FileList) => void;
  onFilesWithPaths: (filePaths: string[]) => void;
}

export function ImportZone({ onFilesSelected, onFilesWithPaths }: ImportZoneProps) {
  const [isDragging, setIsDragging] = useState(false);

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

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      onFilesSelected(files);
    }
  };

  const handleClick = async () => {
    try {
      console.log('Opening Tauri file picker...');
      
      const selected = await open({
        multiple: true,
        filters: [{
          name: 'Video',
          extensions: ['mp4', 'mov', 'MOV']
        }]
      });

      if (selected) {
        const paths = Array.isArray(selected) ? selected : [selected];
        console.log('Native paths from Tauri picker:', paths);
        onFilesWithPaths(paths);
      } else {
        console.log('File picker cancelled');
      }
    } catch (error) {
      console.error('Failed to open file picker:', error);
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
      <div className="import-zone-content">
        <svg className="import-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        <h3>Click or drag files to import</h3>
        <p>Browse for MP4 or MOV files</p>
        <span className="file-types">
          Supports: MP4, MOV<br/>
          <small style={{ fontSize: '0.85em', opacity: 0.8 }}>
            MOV files auto-convert to MP4 (file picker only)
          </small>
        </span>
      </div>
    </div>
  );
}

