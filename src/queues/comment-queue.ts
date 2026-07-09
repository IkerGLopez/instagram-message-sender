import { Queue } from 'bullmq';
import type { Redis } from 'ioredis';
import {
  QUEUE_DEFAULT_ATTEMPTS,
  QUEUE_BACKOFF_DELAY,
  QUEUE_BACKOFF_TYPE,
} from '../config/constants.js';

export const COMMENT_QUEUE_NAME = 'instagram-comment';

export interface CommentEventJob {
  instagramUserId: string;
  commentText: string;
  commentId: string;
  mediaId?: string;
  createdTime: number;
  rawPayload: Record<string, unknown>;
  webhookEventId: string;
}

export function createCommentQueue(connection: Redis): Queue {
  return new Queue(COMMENT_QUEUE_NAME, {
    connection,
    defaultJobOptions: {
      attempts: QUEUE_DEFAULT_ATTEMPTS,
      backoff: {
        type: QUEUE_BACKOFF_TYPE,
        delay: QUEUE_BACKOFF_DELAY,
      },
      removeOnComplete: { age: 3600, count: 100 },
      removeOnFail: { age: 86400 },
    },
  });
}
