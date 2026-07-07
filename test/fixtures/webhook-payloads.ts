import type { WebhookPayload } from '../../src/routes/webhooks/instagram.schema.js';

/**
 * Valid Instagram comment webhook payload with trigger keyword "BASUSTA".
 * Matches WebhookPayloadSchema with field: 'comments'.
 */
export const validCommentPayload: WebhookPayload = {
  object: 'instagram',
  entry: [
    {
      id: 'instagram-business-account-id',
      time: Date.now(),
      changes: [
        {
          field: 'comments',
          value: {
            media: {
              id: 'media-id-123',
            },
            comment: {
              id: 'comment-id-456',
              created_time: Date.now(),
              text: 'BASUSTA',
              from: {
                id: 'commenter-instagram-id-123',
                username: 'testuser',
              },
            },
          },
        },
      ],
    },
  ],
};

/**
 * Comment payload without the trigger keyword.
 * Use to verify the system discards comments that don't match.
 */
export const noKeywordPayload: WebhookPayload = {
  object: 'instagram',
  entry: [
    {
      id: 'instagram-business-account-id',
      time: Date.now(),
      changes: [
        {
          field: 'comments',
          value: {
            media: {
              id: 'media-id-123',
            },
            comment: {
              id: 'comment-id-789',
              created_time: Date.now(),
              text: 'me gusta!',
              from: {
                id: 'commenter-instagram-id-456',
                username: 'otheruser',
              },
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
      id: 'instagram-business-account-id',
      time: Date.now(),
      changes: [
        {
          field: 'comments',
          value: {
            media: {
              id: 'media-id-123',
            },
            comment: {
              id: 'comment-id-999',
              created_time: Date.now(),
              text: 'BASUSTA',
              from: {
                id: 'commenter-instagram-id-456',
              },
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
          field: 'comments',
          // missing 'value.media.id' and 'value.comment'
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
