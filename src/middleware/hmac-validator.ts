import type { FastifyReply, FastifyRequest } from 'fastify';
import { verifyInstagramSignature } from '../utils/crypto.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

/**
 * HMAC-SHA256 signature verification middleware.
 * Must be registered as a preHandler on webhook routes.
 * Requires raw body to be captured via preParsing hook.
 */
export async function hmacValidatorMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  // Skip signature validation for GET requests (webhook handshake)
  if (request.method === 'GET') {
    return;
  }

  const signature = request.headers['x-hub-signature-256'] as string | undefined;

  if (!signature) {
    logger.warn('Missing X-Hub-Signature-256 header');
    return reply.code(403).send({ error: 'missing_signature' });
  }

  // Raw body must be captured by preParsing hook and stored on request
  const rawBody = (request as any).rawBody as Buffer | undefined;

  if (!rawBody) {
    logger.error('Raw body not captured — preParsing hook may not be registered');
    return reply.code(500).send({ error: 'internal_error' });
  }

  const isValid = verifyInstagramSignature(rawBody, signature, env.INSTAGRAM_APP_SECRET);

  if (!isValid) {
    logger.warn(
      { signaturePrefix: signature.substring(0, 10) + '...' },
      'Invalid webhook signature',
    );
    return reply.code(403).send({ error: 'invalid_signature' });
  }
}
