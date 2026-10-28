import { describe, it, expect } from 'vitest';
import { buildMimeMessage, buildGmailRawMessage, toBase64Url, formatHeaderSubject } from '../lib/mime';

describe('MIME Message Construction Suite', () => {
  it('constructs an RFC 2822 email addressed solely to one recipient without CC/BCC', () => {
    const mime = buildMimeMessage({
      from: 'ekaagra@gmail.com',
      to: 'recruiter@techcorp.com',
      subject: 'Software Engineer Application — Ekaagra Gupta',
      bodyText: 'Hello,\n\nPlease find attached my resume for the Software Engineer role.',
    });

    expect(mime).toContain('From: ekaagra@gmail.com');
    expect(mime).toContain('To: recruiter@techcorp.com');
    expect(mime).toContain('Subject: Software Engineer Application — Ekaagra Gupta');
    expect(mime).toContain('MIME-Version: 1.0');
    expect(mime).not.toContain('Cc:');
    expect(mime).not.toContain('Bcc:');
  });

  it('correctly includes PDF attachment with multipart/mixed structure', () => {
    const pdfDummyContent = Buffer.from('%PDF-1.4 sample content for resume');
    const mime = buildMimeMessage({
      from: 'ekaagra@gmail.com',
      to: 'recruiter@techcorp.com',
      subject: 'Application',
      bodyText: 'Attached is my resume.',
      attachment: {
        filename: 'Ekaagra_Gupta_Resume.pdf',
        content: pdfDummyContent,
        contentType: 'application/pdf',
      },
    });

    expect(mime).toContain('Content-Type: multipart/mixed');
    expect(mime).toContain('Content-Type: application/pdf; name="Ekaagra_Gupta_Resume.pdf"');
    expect(mime).toContain('Content-Disposition: attachment; filename="Ekaagra_Gupta_Resume.pdf"');
    expect(mime).toContain('Content-Transfer-Encoding: base64');
  });

  it('formats non-ASCII subjects using RFC 2047 encoded-word syntax', () => {
    const subject = 'Application: Étudiant & Ingénieur 🚀';
    const formatted = formatHeaderSubject(subject);
    expect(formatted.startsWith('=?UTF-8?B?')).toBe(true);
    expect(formatted.endsWith('?=')).toBe(true);
  });

  it('converts MIME message into URL-safe base64 for Gmail API raw parameter', () => {
    const raw = buildGmailRawMessage({
      from: 'test@coldreach.ai',
      to: 'target@example.com',
      subject: 'Test Subject',
      bodyText: 'Body content',
    });

    expect(raw).not.toContain('+');
    expect(raw).not.toContain('/');
    expect(raw).not.toContain('=');
    expect(typeof raw).toBe('string');
  });
});
