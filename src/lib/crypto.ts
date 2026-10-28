import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits recommended for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits

function getEncryptionKey(): Buffer {
  const hexKey = process.env.ENCRYPTION_KEY;
  if (!hexKey) {
    throw new Error('ENCRYPTION_KEY is not defined in environment variables');
  }
  // If hex string of 64 chars (32 bytes)
  if (hexKey.length === 64) {
    return Buffer.from(hexKey, 'hex');
  }
  // Otherwise derive 32-byte key using sha256
  return crypto.createHash('sha256').update(hexKey).digest();
}

/**
 * Encrypts plaintext string using AES-256-GCM.
 * Output format: iv:authTag:ciphertext (all in hex)
 */
export function encrypt(text: string): string {
  if (!text) return '';
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypts encrypted string in format iv:authTag:ciphertext.
 */
export function decrypt(encryptedText: string): string {
  if (!encryptedText) return '';
  const parts = encryptedText.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted text format. Expected iv:authTag:ciphertext');
  }

  const [ivHex, authTagHex, cipherHex] = parts;
  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  if (iv.length !== IV_LENGTH || authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error('Malformed IV or Auth Tag in encrypted text');
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(cipherHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
