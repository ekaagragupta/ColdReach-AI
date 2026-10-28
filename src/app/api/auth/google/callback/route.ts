import { NextRequest, NextResponse } from 'next/server';
import { handleOAuthCallback } from '@/lib/google-auth';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  if (error) {
    return NextResponse.redirect(`${appUrl}/settings?error=${encodeURIComponent(error)}`);
  }

  if (!code) {
    return NextResponse.redirect(`${appUrl}/settings?error=missing_code`);
  }

  try {
    const account = await handleOAuthCallback(code);
    return NextResponse.redirect(
      `${appUrl}/settings?auth=success&account=${encodeURIComponent(account.email)}`
    );
  } catch (err: any) {
    console.error('OAuth Callback Error:', err);
    return NextResponse.redirect(
      `${appUrl}/settings?error=${encodeURIComponent(err.message || 'OAuth exchange failed')}`
    );
  }
}
