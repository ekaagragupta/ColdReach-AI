import { describe, it, expect } from 'vitest';
import {
  isValidEmail,
  processRecipients,
  parsePastedEmails,
  parseCSVRecipients,
  getCSVTemplate,
} from '../lib/validation';

describe('Email Validation & Parsing Suite', () => {
  describe('isValidEmail', () => {
    it('accepts standard valid emails', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('sarah.connor@cyberdyne.tech')).toBe(true);
      expect(isValidEmail('ekaagra+job@gmail.com')).toBe(true);
      expect(isValidEmail('first.last@sub.domain.co.uk')).toBe(true);
    });

    it('rejects invalid email formats', () => {
      expect(isValidEmail('')).toBe(false);
      expect(isValidEmail('plainaddress')).toBe(false);
      expect(isValidEmail('@missingusername.com')).toBe(false);
      expect(isValidEmail('missingdomain@')).toBe(false);
      expect(isValidEmail('spaces in@address.com')).toBe(false);
      expect(isValidEmail('missing.tld@nodot')).toBe(false);
    });
  });

  describe('parsePastedEmails', () => {
    it('parses emails separated by newlines, commas, and semicolons', () => {
      const raw = `
        alex@innovate.ai,
        priya@globalfin.org;
        sarah@cyberdyne.tech
        alex@innovate.ai
      `;

      const result = parsePastedEmails(raw);
      expect(result.valid).toHaveLength(3);
      expect(result.duplicatesRemoved).toBe(1);
      expect(result.valid.map((r) => r.email)).toEqual([
        'alex@innovate.ai',
        'priya@globalfin.org',
        'sarah@cyberdyne.tech',
      ]);
    });

    it('parses "Name <email@example.com>" format from pasted text', () => {
      const raw = '"John Doe" <john@example.com>, "Jane Smith" <jane@example.com>';
      const result = parsePastedEmails(raw);
      expect(result.valid).toHaveLength(2);
      expect(result.valid[0].name).toBe('John Doe');
      expect(result.valid[0].email).toBe('john@example.com');
      expect(result.valid[1].name).toBe('Jane Smith');
      expect(result.valid[1].email).toBe('jane@example.com');
    });

    it('flags invalid pasted addresses', () => {
      const raw = 'valid@example.com, invalid-address, another@domain.com';
      const result = parsePastedEmails(raw);
      expect(result.valid).toHaveLength(2);
      expect(result.invalid).toHaveLength(1);
      expect(result.invalid[0].raw).toBe('invalid-address');
    });
  });

  describe('parseCSVRecipients', () => {
    it('parses valid CSV with standard columns', () => {
      const csv = `
name,email,company,position
Sarah Connor,sarah@cyberdyne.tech,Cyberdyne Systems,Head of Eng
Alex Chen,alex@innovate.ai,Innovate AI,Engineering Manager
      `.trim();

      const result = parseCSVRecipients(csv);
      expect(result.valid).toHaveLength(2);
      expect(result.valid[0].email).toBe('sarah@cyberdyne.tech');
      expect(result.valid[0].name).toBe('Sarah Connor');
      expect(result.valid[0].company).toBe('Cyberdyne Systems');
      expect(result.valid[0].position).toBe('Head of Eng');
    });

    it('handles CSV with only email column', () => {
      const csv = `email\njohn@example.com\njane@example.com`;
      const result = parseCSVRecipients(csv);
      expect(result.valid).toHaveLength(2);
      expect(result.valid[0].email).toBe('john@example.com');
    });

    it('normalizes case and deduplicates CSV rows', () => {
      const csv = `
Email,Company
User@Example.COM,Acme
user@example.com,Acme Corp
      `.trim();

      const result = parseCSVRecipients(csv);
      expect(result.valid).toHaveLength(1);
      expect(result.duplicatesRemoved).toBe(1);
      expect(result.valid[0].email).toBe('user@example.com');
    });

    it('provides downloadable template containing standard headers', () => {
      const template = getCSVTemplate();
      expect(template).toContain('email,name,company,position');
      expect(template).toContain('sarah.connor@cyberdyne.tech');
    });
  });

  describe('processRecipients', () => {
    it('handles empty input gracefully', () => {
      const result = processRecipients([]);
      expect(result.valid).toEqual([]);
      expect(result.invalid).toEqual([]);
      expect(result.duplicatesRemoved).toBe(0);
    });
  });
});
