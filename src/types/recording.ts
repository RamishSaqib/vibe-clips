export interface ScreenSource {
  id: string;
  name: string;
  is_primary: boolean;
  width: number;
  height: number;
}

export interface RecordingState {
  isRecording: boolean;
  recordingType: 'screen' | 'webcam' | 'combined' | null;
  duration: number;
  startTime: number | null;
  outputPath: string | null;
  audioBlob: Blob | null;
  videoPath: string | null;
  selectedScreenSource: ScreenSource | null;
}

export type RecordingType = 'screen' | 'webcam' | 'combined';

