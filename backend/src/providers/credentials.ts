/**
 * providers/credentials.ts
 * OWNS: Secure storage of third-party provider API keys.
 *
 * Security model:
 *  - Keys are encrypted at rest with AES-256-GCM (authenticated encryption).
 *  - The encryption key is derived via scrypt from SAGE_CREDENTIAL_ENCRYPTION_KEY.
 *  - In production the env key is REQUIRED — without it, credential storage is
 *    refused (never a weak fallback). In non-production, a development key is
 *    derived from JWT_SECRET so local/demo runs still encrypt (with a warning).
 *  - Plaintext keys never appear in logs, responses, or error messages.
 */
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';
import { Settings } from '../config/settings';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const KEY_BYTES = 32;

let cachedKey: Buffer | null = null;
let warned = false;

/** True when encrypted storage is available for the current environment. */
export function isCredentialEncryptionReady(): boolean {
  if (Settings.SAGE_CREDENTIAL_ENCRYPTION_KEY) return true;
  // Dev/demo: derive from JWT_SECRET so local runs still exercise encryption.
  return Settings.NODE_ENV !== 'production';
}

function deriveKey(): Buffer {
  if (cachedKey) return cachedKey;

  if (Settings.SAGE_CREDENTIAL_ENCRYPTION_KEY) {
    cachedKey = scryptSync(Settings.SAGE_CREDENTIAL_ENCRYPTION_KEY, 'sage-provider-creds', KEY_BYTES);
    return cachedKey;
  }

  if (Settings.NODE_ENV === 'production') {
    throw new Error('SAGE_CREDENTIAL_ENCRYPTION_KEY is required for provider credential storage in production');
  }

  if (!warned) {
    warned = true;
    console.warn(
      '⚠️ SAGE_CREDENTIAL_ENCRYPTION_KEY not set — deriving a DEV encryption key from JWT_SECRET. ' +
        'Set SAGE_CREDENTIAL_ENCRYPTION_KEY in production.'
    );
  }
  cachedKey = scryptSync(Settings.JWT_SECRET, 'sage-provider-creds-dev', KEY_BYTES);
  return cachedKey;
}

/**
 * Encrypt a secret. Output format: `iv.authTag.ciphertext` (all base64url).
 * The iv and auth tag are unique per encryption, so equal plaintexts produce
 * distinct ciphertexts.
 */
export function encryptSecret(plaintext: string): string {
  const key = deriveKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString('base64url'), authTag.toString('base64url'), ciphertext.toString('base64url')].join('.');
}

/** Decrypt a value produced by encryptSecret. Throws on tampering/bad input. */
export function decryptSecret(payload: string): string {
  const parts = payload.split('.');
  if (parts.length !== 3) {
    throw new Error('Malformed encrypted credential payload');
  }
  const [ivB64, tagB64, dataB64] = parts;
  const iv = Buffer.from(ivB64, 'base64url');
  const authTag = Buffer.from(tagB64, 'base64url');
  const data = Buffer.from(dataB64, 'base64url');

  const decipher = createDecipheriv(ALGORITHM, deriveKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

/**
 * Mask a secret for display: `sk-…abcd`. Never reveals more than a few
 * leading/trailing characters. Safe to send to clients and logs.
 */
export function maskSecret(secret: string): string {
  if (!secret) return '';
  if (secret.length <= 10) return '••••';
  return `${secret.slice(0, 6)}••••${secret.slice(-4)}`;
}
