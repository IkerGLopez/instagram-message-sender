import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { ValidateQuerySchema, RedeemBodySchema } from './codes.schema.js';
import { logger } from '../../utils/logger.js';

export async function codesRoutes(app: FastifyInstance) {
  // GET /api/v1/codes/validate — Check if a code is valid
  app.get(
    '/codes/validate',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            code: { type: 'string', pattern: '^WELCOME-[A-Z2-9]{8}$' },
          },
          required: ['code'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              valid: { type: 'boolean' },
              discount_percentage: { type: 'number' },
              reason: { type: 'string' },
            },
          },
          400: {
            type: 'object',
            properties: {
              valid: { type: 'boolean' },
              reason: { type: 'string' },
            },
          },
        },
      },
      preHandler: [app.apiKeyAuth],
    },
    async (request, reply) => {
      const parsed = ValidateQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.code(400).send({
          valid: false,
          reason: 'INVALID_FORMAT',
        });
      }

      const code = parsed.data.code.toUpperCase();
      const prisma = (app as any).prisma;

      const discountCode = await prisma.discountCode.findUnique({
        where: { code },
        select: {
          status: true,
          expiresAt: true,
          discountPercent: true,
        },
      });

      if (!discountCode) {
        return reply.code(200).send({
          valid: false,
          reason: 'NOT_FOUND',
        });
      }

      if (discountCode.status === 'REDEEMED') {
        return reply.code(200).send({
          valid: false,
          reason: 'ALREADY_REDEEMED',
        });
      }

      if (discountCode.status === 'REVOKED') {
        return reply.code(200).send({
          valid: false,
          reason: 'REVOKED',
        });
      }

      if (discountCode.status === 'EXPIRED' || discountCode.expiresAt < new Date()) {
        return reply.code(200).send({
          valid: false,
          reason: 'EXPIRED',
        });
      }

      // Code is ACTIVE and not expired
      return reply.code(200).send({
        valid: true,
        discount_percentage: discountCode.discountPercent,
      });
    },
  );

  // POST /api/v1/codes/redeem — Redeem a discount code (idempotent by order_id)
  app.post(
    '/codes/redeem',
    {
      schema: {
        body: {
          type: 'object',
          properties: {
            code: { type: 'string', pattern: '^WELCOME-[A-Z2-9]{8}$' },
            order_id: { type: 'string', minLength: 1, maxLength: 128 },
            customer_ip: { type: 'string', format: 'ipv4' },
          },
          required: ['code', 'order_id'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              redeemed_at: { type: 'string' },
            },
          },
          409: {
            type: 'object',
            properties: {
              error: { type: 'string' },
            },
          },
          400: {
            type: 'object',
            properties: {
              error: { type: 'string' },
            },
          },
          500: {
            type: 'object',
            properties: {
              error: { type: 'string' },
            },
          },
        },
      },
      preHandler: [app.apiKeyAuth],
    },
    async (request, reply) => {
      const parsed = RedeemBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'INVALID_INPUT' });
      }

      const { code, order_id, customer_ip } = parsed.data;
      const prisma = (app as any).prisma;

      try {
        const result = await prisma.$transaction(async (tx: PrismaClient) => {
          // SELECT FOR UPDATE — lock the row
          const discountCode = await tx.discountCode.findUnique({
            where: { code: code.toUpperCase() },
            select: {
              id: true,
              status: true,
              expiresAt: true,
              orderId: true,
              redeemedAt: true,
              discountPercent: true,
            },
          });

          if (!discountCode) {
            return { status: 'NOT_FOUND' as const };
          }

          // Already redeemed
          if (discountCode.status === 'REDEEMED') {
            // Idempotent: same order_id returns success
            if (discountCode.orderId === order_id) {
              return {
                status: 'IDEMPOTENT' as const,
                redeemedAt: discountCode.redeemedAt,
              };
            }
            // Different order_id — conflict
            return { status: 'CONFLICT' as const };
          }

          // Expired or revoked
          if (
            discountCode.status === 'EXPIRED' ||
            discountCode.status === 'REVOKED' ||
            discountCode.expiresAt < new Date()
          ) {
            return { status: 'NOT_VALID' as const };
          }

          // Redeem the code
          const now = new Date();
          await tx.discountCode.update({
            where: { id: discountCode.id },
            data: {
              status: 'REDEEMED',
              redeemedAt: now,
              orderId: order_id,
              redeemedIp: customer_ip ?? null,
            },
          });

          return {
            status: 'REDEEMED' as const,
            redeemedAt: now,
          };
        });

        switch (result.status) {
          case 'NOT_FOUND':
            return reply.code(400).send({ error: 'CODE_NOT_VALID' });
          case 'CONFLICT':
            return reply.code(409).send({ error: 'CODE_ALREADY_REDEEMED' });
          case 'NOT_VALID':
            return reply.code(400).send({ error: 'CODE_NOT_VALID' });
          case 'IDEMPOTENT':
            return reply.code(200).send({
              success: true,
              redeemed_at: result.redeemedAt!.toISOString(),
            });
          case 'REDEEMED':
            return reply.code(200).send({
              success: true,
              redeemed_at: result.redeemedAt!.toISOString(),
            });
        }
      } catch (error) {
        logger.error({ error, code }, 'Error during code redemption');
        return reply.code(500).send({ error: 'INTERNAL_SERVER_ERROR' });
      }
    },
  );
}
