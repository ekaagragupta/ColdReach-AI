import { NextRequest, NextResponse } from 'next/server';
import { validatePdfBuffer, savePdfAttachment } from '@/lib/pdf';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file was uploaded.' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Validate PDF magic bytes and size
    const validation = validatePdfBuffer(buffer, file.type);
    if (!validation.isValid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const saved = await savePdfAttachment(buffer, file.name);

    return NextResponse.json({
      success: true,
      originalFilename: file.name,
      filename: saved.safeFilename,
      sizeBytes: saved.size,
      sizeFormatted: `${(saved.size / 1024).toFixed(1)} KB`,
      path: saved.storedPath,
    });
  } catch (err: any) {
    console.error('PDF upload error:', err);
    return NextResponse.json({ error: err.message || 'Failed to process file upload' }, { status: 500 });
  }
}
