import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const PDF_MAGIC_BYTES = Buffer.from([0x25, 0x50, 0x44, 0x46]); // "%PDF"
const DEFAULT_MAX_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB max Gmail limit

export interface PDFValidationResult {
  isValid: boolean;
  error?: string;
  sizeBytes?: number;
}

/**
 * Checks if the buffer starts with the PDF magic header `%PDF`.
 */
export function hasValidPdfSignature(buffer: Buffer): boolean {
  if (!buffer || buffer.length < 4) return false;
  return buffer.subarray(0, 4).equals(PDF_MAGIC_BYTES);
}

/**
 * Validates a PDF file buffer against signature, size, and mime.
 */
export function validatePdfBuffer(
  buffer: Buffer,
  mimeType?: string,
  maxSizeBytes = DEFAULT_MAX_SIZE_BYTES
): PDFValidationResult {
  if (!buffer || buffer.length === 0) {
    return { isValid: false, error: 'The uploaded file is empty.' };
  }

  if (buffer.length > maxSizeBytes) {
    const maxMb = (maxSizeBytes / (1024 * 1024)).toFixed(0);
    return {
      isValid: false,
      error: `File size exceeds the ${maxMb}MB limit allowed by Gmail attachments.`,
    };
  }

  // Check magic bytes
  if (!hasValidPdfSignature(buffer)) {
    return {
      isValid: false,
      error: 'Invalid file signature: The file is not a valid PDF document.',
    };
  }

  // Check mime type if provided
  if (mimeType && mimeType.toLowerCase() !== 'application/pdf') {
    return {
      isValid: false,
      error: `Invalid MIME type (${mimeType}). Only application/pdf is accepted.`,
    };
  }

  return {
    isValid: true,
    sizeBytes: buffer.length,
  };
}

/**
 * Saves an uploaded PDF securely to the non-public upload directory.
 * Returns the stored disk path and sanitized filename.
 */
export async function savePdfAttachment(
  buffer: Buffer,
  originalFilename: string
): Promise<{ storedPath: string; safeFilename: string; size: number }> {
  const uploadDir = path.resolve(process.env.UPLOAD_DIR || './uploads/resumes');
  await fs.mkdir(uploadDir, { recursive: true });

  // Sanitize original filename (keep basename, remove illegal characters)
  const cleanOriginal = path.basename(originalFilename).replace(/[^a-zA-Z0-9._-]/g, '_');
  const safeFilename = cleanOriginal.endsWith('.pdf') ? cleanOriginal : `${cleanOriginal}.pdf`;

  // Generate unique disk storage name using hash to prevent collisions and directory traversal
  const hash = crypto.randomBytes(16).toString('hex');
  const storedFilename = `${hash}-${safeFilename}`;
  const storedPath = path.join(uploadDir, storedFilename);

  await fs.writeFile(storedPath, buffer);

  return {
    storedPath,
    safeFilename,
    size: buffer.length,
  };
}

/**
 * Reads an attachment from disk as a Buffer.
 */
export async function readPdfAttachment(storedPath: string): Promise<Buffer> {
  return await fs.readFile(storedPath);
}

/**
 * Deletes an attachment from disk securely.
 */
export async function deletePdfAttachment(storedPath: string): Promise<void> {
  try {
    await fs.unlink(storedPath);
  } catch (err: any) {
    if (err.code !== 'ENOENT') {
      console.error('Error removing attachment file:', err);
    }
  }
}
