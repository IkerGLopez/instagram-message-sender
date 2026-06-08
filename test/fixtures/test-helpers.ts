import { vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { Queue } from 'bullmq';

/**
 * Create a mock Prisma client with configurable behavior.
 */
export function createMockPrisma(overrides: Partial<PrismaClient> = {}): Partial<PrismaClient> {
  const mockTx = {
    instagramFollower: {
      upsert: vi.fn().mockResolvedValue({}),
    },
    webhookEvent: {
      create: vi.fn().mockResolvedValue({ id: 'webhook-uuid' }),
      update: vi.fn().mockResolvedValue({}),
    },
    apiKey: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
  };

  return {
    $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
    $connect: vi.fn().mockResolvedValue(undefined),
    $disconnect: vi.fn().mockResolvedValue(undefined),
    $on: vi.fn(),
    $transaction: vi.fn().mockImplementation(async (fn) => fn(mockTx)),
    instagramFollower: {
      upsert: vi.fn().mockResolvedValue({}),
    },
    webhookEvent: {
      create: vi.fn().mockResolvedValue({ id: 'webhook-uuid' }),
      update: vi.fn().mockResolvedValue({}),
    },
    apiKey: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
    ...overrides,
  };
}

/**
 * Create a mock Redis client.
 */
export function createMockRedis(): Partial<Redis> {
  return {
    ping: vi.fn().mockResolvedValue('PONG'),
    quit: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn(),
    on: vi.fn(),
  };
}

/**
 * Create a mock BullMQ Queue.
 */
export function createMockQueue(): Partial<Queue> {
  return {
    add: vi.fn().mockResolvedValue({ id: 'job-1' }),
    close: vi.fn().mockResolvedValue(undefined),
    getFailedCount: vi.fn().mockResolvedValue(0),
  };
}

/**
 * Valid webhook follow event payload from Instagram.
 */
export const validFollowPayload = {
  object: 'instagram',
  entry: [
    {
      id: 'instagram-account-id',
      time: Date.now(),
      changes: [
        {
          field: 'follows' as const,
          value: {
            from: {
              id: 'follower-instagram-id-123',
            },
          },
        },
      ],
    },
  ],
};

/**
 * Generate a valid HMAC-SHA256 signature for a given body and secret.
 */
export function generateSignature(body: string, secret: string): string {
  const { createHmac } = require('crypto');
  return `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
}