import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { createCommentQueue } from '../queues/comment-queue.js';
import { createDmQueue } from '../queues/dm-queue.js';
import { logger } from '../utils/logger.js';

export const bullmqPlugin = fp(async function bullmqPlugin(app: FastifyInstance) {
  const connection = (app as any).redis;

  const commentQueue = createCommentQueue(connection);
  const dmQueue = createDmQueue(connection);

  app.decorate('commentQueue', commentQueue);
  app.decorate('dmQueue', dmQueue);

  logger.info('BullMQ queues initialized');

  app.addHook('onClose', async () => {
    await commentQueue.close();
    await dmQueue.close();
    logger.info('BullMQ queues closed');
  });
});

declare module 'fastify' {
  interface FastifyInstance {
    commentQueue: ReturnType<typeof createCommentQueue>;
    dmQueue: ReturnType<typeof createDmQueue>;
  }
}