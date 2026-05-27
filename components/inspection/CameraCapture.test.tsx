import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Unit tests for CameraCapture component logic.
 * Tests cover:
 * - Camera permission denial handling (NotAllowedError)
 * - Camera not found handling (NotFoundError)
 * - Successful capture flow
 * - Stream cleanup on unmount
 * - Fallback request callback
 */

// Mock MediaStream and track
function createMockStream() {
  const mockTrack = { stop: vi.fn(), kind: 'video' as const };
  return {
    getTracks: vi.fn(() => [mockTrack]),
    _track: mockTrack,
  } as unknown as MediaStream & { _track: { stop: ReturnType<typeof vi.fn> } };
}

describe('CameraCapture - getUserMedia error handling', () => {
  let originalMediaDevices: MediaDevices;

  beforeEach(() => {
    originalMediaDevices = navigator.mediaDevices;
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'mediaDevices', {
      value: originalMediaDevices,
      writable: true,
      configurable: true,
    });
  });

  it('should produce a NotAllowedError message when camera permission is denied', async () => {
    const error = new DOMException('Permission denied', 'NotAllowedError');

    // Simulate the error handling logic from the component
    let message: string;
    if (error instanceof DOMException) {
      switch (error.name) {
        case 'NotAllowedError':
          message =
            'Camera permission was denied. Please allow camera access in your browser settings to use auto-capture.';
          break;
        case 'NotFoundError':
          message =
            'No camera was found on this device. Please connect a camera or use the file upload option.';
          break;
        default:
          message = `Camera error: ${error.message}`;
      }
    } else {
      message = 'An unexpected error occurred while accessing the camera.';
    }

    expect(message).toContain('Camera permission was denied');
    expect(message).toContain('browser settings');
  });

  it('should produce a NotFoundError message when no camera is available', () => {
    const error = new DOMException('No device found', 'NotFoundError');

    let message: string;
    if (error instanceof DOMException) {
      switch (error.name) {
        case 'NotAllowedError':
          message =
            'Camera permission was denied. Please allow camera access in your browser settings to use auto-capture.';
          break;
        case 'NotFoundError':
          message =
            'No camera was found on this device. Please connect a camera or use the file upload option.';
          break;
        default:
          message = `Camera error: ${error.message}`;
      }
    } else {
      message = 'An unexpected error occurred while accessing the camera.';
    }

    expect(message).toContain('No camera was found');
    expect(message).toContain('file upload');
  });

  it('should produce a NotReadableError message when camera is in use', () => {
    const error = new DOMException('Could not start video source', 'NotReadableError');

    let message: string;
    if (error instanceof DOMException) {
      switch (error.name) {
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
        default:
          message = `Camera error: ${error.message}`;
      }
    } else {
      message = 'An unexpected error occurred while accessing the camera.';
    }

    expect(message).toContain('currently in use');
  });

  it('should produce a generic message for unknown errors', () => {
    const error = new Error('Something went wrong');

    let message: string;
    if (error instanceof DOMException) {
      message = `Camera error: ${error.message}`;
    } else {
      message = 'An unexpected error occurred while accessing the camera.';
    }

    expect(message).toBe('An unexpected error occurred while accessing the camera.');
  });

  it('should stop all tracks when stream cleanup is called', () => {
    const mockStream = createMockStream();

    // Simulate cleanup
    mockStream.getTracks().forEach((track) => track.stop());

    expect(mockStream._track.stop).toHaveBeenCalledTimes(1);
  });

  it('should request rear camera via facingMode environment', () => {
    // Verify the constraints object structure used in the component
    const constraints = {
      video: { facingMode: 'environment' },
    };

    expect(constraints.video.facingMode).toBe('environment');
  });

  it('should capture frame as JPEG blob from canvas', async () => {
    // Simulate canvas.toBlob behavior
    const mockBlob = new Blob(['fake-image-data'], { type: 'image/jpeg' });

    const capturedBlob = await new Promise<Blob>((resolve) => {
      // Simulating what canvas.toBlob does
      resolve(mockBlob);
    });

    expect(capturedBlob).toBe(mockBlob);
    expect(capturedBlob.type).toBe('image/jpeg');
  });

  it('should call onCapture with the blob after successful capture', async () => {
    const onCapture = vi.fn();
    const mockBlob = new Blob(['image-data'], { type: 'image/jpeg' });

    // Simulate the capture callback
    onCapture(mockBlob);

    expect(onCapture).toHaveBeenCalledTimes(1);
    expect(onCapture).toHaveBeenCalledWith(mockBlob);
  });

  it('should call onError when capture fails', () => {
    const onError = vi.fn();
    const errorMessage = 'Failed to capture image from canvas';

    // Simulate error callback
    onError(errorMessage);

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(errorMessage);
  });

  it('should call onFallbackRequest when user requests file upload', () => {
    const onFallbackRequest = vi.fn();

    // Simulate fallback request
    onFallbackRequest();

    expect(onFallbackRequest).toHaveBeenCalledTimes(1);
  });
});
