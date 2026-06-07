import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger.js';

export const prismaPlugin = fp(async function prismaPlugin(app: FastifyInstance) {
  const prisma = new PrismaClient({
    log: [
      { emit: 'event', level: 'query' },
      { emit: 'event', level: 'error' },
    ],
  });

  // Forward Prisma logs to Pino
  prisma.$on('query', (e: { duration: number; query: string }) => {
    logger.trace({ duration: e.duration, query: e.query }, 'Prisma query');
  });

  prisma.$on('error', (e: any) => {
    logger.error({ error: e }, 'Prisma error');
  });

  // Connect on startup
  await prisma.$connect();
  logger.info('PostgreSQL connected');

  // Decorate Fastify instance
  app.decorate('prisma', prisma);

  // Close on shutdown
  app.addHook('onClose', async () => {
    await prisma.$disconnect();
    logger.info('PostgreSQL disconnected');
  });
});

// Extend Fastify types
declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}
