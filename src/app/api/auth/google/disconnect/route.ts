import { NextResponse } from 'next/server';
import { disconnectGoogleAccount } from '@/lib/google-auth';

export async function POST() {
  try {
    const success = await disconnectGoogleAccount();
    return NextResponse.json({ success, message: 'Google account disconnected successfully.' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
