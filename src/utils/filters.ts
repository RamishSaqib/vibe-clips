// Helper functions for video filters

import type { ClipFilters } from '../types/filters';

/**
 * Convert filter values to CSS filter string for preview
 */
export function filtersToCSSFilter(filters?: ClipFilters): string {
  if (!filters) return '';
  
  const parts: string[] = [];
  
  if (filters.brightness !== undefined && filters.brightness !== 0) {
    // Convert -100 to 100 to CSS brightness (0 to 2, where 1 is normal)
    const brightness = 1 + (filters.brightness / 100);
    parts.push(`brightness(${brightness})`);
  }
  
  if (filters.contrast !== undefined && filters.contrast !== 0) {
    // Convert -100 to 100 to CSS contrast (0 to 2, where 1 is normal)
    const contrast = 1 + (filters.contrast / 100);
    parts.push(`contrast(${contrast})`);
  }
  
  if (filters.saturation !== undefined && filters.saturation !== 0) {
    // Convert -100 to 100 to CSS saturation (0 to 2, where 1 is normal)
    const saturation = 1 + (filters.saturation / 100);
    parts.push(`saturate(${saturation})`);
  }
  
  return parts.join(' ');
}

/**
 * Convert filter values to FFmpeg eq filter parameters
 */
export function filtersToFFmpegEQ(filters?: ClipFilters): string {
  if (!filters) return '';
  
  const parts: string[] = [];
  
  if (filters.brightness !== undefined && filters.brightness !== 0) {
    // Convert -100 to 100 to brightness value between -1.0 and 1.0
    const brightness = filters.brightness / 100;
    parts.push(`brightness=${brightness}`);
  }
  
  if (filters.contrast !== undefined && filters.contrast !== 0) {
    // Convert -100 to 100 to contrast value between 0.0 and 2.0
    const contrast = 1 + (filters.contrast / 100);
    parts.push(`contrast=${contrast}`);
  }
  
  if (filters.saturation !== undefined && filters.saturation !== 0) {
    // Convert -100 to 100 to saturation value between 0.0 and 2.0
    const saturation = 1 + (filters.saturation / 100);
    parts.push(`saturation=${saturation}`);
  }
  
  if (parts.length === 0) return '';
  
  return `eq=${parts.join(':')}`;
}

