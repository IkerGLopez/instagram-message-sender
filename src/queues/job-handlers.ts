import type { Job } from 'bullmq';
import { logger } from '../utils/logger.js';
import { DMDispatcher } from '../services/dm-dispatcher.js';
import { buildWelcomeMessage } from '../utils/build-message.js';
import { env } from '../config/env.js';
import type { PrismaClient } from '@prisma/client';
import type { Queue } from 'bullmq';

import { CommentEventJob } from './comment-queue.js';
import { DmDispatchJob } from './dm-queue.js';

export interface CommentEventJobDeps {
  prisma: PrismaClient;
  dmQueue: Queue;
}

export interface DmDispatchJobDeps {
  dmDispatcher: DMDispatcher;
  prisma: PrismaClient;
}

export async function processCommentEventJob(
  job: Job<CommentEventJob>,
  deps: CommentEventJobDeps,
): Promise<void> {
  logger.info(
    { jobId: job.id, attempt: job.attemptsMade },
    'Processing comment event',
  );

  const { prisma, dmQueue } = deps;

  // Dynamically import to avoid circular dependency issues
  const { WebhookProcessor } = await import(
    '../services/webhook-processor.js'
  );
  const webhookProcessor = new WebhookProcessor(prisma, dmQueue);

  await webhookProcessor.processCommentEvent(job.data);
}

export async function processDmDispatchJob(
  job: Job<DmDispatchJob>,
  deps: DmDispatchJobDeps,
): Promise<void> {
  const { instagramUserId, commentId, mediaId } = job.data;
  logger.info(
    { jobId: job.id, instagramUserId, commentId },
    'Processing DM dispatch',
  );

  // Idempotency guard: if DmRecord already exists, skip (prevents duplicate DMs on retry or race)
  const existingRecord = await deps.prisma.dmRecord.findFirst({
    where: { instagramUserId },
  });

  if (existingRecord) {
    logger.info(
      { instagramUserId, existingMessageId: existingRecord.dmMessageId },
      'DM already recorded — skipping duplicate dispatch',
    );
    return;
  }

  const { dmDispatcher } = deps;
  const messageText = buildWelcomeMessage();
  const result = await dmDispatcher.sendWelcomeMessage(
    instagramUserId,
    messageText,
  );

  // Record the sent DM
  await deps.prisma.dmRecord.create({
    data: {
      instagramUserId,
      commentId: commentId ?? null,
      mediaId: mediaId ?? null,
      discountCode: env.STATIC_DISCOUNT_CODE,
      dmMessageId: result.messageId,
    },
  });

  logger.info(
    { instagramUserId, commentId, messageId: result.messageId },
    'DM dispatched and recorded',
  );
}