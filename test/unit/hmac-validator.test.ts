import { describe, it, expect, vi } from 'vitest';

// Mock env module before any imports
vi.mock('@/config/env.js', () => ({
  env: {
    INSTAGRAM_APP_ID: 'test-app-id',
    INSTAGRAM_APP_SECRET: 'test-app-secret',
    INSTAGRAM_PAGE_ACCESS_TOKEN: 'test-token',
    INSTAGRAM_WEBHOOK_VERIFY_TOKEN: 'test-verify-token',
    INSTAGRAM_BUSINESS_ACCOUNT_ID: 'test-biz-id',
    DATABASE_URL: 'postgresql://test:test@localhost/test',
    REDIS_URL: 'redis://localhost:6379',
    API_KEY_HASH_SECRET: 'test-hash-secret',
    STORE_BASE_URL: 'https://test-store.example.com',
    NODE_ENV: 'development',
    LOG_LEVEL: 'fatal',
    PORT: 3000,
  },
}));

import {
  verifyInstagramSignature,
  hashApiKey,
} from '@/utils/crypto.js';
import { createHmac } from 'crypto';

describe('crypto utilities', () => {
  describe('verifyInstagramSignature', () => {
    const appSecret = 'test-secret-123';
    const body = Buffer.from('{"object":"instagram","entry":[]}');

    it('returns true for a valid signature', () => {
      const expected = `sha256=${createHmac('sha256', appSecret).update(body).digest('hex')}`;
      expect(verifyInstagramSignature(body, expected, appSecret)).toBe(true);
    });

    it('returns false for an invalid signature', () => {
      expect(verifyInstagramSignature(body, 'sha256=invalid', appSecret)).toBe(false);
    });

    it('returns false quickly when signature length differs', () => {
      // Different length should fail fast without timing comparison
      const shortSig = 'sha256=abc';
      expect(verifyInstagramSignature(body, shortSig, appSecret)).toBe(false);
    });

    it('returns false for completely wrong signature with same length', () => {
      const expected = `sha256=${createHmac('sha256', appSecret).update(body).digest('hex')}`;
      // Flip one character
      const wrong = expected.slice(0, -1) + (expected.slice(-1) === 'a' ? 'b' : 'a');
      expect(verifyInstagramSignature(body, wrong, appSecret)).toBe(false);
    });

    it('returns false for empty body with valid signature of different body', () => {
      const expected = `sha256=${createHmac('sha256', appSecret).update(Buffer.from('different')).digest('hex')}`;
      expect(verifyInstagramSignature(body, expected, appSecret)).toBe(false);
    });
  });

  describe('hashApiKey', () => {
    it('produces a consistent hex hash', () => {
      const hash1 = hashApiKey('my-api-key', 'secret');
      const hash2 = hashApiKey('my-api-key', 'secret');
      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/);
    });

    it('produces different hashes for different keys', () => {
      const hash1 = hashApiKey('key-one', 'secret');
      const hash2 = hashApiKey('key-two', 'secret');
      expect(hash1).not.toBe(hash2);
    });

    it('produces different hashes for different secrets', () => {
      const hash1 = hashApiKey('my-api-key', 'secret-a');
      const hash2 = hashApiKey('my-api-key', 'secret-b');
      expect(hash1).not.toBe(hash2);
    });
  });
});
