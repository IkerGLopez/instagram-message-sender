import type { Job } from 'bullmq';
import { Prisma } from '@prisma/client';
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

  // Atomic idempotency guard: create the DmRecord FIRST.
  // If the create succeeds, this worker is the sole sender — proceed to send the DM.
  // If the create fails with P2002 (unique constraint on instagramUserId),
  // another concurrent worker already created the record — skip.
  try {
    await deps.prisma.dmRecord.create({
      data: {
        instagramUserId,
        commentId: commentId ?? null,
        mediaId: mediaId ?? null,
        discountCode: env.STATIC_DISCOUNT_CODE,
        dmMessageId: null,
        dmSentAt: null,
        dmSendAttemptedAt: new Date(),
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      // Atomic create failed — another worker already created the record.
      // Fetch the existing record to check if the DM was actually sent.
      const existing = await deps.prisma.dmRecord.findUnique({
        where: { instagramUserId },
      });

      if (!existing) {
        // Should never happen if P2002 was thrown, but guard anyway
        throw error;
      }

      if (existing.dmMessageId !== null) {
        // DM was already sent and recorded — nothing to do.
        logger.warn(
          { instagramUserId },
          'DM record already created and sent — skipping',
        );
        return;
      }

      // dmMessageId is null. Use an atomic conditional update to close the TOCTOU window:
      // only set dmSendAttemptedAt if dmMessageId is still null.
      const { count } = await deps.prisma.dmRecord.updateMany({
        where: { instagramUserId, dmMessageId: null },
        data: { dmSendAttemptedAt: new Date() },
      });
      if (count === 0) {
        // Another worker already set dmMessageId → skip
        return;
      }
      // We won the race → proceed to send
    } else {
      throw error;
    }
  }

  const { dmDispatcher } = deps;
  const messageText = buildWelcomeMessage();

  // Attempt the API call. If it fails, revert dmSendAttemptedAt and re-throw.
  let result: Awaited<ReturnType<typeof dmDispatcher.sendWelcomeMessage>>;
  try {
    result = await dmDispatcher.sendWelcomeMessage(
      instagramUserId,
      messageText,
    );
  } catch (sendError) {
    // API call failed (rate limit, network error, timeout).
    // Revert dmSendAttemptedAt so the retry can re-send.
    try {
      await deps.prisma.dmRecord.update({
        where: { instagramUserId },
        data: { dmSendAttemptedAt: null },
      });
    } catch (revertError) {
      logger.error(
        { instagramUserId, err: revertError },
        'Failed to revert dmSendAttemptedAt after send failure — dmSendAttemptedAt metadata may be stale.',
      );
    }
    throw sendError;
  }

  // API call succeeded. Record the result.
  // No try/catch — if this update fails, the job will retry and re-send the DM
  // (at-least-once delivery). dmSendAttemptedAt was already set at record creation time.
  await deps.prisma.dmRecord.update({
    where: { instagramUserId },
    data: {
      dmMessageId: result.messageId,
      dmSentAt: new Date(),
    },
  });

  logger.info(
    { instagramUserId, commentId, messageId: result.messageId },
    'DM dispatched and recorded',
  );
}