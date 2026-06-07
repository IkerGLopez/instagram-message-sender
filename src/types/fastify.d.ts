import type { FastifyRequest, FastifyReply } from 'fastify';
import type { Queue } from 'bullmq';
import type IORedis from 'ioredis';
import type { PrismaClient } from '@prisma/client';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
    redis: IORedis;
    followQueue: Queue;
    dmQueue: Queue;
    apiKeyAuth: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}
