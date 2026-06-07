import { DM_WELCOME_TEMPLATE } from '../config/constants.js';

/**
 * Build the welcome message text for DM dispatch.
 * Returns plain text with code and CTA URL.
 */
export function buildWelcomeMessage(code: string, storeUrl: string): string {
  return DM_WELCOME_TEMPLATE(code, storeUrl);
}
