import Papa from 'papaparse';

export interface RecipientInput {
  email: string;
  name?: string;
  company?: string;
  position?: string;
}

export interface InvalidRecipient {
  raw: string;
  reason: string;
}

export interface ValidationResult {
  valid: RecipientInput[];
  invalid: InvalidRecipient[];
  duplicatesRemoved: number;
  totalParsed: number;
}

// RFC 5322 compliant regex for standard email validation
const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

/**
 * Validates a single email address.
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim();
  if (trimmed.length > 254) return false; // RFC limit
  return EMAIL_REGEX.test(trimmed);
}

/**
 * Deduplicates and validates an array of recipient inputs.
 */
export function processRecipients(rawList: RecipientInput[]): ValidationResult {
  const seenEmails = new Set<string>();
  const valid: RecipientInput[] = [];
  const invalid: InvalidRecipient[] = [];
  let duplicatesRemoved = 0;

  for (const item of rawList) {
    const rawEmail = (item.email || '').trim();

    if (!rawEmail) {
      invalid.push({ raw: JSON.stringify(item), reason: 'Empty email address' });
      continue;
    }

    if (!isValidEmail(rawEmail)) {
      invalid.push({ raw: rawEmail, reason: 'Invalid email syntax or format' });
      continue;
    }

    const normalizedEmail = rawEmail.toLowerCase();

    if (seenEmails.has(normalizedEmail)) {
      duplicatesRemoved++;
      continue;
    }

    seenEmails.add(normalizedEmail);
    valid.push({
      email: normalizedEmail,
      name: item.name?.trim() || undefined,
      company: item.company?.trim() || undefined,
      position: item.position?.trim() || undefined,
    });
  }

  return {
    valid,
    invalid,
    duplicatesRemoved,
    totalParsed: rawList.length,
  };
}

/**
 * Parses raw text input (separated by newlines, commas, or semicolons).
 */
export function parsePastedEmails(rawText: string): ValidationResult {
  if (!rawText || !rawText.trim()) {
    return { valid: [], invalid: [], duplicatesRemoved: 0, totalParsed: 0 };
  }

  // Split by newlines, commas, or semicolons
  const tokens = rawText
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const recipientInputs: RecipientInput[] = tokens.map((token) => {
    // Check if token contains "Name <email@example.com>" format
    const angleMatch = token.match(/^(.*?)\s*<([^>]+)>$/);
    if (angleMatch) {
      return {
        name: angleMatch[1].replace(/["']/g, '').trim(),
        email: angleMatch[2].trim(),
      };
    }
    return { email: token };
  });

  return processRecipients(recipientInputs);
}

/**
 * Parses CSV content with columns (name, email, company, position).
 */
export function parseCSVRecipients(csvContent: string): ValidationResult {
  if (!csvContent || !csvContent.trim()) {
    return { valid: [], invalid: [], duplicatesRemoved: 0, totalParsed: 0 };
  }

  const parsed = Papa.parse<Record<string, string>>(csvContent, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => h.trim().toLowerCase().replace(/[\s_-]+/g, ''),
  });

  if (parsed.errors && parsed.errors.length > 0 && parsed.data.length === 0) {
    return {
      valid: [],
      invalid: parsed.errors.map((e) => ({
        raw: `Row ${e.row || 0}`,
        reason: e.message,
      })),
      duplicatesRemoved: 0,
      totalParsed: 0,
    };
  }

  const inputs: RecipientInput[] = [];

  for (const row of parsed.data) {
    // Find the email field across common variations
    const emailKey = Object.keys(row).find((key) =>
      ['email', 'emailaddress', 'mail', 'recipient', 'contactemail'].includes(key)
    );

    const email = emailKey ? row[emailKey] : '';
    const nameKey = Object.keys(row).find((key) =>
      ['name', 'fullname', 'contactname', 'recipientname'].includes(key)
    );
    const companyKey = Object.keys(row).find((key) =>
      ['company', 'organization', 'companyname', 'firm'].includes(key)
    );
    const positionKey = Object.keys(row).find((key) =>
      ['position', 'title', 'jobtitle', 'role'].includes(key)
    );

    if (email) {
      inputs.push({
        email,
        name: nameKey ? row[nameKey] : undefined,
        company: companyKey ? row[companyKey] : undefined,
        position: positionKey ? row[positionKey] : undefined,
      });
    } else {
      // If no recognized email header was found, but row has 1 column
      const values = Object.values(row).filter(Boolean);
      if (values.length === 1 && isValidEmail(values[0])) {
        inputs.push({ email: values[0] });
      }
    }
  }

  return processRecipients(inputs);
}

/**
 * Generates CSV template string for recipient outreach.
 */
export function getCSVTemplate(): string {
  return [
    'email,name,company,position',
    'sarah.connor@cyberdyne.tech,Sarah Connor,Cyberdyne Systems,Head of Engineering',
    'alex.chen@innovate.ai,Alex Chen,Innovate AI,Engineering Manager',
    'priya.patel@globalfin.org,Priya Patel,Global Financial,Tech Lead',
  ].join('\n');
}
