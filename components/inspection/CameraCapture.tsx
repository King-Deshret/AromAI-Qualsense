'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { Stack, Group, Button, Alert, Paper, Text, Loader } from '@mantine/core';
import {
  IconCamera,
  IconUpload,
  IconAlertCircle,
  IconRefresh,
} from '@tabler/icons-react';

export interface CameraCaptureProps {
  /** Called with the captured image Blob after a successful capture */
  onCapture: (imageBlob: Blob) => void;
  /** Called when an error occurs (permission denied, camera unavailable, etc.) */
  onError: (error: string) => void;
  /** Called when the user requests to use file upload instead */
  onFallbackRequest: () => void;
}

type CameraState = 'initializing' | 'active' | 'error' | 'captured';

/**
 * CameraCapture component provides WebRTC-based camera access with live preview
 * and a scan/capture button. After capture, the image Blob is passed to onCapture
 * for auto-posting to the AI service.
 *
 * Handles:
 * - Camera permission denial (NotAllowedError)
 * - No camera available (NotFoundError)
 * - Generic camera errors
 * - Cleanup of media stream on unmount
 */
export function CameraCapture({ onCapture, onError, onFallbackRequest }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraState, setCameraState] = useState<CameraState>('initializing');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isCapturing, setIsCapturing] = useState(false);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    setCameraState('initializing');
    setErrorMessage('');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setCameraState('active');
    } catch (err: unknown) {
      stopStream();

      let message: string;

      if (err instanceof DOMException) {
        switch (err.name) {
          case 'NotAllowedError':
            message =
              'Camera permission was denied. Please allow camera access in your browser settings to use auto-capture.';
            break;
          case 'NotFoundError':
            message =
              'No camera was found on this device. Please connect a camera or use the file upload option.';
            break;
          case 'NotReadableError':
            message =
              'The camera is currently in use by another application. Please close other apps using the camera and try again.';
            break;
          case 'OverconstrainedError':
            message =
              'The requested camera configuration is not supported by your device. Trying with default settings.';
            break;
          default:
            message = `Camera error: ${err.message || 'An unexpected error occurred while accessing the camera.'}`;
        }
      } else {
        message = 'An unexpected error occurred while accessing the camera.';
      }

      setErrorMessage(message);
      setCameraState('error');
      onError(message);
    }
  }, [onError, stopStream]);

  useEffect(() => {
    startCamera();

    return () => {
      stopStream();
    };
  }, [startCamera, stopStream]);

  const handleCapture = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;

    setIsCapturing(true);

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Failed to get canvas context');
      }

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => {
            if (b) {
              resolve(b);
            } else {
              reject(new Error('Failed to capture image from canvas'));
            }
          },
          'image/jpeg',
          0.92
        );
      });

      setCameraState('captured');
      stopStream();
      onCapture(blob);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to capture image. Please try again.';
      setErrorMessage(message);
      onError(message);
    } finally {
      setIsCapturing(false);
    }
  }, [onCapture, onError, stopStream]);

  const handleRetryCamera = useCallback(() => {
    stopStream();
    startCamera();
  }, [startCamera, stopStream]);

  return (
    <Stack gap="md">
      {/* Error state with fallback offer */}
      {cameraState === 'error' && (
        <Alert
          icon={<IconAlertCircle size={16} />}
          title="Camera Unavailable"
          color="red"
          variant="light"
        >
          <Stack gap="sm">
            <Text size="sm">{errorMessage}</Text>
            <Group gap="sm">
              <Button
                size="xs"
                variant="light"
                leftSection={<IconRefresh size={14} />}
                onClick={handleRetryCamera}
              >
                Retry Camera
              </Button>
              <Button
                size="xs"
                variant="filled"
                leftSection={<IconUpload size={14} />}
                onClick={onFallbackRequest}
              >
                Use File Upload Instead
              </Button>
            </Group>
          </Stack>
        </Alert>
      )}

      {/* Initializing state */}
      {cameraState === 'initializing' && (
        <Paper p="xl" withBorder style={{ textAlign: 'center' }}>
          <Stack align="center" gap="sm">
            <Loader size="md" />
            <Text size="sm" c="dimmed">
              Accessing camera...
            </Text>
          </Stack>
        </Paper>
      )}

      {/* Live video preview */}
      {(cameraState === 'active' || cameraState === 'initializing') && (
        <Paper
          withBorder
          style={{
            overflow: 'hidden',
            borderRadius: 'var(--mantine-radius-md)',
            position: 'relative',
            display: cameraState === 'active' ? 'block' : 'none',
          }}
        >
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{
              width: '100%',
              height: 'auto',
              display: 'block',
              maxHeight: '480px',
              objectFit: 'cover',
            }}
          />
        </Paper>
      )}

      {/* Hidden canvas for frame capture */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* Capture button */}
      {cameraState === 'active' && (
        <Group justify="center">
          <Button
            size="lg"
            leftSection={<IconCamera size={20} />}
            onClick={handleCapture}
            loading={isCapturing}
            disabled={isCapturing}
          >
            {isCapturing ? 'Capturing...' : 'Scan / Capture'}
          </Button>
        </Group>
      )}

      {/* Captured state */}
      {cameraState === 'captured' && (
        <Alert
          icon={<IconCamera size={16} />}
          title="Image Captured"
          color="green"
          variant="light"
        >
          <Text size="sm">
            Image captured successfully. Processing with AI service...
          </Text>
        </Alert>
      )}

      {/* Fallback link always visible when camera is active */}
      {cameraState === 'active' && (
        <Group justify="center">
          <Button
            variant="subtle"
            size="xs"
            leftSection={<IconUpload size={14} />}
            onClick={onFallbackRequest}
          >
            Or use file upload instead
          </Button>
        </Group>
      )}
    </Stack>
  );
}
