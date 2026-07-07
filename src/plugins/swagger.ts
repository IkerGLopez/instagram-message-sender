import fp from 'fastify-plugin';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import type { FastifyInstance } from 'fastify';

/**
 * Dev-only OpenAPI documentation plugin.
 * Registers Swagger UI at /docs when NODE_ENV !== 'production'.
 *
 * Required packages (add to devDependencies):
 *   npm install --save-dev @fastify/swagger @fastify/swagger-ui
 */
export const swaggerPlugin = fp(async (app: FastifyInstance) => {
  if (process.env.NODE_ENV === 'production') return;

  await app.register(swagger, {
    openapi: {
      openapi: '3.0.3',
      info: {
        title: 'Instagram Message Sender API',
        version: '3.0.0',
        description: 'Instagram Client Retention System — comment-triggered DM dispatch with static discount code',
      },
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
  });
});