import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import IORedis from 'ioredis';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

export const redisPlugin = fp(async function redisPlugin(app: FastifyInstance) {
  const redis = new IORedis(env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    retryStrategy: (times: number) => {
      // Never stop retrying — cap delay at 10s to avoid excessive waits
      return Math.min(times * 200, 10000);
    },
  });

  redis.on('error', (err: Error) => {
    logger.error({ err }, 'Redis connection error');
  });

  redis.on('connect', () => {
    logger.info('Redis connected');
  });

  // Test connection
  await redis.ping();

  app.decorate('redis', redis);

  app.addHook('onClose', async () => {
    await redis.quit();
    logger.info('Redis disconnected');
  });
});

declare module 'fastify' {
  interface FastifyInstance {
    redis: IORedis;
  }
}
