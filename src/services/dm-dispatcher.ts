import axios, { type AxiosInstance } from 'axios';
import { env } from '../config/env.js';
import { INSTAGRAM_GRAPH_API_BASE } from '../config/constants.js';
import { logger } from '../utils/logger.js';

export interface DmSendResult {
  messageId: string;
}

export class DMDispatcher {
  private readonly client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: INSTAGRAM_GRAPH_API_BASE,
      timeout: 10_000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Attach Bearer token (page access token) to every request
    this.client.interceptors.request.use((config) => {
      config.params = {
        ...config.params,
        access_token: env.INSTAGRAM_PAGE_ACCESS_TOKEN,
      };
      return config;
    });
  }

  /**
   * Send a welcome DM to a new follower.
   * POST /me/messages with recipient and message text.
   */
  async sendWelcomeMessage(
    instagramUserId: string,
    messageText: string,
  ): Promise<DmSendResult> {
    logger.info({ instagramUserId }, 'Sending welcome DM');

    const response = await this.client.post<{ message_id: string }>(
      `/${env.INSTAGRAM_BUSINESS_ACCOUNT_ID}/messages`,
      {
        recipient: { id: instagramUserId },
        message: { text: messageText },
      },
    );

    logger.info(
      { instagramUserId, messageId: response.data.message_id },
      'Welcome DM sent successfully',
    );

    return { messageId: response.data.message_id };
  }
}
