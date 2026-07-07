import { Worker, Queue } from 'bullmq';
import IORedis from 'ioredis';
import { PrismaClient } from '@prisma/client';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { DMDispatcher } from './services/dm-dispatcher.js';
import { createCommentQueue, createDmQueue } from './queues/index.js';
import { processCommentEventJob, processDmDispatchJob } from './queues/job-handlers.js';

// Shared Redis connection
const redis = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

redis.on('connect', () => logger.info('Worker Redis connecting...'));
redis.on('ready', () => logger.info('Worker Redis connected'));
redis.on('error', (err) => logger.error({ err }, 'Worker Redis connection error'));

// Shared Prisma client
const db = new PrismaClient({
  log: [
    { emit: 'event', level: 'query' },
    { emit: 'event', level: 'error' },
  ],
});

db.$on('query', (e: { duration: number }) => {
  logger.trace({ duration: e.duration }, 'Prisma query');
});

db.$on('error', (e: any) => {
  logger.error({ error: e }, 'Prisma error');
});

// Shared services
const dmDispatcher = new DMDispatcher();

// Queue instances
const commentQueue = createCommentQueue(redis);
const dmQueue = createDmQueue(redis);

// Comment event worker
const commentWorker = new Worker(
  'instagram-comment',
  (job) =>
    processCommentEventJob(job, {
      prisma: db,
      redis,
      dmQueue,
    }),
  {
    connection: redis,
    concurrency: 5,
  },
);

commentWorker.on('error', (err) => logger.error({ err }, 'Comment worker error'));

commentWorker.on('active', (job) => {
  logger.info({ jobId: job.id, jobName: job.name }, 'Comment job started');
});

commentWorker.on('completed', (job) => {
  logger.info({ jobId: job.id }, 'Comment event processed');
});

commentWorker.on('failed', (job, err) => {
  logger.error(
    { jobId: job?.id, error: err.message },
    'Comment event processing failed',
  );
});

// DM dispatch worker
const dmWorker = new Worker(
  'instagram-dm',
  (job) =>
    processDmDispatchJob(job, {
      dmDispatcher,
      prisma: db,
    }),
  {
    connection: redis,
    concurrency: 1,
  },
);

dmWorker.on('error', (err) => logger.error({ err }, 'DM worker error'));

dmWorker.on('completed', (job) => {
  logger.info({ jobId: job.id }, 'DM dispatched');
});

dmWorker.on('failed', (job, err) => {
  const error = err as Error & { response?: { data: unknown } };
  logger.error(
    { jobId: job?.id, error: err.message, details: error.response?.data },
    'DM dispatch failed',
  );
});

// Graceful shutdown
const shutdown = async (signal: string) => {
  logger.info({ signal }, 'Worker shutdown initiated');

  await commentWorker.close();
  await dmWorker.close();
  await commentQueue.close();
  await dmQueue.close();
  await db.$disconnect();
  redis.disconnect();

  logger.info('Worker shutdown complete');
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

logger.info('Worker started — listening for jobs');