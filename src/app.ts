import Fastify from 'fastify';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import cors from '@fastify/cors';
import { prismaPlugin } from './plugins/prisma.js';
import { redisPlugin } from './plugins/redis.js';
import { bullmqPlugin } from './plugins/bullmq.js';
import { swaggerPlugin } from './plugins/swagger.js';
import { registerErrorHandler } from './middleware/error-handler.js';
import { instagramWebhookRoutes } from './routes/webhooks/instagram.js';
import { legalRoutes } from './routes/legal.js';
import { healthRoute } from './health/health.js';
import { apiKeyAuthMiddleware } from './middleware/api-key-auth.js';
import { hmacValidatorMiddleware } from './middleware/hmac-validator.js';
import { env } from './config/env.js';
import {
  WEBHOOK_RATE_LIMIT_MAX,
  WEBHOOK_RATE_LIMIT_WINDOW,
  API_RATE_LIMIT_MAX_PER_KEY,
} from './config/constants.js';

export async function buildApp() {
  const app = Fastify({
    logger: false, // We use Pino directly
    bodyLimit: 1_048_576, // 1MB
  });

  // Register plugins (order matters for dependency chain)
  await app.register(prismaPlugin);
  await app.register(redisPlugin);
  await app.register(bullmqPlugin);

  // Swagger API docs (dev-only — skipped in production)
  await app.register(swaggerPlugin);

  // Security headers
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
    },
    frameguard: { action: 'deny' },
    noSniff: true,
    xssFilter: true,
    referrerPolicy: { policy: 'no-referrer' },
  });

  // CORS
  await app.register(cors, {
    origin: env.NODE_ENV === 'production' ? [] : true,
    methods: ['GET', 'POST'],
  });

  // Global rate limit
  await app.register(rateLimit, {
    max: 1000,
    timeWindow: '1 minute',
  });

  // Register middleware as decorators
  app.decorate('apiKeyAuth', apiKeyAuthMiddleware);

  // Raw body capture for HMAC validation (preParsing hook)
  app.addHook('preParsing', async (request, _reply, payload) => {
    const chunks: Buffer[] = [];
    for await (const chunk of payload) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const rawBody = Buffer.concat(chunks);
    (request as any).rawBody = rawBody;
    // Return a new readable stream from the raw body
    const { Readable } = await import('stream');
    return Readable.from(rawBody);
  });

  // Register routes
  // Webhook routes with HMAC validation and specific rate limiting
  await app.register(async (webhookApp) => {
    await webhookApp.register(rateLimit, {
      max: WEBHOOK_RATE_LIMIT_MAX,
      timeWindow: WEBHOOK_RATE_LIMIT_WINDOW,
      keyGenerator: (req) => req.ip,
    });
    webhookApp.addHook('preHandler', hmacValidatorMiddleware);
    await webhookApp.register(instagramWebhookRoutes);
  }, { prefix: '' });

  // API routes with API key auth and rate limiting
  await app.register(async (apiApp) => {
    await apiApp.register(rateLimit, {
      max: API_RATE_LIMIT_MAX_PER_KEY,
      timeWindow: '1 minute',
      keyGenerator: (req) => (req.headers['x-api-key'] as string) || req.ip,
    });
  }, { prefix: '' });

  // Health endpoint (no auth, no rate limit)
  await healthRoute(app);

  // Legal pages (no auth, no rate limit)
  await legalRoutes(app);

  // Global error handler
  registerErrorHandler(app);

  return app;
}
