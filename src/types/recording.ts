export interface ScreenSource {
  id: string;
  name: string;
  is_primary: boolean;
  width: number;
  height: number;
}

export interface PiPConfig {
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  size: 'small' | 'medium' | 'large';
  padding: number;
}

export interface AudioOptions {
  includeSystemAudio: boolean;
  includeMicAudio: boolean;
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
  // Combined recording specific
  webcamPath: string | null;
  screenPath: string | null;
  pipConfig: PiPConfig | null;
  audioOptions: AudioOptions | null;
  screenStartOffset: number | null; // Seconds that screen started before webcam
}

export type RecordingType = 'screen' | 'webcam' | 'combined';

