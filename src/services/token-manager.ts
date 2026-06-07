/**
 * Manages Instagram page access token validity.
 * For v1, checks the token from environment variables.
 * In production, this would decode JWT or check expiry from a token store.
 */
export class TokenManager {
  private readonly token: string;

  constructor(token: string) {
    this.token = token;
  }

  /**
   * Check if the current token is valid (non-empty and not expired).
   * For v1, we assume the env token is valid if present.
   */
  isValid(): boolean {
    return this.token.length > 0;
  }

  /**
   * Return estimated days until token expiry.
   * Instagram page access tokens typically expire in 60 days.
   * For v1, returns a fixed value since we don't have JWT decode.
   */
  expiresInDays(): number {
    // Instagram long-lived tokens expire in ~60 days
    // In production, decode the JWT to get exact expiry
    return 60;
  }

  /**
   * Get the raw token (use sparingly — never log this).
   */
  getToken(): string {
    return this.token;
  }
}
