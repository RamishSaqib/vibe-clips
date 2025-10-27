export interface VideoFile {
  id: string;
  path: string;
  filename: string;
  duration: number;
  size: number;
  resolution: {
    width: number;
    height: number;
  };
  thumbnail?: string;
}

