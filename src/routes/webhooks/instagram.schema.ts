import { z } from 'zod';

// Webhook payload schema — Instagram comments event
export const WebhookPayloadSchema = z.object({
  object: z.literal('instagram'),
  entry: z.array(
    z.object({
      id: z.string(),
      time: z.number(),
      changes: z.array(
        z.object({
          field: z.literal('comments'),
          value: z.object({
            media: z.object({
              id: z.string().min(1),
            }),
            comment: z.object({
              id: z.string().min(1),
              created_time: z.number(),
              text: z.string().min(1),
              from: z.object({
                id: z.string().min(1),
                username: z.string().optional(),
              }),
            }),
          }),
        }),
      ),
    }),
  ),
});

export type WebhookPayload = z.infer<typeof WebhookPayloadSchema>;

// Webhook verification handshake params
export const WebhookHandshakeSchema = z.object({
  'hub.mode': z.literal('subscribe'),
  'hub.verify_token': z.string().min(1),
  'hub.challenge': z.string().min(1),
});

export type WebhookHandshake = z.infer<typeof WebhookHandshakeSchema>;
