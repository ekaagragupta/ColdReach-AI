import { NextRequest, NextResponse } from 'next/server';
import {
  parsePastedEmails,
  parseCSVRecipients,
  processRecipients,
  RecipientInput,
} from '@/lib/validation';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, content, checkSuppression = true } = body;

    let result;

    if (type === 'paste') {
      result = parsePastedEmails(typeof content === 'string' ? content : '');
    } else if (type === 'csv') {
      result = parseCSVRecipients(typeof content === 'string' ? content : '');
    } else if (type === 'manual') {
      const inputs = Array.isArray(content) ? (content as RecipientInput[]) : [];
      result = processRecipients(inputs);
    } else {
      return NextResponse.json({ error: 'Invalid input type. Expected paste, csv, or manual.' }, { status: 400 });
    }

    let suppressedCount = 0;
    let finalValid = result.valid;

    // Check against suppression list if requested
    if (checkSuppression && result.valid.length > 0) {
      const emails = result.valid.map((r) => r.email);
      const suppressedRecords = await db.suppressionEntry.findMany({
        where: { email: { in: emails } },
        select: { email: true },
      });

      if (suppressedRecords.length > 0) {
        const suppressedSet = new Set(suppressedRecords.map((s) => s.email));
        suppressedCount = suppressedRecords.length;
        finalValid = result.valid.filter((r) => !suppressedSet.has(r.email));
      }
    }

    return NextResponse.json({
      valid: finalValid,
      invalid: result.invalid,
      duplicatesRemoved: result.duplicatesRemoved,
      totalParsed: result.totalParsed,
      suppressedCount,
    });
  } catch (err: any) {
    console.error('Validation API error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
