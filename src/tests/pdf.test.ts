import { describe, it, expect } from 'vitest';
import { validatePdfBuffer, hasValidPdfSignature } from '../lib/pdf';

describe('PDF Attachment Validation Suite', () => {
  const validPdfHeader = Buffer.from('%PDF-1.4\n%âãÏÓ\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF');
  const invalidBuffer = Buffer.from('This is a plain text file, not a PDF');
  const fakePngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  it('correctly verifies PDF magic byte signature (%PDF)', () => {
    expect(hasValidPdfSignature(validPdfHeader)).toBe(true);
    expect(hasValidPdfSignature(invalidBuffer)).toBe(false);
    expect(hasValidPdfSignature(fakePngBuffer)).toBe(false);
  });

  it('validates a legitimate PDF buffer', () => {
    const result = validatePdfBuffer(validPdfHeader, 'application/pdf');
    expect(result.isValid).toBe(true);
    expect(result.error).toBeUndefined();
    expect(result.sizeBytes).toBe(validPdfHeader.length);
  });

  it('rejects files without PDF signature even if mime is claimed as application/pdf', () => {
    const result = validatePdfBuffer(invalidBuffer, 'application/pdf');
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('Invalid file signature');
  });

  it('rejects non-pdf mime types', () => {
    const result = validatePdfBuffer(validPdfHeader, 'image/jpeg');
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('Invalid MIME type');
  });

  it('enforces maximum file size limit', () => {
    const smallLimit = 10; // 10 bytes limit
    const result = validatePdfBuffer(validPdfHeader, 'application/pdf', smallLimit);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('File size exceeds');
  });
});
