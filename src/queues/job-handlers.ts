import type { Job } from 'bullmq';
import { logger } from '../utils/logger.js';
import { WebhookProcessor } from '../services/webhook-processor.js';
import { DMDispatcher } from '../services/dm-dispatcher.js';
import { buildWelcomeMessage } from '../utils/build-message.js';
import { env } from '../config/env.js';
import type { PrismaClient } from '@prisma/client';
import type { Queue } from 'bullmq';
import type { Redis } from 'ioredis';
import type { CodeEngine } from '../services/code-engine.js';

import { FollowEventJob } from './follow-queue.js';
import { DmDispatchJob } from './dm-queue.js';

export interface FollowEventJobDeps {
  prisma: PrismaClient;
  redis: Redis;
  codeEngine: CodeEngine;
  dmQueue: Queue;
}

export interface DmDispatchJobDeps {
  prisma: PrismaClient;
  dmDispatcher: DMDispatcher;
}

export async function processFollowEventJob(
  job: Job<FollowEventJob>,
  deps: FollowEventJobDeps,
): Promise<void> {
  logger.info({ jobId: job.id, attempt: job.attemptsMade }, 'Processing follow event');

  const { prisma, redis, codeEngine, dmQueue } = deps;
  const webhookProcessor = new WebhookProcessor(prisma, codeEngine, dmQueue);

  await webhookProcessor.processFollowEvent(job.data);
}

export async function processDmDispatchJob(
  job: Job<DmDispatchJob>,
  deps: DmDispatchJobDeps,
): Promise<void> {
  const { discountCodeId, instagramUserId, code } = job.data;
  logger.info({ jobId: job.id, discountCodeId }, 'Processing DM dispatch');

  const { prisma, dmDispatcher } = deps;
  const messageText = buildWelcomeMessage(code, env.STORE_BASE_URL);
  const result = await dmDispatcher.sendWelcomeMessage(instagramUserId, messageText);

  await prisma.discountCode.update({
    where: { id: discountCodeId },
    data: {
      dmSentAt: new Date(),
      dmMessageId: result.messageId,
    },
  });

  logger.info(
    { discountCodeId, messageId: result.messageId },
    'DM dispatched successfully',
  );
}