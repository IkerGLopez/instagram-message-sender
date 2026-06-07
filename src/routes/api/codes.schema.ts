import { z } from 'zod';
import { CODE_FORMAT_REGEX } from '../../config/constants.js';

// Validate query params
export const ValidateQuerySchema = z.object({
  code: z.string().regex(CODE_FORMAT_REGEX, 'Invalid code format'),
});

export type ValidateQuery = z.infer<typeof ValidateQuerySchema>;

// Redeem body
export const RedeemBodySchema = z.object({
  code: z.string().regex(CODE_FORMAT_REGEX, 'Invalid code format'),
  order_id: z.string().min(1).max(128),
  customer_ip: z.string().ip().optional(),
});

export type RedeemBody = z.infer<typeof RedeemBodySchema>;

// Validate response
export const ValidateResponseSchema = z.object({
  valid: z.boolean(),
  discount_percentage: z.number().optional(),
  reason: z.string().optional(),
});

export type ValidateResponse = z.infer<typeof ValidateResponseSchema>;

// Redeem response
export const RedeemResponseSchema = z.object({
  success: z.boolean(),
  redeemed_at: z.string().datetime().optional(),
});

export type RedeemResponse = z.infer<typeof RedeemResponseSchema>;
