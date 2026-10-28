import crypto from 'crypto';

export interface EmailMessageOptions {
  from: string; // "Sender Name <email@gmail.com>" or "email@gmail.com"
  to: string; // single recipient email address
  subject: string;
  bodyText: string;
  bodyHtml?: string;
  attachment?: {
    filename: string;
    content: Buffer;
    contentType?: string;
  };
}

/**
 * Encodes a string or buffer into Gmail API compatible base64url format.
 * (replaces '+' with '-', '/' with '_', and strips trailing '=')
 */
export function toBase64Url(input: string | Buffer): string {
  const buffer = typeof input === 'string' ? Buffer.from(input, 'utf-8') : input;
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Formats an email header with proper UTF-8 encoded-word syntax if necessary (RFC 2047).
 */
export function formatHeaderSubject(subject: string): string {
  // If subject contains non-ASCII characters, encode using RFC 2047 =?UTF-8?B?...?=
  if (/[\x80-\xFF]/.test(subject)) {
    return `=?UTF-8?B?${Buffer.from(subject, 'utf-8').toString('base64')}?=`;
  }
  return subject;
}

/**
 * Constructs a fully compliant RFC 2822 / MIME multipart email message.
 * When an attachment is present:
 *   multipart/mixed
 *     ├── multipart/alternative (or text/plain / text/html)
 *     │     ├── text/plain
 *     │     └── text/html
 *     └── application/pdf attachment (base64 encoded)
 */
export function buildMimeMessage(options: EmailMessageOptions): string {
  const boundaryMixed = `coldreach_mixed_${crypto.randomBytes(12).toString('hex')}`;
  const boundaryAlt = `coldreach_alt_${crypto.randomBytes(12).toString('hex')}`;
  const dateStr = new Date().toUTCString();
  const messageId = `<${Date.now()}.${crypto.randomBytes(8).toString('hex')}@coldreach.ai>`;

  const lines: string[] = [];

  // Core Headers
  lines.push(`From: ${options.from}`);
  lines.push(`To: ${options.to}`);
  lines.push(`Subject: ${formatHeaderSubject(options.subject)}`);
  lines.push(`Date: ${dateStr}`);
  lines.push(`Message-ID: ${messageId}`);
  lines.push(`MIME-Version: 1.0`);

  if (options.attachment) {
    // Top level is multipart/mixed
    lines.push(`Content-Type: multipart/mixed; boundary="${boundaryMixed}"`);
    lines.push('');
    lines.push(`--${boundaryMixed}`);

    // Nested alternative part for plain text and HTML
    if (options.bodyHtml) {
      lines.push(`Content-Type: multipart/alternative; boundary="${boundaryAlt}"`);
      lines.push('');
      // Plain text part
      lines.push(`--${boundaryAlt}`);
      lines.push('Content-Type: text/plain; charset="UTF-8"');
      lines.push('Content-Transfer-Encoding: base64');
      lines.push('');
      lines.push(Buffer.from(options.bodyText, 'utf-8').toString('base64'));
      lines.push('');

      // HTML part
      lines.push(`--${boundaryAlt}`);
      lines.push('Content-Type: text/html; charset="UTF-8"');
      lines.push('Content-Transfer-Encoding: base64');
      lines.push('');
      lines.push(Buffer.from(options.bodyHtml, 'utf-8').toString('base64'));
      lines.push('');
      lines.push(`--${boundaryAlt}--`);
    } else {
      // Plain text only inside mixed
      lines.push('Content-Type: text/plain; charset="UTF-8"');
      lines.push('Content-Transfer-Encoding: base64');
      lines.push('');
      lines.push(Buffer.from(options.bodyText, 'utf-8').toString('base64'));
    }

    lines.push('');
    // Attachment Part
    lines.push(`--${boundaryMixed}`);
    const safeFilename = options.attachment.filename.replace(/"/g, '');
    const contentType = options.attachment.contentType || 'application/pdf';
    lines.push(`Content-Type: ${contentType}; name="${safeFilename}"`);
    lines.push(`Content-Disposition: attachment; filename="${safeFilename}"`);
    lines.push('Content-Transfer-Encoding: base64');
    lines.push('');

    // Split base64 attachment into 76-character lines per MIME spec
    const attachmentBase64 = options.attachment.content.toString('base64');
    const chunks = attachmentBase64.match(/.{1,76}/g) || [];
    lines.push(...chunks);
    lines.push('');
    lines.push(`--${boundaryMixed}--`);
  } else {
    // No attachment
    if (options.bodyHtml) {
      lines.push(`Content-Type: multipart/alternative; boundary="${boundaryAlt}"`);
      lines.push('');

      // Plain text
      lines.push(`--${boundaryAlt}`);
      lines.push('Content-Type: text/plain; charset="UTF-8"');
      lines.push('Content-Transfer-Encoding: base64');
      lines.push('');
      lines.push(Buffer.from(options.bodyText, 'utf-8').toString('base64'));
      lines.push('');

      // HTML
      lines.push(`--${boundaryAlt}`);
      lines.push('Content-Type: text/html; charset="UTF-8"');
      lines.push('Content-Transfer-Encoding: base64');
      lines.push('');
      lines.push(Buffer.from(options.bodyHtml, 'utf-8').toString('base64'));
      lines.push('');
      lines.push(`--${boundaryAlt}--`);
    } else {
      lines.push('Content-Type: text/plain; charset="UTF-8"');
      lines.push('Content-Transfer-Encoding: base64');
      lines.push('');
      lines.push(Buffer.from(options.bodyText, 'utf-8').toString('base64'));
    }
  }

  // Join lines with CRLF as mandated by RFC 2822
  return lines.join('\r\n');
}

/**
 * Builds the base64url encoded payload ready for Gmail API `raw` field.
 */
export function buildGmailRawMessage(options: EmailMessageOptions): string {
  const mime = buildMimeMessage(options);
  return toBase64Url(mime);
}
