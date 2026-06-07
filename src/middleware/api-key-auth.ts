import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { hashApiKey } from '../utils/crypto.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

export class UnauthorizedError extends Error {
  constructor(message: string = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

/**
 * API key authentication middleware.
 * Reads X-API-Key header, hashes it, looks up in DB, checks isActive and expiresAt.
 * Falls back to env-based key for v1 development.
 */
export async function apiKeyAuthMiddleware(
  this: FastifyInstance,
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  const apiKey = request.headers['x-api-key'] as string | undefined;

  if (!apiKey) {
    throw new UnauthorizedError('Missing API key');
  }

  const hashSecret = env.API_KEY_HASH_SECRET;
  const hashedKey = hashApiKey(apiKey, hashSecret);

  const prisma = (this as any).prisma;

  const keyRecord = await prisma.apiKey.findUnique({
    where: { hash: hashedKey },
    select: {
      isActive: true,
      expiresAt: true,
      name: true,
    },
  });

  if (!keyRecord) {
    logger.warn({ hashedKey }, 'API key not found in database');
    throw new UnauthorizedError('Invalid API key');
  }

  if (!keyRecord.isActive) {
    logger.warn({ keyName: keyRecord.name }, 'API key is deactivated');
    throw new UnauthorizedError('API key is deactivated');
  }

  if (keyRecord.expiresAt < new Date()) {
    logger.warn({ keyName: keyRecord.name }, 'API key has expired');
    throw new UnauthorizedError('API key has expired');
  }
}
