import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 16;
const LEGACY_SALT = 'dawin-dash-backup';

function deriveKey(secret, salt) {
  return scryptSync(secret, salt, 32);
}

/**
 * Encrypt plaintext using AES-256-GCM with random salt
 * @returns {string} base64 string: salt(16) + iv(16) + authTag(16) + ciphertext
 */
export function encrypt(plaintext, secret = process.env.SESSION_SECRET) {
  if (!secret) throw new Error('SESSION_SECRET is required for encryption');
  const salt = randomBytes(SALT_LENGTH);
  const key = deriveKey(secret, salt);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([salt, iv, authTag, encrypted]).toString('base64');
}

/**
 * Decrypt AES-256-GCM encrypted string
 * Supports both new format (random salt) and legacy format (fixed salt)
 * @param {string} encryptedBase64 base64 string from encrypt()
 * @returns {string} decrypted plaintext
 */
export function decrypt(encryptedBase64, secret = process.env.SESSION_SECRET) {
  if (!secret) throw new Error('SESSION_SECRET is required for decryption');
  const buf = Buffer.from(encryptedBase64, 'base64');

  // Try new format first: salt(16) + iv(16) + authTag(16) + ciphertext
  try {
    const salt = buf.subarray(0, SALT_LENGTH);
    const iv = buf.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const authTag = buf.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);
    const ciphertext = buf.subarray(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);
    const key = deriveKey(secret, salt);
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    return decipher.update(ciphertext) + decipher.final('utf8');
  } catch {
    // Fallback: legacy format iv(16) + authTag(16) + ciphertext (fixed salt)
    const key = deriveKey(secret, LEGACY_SALT);
    const iv = buf.subarray(0, IV_LENGTH);
    const authTag = buf.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const ciphertext = buf.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    return decipher.update(ciphertext) + decipher.final('utf8');
  }
}
