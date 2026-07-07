import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Job } from 'bullmq';
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
  let mockDmRecordFindFirst: ReturnType<typeof vi.fn>;
  let mockDmRecordCreate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockDmDispatcher = {
      sendWelcomeMessage: vi.fn().mockResolvedValue({ messageId: 'mid.test' }),
    };
    mockDmRecordFindFirst = vi.fn().mockResolvedValue(null);
    mockDmRecordCreate = vi.fn().mockResolvedValue({});
  });

  function buildPrisma() {
    const prisma = createMockPrisma();
    prisma.dmRecord = {
      findFirst: mockDmRecordFindFirst,
      create: mockDmRecordCreate,
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

    // Assert: Instagram API called with userId and text containing static code
    expect(mockDmDispatcher.sendWelcomeMessage).toHaveBeenCalledWith(
      'user-123',
      expect.stringContaining('WELCOME-NEWSYSTEM'),
    );

    // Assert: dmRecord.create called with correct fields
    expect(mockDmRecordCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          instagramUserId: 'user-123',
          discountCode: 'WELCOME-NEWSYSTEM',
          dmMessageId: 'mid.123',
        }),
      }),
    );
  });

  // T8: No duplicate DM — idempotency guard
  it('should NOT send duplicate DM to same user', async () => {
    mockDmRecordFindFirst.mockResolvedValue({
      id: 'existing-record',
      dmMessageId: 'existing-mid',
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

    // Assert: no new record created
    expect(mockDmRecordCreate).not.toHaveBeenCalled();
  });

  // T9: Persist dm_record after successful send
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

    // Assert: dmRecord.create called with exact expected values
    expect(mockDmRecordCreate).toHaveBeenCalledWith({
      data: {
        instagramUserId: 'user-456',
        commentId: 'comment-3',
        mediaId: 'media-3',
        discountCode: 'WELCOME-NEWSYSTEM',
        dmMessageId: 'mid.456',
      },
    });
  });
});
