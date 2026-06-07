import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { createFollowQueue } from '../queues/follow-queue.js';
import { createDmQueue } from '../queues/dm-queue.js';
import { logger } from '../utils/logger.js';

export const bullmqPlugin = fp(async function bullmqPlugin(app: FastifyInstance) {
  const connection = (app as any).redis;

  const followQueue = createFollowQueue(connection);
  const dmQueue = createDmQueue(connection);

  app.decorate('followQueue', followQueue);
  app.decorate('dmQueue', dmQueue);

  logger.info('BullMQ queues initialized');

  app.addHook('onClose', async () => {
    await followQueue.close();
    await dmQueue.close();
    logger.info('BullMQ queues closed');
  });
});

declare module 'fastify' {
  interface FastifyInstance {
    followQueue: ReturnType<typeof createFollowQueue>;
    dmQueue: ReturnType<typeof createDmQueue>;
  }
}