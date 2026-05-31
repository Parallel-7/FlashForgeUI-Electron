/**
 * @fileoverview Lightweight helpers for encrypting/decrypting secrets at rest.
 *
 * Uses Electron's safeStorage when available. Falls back to base64 encoding when
 * encryption is unavailable so secrets are not stored raw.
 */

import { safeStorage } from 'electron';

const ENCRYPT_PREFIX = 'enc:';
const PLAIN_PREFIX = 'plain:';

export function encryptSecret(value: string): string {
  if (!value) {
    return value;
  }

  try {
    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(value);
      return `${ENCRYPT_PREFIX}${encrypted.toString('base64')}`;
    }
  } catch (error) {
    console.warn('[SecureStorage] Encryption failed, falling back to base64 encoding.', error);
  }

  return `${PLAIN_PREFIX}${Buffer.from(value, 'utf-8').toString('base64')}`;
}

export function decryptSecret(value?: string): string | undefined {
  if (!value) {
    return value;
  }

  if (value.startsWith(ENCRYPT_PREFIX)) {
    const payload = value.slice(ENCRYPT_PREFIX.length);
    try {
      if (safeStorage.isEncryptionAvailable()) {
        return safeStorage.decryptString(Buffer.from(payload, 'base64'));
      }
    } catch (error) {
      console.warn('[SecureStorage] Decryption failed.', error);
    }
    return undefined;
  }

  if (value.startsWith(PLAIN_PREFIX)) {
    const payload = value.slice(PLAIN_PREFIX.length);
    try {
      return Buffer.from(payload, 'base64').toString('utf-8');
    } catch {
      return undefined;
    }
  }

  return value;
}
