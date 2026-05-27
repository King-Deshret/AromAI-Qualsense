import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { validateImage, detectImageFormat } from '../image-validation';

// --- Helpers to create mock File objects with specific byte headers ---

let mockImageWidth = 1024;
let mockImageHeight = 768;
let mockImageLoadError = false;

/**
 * Creates a mock File that, when sliced and read via FileReader,
 * returns the specified header bytes. The `size` property is overridden
 * to simulate large files without allocating memory.
 */
function createMockFile(
  headerBytes: number[],
  size: number,
  name: string = 'test.jpg',
  type: string = 'image/jpeg'
): File {
  const buffer = new ArrayBuffer(headerBytes.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < headerBytes.length; i++) {
    view[i] = headerBytes[i];
  }

  // Create a real Blob with the header bytes
  const blob = new Blob([buffer], { type });

  // Create a File-like object with overridden size
  const file = Object.create(File.prototype);
  Object.defineProperties(file, {
    name: { value: name, writable: false },
    type: { value: type, writable: false },
    size: { value: size, writable: false },
    slice: {
      value: (_start?: number, _end?: number) => {
        // Return a blob containing the header bytes
        return new Blob([buffer.slice(0, Math.min(_end || buffer.byteLength, buffer.byteLength))], { type });
      },
    },
  });

  return file as File;
}

// JPEG header: FF D8 FF
const JPEG_HEADER = [0xff, 0xd8, 0xff, 0xe0];

// PNG header: 89 50 4E 47
const PNG_HEADER = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

// WebP header: RIFF....WEBP
const WEBP_HEADER = [
  0x52, 0x49, 0x46, 0x46, // RIFF
  0x00, 0x00, 0x00, 0x00, // file size (placeholder)
  0x57, 0x45, 0x42, 0x50, // WEBP
];

// Invalid header (GIF)
const GIF_HEADER = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61];

// --- Mock browser APIs ---

class MockFileReader {
  result: ArrayBuffer | null = null;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;

  readAsArrayBuffer(blob: Blob) {
    blob.arrayBuffer().then((buffer) => {
      this.result = buffer;
      this.onload?.();
    }).catch(() => {
      this.onerror?.();
    });
  }
}

class MockImage {
  naturalWidth = 0;
  naturalHeight = 0;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;

  set src(_value: string) {
    // Use queueMicrotask to simulate async image load
    queueMicrotask(() => {
      if (mockImageLoadError) {
        this.onerror?.();
      } else {
        this.naturalWidth = mockImageWidth;
        this.naturalHeight = mockImageHeight;
        this.onload?.();
      }
    });
  }
}

beforeEach(() => {
  mockImageWidth = 1024;
  mockImageHeight = 768;
  mockImageLoadError = false;

  // Mock FileReader
  vi.stubGlobal('FileReader', MockFileReader);

  // Mock URL.createObjectURL and URL.revokeObjectURL
  vi.stubGlobal('URL', {
    ...globalThis.URL,
    createObjectURL: vi.fn(() => 'blob:mock-url'),
    revokeObjectURL: vi.fn(),
  });

  // Mock Image constructor
  vi.stubGlobal('Image', MockImage);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// --- detectImageFormat unit tests ---

describe('detectImageFormat', () => {
  it('detects JPEG format from magic bytes', () => {
    const header = new Uint8Array(JPEG_HEADER);
    expect(detectImageFormat(header)).toBe('jpeg');
  });

  it('detects PNG format from magic bytes', () => {
    const header = new Uint8Array(PNG_HEADER);
    expect(detectImageFormat(header)).toBe('png');
  });

  it('detects WebP format from magic bytes', () => {
    const header = new Uint8Array(WEBP_HEADER);
    expect(detectImageFormat(header)).toBe('webp');
  });

  it('returns null for unrecognized format (GIF)', () => {
    const header = new Uint8Array(GIF_HEADER);
    expect(detectImageFormat(header)).toBeNull();
  });

  it('returns null for empty header', () => {
    const header = new Uint8Array([]);
    expect(detectImageFormat(header)).toBeNull();
  });

  it('returns null for header too short for any format', () => {
    const header = new Uint8Array([0xff, 0xd8]);
    expect(detectImageFormat(header)).toBeNull();
  });

  it('returns null for random bytes', () => {
    const header = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b]);
    expect(detectImageFormat(header)).toBeNull();
  });

  it('does not detect WebP if RIFF is present but WEBP is missing at offset 8', () => {
    const header = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, // RIFF
      0x00, 0x00, 0x00, 0x00,
      0x41, 0x56, 0x49, 0x20, // AVI  (not WEBP)
    ]);
    expect(detectImageFormat(header)).toBeNull();
  });
});

// --- validateImage unit tests ---

describe('validateImage', () => {
  describe('format validation (Requirement 3.1)', () => {
    it('accepts a valid JPEG file', async () => {
      const file = createMockFile(JPEG_HEADER, 1024, 'photo.jpg', 'image/jpeg');
      const result = await validateImage(file);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('accepts a valid PNG file', async () => {
      const file = createMockFile(PNG_HEADER, 2048, 'photo.png', 'image/png');
      const result = await validateImage(file);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('accepts a valid WebP file', async () => {
      const file = createMockFile(WEBP_HEADER, 3000, 'photo.webp', 'image/webp');
      const result = await validateImage(file);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('rejects a GIF file (unsupported format)', async () => {
      const file = createMockFile(GIF_HEADER, 1024, 'image.gif', 'image/gif');
      const result = await validateImage(file);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.stringContaining('Invalid image format')
      );
    });

    it('rejects a file with random bytes (no valid header)', async () => {
      const file = createMockFile([0x00, 0x01, 0x02, 0x03], 1024, 'file.bin', 'application/octet-stream');
      const result = await validateImage(file);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.stringContaining('Invalid image format')
      );
    });
  });

  describe('file size validation (Requirement 3.2)', () => {
    it('accepts a file exactly at 10 MB', async () => {
      const file = createMockFile(JPEG_HEADER, 10 * 1024 * 1024, 'large.jpg');
      const result = await validateImage(file);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('rejects a file exceeding 10 MB', async () => {
      const file = createMockFile(JPEG_HEADER, 10 * 1024 * 1024 + 1, 'too-large.jpg');
      const result = await validateImage(file);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.stringContaining('exceeds the maximum allowed size of 10 MB')
      );
    });

    it('accepts a small file (1 KB)', async () => {
      const file = createMockFile(JPEG_HEADER, 1024, 'small.jpg');
      const result = await validateImage(file);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('dimension validation (Requirements 3.3, 3.4)', () => {
    it('accepts dimensions at minimum (640x480)', async () => {
      mockImageWidth = 640;
      mockImageHeight = 480;
      const file = createMockFile(JPEG_HEADER, 5000, 'min.jpg');
      const result = await validateImage(file);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('accepts dimensions at maximum (4096x3072)', async () => {
      mockImageWidth = 4096;
      mockImageHeight = 3072;
      const file = createMockFile(JPEG_HEADER, 5000, 'max.jpg');
      const result = await validateImage(file);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('rejects dimensions below minimum width', async () => {
      mockImageWidth = 639;
      mockImageHeight = 480;
      const file = createMockFile(JPEG_HEADER, 5000, 'narrow.jpg');
      const result = await validateImage(file);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.stringContaining('below the minimum required size of 640x480')
      );
    });

    it('rejects dimensions below minimum height', async () => {
      mockImageWidth = 640;
      mockImageHeight = 479;
      const file = createMockFile(JPEG_HEADER, 5000, 'short.jpg');
      const result = await validateImage(file);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.stringContaining('below the minimum required size of 640x480')
      );
    });

    it('rejects dimensions exceeding maximum width', async () => {
      mockImageWidth = 4097;
      mockImageHeight = 3072;
      const file = createMockFile(JPEG_HEADER, 5000, 'wide.jpg');
      const result = await validateImage(file);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.stringContaining('exceed the maximum allowed size of 4096x3072')
      );
    });

    it('rejects dimensions exceeding maximum height', async () => {
      mockImageWidth = 4096;
      mockImageHeight = 3073;
      const file = createMockFile(JPEG_HEADER, 5000, 'tall.jpg');
      const result = await validateImage(file);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.stringContaining('exceed the maximum allowed size of 4096x3072')
      );
    });
  });

  describe('corrupt/unreadable file (Requirement 3.6)', () => {
    it('reports error when image cannot be decoded', async () => {
      mockImageLoadError = true;
      const file = createMockFile(JPEG_HEADER, 5000, 'corrupt.jpg');
      const result = await validateImage(file);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.stringContaining('could not be decoded as a valid image')
      );
    });
  });

  describe('multiple errors reported together (Requirement 3.5)', () => {
    it('reports both format and size errors together', async () => {
      const file = createMockFile(GIF_HEADER, 11 * 1024 * 1024, 'bad.gif', 'image/gif');
      const result = await validateImage(file);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
      expect(result.errors).toContainEqual(
        expect.stringContaining('Invalid image format')
      );
      expect(result.errors).toContainEqual(
        expect.stringContaining('exceeds the maximum allowed size of 10 MB')
      );
    });

    it('reports size and dimension errors together', async () => {
      mockImageWidth = 320;
      mockImageHeight = 240;
      const file = createMockFile(JPEG_HEADER, 11 * 1024 * 1024, 'bad.jpg');
      const result = await validateImage(file);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
      expect(result.errors).toContainEqual(
        expect.stringContaining('exceeds the maximum allowed size of 10 MB')
      );
      expect(result.errors).toContainEqual(
        expect.stringContaining('below the minimum required size of 640x480')
      );
    });

    it('reports dimension exceeding maximum', async () => {
      mockImageWidth = 5000;
      mockImageHeight = 3072;
      const file = createMockFile(JPEG_HEADER, 5000, 'wide.jpg');
      const result = await validateImage(file);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.stringContaining('exceed the maximum allowed size of 4096x3072')
      );
    });
  });
});
