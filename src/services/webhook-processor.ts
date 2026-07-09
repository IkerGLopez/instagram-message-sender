import { PrismaClient } from '@prisma/client';
import { Queue } from 'bullmq';
import { logger } from '../utils/logger.js';

export interface CommentEventData {
  instagramUserId: string;
  commentText: string;
  commentId: string;
  mediaId?: string;
  createdTime: number;
  rawPayload: Record<string, unknown>;
  webhookEventId: string;
}

export class WebhookProcessor {
  constructor(
    private readonly db: PrismaClient,
    private readonly dmQueue: Queue,
  ) {}

  /**
   * Process a comment event:
   * 1. Upsert comment record
   * 2. Enqueue DM job
   */
  async processCommentEvent(data: CommentEventData): Promise<void> {
    const { instagramUserId, commentText, commentId, mediaId, createdTime, webhookEventId } =
      data;

    // Upsert comment record — use actual comment.created_time, not server processing time
    await this.db.instagramComment.upsert({
      where: { commentId },
      update: { commentText },
      create: {
        commentId,
        instagramUserId,
        mediaId: mediaId ?? null,
        commentText,
        commentedAt: new Date(createdTime * 1000),
      },
    });

    // Enqueue DM dispatch job BEFORE marking event as PROCESSED.
    // If enqueue fails, event stays PENDING and will be retried.
    await this.dmQueue.add(
      'dm-dispatch',
      { instagramUserId, commentId, mediaId },
      {
        jobId: `dm-${instagramUserId}-${commentId}`,
        removeOnComplete: { age: 3600, count: 100 },
        removeOnFail: { age: 86400 },
      },
    );

    // Update webhook event as processed — only after DM is successfully enqueued
    await this.db.webhookEvent.update({
      where: { id: webhookEventId },
      data: {
        processingStatus: 'PROCESSED',
        processedAt: new Date(),
        instagramUserId,
      },
    });

    logger.info(
      { instagramUserId, commentId },
      'Comment event processed — DM queued',
    );
  }
}