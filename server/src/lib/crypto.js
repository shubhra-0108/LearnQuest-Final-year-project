import crypto from 'node:crypto';
import { config } from '../config.js';

// AES-256-GCM encryption for sensitive data (UPI IDs)
// Key must be exactly 32 bytes
function getKey() {
  const k = config.cryptoKey;
  if (!k || k.length < 32) throw new Error('CRYPTO_KEY must be at least 32 characters');
  return Buffer.from(k.slice(0, 32), 'utf8');
}

/**
 * Encrypt a string using AES-256-GCM.
 * Returns: "iv:authTag:ciphertext" in hex, colon-delimited.
 */
export function encrypt(plaintext) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypt a string encrypted by encrypt().
 */
export function decrypt(encoded) {
  const [ivHex, tagHex, ctHex] = encoded.split(':');
  if (!ivHex || !tagHex || !ctHex) throw new Error('Invalid encrypted format');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(tagHex, 'hex');
  const ct = Buffer.from(ctHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
}

/**
 * Mask a UPI ID for display: show first 3 chars, last 4 chars.
 * e.g., "name@bank" → "nam***ank"
 */
export function maskUpi(upi) {
  if (!upi || upi.length < 6) return '***';
  return upi.slice(0, 3) + '***' + upi.slice(-4);
}
