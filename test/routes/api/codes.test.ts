import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import { createMockPrisma, createMockRedis, createMockQueue } from '../../fixtures/test-helpers.js';

// Mock env module before any other imports
vi.mock('@/config/env.js', () => ({
  env: {
    INSTAGRAM_WEBHOOK_VERIFY_TOKEN: 'test-verify-token',
    INSTAGRAM_APP_SECRET: 'test-app-secret',
    NODE_ENV: 'development',
    LOG_LEVEL: 'fatal',
    PORT: 3000,
    INSTAGRAM_PAGE_ACCESS_TOKEN: 'test-token',
    API_KEY_HASH_SECRET: 'test-hash-secret',
    DATABASE_URL: 'postgresql://test:test@localhost/test',
    REDIS_URL: 'redis://localhost:6379',
    STORE_BASE_URL: 'https://test-store.example.com',
    INSTAGRAM_APP_ID: 'test-app-id',
    INSTAGRAM_BUSINESS_ACCOUNT_ID: 'test-biz-id',
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

// Import after mocks
import { hashApiKey } from '@/utils/crypto.js';
import { codesRoutes } from '@/routes/api/codes.js';

describe('Codes API Routes', () => {
  let app: Fastify.FastifyInstance;
  let mockPrisma: ReturnType<typeof createMockPrisma>;

  const validApiKey = 'test-api-key-123';

  beforeEach(async () => {
    app = Fastify({ logger: false });

    mockPrisma = createMockPrisma();
    const mockRedis = createMockRedis();
    const mockFollowQueue = createMockQueue();
    const mockDmQueue = createMockQueue();

    app.decorate('prisma', mockPrisma as any);
    app.decorate('redis', mockRedis as any);
    app.decorate('followQueue', mockFollowQueue as any);
    app.decorate('dmQueue', mockDmQueue as any);

    // Mock API key auth — accept any key for testing
    app.decorate('apiKeyAuth', async (request: any, reply: any) => {
      const apiKey = request.headers['x-api-key'];
      if (!apiKey) {
        const err = new Error('Missing API key');
        (err as any).statusCode = 401;
        throw err;
      }
    });

    await app.register(codesRoutes);

    // Error handler that matches the real error-handler.ts behavior
    app.setErrorHandler((error, request, reply) => {
      if (error.message === 'Missing API key') {
        return reply.code(401).send({ error: 'unauthorized', message: 'Missing API key' });
      }
      // Validation errors from Fastify schema
      if ((error as any).validation) {
        return reply.code(400).send({
          error: 'validation_error',
          details: (error as any).validation,
        });
      }
      return reply.code(500).send({ error: 'internal_server_error' });
    });
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /api/v1/codes/validate', () => {
    it('returns valid:true for an active code', async () => {
      (mockPrisma.discountCode as any).findUnique.mockResolvedValue({
        status: 'ACTIVE',
        expiresAt: new Date(Date.now() + 86400000),
        discountPercent: 3,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/codes/validate',
        query: { code: 'WELCOME-ABCDEFGH' },
        headers: { 'x-api-key': validApiKey },
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({
        valid: true,
        discount_percentage: 3,
      });
    });

    it('returns valid:false with reason EXPIRED for an expired code', async () => {
      (mockPrisma.discountCode as any).findUnique.mockResolvedValue({
        status: 'ACTIVE',
        expiresAt: new Date(Date.now() - 86400000),
        discountPercent: 3,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/codes/validate',
        query: { code: 'WELCOME-ABCDEFGH' },
        headers: { 'x-api-key': validApiKey },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.valid).toBe(false);
      expect(body.reason).toBe('EXPIRED');
    });

    it('returns valid:false with reason NOT_FOUND for unknown code', async () => {
      (mockPrisma.discountCode as any).findUnique.mockResolvedValue(null);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/codes/validate',
        query: { code: 'WELCOME-NOTEXIST' },
        headers: { 'x-api-key': validApiKey },
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({
        valid: false,
        reason: 'NOT_FOUND',
      });
    });

    it('returns valid:false with reason ALREADY_REDEEMED', async () => {
      (mockPrisma.discountCode as any).findUnique.mockResolvedValue({
        status: 'REDEEMED',
        expiresAt: new Date(Date.now() + 86400000),
        discountPercent: 3,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/codes/validate',
        query: { code: 'WELCOME-ABCDEFGH' },
        headers: { 'x-api-key': validApiKey },
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({
        valid: false,
        reason: 'ALREADY_REDEEMED',
      });
    });

    it('returns 401 when API key is missing', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/codes/validate',
        query: { code: 'WELCOME-ABCDEFGH' },
      });

      expect(response.statusCode).toBe(401);
    });

    it('returns 400 for invalid code format (Fastify schema validation)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/codes/validate',
        query: { code: 'invalid-code' },
        headers: { 'x-api-key': validApiKey },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('POST /api/v1/codes/redeem', () => {
    it('returns 200 on first-time redemption', async () => {
      const now = new Date();
      // Set up the transaction mock to return the right data
      (mockPrisma as any).$transaction.mockImplementation(async (fn: any) => {
        // Create a mock tx object that uses the same mocks
        const tx = {
          discountCode: {
            findUnique: vi.fn().mockResolvedValue({
              id: 'code-uuid',
              status: 'ACTIVE',
              expiresAt: new Date(Date.now() + 86400000),
              orderId: null,
              redeemedAt: null,
              discountPercent: 3,
            }),
            update: vi.fn().mockResolvedValue({}),
          },
        };
        return fn(tx);
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/codes/redeem',
        headers: {
          'x-api-key': validApiKey,
          'content-type': 'application/json',
        },
        payload: {
          code: 'WELCOME-ABCDEFGH',
          order_id: 'order-001',
          customer_ip: '192.168.1.1',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.redeemed_at).toBeDefined();
    });

    it('returns 200 on idempotent re-redeem (same order_id)', async () => {
      const now = new Date();
      (mockPrisma as any).$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          discountCode: {
            findUnique: vi.fn().mockResolvedValue({
              id: 'code-uuid',
              status: 'REDEEMED',
              expiresAt: new Date(Date.now() + 86400000),
              orderId: 'order-001',
              redeemedAt: now,
              discountPercent: 3,
            }),
            update: vi.fn().mockResolvedValue({}),
          },
        };
        return fn(tx);
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/codes/redeem',
        headers: {
          'x-api-key': validApiKey,
          'content-type': 'application/json',
        },
        payload: {
          code: 'WELCOME-ABCDEFGH',
          order_id: 'order-001',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body).success).toBe(true);
    });

    it('returns 409 on conflict (different order_id)', async () => {
      (mockPrisma as any).$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          discountCode: {
            findUnique: vi.fn().mockResolvedValue({
              id: 'code-uuid',
              status: 'REDEEMED',
              expiresAt: new Date(Date.now() + 86400000),
              orderId: 'order-001',
              redeemedAt: new Date(),
              discountPercent: 3,
            }),
            update: vi.fn().mockResolvedValue({}),
          },
        };
        return fn(tx);
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/codes/redeem',
        headers: {
          'x-api-key': validApiKey,
          'content-type': 'application/json',
        },
        payload: {
          code: 'WELCOME-ABCDEFGH',
          order_id: 'order-002',
        },
      });

      expect(response.statusCode).toBe(409);
      expect(JSON.parse(response.body).error).toBe('CODE_ALREADY_REDEEMED');
    });

    it('returns 400 for non-existent code', async () => {
      (mockPrisma as any).$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          discountCode: {
            findUnique: vi.fn().mockResolvedValue(null),
            update: vi.fn().mockResolvedValue({}),
          },
        };
        return fn(tx);
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/codes/redeem',
        headers: {
          'x-api-key': validApiKey,
          'content-type': 'application/json',
        },
        payload: {
          code: 'WELCOME-NOTEXIST',
          order_id: 'order-001',
        },
      });

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body).error).toBe('CODE_NOT_VALID');
    });

    it('returns 401 when API key is missing', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/codes/redeem',
        headers: { 'content-type': 'application/json' },
        payload: {
          code: 'WELCOME-ABCDEFGH',
          order_id: 'order-001',
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('returns 400 for invalid input format (Fastify schema validation)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/codes/redeem',
        headers: {
          'x-api-key': validApiKey,
          'content-type': 'application/json',
        },
        payload: {
          code: 'invalid',
          order_id: 'order-001',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBeDefined();
    });
  });
});
