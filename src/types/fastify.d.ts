import type { Queue } from 'bullmq';
import type IORedis from 'ioredis';
import type { PrismaClient } from '@prisma/client';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
    redis: IORedis;
    commentQueue: Queue;
    dmQueue: Queue;
  }
}
