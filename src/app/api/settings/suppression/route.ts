import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { isValidEmail } from '@/lib/validation';

export async function GET() {
  try {
    const list = await db.suppressionEntry.findMany({
      orderBy: { suppressedAt: 'desc' },
      take: 200,
    });
    return NextResponse.json({ suppressionList: list });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, reason } = body;

    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ error: 'Valid email required' }, { status: 400 });
    }

    const entry = await db.suppressionEntry.upsert({
      where: { email: email.trim().toLowerCase() },
      update: { reason: reason || 'Manual Suppression' },
      create: {
        email: email.trim().toLowerCase(),
        reason: reason || 'Manual Suppression',
      },
    });

    return NextResponse.json({ success: true, entry });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json({ error: 'Email parameter required' }, { status: 400 });
    }

    await db.suppressionEntry.deleteMany({
      where: { email: email.trim().toLowerCase() },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
