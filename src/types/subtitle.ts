export interface Subtitle {
  id: string;
  startTime: number; // Start time in seconds
  endTime: number; // End time in seconds
  text: string; // Subtitle text content
}

export interface SubtitleStyle {
  fontFamily: string;
  fontSize: number;
  color: string; // Hex color
  backgroundColor?: string; // Optional background for readability
  position: 'bottom' | 'top' | 'center';
  alignment: 'left' | 'center' | 'right';
}

export interface SubtitleTrack {
  clipId: string; // Associated clip ID
  subtitles: Subtitle[];
  style: SubtitleStyle;
  enabled: boolean; // Whether subtitles are visible
}

export interface TranscriptionResult {
  format: 'srt' | 'vtt';
  content: string; // Raw subtitle file content
  subtitles: Subtitle[]; // Parsed subtitles
}

