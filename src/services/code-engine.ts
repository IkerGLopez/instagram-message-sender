import { PrismaClient } from '@prisma/client';
import { customAlphabet } from 'nanoid';
import { CODE_MAX_RETRIES, SAFE_ALPHABET } from '../config/constants.js';
import { logger } from '../utils/logger.js';

const generateCodePart = customAlphabet(SAFE_ALPHABET, 8);

export class CodeEngine {
  constructor(private readonly db: PrismaClient) {}

  /**
   * Generate a unique discount code with format WELCOME-[A-Z2-9]{8}.
   * Retries on collision up to CODE_MAX_RETRIES times.
   * Throws after max retries exhausted.
   */
  async generateDiscountCode(maxRetries: number = CODE_MAX_RETRIES): Promise<string> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const code = `WELCOME-${generateCodePart()}`;

      const existing = await this.db.discountCode.findUnique({
        where: { code },
        select: { id: true },
      });

      if (!existing) {
        logger.debug({ code }, 'Generated unique discount code');
        return code;
      }

      logger.warn({ code, attempt }, 'Code collision, retrying');
    }

    throw new Error(
      `Failed to generate unique code after ${maxRetries} attempts — collision rate too high`,
    );
  }
}
