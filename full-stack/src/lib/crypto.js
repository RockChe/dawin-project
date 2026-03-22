import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 16;

function deriveKey(secret) {
  // Use scrypt to derive a 32-byte key from SESSION_SECRET
  const salt = 'dawin-dash-backup'; // Fixed salt for deterministic key derivation
  return scryptSync(secret, salt, 32);
}

/**
 * Encrypt plaintext using AES-256-GCM
 * @returns {string} base64 string: iv(16) + authTag(16) + ciphertext
 */
export function encrypt(plaintext, secret = process.env.SESSION_SECRET) {
  if (!secret) throw new Error('SESSION_SECRET is required for encryption');
  const key = deriveKey(secret);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

/**
 * Decrypt AES-256-GCM encrypted string
 * @param {string} encryptedBase64 base64 string from encrypt()
 * @returns {string} decrypted plaintext
 */
export function decrypt(encryptedBase64, secret = process.env.SESSION_SECRET) {
  if (!secret) throw new Error('SESSION_SECRET is required for decryption');
  const key = deriveKey(secret);
  const buf = Buffer.from(encryptedBase64, 'base64');
  const iv = buf.subarray(0, IV_LENGTH);
  const authTag = buf.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = buf.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(ciphertext) + decipher.final('utf8');
}
