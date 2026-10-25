import { encrypt, decrypt, maskUpi } from '../src/lib/crypto.js';

describe('AES-256-GCM Encryption & Masking', () => {
  test('encrypt and decrypt roundtrip matches plaintext', () => {
    const original = 'guardian@okhdfcbank';
    const encrypted = encrypt(original);
    expect(encrypted).not.toBe(original);
    expect(encrypted.split(':')).toHaveLength(3); // iv:tag:ciphertext

    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(original);
  });

  test('maskUpi hides middle characters for privacy', () => {
    expect(maskUpi('ramesh@okicici')).toBe('ram***cici');
    expect(maskUpi('abc')).toBe('***');
  });
});
