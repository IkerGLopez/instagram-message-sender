import type { WebhookPayload } from '../src/routes/webhooks/instagram.schema.js';

/**
 * Valid Instagram follow event webhook payload matching WebhookPayloadSchema.
 */
export const validFollowPayload: WebhookPayload = {
  object: 'instagram',
  entry: [
    {
      id: 'instagram-account-id',
      time: Date.now(),
      changes: [
        {
          field: 'follows',
          value: {
            from: {
              id: 'follower-instagram-id-123',
            },
          },
        },
      ],
    },
  ],
};

/**
 * Payload with an invalid HMAC signature (signature won't match).
 * Use this to test that the server rejects tampered payloads.
 */
export const invalidSignaturePayload = {
  object: 'instagram',
  entry: [
    {
      id: 'instagram-account-id',
      time: Date.now(),
      changes: [
        {
          field: 'follows',
          value: {
            from: {
              id: 'follower-instagram-id-456',
            },
          },
        },
      ],
    },
  ],
};

/**
 * Malformed payload — missing required fields that fail Zod validation.
 * Use this to test that the server handles invalid payload shapes gracefully.
 */
export const malformedPayload = {
  object: 'instagram',
  entry: [
    {
      // missing 'id' field
      time: Date.now(),
      changes: [
        {
          field: 'follows',
          // missing 'value.from.id'
          value: {},
        },
      ],
    },
  ],
};

/**
 * Valid webhook handshake verification params.
 */
export const validHandshakeParams = {
  'hub.mode': 'subscribe',
  'hub.verify_token': 'test-verify-token',
  'hub.challenge': 'test-challenge-string',
};