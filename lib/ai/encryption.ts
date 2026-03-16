/**
 * BYOK API key encryption utilities.
 *
 * Uses AES-256-GCM for authenticated encryption. Keys are encrypted server-side
 * before storage in the encrypted_api_keys table and decrypted only when needed
 * for AI calls. The encryption key is stored in BYOK_ENCRYPTION_KEY env var.
 */

import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const key = process.env.BYOK_ENCRYPTION_KEY;
  if (!key) throw new Error('BYOK_ENCRYPTION_KEY env var is not set');
  return Buffer.from(key, 'hex');
}

/**
 * Encrypt an API key for storage.
 * Returns a base64 string containing iv + authTag + ciphertext.
 */
export function encryptApiKey(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Pack: iv (12) + authTag (16) + ciphertext
  const packed = Buffer.concat([iv, authTag, encrypted]);
  return packed.toString('base64');
}

/**
 * Decrypt an API key from storage.
 * Expects the base64 format produced by encryptApiKey.
 */
export function decryptApiKey(encrypted: string): string {
  const key = getEncryptionKey();
  const packed = Buffer.from(encrypted, 'base64');

  const iv = packed.subarray(0, IV_LENGTH);
  const authTag = packed.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = packed.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf8');
}

/**
 * Extract a safe prefix for display (e.g., "sk-ant-...xxxx").
 */
export function getKeyPrefix(apiKey: string): string {
  if (apiKey.length < 12) return '***';
  return `${apiKey.slice(0, 7)}...${apiKey.slice(-4)}`;
}
