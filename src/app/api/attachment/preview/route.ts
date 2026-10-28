import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';

export async function GET(request: NextRequest) {
  try {
    const filePath = request.nextUrl.searchParams.get('path');

    if (!filePath) {
      return NextResponse.json({ error: 'Missing path parameter' }, { status: 400 });
    }

    const uploadDir = path.resolve(process.env.UPLOAD_DIR || './uploads/resumes');
    const resolvedPath = path.resolve(filePath);

    // Prevent directory traversal attacks
    if (!resolvedPath.startsWith(uploadDir)) {
      return NextResponse.json({ error: 'Access denied: Path is outside upload directory' }, { status: 403 });
    }

    const fileBuffer = await fs.readFile(resolvedPath);
    const filename = path.basename(resolvedPath);

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
