import type { OverlayPosition } from '../types/timeline';

export function calculateOverlayPosition(
  position: OverlayPosition,
  baseWidth: number,
  baseHeight: number,
  overlayWidth: number,
  overlayHeight: number,
  padding: number = 20
): { x: number; y: number } {
  switch (position) {
    case 'bottom-left':
      return { x: padding, y: baseHeight - overlayHeight - padding };
    case 'bottom-right':
      return { x: baseWidth - overlayWidth - padding, y: baseHeight - overlayHeight - padding };
    case 'top-left':
      return { x: padding, y: padding };
    case 'top-right':
      return { x: baseWidth - overlayWidth - padding, y: padding };
    case 'center':
      return { x: (baseWidth - overlayWidth) / 2, y: (baseHeight - overlayHeight) / 2 };
    default:
      return { x: padding, y: baseHeight - overlayHeight - padding };
  }
}

