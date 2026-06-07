import pino from 'pino';
import { env } from '../config/env.js';

export const logger = pino({
  level: env.LOG_LEVEL,
  transport:
    env.NODE_ENV === 'development'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
  redact: {
    paths: [
      'INSTAGRAM_PAGE_ACCESS_TOKEN',
      'API_KEY_HASH_SECRET',
      'DATABASE_URL',
      'req.headers.authorization',
      'req.headers.x-api-key',
    ],
    remove: true,
  },
});
