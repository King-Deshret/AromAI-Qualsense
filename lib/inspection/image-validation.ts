/**
 * Client-side image validation for inspection images.
 * Validates file format (magic bytes), file size, and image dimensions.
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
 */

export interface ImageValidationResult {
  valid: boolean;
  errors: string[];
}

/** Maximum file size: 10 MB */
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/** Minimum dimensions */
const MIN_WIDTH = 640;
const MIN_HEIGHT = 480;

/** Maximum dimensions */
const MAX_WIDTH = 4096;
const MAX_HEIGHT = 3072;

/** JPEG magic bytes: FF D8 FF */
const JPEG_MAGIC = [0xff, 0xd8, 0xff];

/** PNG magic bytes: 89 50 4E 47 */
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47];

/** WebP magic bytes: RIFF at offset 0, WEBP at offset 8 */
const WEBP_RIFF = [0x52, 0x49, 0x46, 0x46];
const WEBP_MAGIC = [0x57, 0x45, 0x42, 0x50];

/**
 * Reads the first N bytes of a file as a Uint8Array.
 */
function readFileHeader(file: File, bytes: number): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(new Uint8Array(reader.result as ArrayBuffer));
    };
    reader.onerror = () => {
      reject(new Error('Failed to read file header'));
    };
    reader.readAsArrayBuffer(file.slice(0, bytes));
  });
}

/**
 * Checks if the file header matches one of the accepted image formats.
 * Returns the detected format name or null if unrecognized.
 */
export function detectImageFormat(header: Uint8Array): 'jpeg' | 'png' | 'webp' | null {
  if (header.length < 3) return null;

  // Check JPEG: FF D8 FF
  if (
    header[0] === JPEG_MAGIC[0] &&
    header[1] === JPEG_MAGIC[1] &&
    header[2] === JPEG_MAGIC[2]
  ) {
    return 'jpeg';
  }

  // Check PNG: 89 50 4E 47
  if (
    header.length >= 4 &&
    header[0] === PNG_MAGIC[0] &&
    header[1] === PNG_MAGIC[1] &&
    header[2] === PNG_MAGIC[2] &&
    header[3] === PNG_MAGIC[3]
  ) {
    return 'png';
  }

  // Check WebP: RIFF at offset 0 AND WEBP at offset 8
  if (
    header.length >= 12 &&
    header[0] === WEBP_RIFF[0] &&
    header[1] === WEBP_RIFF[1] &&
    header[2] === WEBP_RIFF[2] &&
    header[3] === WEBP_RIFF[3] &&
    header[8] === WEBP_MAGIC[0] &&
    header[9] === WEBP_MAGIC[1] &&
    header[10] === WEBP_MAGIC[2] &&
    header[11] === WEBP_MAGIC[3]
  ) {
    return 'webp';
  }

  return null;
}

/**
 * Loads an image from a File and returns its natural dimensions.
 * Throws if the image cannot be decoded.
 */
function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to decode image'));
    };
    img.src = url;
  });
}

/**
 * Validates an image file for inspection use.
 * Checks format (magic bytes), file size, and dimensions.
 * Reports ALL violated constraints together (does not short-circuit).
 *
 * @param file - The File object to validate
 * @returns Promise resolving to validation result with all errors
 */
export async function validateImage(file: File): Promise<ImageValidationResult> {
  const errors: string[] = [];

  // 1. Validate file format via magic bytes (Requirement 3.1)
  let formatValid = false;
  try {
    const header = await readFileHeader(file, 12);
    const format = detectImageFormat(header);
    if (format === null) {
      errors.push(
        'Invalid image format. Accepted formats: JPEG, PNG, WebP. File header does not match any accepted format.'
      );
    } else {
      formatValid = true;
    }
  } catch {
    errors.push('Unable to read file. The file may be corrupt or unreadable.');
  }

  // 2. Validate file size (Requirement 3.2)
  if (file.size > MAX_FILE_SIZE) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
    errors.push(
      `File size (${sizeMB} MB) exceeds the maximum allowed size of 10 MB.`
    );
  }

  // 3. Validate dimensions (Requirements 3.3, 3.4)
  // Only check dimensions if format is valid (otherwise image won't load)
  if (formatValid) {
    try {
      const { width, height } = await getImageDimensions(file);

      if (width < MIN_WIDTH || height < MIN_HEIGHT) {
        errors.push(
          `Image dimensions (${width}x${height}) are below the minimum required size of ${MIN_WIDTH}x${MIN_HEIGHT} pixels.`
        );
      }

      if (width > MAX_WIDTH || height > MAX_HEIGHT) {
        errors.push(
          `Image dimensions (${width}x${height}) exceed the maximum allowed size of ${MAX_WIDTH}x${MAX_HEIGHT} pixels.`
        );
      }
    } catch {
      // Requirement 3.6: file cannot be decoded as valid image
      errors.push(
        'The file could not be decoded as a valid image. The file may be corrupt or unreadable.'
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
