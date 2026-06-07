import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { Queue } from 'bullmq';
import {
  QUEUE_DEFAULT_ATTEMPTS,
  QUEUE_BACKOFF_DELAY,
  QUEUE_BACKOFF_TYPE,
} from '../config/constants.js';
import { logger } from '../utils/logger.js';

export const bullmqPlugin = fp(async function bullmqPlugin(app: FastifyInstance) {
  const connection = (app as any).redis;

  // Follow event queue
  const followQueue = new Queue('follow-queue', {
    connection,
    defaultJobOptions: {
      attempts: QUEUE_DEFAULT_ATTEMPTS,
      backoff: {
        type: QUEUE_BACKOFF_TYPE,
        delay: QUEUE_BACKOFF_DELAY,
      },
      removeOnComplete: { age: 3600, count: 100 },
      removeOnFail: { age: 86400 },
    },
  });

  // DM dispatch queue (rate-limited to 1 msg/sec)
  const dmQueue = new Queue('dm-queue', {
    connection,
    defaultJobOptions: {
      attempts: QUEUE_DEFAULT_ATTEMPTS,
      backoff: {
        type: QUEUE_BACKOFF_TYPE,
        delay: QUEUE_BACKOFF_DELAY,
      },
      removeOnComplete: { age: 3600, count: 100 },
      removeOnFail: { age: 86400 },
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);

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
    followQueue: Queue;
    dmQueue: Queue;
  }
}
