/**
 * providers/credentials.test.ts — Encryption-at-rest + masking for provider keys
 */
import { describe, it, expect } from 'vitest';
import { encryptSecret, decryptSecret, maskSecret, isCredentialEncryptionReady } from './credentials';
import { Settings } from '../config/settings';

describe('provider credential encryption', () => {
  it('round-trips a secret', () => {
    const secret = 'sk-ant-abcdefghijklmnop123456';
    const ciphertext = encryptSecret(secret);
    expect(ciphertext).not.toContain(secret);
    expect(decryptSecret(ciphertext)).toBe(secret);
  });

  it('produces unique ciphertexts for the same secret (random IV)', () => {
    const a = encryptSecret('same-secret');
    const b = encryptSecret('same-secret');
    expect(a).not.toBe(b);
    expect(decryptSecret(a)).toBe(decryptSecret(b));
  });

  it('is encrypted at rest (never stores plaintext)', () => {
    const secret = 'sk-proj-topsecretvalue123';
    const ciphertext = encryptSecret(secret);
    // The payload must contain no plaintext fragment of the key.
    expect(ciphertext).not.toContain('topsecret');
    expect(ciphertext).not.toContain(secret);
    expect(ciphertext.split('.')).toHaveLength(3); // iv.authTag.ciphertext
  });

  it('fails loudly on tampered ciphertext (GCM auth tag)', () => {
    const secret = 'sk-1234567890abcdef';
    const ciphertext = encryptSecret(secret);
    const [iv, tag, data] = ciphertext.split('.');
    const tampered = `${iv}.${tag}.${data.slice(0, -2)}xx`;
    expect(() => decryptSecret(tampered)).toThrow();
  });

  it('fails loudly on malformed payloads', () => {
    expect(() => decryptSecret('not-a-payload')).toThrow(/Malformed/);
    expect(() => decryptSecret('a.b')).toThrow(/Malformed/);
  });

  it('masks secrets for display without revealing the body', () => {
    const masked = maskSecret('sk-abcdefghijklmnopqrstuvwxyz');
    expect(masked).not.toContain('abcdefghijklmnop');
    expect(masked).toContain('••••');
    expect(masked.length).toBeLessThan(20);
    expect(maskSecret('short')).toBe('••••');
    expect(maskSecret('')).toBe('');
  });

  it('is ready with an env key or in dev; requires the env key in production', () => {
    const originalEnv = Settings.NODE_ENV;
    (Settings as any).NODE_ENV = 'production';
    (Settings as any).SAGE_CREDENTIAL_ENCRYPTION_KEY = '';
    expect(isCredentialEncryptionReady()).toBe(false);
    (Settings as any).SAGE_CREDENTIAL_ENCRYPTION_KEY = 'a-strong-production-key-1234567890';
    expect(isCredentialEncryptionReady()).toBe(true);
    (Settings as any).NODE_ENV = originalEnv;
    (Settings as any).SAGE_CREDENTIAL_ENCRYPTION_KEY = '';
  });
});
