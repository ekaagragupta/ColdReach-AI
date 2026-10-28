import { OAuth2Client } from 'google-auth-library';
import { buildGmailRawMessage } from './mime';
import { readPdfAttachment } from './pdf';

export interface SendSingleEmailParams {
  authClient?: OAuth2Client;
  accessToken?: string;
  fromEmail: string;
  fromName?: string | null;
  toEmail: string;
  subject: string;
  bodyText: string;
  bodyHtml?: string;
  attachmentPath?: string | null;
  attachmentFilename?: string | null;
}

export interface SendResult {
  success: boolean;
  messageId?: string;
  threadId?: string;
  error?: string;
  isQuotaError?: boolean;
  isTransient?: boolean;
}

/**
 * Sends a single email directly through the official Gmail API users.messages.send endpoint
 * using native fetch with Connection: close.
 *
 * This completely avoids node-fetch@2's ERR_STREAM_PREMATURE_CLOSE stream destruction bug
 * on Node 20/22/24/26.
 */
export async function sendEmailViaGmail(params: SendSingleEmailParams): Promise<SendResult> {
  const {
    authClient,
    accessToken: providedAccessToken,
    fromEmail,
    fromName,
    toEmail,
    subject,
    bodyText,
    bodyHtml,
    attachmentPath,
    attachmentFilename,
  } = params;

  try {
    let attachmentBuffer: Buffer | undefined;
    if (attachmentPath && attachmentFilename) {
      attachmentBuffer = await readPdfAttachment(attachmentPath);
    }

    const formattedFrom = fromName ? `"${fromName}" <${fromEmail}>` : fromEmail;

    const rawMessage = buildGmailRawMessage({
      from: formattedFrom,
      to: toEmail,
      subject,
      bodyText,
      bodyHtml,
      attachment:
        attachmentBuffer && attachmentFilename
          ? {
              filename: attachmentFilename,
              content: attachmentBuffer,
              contentType: 'application/pdf',
            }
          : undefined,
    });

    // Obtain access token
    let token = providedAccessToken || authClient?.credentials?.access_token;
    if (!token && authClient) {
      const tokenRes = await authClient.getAccessToken();
      token = typeof tokenRes === 'string' ? tokenRes : tokenRes?.token;
    }

    if (!token) {
      return {
        success: false,
        error: 'No active Google OAuth access token available. Please reconnect your Gmail account.',
        isTransient: false,
      };
    }

    // Call Gmail API users.messages.send directly with native fetch
    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Connection: 'close',
      },
      body: JSON.stringify({
        raw: rawMessage,
      }),
    });

    const resData = await response.json();

    if (!response.ok) {
      const status = response.status;
      const errorObj = resData?.error || {};
      const rawMsg = errorObj?.message || 'Gmail API send error';
      const errorDetails = errorObj?.errors?.[0] || {};
      const reason = errorDetails?.reason || '';

      // Quota limit exceeded
      if (
        status === 403 &&
        (reason === 'quotaExceeded' ||
          reason === 'dailyLimitExceeded' ||
          rawMsg.toLowerCase().includes('quota') ||
          rawMsg.toLowerCase().includes('limit'))
      ) {
        return {
          success: false,
          error:
            'Gmail daily sending quota exceeded. Google standard free accounts allow up to 500 emails/day; Google Workspace allows up to 2,000/day.',
          isQuotaError: true,
          isTransient: false,
        };
      }

      // Rate limit
      if (status === 429 || reason === 'rateLimitExceeded' || reason === 'userRateLimitExceeded') {
        return {
          success: false,
          error: 'Gmail API rate limit reached. Backing off before next send.',
          isTransient: true,
        };
      }

      // Auth error
      if (status === 401 || reason === 'authError') {
        return {
          success: false,
          error: 'Gmail authorization expired or was revoked. Please reconnect your Google account.',
          isTransient: false,
        };
      }

      // Invalid recipient address
      if (status === 400 && rawMsg.toLowerCase().includes('recipient')) {
        return {
          success: false,
          error: `Recipient address rejected by Gmail: ${rawMsg}`,
          isTransient: false,
        };
      }

      const isTransient = status >= 500 && status < 600;

      return {
        success: false,
        error: `Gmail API error (${status}): ${rawMsg}`,
        isTransient,
      };
    }

    if (resData.id) {
      return {
        success: true,
        messageId: resData.id,
        threadId: resData.threadId || undefined,
      };
    }

    return {
      success: false,
      error: 'Gmail accepted the request but did not return a message ID.',
      isTransient: false,
    };
  } catch (err: any) {
    const rawMsg = err?.message || 'Network error communicating with Gmail API';
    return {
      success: false,
      error: `Gmail API network error: ${rawMsg}`,
      isTransient: true,
    };
  }
}
