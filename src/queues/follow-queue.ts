import { Queue } from 'bullmq';
import type { Redis } from 'ioredis';
import {
  QUEUE_DEFAULT_ATTEMPTS,
  QUEUE_BACKOFF_DELAY,
  QUEUE_BACKOFF_TYPE,
} from '../config/constants.js';

export const FOLLOW_QUEUE_NAME = 'instagram-follow';

export interface FollowEventJob {
  instagramUserId: string;
  username: string;
  followedAt: string;
}

export function createFollowQueue(connection: Redis): Queue {
  return new Queue(FOLLOW_QUEUE_NAME, {
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