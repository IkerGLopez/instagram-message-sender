import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock env module before importing anything that uses it
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

// Mock logger
vi.mock('@/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
    trace: vi.fn(),
  },
}));

import { CodeEngine } from '@/services/code-engine.js';
import { CODE_MAX_RETRIES, CODE_FORMAT_REGEX } from '@/config/constants.js';

// Mock Prisma client with configurable collision behavior
function createMockDb(collisionCount: number = 0) {
  let callCount = 0;
  return {
    discountCode: {
      findUnique: vi.fn(async () => {
        callCount++;
        // Return collision for first N calls, then null (unique)
        if (callCount <= collisionCount) {
          return { id: `collision-${callCount}` };
        }
        return null;
      }),
    },
  };
}

describe('CodeEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('generates a code matching the expected format WELCOME-[A-Z2-9]{8}', async () => {
    const db = createMockDb(0); // no collisions
    const engine = new CodeEngine(db as any);

    const code = await engine.generateDiscountCode();

    expect(code).toMatch(CODE_FORMAT_REGEX);
    expect(db.discountCode.findUnique).toHaveBeenCalled();
  });

  it('retries on collision and eventually succeeds', async () => {
    const db = createMockDb(2); // first 2 calls are collisions
    const engine = new CodeEngine(db as any);

    const code = await engine.generateDiscountCode();

    expect(code).toMatch(CODE_FORMAT_REGEX);
    // Should have been called 3 times (2 collisions + 1 success)
    expect(db.discountCode.findUnique).toHaveBeenCalledTimes(3);
  });

  it('throws after max retries are exhausted', async () => {
    const maxRetries = 3;
    const db = createMockDb(maxRetries); // all calls are collisions
    const engine = new CodeEngine(db as any);

    await expect(engine.generateDiscountCode(maxRetries)).rejects.toThrow(
      /collision rate too high/i,
    );

    expect(db.discountCode.findUnique).toHaveBeenCalledTimes(maxRetries);
  });

  it('uses default CODE_MAX_RETRIES when no maxRetries provided', async () => {
    const db = createMockDb(0);
    const engine = new CodeEngine(db as any);

    await engine.generateDiscountCode();

    // Should succeed on first try since no collisions
    expect(db.discountCode.findUnique).toHaveBeenCalledTimes(1);
  });
});
