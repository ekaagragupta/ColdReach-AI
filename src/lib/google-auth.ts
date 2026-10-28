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
  const client = createOAuth2Client();
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);

  // Fetch user info from Google
  const oauth2 = google.oauth2({ version: 'v2', auth: client });
  const userInfoRes = await oauth2.userinfo.get();
  const userInfo = userInfoRes.data;

  if (!userInfo.email) {
    throw new Error('Google did not return an email address for the authenticated account.');
  }

  const email = userInfo.email.toLowerCase();
  const name = userInfo.name || null;
  const picture = userInfo.picture || null;

  // We need a refresh token to send emails later.
  // Note: Google only sends a refresh token when prompt=consent or on the first authorization.
  let encryptedRefreshToken: string;

  if (tokens.refresh_token) {
    encryptedRefreshToken = encrypt(tokens.refresh_token);
  } else {
    // If not provided in this exchange, check if we already have one saved for this email
    const existing = await db.googleAccount.findUnique({ where: { email } });
    if (!existing || !existing.encryptedRefreshToken) {
      throw new Error(
        'Google did not return a refresh token. Please revoke ColdReach AI permissions in your Google Security settings and reconnect.'
      );
    }
    encryptedRefreshToken = existing.encryptedRefreshToken;
  }

  const encryptedAccessToken = tokens.access_token ? encrypt(tokens.access_token) : null;
  const tokenExpiry = tokens.expiry_date ? new Date(tokens.expiry_date) : null;
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
      // Access token decryption failure; fall back to refreshing
      accessToken = undefined;
    }
  }

  client.setCredentials({
    refresh_token: refreshToken,
    access_token: accessToken,
    expiry_date: account.tokenExpiry?.getTime(),
  });

  // Listen for automatic token refresh events and persist new access token
  client.on('tokens', async (newTokens) => {
    try {
      const updates: {
        encryptedAccessToken?: string;
        tokenExpiry?: Date;
        encryptedRefreshToken?: string;
      } = {};

      if (newTokens.access_token) {
        updates.encryptedAccessToken = encrypt(newTokens.access_token);
      }
      if (newTokens.expiry_date) {
        updates.tokenExpiry = new Date(newTokens.expiry_date);
      }
      if (newTokens.refresh_token) {
        updates.encryptedRefreshToken = encrypt(newTokens.refresh_token);
      }

      await db.googleAccount.update({
        where: { id: account.id },
        data: updates,
      });
    } catch (err) {
      console.error('Failed to persist refreshed OAuth tokens:', err);
    }
  });

  // Pre-emptively refresh if token is missing or near expiry (within 5 minutes)
  const isExpiredOrExpiring =
    !account.tokenExpiry || account.tokenExpiry.getTime() - Date.now() < 5 * 60 * 1000;

  if (isExpiredOrExpiring) {
    try {
      const refreshed = await client.refreshAccessToken();
      client.setCredentials(refreshed.credentials);

      await db.googleAccount.update({
        where: { id: account.id },
        data: {
          encryptedAccessToken: refreshed.credentials.access_token
            ? encrypt(refreshed.credentials.access_token)
            : undefined,
          tokenExpiry: refreshed.credentials.expiry_date
            ? new Date(refreshed.credentials.expiry_date)
            : undefined,
        },
      });
    } catch (err: any) {
      const errMsg = err?.message || '';
      if (errMsg.includes('invalid_grant') || errMsg.includes('Token has been expired or revoked')) {
        throw new Error(
          'Gmail authorization was revoked or expired. Please disconnect and reconnect your Google account.'
        );
      }
      throw new Error(`Failed to refresh Gmail authorization: ${errMsg}`);
    }
  }

  return {
    client,
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
    const client = createOAuth2Client();
    const refreshToken = decrypt(account.encryptedRefreshToken);
    await client.revokeToken(refreshToken).catch(() => null);
  } catch (err) {
    console.warn('Google revokeToken call failed during disconnect, removing local record:', err);
  }

  await db.googleAccount.delete({ where: { id: account.id } });
  return true;
}
