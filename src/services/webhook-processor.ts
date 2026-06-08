import { PrismaClient } from '@prisma/client';
import { Queue } from 'bullmq';
import { logger } from '../utils/logger.js';

export interface FollowEventData {
  instagramUserId: string;
  rawPayload: Record<string, unknown>;
  webhookEventId: string;
}

export class WebhookProcessor {
  constructor(
    private readonly db: PrismaClient,
    private readonly dmQueue: Queue,
  ) {}

  /**
   * Process a follow event:
   * 1. Upsert follower record
   * 2. Enqueue DM job
   */
  async processFollowEvent(data: FollowEventData): Promise<void> {
    const { instagramUserId, webhookEventId } = data;

    // Upsert follower
    await this.db.instagramFollower.upsert({
      where: { instagramUserId },
      update: {},
      create: { instagramUserId },
    });

    // Update webhook event as processed
    await this.db.webhookEvent.update({
      where: { id: webhookEventId },
      data: {
        processingStatus: 'PROCESSED',
        instagramUserId,
      },
    });

    // Enqueue DM dispatch job
    await this.dmQueue.add(
      'dm-dispatch',
      { instagramUserId },
      {
        jobId: `dm-${instagramUserId}`,
        removeOnComplete: { age: 3600, count: 100 },
        removeOnFail: { age: 86400 },
      },
    );

    logger.info({ instagramUserId }, 'Follow event processed — DM queued');
  }
}