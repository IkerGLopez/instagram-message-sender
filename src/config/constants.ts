// DM message template — sent when a user comments with the trigger keyword.
// Contains only the static discount code; no store URL.
export const DM_WELCOME_TEMPLATE = `¡Gracias por tu interés! 🎉

Acá tenés tu código de descuento exclusivo:

🏷️ {CODE}

¡Gracias por ser parte de nuestra comunidad!`;

// Instagram API base URL
export const INSTAGRAM_GRAPH_API_BASE = 'https://graph.facebook.com/v21.0';

// Instagram API error codes
export const IG_ERROR_RATE_LIMIT = [4, 613];
export const IG_ERROR_TOKEN_EXPIRED = 190;
export const IG_ERROR_PERMISSION_DENIED = [10, 100];

// Queue defaults
export const QUEUE_DEFAULT_ATTEMPTS = 3;
export const QUEUE_BACKOFF_DELAY = 5000; // 5 seconds
export const QUEUE_BACKOFF_TYPE = 'exponential' as const;

// Health check
export const HEALTH_FAILED_JOBS_THRESHOLD = 10;