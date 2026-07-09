import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Job } from 'bullmq';
import { Prisma } from '@prisma/client';

// Mock env before importing modules that use it
vi.mock('@/config/env.js', () => ({
  env: {
    STATIC_DISCOUNT_CODE: 'WELCOME-NEWSYSTEM',
    INSTAGRAM_PAGE_ACCESS_TOKEN: 'test-token',
    INSTAGRAM_BUSINESS_ACCOUNT_ID: 'test-account',
    LOG_LEVEL: 'info',
  },
}));

import { processDmDispatchJob } from '@/queues/job-handlers.js';
import type { DmDispatchJob } from '@/queues/dm-queue.js';
import { createMockPrisma } from '../fixtures/test-helpers.js';

function createMockJob(data: DmDispatchJob): Job<DmDispatchJob> {
  return {
    id: 'test-job-1',
    data,
    attemptsMade: 0,
    opts: {},
    queue: null,
    queueName: 'instagram-dm',
  } as unknown as Job<DmDispatchJob>;
}

describe('processDmDispatchJob', () => {
  let mockDmDispatcher: { sendWelcomeMessage: ReturnType<typeof vi.fn> };
  let mockDmRecordCreate: ReturnType<typeof vi.fn>;
  let mockDmRecordUpdate: ReturnType<typeof vi.fn>;
  let mockDmRecordUpdateMany: ReturnType<typeof vi.fn>;
  let mockDmRecordFindUnique: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockDmDispatcher = {
      sendWelcomeMessage: vi.fn().mockResolvedValue({ messageId: 'mid.test' }),
    };
    mockDmRecordCreate = vi.fn().mockResolvedValue({});
    mockDmRecordUpdate = vi.fn().mockResolvedValue({});
    mockDmRecordUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
    mockDmRecordFindUnique = vi.fn().mockResolvedValue(null);
  });

  function buildPrisma() {
    const prisma = createMockPrisma();
    prisma.dmRecord = {
      create: mockDmRecordCreate,
      update: mockDmRecordUpdate,
      updateMany: mockDmRecordUpdateMany,
      findUnique: mockDmRecordFindUnique,
    } as any;
    return prisma;
  }

  // T7: DM dispatch with static discount code
  it('should send DM with static discount code', async () => {
    const job = createMockJob({
      instagramUserId: 'user-123',
      commentId: 'comment-1',
      mediaId: 'media-1',
    });

    mockDmDispatcher.sendWelcomeMessage.mockResolvedValue({
      messageId: 'mid.123',
    });

    await processDmDispatchJob(job, {
      dmDispatcher: mockDmDispatcher as any,
      prisma: buildPrisma() as any,
    });

    // Assert: dmRecord.create called first with dmMessageId: null and dmSendAttemptedAt set
    expect(mockDmRecordCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          instagramUserId: 'user-123',
          discountCode: 'WELCOME-NEWSYSTEM',
          dmMessageId: null,
          dmSendAttemptedAt: expect.any(Date),
        }),
      }),
    );

    // Assert: Instagram API called with userId and text containing static code
    expect(mockDmDispatcher.sendWelcomeMessage).toHaveBeenCalledWith(
      'user-123',
      expect.stringContaining('WELCOME-NEWSYSTEM'),
    );

    // Assert: update called once — post-send only (pre-flight marker is now part of create)
    expect(mockDmRecordUpdate).toHaveBeenCalledTimes(1);
    expect(mockDmRecordUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { instagramUserId: 'user-123' },
        data: {
          dmMessageId: 'mid.123',
          dmSentAt: expect.any(Date),
        },
      }),
    );
  });

  // T8: No duplicate DM — idempotency guard via P2002
  // Scenario: concurrent worker already created AND sent the DM (dmMessageId is set)
  it('should NOT send duplicate DM to same user', async () => {
    // Simulate concurrent worker already created the record
    mockDmRecordCreate.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError(
        'Unique constraint violation',
        {
          code: 'P2002',
          clientVersion: '6.x',
          meta: { target: ['instagram_user_id'] },
        },
      ),
    );
    // Existing record has dmMessageId already set (DM was already sent)
    mockDmRecordFindUnique.mockResolvedValue({
      instagramUserId: 'user-123',
      dmMessageId: 'mid.existing',
    });

    const job = createMockJob({
      instagramUserId: 'user-123',
      commentId: 'comment-2',
      mediaId: 'media-2',
    });

    await processDmDispatchJob(job, {
      dmDispatcher: mockDmDispatcher as any,
      prisma: buildPrisma() as any,
    });

    // Assert: no DM sent
    expect(mockDmDispatcher.sendWelcomeMessage).not.toHaveBeenCalled();

    // Assert: no update called either
    expect(mockDmRecordUpdate).not.toHaveBeenCalled();
  });

  // T9: Persist dm_record after successful send (now via create + update)
  it('should persist dm_record after successful send', async () => {
    const job = createMockJob({
      instagramUserId: 'user-456',
      commentId: 'comment-3',
      mediaId: 'media-3',
    });

    mockDmDispatcher.sendWelcomeMessage.mockResolvedValue({
      messageId: 'mid.456',
    });

    await processDmDispatchJob(job, {
      dmDispatcher: mockDmDispatcher as any,
      prisma: buildPrisma() as any,
    });

    // Assert: dmRecord.create called first with dmMessageId: null and dmSendAttemptedAt set
    expect(mockDmRecordCreate).toHaveBeenCalledWith({
      data: {
        instagramUserId: 'user-456',
        commentId: 'comment-3',
        mediaId: 'media-3',
        discountCode: 'WELCOME-NEWSYSTEM',
        dmMessageId: null,
        dmSentAt: null,
        dmSendAttemptedAt: expect.any(Date),
      },
    });

    // Assert: update called once — post-send only (pre-flight marker is now part of create)
    expect(mockDmRecordUpdate).toHaveBeenCalledTimes(1);
    expect(mockDmRecordUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { instagramUserId: 'user-456' },
        data: {
          dmMessageId: 'mid.456',
          dmSentAt: expect.any(Date),
        },
      }),
    );
  });

  // T10: Proceed to send on retry when dmSendAttemptedAt is null (API failed, DM never sent)
  it('should proceed to send DM on retry when dmSendAttemptedAt is null', async () => {
    // Simulate P2002 — record already exists from a failed first attempt
    mockDmRecordCreate.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError(
        'Unique constraint violation',
        {
          code: 'P2002',
          clientVersion: '6.x',
          meta: { target: ['instagram_user_id'] },
        },
      ),
    );
    // Existing record: dmMessageId is null AND dmSendAttemptedAt is null
    // This means the first attempt created the record, the API call failed,
    // and dmSendAttemptedAt was reverted to null. The retry should proceed.
    mockDmRecordFindUnique.mockResolvedValue({
      instagramUserId: 'user-789',
      dmMessageId: null,
      dmSendAttemptedAt: null,
    });

    mockDmDispatcher.sendWelcomeMessage.mockResolvedValue({
      messageId: 'mid.retry',
    });

    const job = createMockJob({
      instagramUserId: 'user-789',
      commentId: 'comment-4',
      mediaId: 'media-4',
    });

    await processDmDispatchJob(job, {
      dmDispatcher: mockDmDispatcher as any,
      prisma: buildPrisma() as any,
    });

    // Assert: DM WAS sent (retry proceeded because dmSendAttemptedAt is null)
    expect(mockDmDispatcher.sendWelcomeMessage).toHaveBeenCalledWith(
      'user-789',
      expect.stringContaining('WELCOME-NEWSYSTEM'),
    );

    // Assert: updateMany (race-winning atomic write) + 1 update (post-send)
    expect(mockDmRecordUpdateMany).toHaveBeenCalledTimes(1);
    expect(mockDmRecordUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { instagramUserId: 'user-789', dmMessageId: null },
        data: { dmSendAttemptedAt: expect.any(Date) },
      }),
    );
    expect(mockDmRecordUpdate).toHaveBeenCalledTimes(1);
    expect(mockDmRecordUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { instagramUserId: 'user-789' },
        data: {
          dmMessageId: 'mid.retry',
          dmSentAt: expect.any(Date),
        },
      }),
    );
  });

  // T11: P2002 + dmMessageId set → skip
  it('should skip when dmMessageId is already set (T11)', async () => {
    mockDmRecordCreate.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError(
        'Unique constraint violation',
        {
          code: 'P2002',
          clientVersion: '6.x',
          meta: { target: ['instagram_user_id'] },
        },
      ),
    );
    mockDmRecordFindUnique.mockResolvedValue({
      instagramUserId: 'user-t11',
      dmMessageId: 'mid.existing',
      dmSendAttemptedAt: new Date(),
    });

    const job = createMockJob({ instagramUserId: 'user-t11' });

    await processDmDispatchJob(job, {
      dmDispatcher: mockDmDispatcher as any,
      prisma: buildPrisma() as any,
    });

    expect(mockDmDispatcher.sendWelcomeMessage).not.toHaveBeenCalled();
    expect(mockDmRecordUpdate).not.toHaveBeenCalled();
  });

  // T12: P2002 + dmMessageId null → proceed regardless of dmSendAttemptedAt (at-least-once delivery)
  it('should proceed to send DM when dmMessageId is null even if dmSendAttemptedAt is recent (T12)', async () => {
    mockDmRecordCreate.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError(
        'Unique constraint violation',
        {
          code: 'P2002',
          clientVersion: '6.x',
          meta: { target: ['instagram_user_id'] },
        },
      ),
    );
    mockDmRecordFindUnique.mockResolvedValue({
      instagramUserId: 'user-t12',
      dmMessageId: null,
      dmSendAttemptedAt: new Date(),
    });
    mockDmDispatcher.sendWelcomeMessage.mockResolvedValue({
      messageId: 'mid.t12',
    });

    const job = createMockJob({
      instagramUserId: 'user-t12',
      commentId: 'comment-t12',
      mediaId: 'media-t12',
    });

    await processDmDispatchJob(job, {
      dmDispatcher: mockDmDispatcher as any,
      prisma: buildPrisma() as any,
    });

    // Assert: DM WAS sent (at-least-once: dmMessageId null always means "send")
    expect(mockDmDispatcher.sendWelcomeMessage).toHaveBeenCalledWith(
      'user-t12',
      expect.stringContaining('WELCOME-NEWSYSTEM'),
    );

    // Assert: updateMany (race-winning atomic write) + 1 update (post-send)
    expect(mockDmRecordUpdateMany).toHaveBeenCalledTimes(1);
    expect(mockDmRecordUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { instagramUserId: 'user-t12', dmMessageId: null },
        data: { dmSendAttemptedAt: expect.any(Date) },
      }),
    );
    expect(mockDmRecordUpdate).toHaveBeenCalledTimes(1);
    expect(mockDmRecordUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { instagramUserId: 'user-t12' },
        data: {
          dmMessageId: 'mid.t12',
          dmSentAt: expect.any(Date),
        },
      }),
    );
  });

  // T13: P2002 + both null → proceed to send (legitimate retry after API failure)
  it('should proceed to send DM when both dmMessageId and dmSendAttemptedAt are null (T13)', async () => {
    mockDmRecordCreate.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError(
        'Unique constraint violation',
        {
          code: 'P2002',
          clientVersion: '6.x',
          meta: { target: ['instagram_user_id'] },
        },
      ),
    );
    mockDmRecordFindUnique.mockResolvedValue({
      instagramUserId: 'user-t13',
      dmMessageId: null,
      dmSendAttemptedAt: null,
    });
    mockDmDispatcher.sendWelcomeMessage.mockResolvedValue({
      messageId: 'mid.t13',
    });

    const job = createMockJob({
      instagramUserId: 'user-t13',
      commentId: 'comment-t13',
      mediaId: 'media-t13',
    });

    await processDmDispatchJob(job, {
      dmDispatcher: mockDmDispatcher as any,
      prisma: buildPrisma() as any,
    });

    // Assert: DM WAS sent (both null → legitimate retry)
    expect(mockDmDispatcher.sendWelcomeMessage).toHaveBeenCalledWith(
      'user-t13',
      expect.stringContaining('WELCOME-NEWSYSTEM'),
    );

    // Assert: updateMany (race-winning atomic write) + 1 update (post-send)
    expect(mockDmRecordUpdateMany).toHaveBeenCalledTimes(1);
    expect(mockDmRecordUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { instagramUserId: 'user-t13', dmMessageId: null },
        data: { dmSendAttemptedAt: expect.any(Date) },
      }),
    );
    expect(mockDmRecordUpdate).toHaveBeenCalledTimes(1);
    expect(mockDmRecordUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { instagramUserId: 'user-t13' },
        data: {
          dmMessageId: 'mid.t13',
          dmSentAt: expect.any(Date),
        },
      }),
    );
  });

  // T14: sendWelcomeMessage rejects → revert dmSendAttemptedAt → re-throw original error
  it('should revert dmSendAttemptedAt and re-throw when send fails (T14)', async () => {
    mockDmDispatcher.sendWelcomeMessage.mockRejectedValue(
      new Error('API rate limit exceeded'),
    );

    const job = createMockJob({
      instagramUserId: 'user-t14',
      commentId: 'comment-t14',
      mediaId: 'media-t14',
    });

    await expect(
      processDmDispatchJob(job, {
        dmDispatcher: mockDmDispatcher as any,
        prisma: buildPrisma() as any,
      }),
    ).rejects.toThrow('API rate limit exceeded');

    // Assert: revert update called to clear the pre-flight marker
    expect(mockDmRecordUpdate).toHaveBeenCalledTimes(1);
    expect(mockDmRecordUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { instagramUserId: 'user-t14' },
        data: { dmSendAttemptedAt: null },
      }),
    );
  });

  // T15: sendWelcomeMessage rejects AND revert update also rejects → original error re-thrown
  it('should re-throw original sendError even when revert update fails (T15)', async () => {
    mockDmDispatcher.sendWelcomeMessage.mockRejectedValue(
      new Error('API rate limit exceeded'),
    );

    // Revert update also fails (e.g. DB connection lost)
    mockDmRecordUpdate.mockRejectedValue(
      new Error('DB connection lost'),
    );

    const job = createMockJob({
      instagramUserId: 'user-t15',
      commentId: 'comment-t15',
      mediaId: 'media-t15',
    });

    await expect(
      processDmDispatchJob(job, {
        dmDispatcher: mockDmDispatcher as any,
        prisma: buildPrisma() as any,
      }),
    ).rejects.toThrow('API rate limit exceeded');

    // Assert: the revert was attempted
    expect(mockDmRecordUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { instagramUserId: 'user-t15' },
        data: { dmSendAttemptedAt: null },
      }),
    );
  });
});
