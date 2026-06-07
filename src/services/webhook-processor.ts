import { PrismaClient } from '@prisma/client';
import { Queue } from 'bullmq';
import { CodeEngine } from './code-engine.js';
import { logger } from '../utils/logger.js';
import { CODE_EXPIRY_DAYS } from '../config/constants.js';

export interface FollowEventData {
  instagramUserId: string;
  rawPayload: Record<string, unknown>;
  webhookEventId: string;
}

export class WebhookProcessor {
  constructor(
    private readonly db: PrismaClient,
    private readonly codeEngine: CodeEngine,
    private readonly dmQueue: Queue,
  ) {}

  /**
   * Process a follow event:
   * 1. Check if user already has a code
   * 2. Upsert follower record
   * 3. Generate new discount code
   * 4. Create DB records
   * 5. Enqueue DM job
   */
  async processFollowEvent(data: FollowEventData): Promise<void> {
    const { instagramUserId, webhookEventId } = data;

    // Check if user already has an active code
    const existingCode = await this.db.discountCode.findFirst({
      where: {
        instagramUserId,
        status: 'ACTIVE',
      },
    });

    if (existingCode) {
      logger.info(
        { instagramUserId, existingCode: existingCode.code },
        'User already has an active code, skipping',
      );
      await this.db.webhookEvent.update({
        where: { id: webhookEventId },
        data: {
          processingStatus: 'SKIPPED',
          errorMessage: 'Code already issued',
        },
      });
      return;
    }

    // Upsert follower
    await this.db.instagramFollower.upsert({
      where: { instagramUserId },
      update: {},
      create: { instagramUserId },
    });

    // Generate code
    const code = await this.codeEngine.generateDiscountCode();

    // Calculate expiry
    const expiresAt = new Date(Date.now() + CODE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    // Create discount code record
    const discountCode = await this.db.discountCode.create({
      data: {
        code,
        instagramUserId,
        status: 'ACTIVE',
        discountPercent: 3,
        expiresAt,
      },
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
      {
        discountCodeId: discountCode.id,
        instagramUserId,
        code,
      },
      {
        jobId: `dm-${discountCode.id}`,
        removeOnComplete: { age: 3600, count: 100 },
        removeOnFail: { age: 86400 },
      },
    );

    logger.info(
      { instagramUserId, code: discountCode.code },
      'Follow event processed — code generated and DM queued',
    );
  }
}
