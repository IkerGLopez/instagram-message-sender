import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { env } from '../../config/env.js';
import { WebhookHandshakeSchema, WebhookPayloadSchema } from './instagram.schema.js';
import { matchesKeyword } from '../../utils/keyword-match.js';
import { logger } from '../../utils/logger.js';

export async function instagramWebhookRoutes(app: FastifyInstance) {
  // GET — Webhook verification handshake
  app.get(
    '/webhooks/instagram',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            'hub.mode': { type: 'string' },
            'hub.verify_token': { type: 'string' },
            'hub.challenge': { type: 'string' },
          },
          required: ['hub.mode', 'hub.verify_token', 'hub.challenge'],
        },
      },
    },
    async (
      request: FastifyRequest<{
        Querystring: Record<string, string>;
      }>,
      reply: FastifyReply,
    ) => {
      const parsed = WebhookHandshakeSchema.safeParse(request.query);

      if (!parsed.success) {
        logger.warn({ query: request.query }, 'Invalid webhook handshake params');
        return reply.code(403).send({ error: 'invalid_handshake_params' });
      }

      if (parsed.data['hub.verify_token'] !== env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN) {
        logger.warn('Webhook verify token mismatch');
        return reply.code(403).send({ error: 'verify_token_mismatch' });
      }

      logger.info('Webhook handshake verified');
      return reply.code(200).send(parsed.data['hub.challenge']);
    },
  );

  // POST — Webhook event receiver
  app.post(
    '/webhooks/instagram',
    {
      schema: {
        response: {
          200: {
            type: 'object',
            properties: {
              received: { type: 'boolean' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body as Record<string, unknown>;

      // Validate payload structure
      const parsed = WebhookPayloadSchema.safeParse(body);
      if (!parsed.success) {
        // ACK anyway — Instagram expects 200, log the error
        logger.warn(
          { error: parsed.error.errors, body },
          'Malformed webhook payload — ACKing anyway',
        );

        // Still create a FAILED webhook event record
        try {
          await (app as any).prisma.webhookEvent.create({
            data: {
              eventType: 'comments_invalid',
              rawPayload: body,
              processingStatus: 'FAILED',
              errorMessage: 'Malformed payload',
            },
          });
        } catch (err) {
          logger.error({ err }, 'Failed to log malformed webhook event');
        }

        return reply.code(200).send({ received: true });
      }

      const commentQueue = (app as any).commentQueue;
      const prisma = (app as any).prisma;

      for (const entry of parsed.data.entry) {
        for (const change of entry.changes) {
          try {
            const { comment, media } = change.value;
            const instagramUserId = comment.from.id;
            const commentText = comment.text;
            const commentId = comment.id;
            const createdTime = comment.created_time;
            const mediaId = media.id;

            // Keyword matching gate — discard non-matching comments
            if (!matchesKeyword(commentText, env.TRIGGER_KEYWORD)) {
              logger.info(
                { instagramUserId, commentId, commentText },
                'Comment skipped — keyword not matched',
              );
              continue;
            }

            // Dedup check — one DM per user
            const existingDm = await prisma.dmRecord.findFirst({
              where: { instagramUserId },
            });

            if (existingDm !== null && existingDm.dmMessageId !== null) {
              logger.info(
                { instagramUserId, commentId },
                'Comment skipped — DM already sent to this user',
              );
              continue;
            }

            // Create webhook event record
            const webhookEvent = await prisma.webhookEvent.create({
              data: {
                eventType: 'comments',
                rawPayload: parsed.data,
                processingStatus: 'PENDING',
                instagramUserId,
              },
            });

            // Enqueue for processing
            await commentQueue.add(
              'comment-event',
              {
                instagramUserId,
                commentText,
                commentId,
                mediaId,
                createdTime,
                rawPayload: parsed.data,
                webhookEventId: webhookEvent.id,
              },
              {
                jobId: `comment-${instagramUserId}-${webhookEvent.id}`,
                removeOnComplete: { age: 3600, count: 100 },
                removeOnFail: { age: 86400 },
              },
            );

            logger.info(
              { instagramUserId, commentId, webhookEventId: webhookEvent.id },
              'Comment event enqueued',
            );
          } catch (err) {
            logger.error({ err }, 'Error processing individual change — continuing to next change');
            // Continue to next change instead of dropping all remaining entries
          }
        }
      }

      return reply.code(200).send({ received: true });
    },
  );
}
