import type { VideoFile } from './video';

export interface TimelineClip {
  id: string;
  videoFileId: string;
  startTime: number; // Position on timeline in seconds
  duration: number; // Current duration after trimming
  trimStart: number; // Trim in-point in seconds (offset from clip start)
  trimEnd: number; // Trim out-point in seconds (offset from clip start)
  track: number; // Track number (0 for MVP)
}

export interface TimelineState {
  clips: TimelineClip[];
  playheadPosition: number; // Current playhead position in seconds
  zoom: number; // Zoom level (1 = normal, 2 = doubled, etc.)
  scrollOffset: number; // Horizontal scroll offset in pixels
  selectedClipId: string | null;
}

