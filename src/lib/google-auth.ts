import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { db } from './db';
import { encrypt, decrypt } from './crypto';

export const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
];

export function isGoogleConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_CLIENT_ID.trim() !== '' &&
    process.env.GOOGLE_CLIENT_SECRET.trim() !== '' &&
    !process.env.GOOGLE_CLIENT_ID.includes('your-google-client-id')
  );
}

export function getRedirectUri(): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  return `${baseUrl.replace(/\/$/, '')}/api/auth/google/callback`;
}

/**
 * Creates a fresh OAuth2 client using current environment credentials.
 */
export function createOAuth2Client(): OAuth2Client {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = getRedirectUri();

  if (!clientId || !clientSecret) {
    throw new Error(
      'Google OAuth credentials are missing. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.local'
    );
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

/**
 * Generates the Google OAuth authorization URL.
 */
export function getAuthorizationUrl(state?: string): string {
  const client = createOAuth2Client();

  return client.generateAuthUrl({
    access_type: 'offline', // Mandatory for receiving a refresh token
    prompt: 'consent', // Forces consent screen to ensure refresh token is always returned
    scope: GMAIL_SCOPES,
    include_granted_scopes: true,
    state: state || 'coldreach_connect',
  });
}

interface GoogleTokenResponse {
  access_token: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
}

/**
 * Robustly exchanges authorization code for tokens using native fetch.
 * Immune to node-fetch premature close bugs on modern Node.js runtimes.
 */
export async function exchangeCodeForTokens(code: string): Promise<GoogleTokenResponse> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = getRedirectUri();

  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth credentials not configured in environment.');
  }

  const params = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Connection: 'close',
    },
    body: params.toString(),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(
      `Google token exchange error (${res.status}): ${
        data.error_description || data.error || 'Failed to exchange authorization code'
      }`
    );
  }

  return data as GoogleTokenResponse;
}

/**
 * Fetches user profile info from Google userinfo API using native fetch.
 */
export async function fetchGoogleUserInfo(
  accessToken: string
): Promise<{ email: string; name?: string; picture?: string }> {
  const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Connection: 'close',
    },
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(
      `Google userinfo error (${res.status}): ${
        data.error?.message || data.error || 'Failed to fetch user profile'
      }`
    );
  }

  return data;
}

/**
 * Refreshes an expired access token using native fetch.
 */
export async function refreshGoogleAccessToken(
  refreshToken: string
): Promise<{ access_token: string; expires_in?: number }> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth credentials not configured in environment.');
  }

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Connection: 'close',
    },
    body: params.toString(),
  });

  const data = await res.json();
  if (!res.ok) {
    const errMsg = data.error_description || data.error || '';
    if (errMsg.includes('invalid_grant') || errMsg.includes('expired') || errMsg.includes('revoked')) {
      throw new Error(
        'Gmail authorization was revoked or expired. Please disconnect and reconnect your Google account.'
      );
    }
    throw new Error(`Google token refresh error (${res.status}): ${errMsg}`);
  }

  return data;
}

/**
 * Handles the OAuth authorization code exchange, retrieves user profile,
 * encrypts tokens, and stores them in the database.
 */
export async function handleOAuthCallback(code: string): Promise<{
  id: string;
  email: string;
  name: string | null;
  picture: string | null;
}> {
  // Exchange code for tokens via resilient native fetch
  const tokens = await exchangeCodeForTokens(code);

  // Fetch user info from Google via resilient native fetch
  const userInfo = await fetchGoogleUserInfo(tokens.access_token);

  if (!userInfo.email) {
    throw new Error('Google did not return an email address for the authenticated account.');
  }

  const email = userInfo.email.toLowerCase();
  const name = userInfo.name || null;
  const picture = userInfo.picture || null;

  // We need a refresh token to send emails later.
  let encryptedRefreshToken: string;

  if (tokens.refresh_token) {
    encryptedRefreshToken = encrypt(tokens.refresh_token);
  } else {
    // If not provided in this exchange, check if we already have one saved for this email
    const existing = await db.googleAccount.findUnique({ where: { email } });
    if (!existing || !existing.encryptedRefreshToken) {
      throw new Error(
        'Google did not return a refresh token. Please remove ColdReach AI from https://myaccount.google.com/permissions and reconnect to grant offline access.'
      );
    }
    encryptedRefreshToken = existing.encryptedRefreshToken;
  }

  const encryptedAccessToken = tokens.access_token ? encrypt(tokens.access_token) : null;
  const tokenExpiry = tokens.expires_in
    ? new Date(Date.now() + tokens.expires_in * 1000)
    : null;
  const scope = tokens.scope || GMAIL_SCOPES.join(' ');

  // Upsert GoogleAccount record
  const account = await db.googleAccount.upsert({
    where: { email },
    update: {
      name,
      picture,
      encryptedRefreshToken,
      encryptedAccessToken,
      tokenExpiry,
      scope,
    },
    create: {
      email,
      name,
      picture,
      encryptedRefreshToken,
      encryptedAccessToken,
      tokenExpiry,
      scope,
    },
  });

  return {
    id: account.id,
    email: account.email,
    name: account.name,
    picture: account.picture,
  };
}

/**
 * Retrieves and refreshes credentials for a connected Google account,
 * returning an authorized OAuth2Client ready for Gmail API calls.
 */
export async function getAuthorizedClient(googleAccountId?: string): Promise<{
  client: OAuth2Client;
  accessToken: string;
  email: string;
  name: string | null;
}> {
  // If no account ID provided, use the most recently connected account
  const account = googleAccountId
    ? await db.googleAccount.findUnique({ where: { id: googleAccountId } })
    : await db.googleAccount.findFirst({ orderBy: { connectedAt: 'desc' } });

  if (!account) {
    throw new Error('No connected Google Gmail account found. Please connect your Gmail account.');
  }

  const client = createOAuth2Client();
  const refreshToken = decrypt(account.encryptedRefreshToken);

  let accessToken: string | undefined;
  if (account.encryptedAccessToken) {
    try {
      accessToken = decrypt(account.encryptedAccessToken);
    } catch {
      accessToken = undefined;
    }
  }

  // Pre-emptively refresh if token is missing or near expiry (within 5 minutes)
  const isExpiredOrExpiring =
    !account.tokenExpiry ||
    !accessToken ||
    account.tokenExpiry.getTime() - Date.now() < 5 * 60 * 1000;

  if (isExpiredOrExpiring) {
    try {
      const refreshed = await refreshGoogleAccessToken(refreshToken);
      accessToken = refreshed.access_token;
      const newExpiry = refreshed.expires_in
        ? new Date(Date.now() + refreshed.expires_in * 1000)
        : new Date(Date.now() + 3600 * 1000);

      await db.googleAccount.update({
        where: { id: account.id },
        data: {
          encryptedAccessToken: encrypt(accessToken),
          tokenExpiry: newExpiry,
        },
      });

      client.setCredentials({
        refresh_token: refreshToken,
        access_token: accessToken,
        expiry_date: newExpiry.getTime(),
      });
    } catch (err: any) {
      throw err;
    }
  } else {
    client.setCredentials({
      refresh_token: refreshToken,
      access_token: accessToken,
      expiry_date: account.tokenExpiry?.getTime(),
    });
  }

  return {
    client,
    accessToken: accessToken!,
    email: account.email,
    name: account.name,
  };
}

/**
 * Revokes Google access and removes the account from the database.
 */
export async function disconnectGoogleAccount(id?: string): Promise<boolean> {
  const account = id
    ? await db.googleAccount.findUnique({ where: { id } })
    : await db.googleAccount.findFirst({ orderBy: { connectedAt: 'desc' } });

  if (!account) return false;

  try {
    const refreshToken = decrypt(account.encryptedRefreshToken);
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(refreshToken)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Connection: 'close',
      },
    }).catch(() => null);
  } catch (err) {
    console.warn('Google revokeToken call failed during disconnect, removing local record:', err);
  }

  await db.googleAccount.delete({ where: { id: account.id } });
  return true;
}
