import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { env } from '../config/env.js';
import { TokenManager } from '../services/token-manager.js';
import { logger } from '../utils/logger.js';

export async function healthRoute(app: FastifyInstance) {
  app.get('/health', async (_request: FastifyRequest, reply: FastifyReply) => {
    const services: Record<string, string | number | boolean> = {};
    let overallStatus: 'ok' | 'error' = 'ok';

    // Check PostgreSQL
    try {
      await (app as any).prisma.$queryRaw`SELECT 1`;
      services.database = 'ok';
    } catch (error) {
      logger.error(error, 'Postgres health check failed');
      services.database = 'error';
      overallStatus = 'error';
    }

    // Check Redis
    try {
      await (app as any).redis.ping();
      services.redis = 'ok';
    } catch (error) {
      logger.error(error, 'Redis health check failed');
      services.redis = 'error';
      overallStatus = 'error';
    }

    // Check Instagram token
    try {
      const tokenManager = new TokenManager(env.INSTAGRAM_PAGE_ACCESS_TOKEN);
      const tokenValid = tokenManager.isValid();
      services.instagram_token_valid = tokenValid;
      services.instagram_token_expires_in_days = tokenManager.expiresInDays();
      if (!tokenValid) {
        overallStatus = 'error';
      }
    } catch (error) {
      services.instagram_token_valid = false;
      services.instagram_token_expires_in_days = 0;
      overallStatus = 'error';
    }

    const statusCode = overallStatus === 'ok' ? 200 : 503;

    return reply.code(statusCode).send({
      status: overallStatus,
      services,
      timestamp: new Date().toISOString(),
    });
  });
}
