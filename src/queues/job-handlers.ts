import type { Job } from 'bullmq';
import { logger } from '../utils/logger.js';
import { DMDispatcher } from '../services/dm-dispatcher.js';
import { buildWelcomeMessage } from '../utils/build-message.js';
import type { PrismaClient } from '@prisma/client';
import type { Queue } from 'bullmq';
import type { Redis } from 'ioredis';

import { FollowEventJob } from './follow-queue.js';
import { DmDispatchJob } from './dm-queue.js';

export interface FollowEventJobDeps {
  prisma: PrismaClient;
  redis: Redis;
  dmQueue: Queue;
}

export interface DmDispatchJobDeps {
  dmDispatcher: DMDispatcher;
}

export async function processFollowEventJob(
  job: Job<FollowEventJob>,
  deps: FollowEventJobDeps,
): Promise<void> {
  logger.info({ jobId: job.id, attempt: job.attemptsMade }, 'Processing follow event');

  const { prisma, redis, dmQueue } = deps;

  // Dynamically import to avoid circular dependency issues
  const { WebhookProcessor } = await import('../services/webhook-processor.js');
  const webhookProcessor = new WebhookProcessor(prisma, dmQueue);

  await webhookProcessor.processFollowEvent(job.data);
}

export async function processDmDispatchJob(
  job: Job<DmDispatchJob>,
  deps: DmDispatchJobDeps,
): Promise<void> {
  const { instagramUserId } = job.data;
  logger.info({ jobId: job.id, instagramUserId }, 'Processing DM dispatch');

  const { dmDispatcher } = deps;
  const messageText = buildWelcomeMessage();
  await dmDispatcher.sendWelcomeMessage(instagramUserId, messageText);

  logger.info({ instagramUserId }, 'DM dispatched successfully');
}