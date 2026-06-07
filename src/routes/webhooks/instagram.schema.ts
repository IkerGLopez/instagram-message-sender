import { z } from 'zod';

// Webhook payload schema — Instagram follows event
export const WebhookPayloadSchema = z.object({
  object: z.literal('instagram'),
  entry: z.array(
    z.object({
      id: z.string(),
      time: z.number(),
      changes: z.array(
        z.object({
          field: z.literal('follows'),
          value: z.object({
            from: z.object({
              id: z.string().min(1),
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
