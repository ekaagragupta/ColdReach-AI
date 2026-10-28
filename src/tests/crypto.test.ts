import { describe, it, expect } from 'vitest';
import { encrypt, decrypt } from '../lib/crypto';

describe('Encryption & Token Security Suite', () => {
  it('encrypts and decrypts OAuth tokens accurately using AES-256-GCM', () => {
    const secretToken = 'ya29.a0ARrdaM-GoogleRefreshTokenExample1234567890';
    const encrypted = encrypt(secretToken);

    expect(encrypted).not.toBe(secretToken);
    expect(encrypted.split(':')).toHaveLength(3); // iv : authTag : ciphertext

    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(secretToken);
  });

  it('generates unique ciphertexts and IVs for identical plaintexts', () => {
    const text = 'test-token-value';
    const enc1 = encrypt(text);
    const enc2 = encrypt(text);

    expect(enc1).not.toBe(enc2);
    expect(decrypt(enc1)).toBe(text);
    expect(decrypt(enc2)).toBe(text);
  });

  it('fails decryption if ciphertext or auth tag is tampered with', () => {
    const secret = 'sensitive-data';
    const encrypted = encrypt(secret);
    const parts = encrypted.split(':');
    // Tamper with the ciphertext
    const tampered = `${parts[0]}:${parts[1]}:${parts[2].slice(0, -2)}ff`;

    expect(() => decrypt(tampered)).toThrow();
  });

  it('handles empty strings gracefully', () => {
    expect(encrypt('')).toBe('');
    expect(decrypt('')).toBe('');
  });
});
