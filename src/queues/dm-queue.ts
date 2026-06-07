import { Queue } from 'bullmq';
import type { Redis } from 'ioredis';
import {
  QUEUE_DEFAULT_ATTEMPTS,
  QUEUE_BACKOFF_DELAY,
  QUEUE_BACKOFF_TYPE,
} from '../config/constants.js';

export const DM_QUEUE_NAME = 'instagram-dm';

export interface DmDispatchJob {
  discountCodeId: string;
  instagramUserId: string;
  code: string;
}

export function createDmQueue(connection: Redis): Queue {
  return new Queue(DM_QUEUE_NAME, {
    connection,
    limiter: {
      max: 1,
      duration: 1000,
    },
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