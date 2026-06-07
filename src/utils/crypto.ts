import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Verify Instagram webhook signature using timing-safe comparison.
 * Returns false early if lengths differ to prevent timing attacks.
 */
export function verifyInstagramSignature(
  rawBody: Buffer,
  signature: string,
  appSecret: string,
): boolean {
  const expected = `sha256=${createHmac('sha256', appSecret).update(rawBody).digest('hex')}`;

  // Length check first — prevents timing attacks on different-length inputs
  if (signature.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

/**
 * Hash an API key using SHA-256 with the configured secret.
 * Format: SHA256(secret:plaintext_key)
 */
export function hashApiKey(key: string, secret: string): string {
  return createHmac('sha256', secret).update(key).digest('hex');
}
