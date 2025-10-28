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

/**
 * Export resolution presets
 */
export const EXPORT_PRESETS = {
  source: { width: 0, height: 0, label: 'Source Resolution', description: 'Keep original video resolution' },
  '720p': { width: 1280, height: 720, label: '720p (HD)', description: '1280 × 720' },
  '1080p': { width: 1920, height: 1080, label: '1080p (Full HD)', description: '1920 × 1080' },
  '4k': { width: 3840, height: 2160, label: '4K (Ultra HD)', description: '3840 × 2160' },
  instagram_square: { width: 1080, height: 1080, label: 'Instagram Square', description: '1080 × 1080' },
  instagram_story: { width: 1080, height: 1920, label: 'Instagram Story', description: '1080 × 1920 (9:16)' },
  youtube: { width: 1920, height: 1080, label: 'YouTube', description: '1920 × 1080' },
  tiktok: { width: 1080, height: 1920, label: 'TikTok', description: '1080 × 1920 (9:16)' },
} as const;

/**
 * Export quality presets
 */
export const QUALITY_PRESETS = {
  fast: { label: 'Fast', crf: '28', preset: 'veryfast', description: 'Faster export, larger file' },
  balanced: { label: 'Balanced', crf: '23', preset: 'medium', description: 'Good balance of quality and speed' },
  high: { label: 'High Quality', crf: '18', preset: 'slow', description: 'Best quality, slower export' },
} as const;

