import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import { createHmac } from 'crypto';
import { createMockPrisma, createMockRedis, createMockQueue, validCommentPayload } from '../../fixtures/test-helpers.js';

// Mock env module before any other imports
vi.mock('@/config/env.js', () => ({
  env: {
    INSTAGRAM_WEBHOOK_VERIFY_TOKEN: 'test-verify-token',
    INSTAGRAM_APP_SECRET: 'test-app-secret',
    TRIGGER_KEYWORD: 'BASUSTA',
    STATIC_DISCOUNT_CODE: 'TEST_DISCOUNT',
    NODE_ENV: 'development',
    LOG_LEVEL: 'fatal',
    PORT: 3000,
    INSTAGRAM_PAGE_ACCESS_TOKEN: 'test-token',
    DATABASE_URL: 'postgresql://test:test@localhost/test',
    REDIS_URL: 'redis://localhost:6379',
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

// Import route factory after mocks are set up
import { instagramWebhookRoutes } from '@/routes/webhooks/instagram.js';

function generateSignature(body: string, secret: string): string {
  return `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
}

describe('Instagram Webhook Routes (comment flow)', () => {
  let app: Fastify.FastifyInstance;
  let mockPrisma: ReturnType<typeof createMockPrisma>;
  let mockCommentQueue: ReturnType<typeof createMockQueue>;

  beforeEach(async () => {
    app = Fastify({ logger: false });

    // Mock plugins
    mockPrisma = createMockPrisma();
    const mockRedis = createMockRedis();
    mockCommentQueue = createMockQueue();

    app.decorate('prisma', mockPrisma as any);
    app.decorate('redis', mockRedis as any);
    app.decorate('commentQueue', mockCommentQueue as any);

    // Capture raw body (same as app.ts)
    app.addHook('preParsing', async (request, reply, payload) => {
      const chunks: Buffer[] = [];
      for await (const chunk of payload) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const rawBody = Buffer.concat(chunks);
      (request as any).rawBody = rawBody;
      const { Readable } = await import('stream');
      return Readable.from(rawBody);
    });

    // Register routes directly (without HMAC middleware for easier testing)
    await app.register(instagramWebhookRoutes);
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /webhooks/instagram — Handshake', () => {
    it('returns 200 with challenge on valid handshake', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/webhooks/instagram',
        query: {
          'hub.mode': 'subscribe',
          'hub.verify_token': 'test-verify-token',
          'hub.challenge': 'challenge-12345',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.body).toBe('challenge-12345');
    });

    it('returns 403 on verify token mismatch', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/webhooks/instagram',
        query: {
          'hub.mode': 'subscribe',
          'hub.verify_token': 'wrong-token',
          'hub.challenge': 'challenge-12345',
        },
      });

      expect(response.statusCode).toBe(403);
      expect(JSON.parse(response.body)).toEqual({ error: 'verify_token_mismatch' });
    });

    it('returns 400 on missing handshake params', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/webhooks/instagram',
        query: {},
      });

      // Fastify schema validation returns 400 before handler runs
      expect(response.statusCode).toBe(400);
    });
  });

  describe('POST /webhooks/instagram — Comment event receiver', () => {
    it('returns 200 and enqueues job on valid comment with keyword', async () => {
      const body = JSON.stringify(validCommentPayload);
      const signature = generateSignature(body, 'test-app-secret');

      const response = await app.inject({
        method: 'POST',
        url: '/webhooks/instagram',
        headers: {
          'x-hub-signature-256': signature,
          'content-type': 'application/json',
        },
        payload: body,
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({ received: true });

      // Verify job was enqueued on commentQueue (not followQueue)
      expect(mockCommentQueue.add).toHaveBeenCalled();
    });

    it('returns 200 (ACK) on malformed payload', async () => {
      const body = JSON.stringify({ invalid: 'payload' });
      const signature = generateSignature(body, 'test-app-secret');

      const response = await app.inject({
        method: 'POST',
        url: '/webhooks/instagram',
        headers: {
          'x-hub-signature-256': signature,
          'content-type': 'application/json',
        },
        payload: body,
      });

      // Should ACK with 200 even for malformed payloads
      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({ received: true });
    });

    it('returns 200 on empty body', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/webhooks/instagram',
        headers: {
          'content-type': 'application/json',
        },
        payload: '{}',
      });

      expect(response.statusCode).toBe(200);
    });

    it('discards comment without keyword (no enqueue)', async () => {
      const payloadWithoutKeyword = {
        ...validCommentPayload,
        entry: [
          {
            ...validCommentPayload.entry[0],
            changes: [
              {
                ...validCommentPayload.entry[0].changes[0],
                value: {
                  ...validCommentPayload.entry[0].changes[0].value,
                  comment: {
                    ...validCommentPayload.entry[0].changes[0].value.comment,
                    text: 'me gusta!',
                  },
                },
              },
            ],
          },
        ],
      };

      const body = JSON.stringify(payloadWithoutKeyword);
      const signature = generateSignature(body, 'test-app-secret');

      const response = await app.inject({
        method: 'POST',
        url: '/webhooks/instagram',
        headers: {
          'x-hub-signature-256': signature,
          'content-type': 'application/json',
        },
        payload: body,
      });

      expect(response.statusCode).toBe(200);

      // CommentQueue should NOT have been called (keyword didn't match)
      expect(mockCommentQueue.add).not.toHaveBeenCalled();
    });
  });
});
