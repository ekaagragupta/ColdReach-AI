import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { buildGmailRawMessage } from './mime';
import { readPdfAttachment } from './pdf';

export interface SendSingleEmailParams {
  authClient: OAuth2Client;
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
 * Sends a single email through the Gmail API using users.messages.send.
 */
export async function sendEmailViaGmail(params: SendSingleEmailParams): Promise<SendResult> {
  const {
    authClient,
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

    const gmail = google.gmail({ version: 'v1', auth: authClient });

    const response = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: rawMessage,
      },
    });

    if (response.data.id) {
      return {
        success: true,
        messageId: response.data.id,
        threadId: response.data.threadId || undefined,
      };
    }

    return {
      success: false,
      error: 'Gmail accepted the request but did not return a message ID.',
      isTransient: false,
    };
  } catch (err: any) {
    const status = err?.status || err?.code || 500;
    const rawMsg = err?.message || 'Unknown Gmail API error';
    const errorDetails = err?.response?.data?.error?.errors?.[0] || {};
    const reason = errorDetails?.reason || '';

    // Check quota exceeded
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
          'Gmail daily sending quota exceeded. Google imposes a daily limit (500 for standard free Gmail, 2000 for Google Workspace).',
        isQuotaError: true,
        isTransient: false,
      };
    }

    // Rate limits / Too many requests
    if (status === 429 || reason === 'rateLimitExceeded' || reason === 'userRateLimitExceeded') {
      return {
        success: false,
        error: 'Gmail API rate limit reached. Backing off before next send.',
        isTransient: true,
      };
    }

    // Auth expired or invalid
    if (status === 401 || reason === 'authError') {
      return {
        success: false,
        error: 'Gmail authentication expired or was revoked. Please reconnect your Google account.',
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

    // Server errors (500, 503) are transient
    const isTransient = status >= 500 && status < 600;

    return {
      success: false,
      error: `Gmail API error (${status}): ${rawMsg}`,
      isTransient,
    };
  }
}
