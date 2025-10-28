import { useEffect, useRef, useState } from 'react';

interface UseCameraPreviewOptions {
  deviceId: string | null;
  resolution: { width: number; height: number };
  includeAudio?: boolean;
  enabled?: boolean;
}

interface UseCameraPreviewResult {
  previewRef: React.RefObject<HTMLVideoElement>;
  previewStream: MediaStream | null;
  error: string | null;
  isLoading: boolean;
}

/**
 * Hook for managing camera preview stream
 * Automatically starts/stops preview based on device and resolution changes
 */
export function useCameraPreview({
  deviceId,
  resolution,
  includeAudio = false,
  enabled = true,
}: UseCameraPreviewOptions): UseCameraPreviewResult {
  const previewRef = useRef<HTMLVideoElement>(null);
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!deviceId || !enabled) {
      // Stop any existing preview
      if (previewStream) {
        previewStream.getTracks().forEach(track => track.stop());
        setPreviewStream(null);
      }
      return;
    }

    let isMounted = true;

    const startPreview = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Stop existing preview first
        if (previewStream) {
          previewStream.getTracks().forEach(track => track.stop());
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: { exact: deviceId },
            width: { ideal: resolution.width },
            height: { ideal: resolution.height }
          },
          audio: includeAudio
        });

        if (!isMounted) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }

        setPreviewStream(stream);
        
        if (previewRef.current) {
          previewRef.current.srcObject = stream;
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to start preview');
          console.error('Camera preview error:', err);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    startPreview();

    return () => {
      isMounted = false;
      if (previewStream) {
        previewStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [deviceId, resolution.width, resolution.height, includeAudio, enabled]);

  return { previewRef, previewStream, error, isLoading };
}

