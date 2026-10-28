import { NextResponse } from 'next/server';
import { getAuthorizationUrl, isGoogleConfigured } from '@/lib/google-auth';

export async function GET() {
  try {
    if (!isGoogleConfigured()) {
      return NextResponse.json(
        {
          configured: false,
          error:
            'Google Client ID and Client Secret are not configured in your environment variables. Please add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env.local',
        },
        { status: 400 }
      );
    }

    const authUrl = getAuthorizationUrl();
    return NextResponse.json({ configured: true, url: authUrl });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
