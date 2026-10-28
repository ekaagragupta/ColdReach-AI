import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { isGoogleConfigured } from '@/lib/google-auth';

export async function GET() {
  try {
    const configured = isGoogleConfigured();
    const account = await db.googleAccount.findFirst({
      orderBy: { connectedAt: 'desc' },
      select: {
        id: true,
        email: true,
        name: true,
        picture: true,
        connectedAt: true,
      },
    });

    return NextResponse.json({
      configured,
      connected: Boolean(account),
      account: account || null,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
