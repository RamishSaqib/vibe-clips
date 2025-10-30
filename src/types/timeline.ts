import type { VideoFile } from './video';
import type { ClipFilters } from './filters';

export interface TimelineClip {
  id: string;
  videoFileId: string;
  startTime: number; // Position on timeline in seconds
  duration: number; // Current duration after trimming
  trimStart: number; // Trim in-point in seconds (offset from clip start)
  trimEnd: number; // Trim out-point in seconds (offset from clip start)
  track: number; // Track number (0, 1, or 2)
  filters?: ClipFilters; // Optional filters applied to clip
}

export type OverlayPosition = 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right' | 'center';

export interface TrackState {
  muted: boolean;
  solo: boolean;
  overlayPosition?: OverlayPosition; // Position for overlay tracks (1 & 2), undefined means use default
}

export interface TimelineState {
  clips: TimelineClip[];
  playheadPosition: number; // Current playhead position in seconds
  zoom: number; // Zoom level (1 = normal, 2 = doubled, etc.)
  scrollOffset: number; // Horizontal scroll offset in pixels
  selectedClipId: string | null;
  snapEnabled: boolean; // Whether snap-to-edge is enabled
  tracks: TrackState[]; // Track states (mute/solo) - index matches track number
}

