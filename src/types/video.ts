export interface VideoFile {
  id: string;
  path: string;
  filename: string;
  file?: File; // Store the File object for browser API
  duration: number;
  size: number;
  resolution: {
    width: number;
    height: number;
  };
  thumbnail?: string;
}

