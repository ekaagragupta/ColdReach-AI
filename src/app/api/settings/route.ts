import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    let settings = await db.appSettings.findUnique({
      where: { id: 'default' },
    });

    if (!settings) {
      settings = await db.appSettings.create({
        data: {
          id: 'default',
          defaultSendInterval: 3,
          dailySendLimit: 500,
          maxRetries: 2,
        },
      });
    }

    const suppressionCount = await db.suppressionEntry.count();

    return NextResponse.json({
      settings,
      suppressionCount,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { defaultSendInterval, dailySendLimit, maxRetries } = body;

    const settings = await db.appSettings.upsert({
      where: { id: 'default' },
      update: {
        defaultSendInterval: Math.max(1, Number(defaultSendInterval) || 3),
        dailySendLimit: Math.max(1, Number(dailySendLimit) || 500),
        maxRetries: Math.max(0, Number(maxRetries) || 2),
      },
      create: {
        id: 'default',
        defaultSendInterval: Math.max(1, Number(defaultSendInterval) || 3),
        dailySendLimit: Math.max(1, Number(dailySendLimit) || 500),
        maxRetries: Math.max(0, Number(maxRetries) || 2),
      },
    });

    return NextResponse.json({ success: true, settings });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
