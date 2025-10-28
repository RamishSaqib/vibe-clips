/**
 * Timeline rendering constants
 */
export const TIMELINE_CONSTANTS = {
  PIXELS_PER_SECOND: 30,
  RULER_HEIGHT: 30,
  TRACK_HEIGHT: 60,
  HANDLE_WIDTH: 14,
  HANDLE_TOLERANCE: 8,
  MIN_CLIP_DURATION: 0.1,
  DEFAULT_ZOOM: 1,
  MIN_ZOOM: 0.5,
  MAX_ZOOM: 10,
  SNAP_THRESHOLD: 0.5, // seconds - snap clips within 0.5s of edges
} as const;

/**
 * Recording resolution presets
 */
export const RECORDING_RESOLUTIONS = [
  { width: 640, height: 480, label: '480p' },
  { width: 1280, height: 720, label: '720p' },
  { width: 1920, height: 1080, label: '1080p' },
] as const;

/**
 * Frame rate limiter for drag operations (ms)
 */
export const DRAG_THROTTLE_MS = 16; // ~60fps
export const TRIM_THROTTLE_MS = 16; // ~60fps

/**
 * Movement threshold for detecting drag vs click (pixels)
 */
export const DRAG_THRESHOLD = 3;

