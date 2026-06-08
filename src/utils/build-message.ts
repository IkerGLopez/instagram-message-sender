import { DM_WELCOME_TEMPLATE } from '../config/constants.js';
import { env } from '../config/env.js';

/**
 * Build the welcome message text for DM dispatch.
 * Returns plain text with static code from env.
 */
export function buildWelcomeMessage(): string {
  return DM_WELCOME_TEMPLATE.replace('{CODE}', env.STATIC_DISCOUNT_CODE);
}