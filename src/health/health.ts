import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { env } from '../config/env.js';
import { TokenManager } from '../services/token-manager.js';
import { HEALTH_FAILED_JOBS_THRESHOLD } from '../config/constants.js';
import { logger } from '../utils/logger.js';

export async function healthRoute(app: FastifyInstance) {
  app.get('/health', async (_request: FastifyRequest, reply: FastifyReply) => {
    const health: Record<string, { status: string; detail?: string }> = {};
    let overallStatus = 'ok';

    // Check PostgreSQL
    try {
      await (app as any).prisma.$queryRaw`SELECT 1`;
      health.postgres = { status: 'ok' };
    } catch (error) {
      logger.error(error, 'Postgres health check failed');
      health.postgres = { status: 'error', detail: 'Database connection failed' };
      overallStatus = 'error';
    }

    // Check Redis
    try {
      await (app as any).redis.ping();
      health.redis = { status: 'ok' };
    } catch (error) {
      logger.error(error, 'Redis health check failed');
      health.redis = { status: 'error', detail: 'Redis connection failed' };
      overallStatus = 'error';
    }

    // Check Instagram token
    try {
      const tokenManager = new TokenManager(env.INSTAGRAM_PAGE_ACCESS_TOKEN);
      const tokenValid = tokenManager.isValid();
      health.instagram_token = {
        status: tokenValid ? 'ok' : 'error',
        detail: tokenValid
          ? `Token valid, ~${tokenManager.expiresInDays()} days remaining`
          : 'Token is invalid or empty',
      };
      if (!tokenValid) {
        overallStatus = 'error';
      }
    } catch (error) {
      health.instagram_token = { status: 'error', detail: 'Token check failed' };
      overallStatus = 'error';
    }

    // Check queue health (failed job count)
    try {
      const followQueue = (app as any).followQueue;
      const dmQueue = (app as any).dmQueue;

      const followFailedCount = await followQueue.getFailedCount();
      const dmFailedCount = await dmQueue.getFailedCount();

      health.queues = {
        status:
          followFailedCount + dmFailedCount > HEALTH_FAILED_JOBS_THRESHOLD
            ? 'warning'
            : 'ok',
        detail: `follow-queue: ${followFailedCount} failed, dm-queue: ${dmFailedCount} failed`,
      };

      if (followFailedCount + dmFailedCount > HEALTH_FAILED_JOBS_THRESHOLD) {
        overallStatus = 'warning';
      }
    } catch (error) {
      logger.error(error, 'Queue health check failed');
      health.queues = { status: 'error', detail: 'Queue health check failed' };
      overallStatus = 'error';
    }

    const statusCode = overallStatus === 'ok' ? 200 : overallStatus === 'warning' ? 200 : 503;

    return reply.code(statusCode).send({
      status: overallStatus,
      services: health,
      timestamp: new Date().toISOString(),
    });
  });
}
