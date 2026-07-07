import type { FastifyInstance, FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { logger } from '../utils/logger.js';

/**
 * Global error handler for Fastify.
 * Maps error types to appropriate HTTP status codes.
 */
export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler(
    (error: FastifyError & { statusCode?: number }, request: FastifyRequest, reply: FastifyReply) => {
      // Zod validation errors from Fastify schema validation
      if (error.validation) {
        logger.warn(
          { path: request.url, validation: error.validation },
          'Validation error',
        );
        return reply.code(400).send({
          error: 'validation_error',
          details: error.validation,
        });
      }

      // Fastify's built-in 4xx errors
      if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
        return reply.code(error.statusCode).send({
          error: error.message || 'client_error',
        });
      }

      // Default: 500 with generic message — never leak internals
      logger.error(
        {
          err: error,
          path: request.url,
          method: request.method,
        },
        'Unhandled server error',
      );

      return reply.code(500).send({ error: 'internal_server_error' });
    },
  );
}
