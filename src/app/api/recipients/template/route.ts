import { NextResponse } from 'next/server';
import { getCSVTemplate } from '@/lib/validation';

export async function GET() {
  const csvContent = getCSVTemplate();
  return new NextResponse(csvContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="coldreach_recipients_template.csv"',
    },
  });
}
