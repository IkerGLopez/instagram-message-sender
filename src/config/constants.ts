// DM welcome message template (static code only — no URL)
export const DM_WELCOME_TEMPLATE = `¡Gracias por seguirnos! 🎉

Acá tenés tu código de descuento exclusivo:

🏷️ {CODE}

Usalo en nuestra tienda para obtener un 3% de descuento.

¡Gracias por ser parte de nuestra comunidad!`;

// Instagram API base URL
export const INSTAGRAM_GRAPH_API_BASE = 'https://graph.facebook.com/v21.0';

// Instagram API error codes
export const IG_ERROR_RATE_LIMIT = [4, 613];
export const IG_ERROR_TOKEN_EXPIRED = 190;
export const IG_ERROR_PERMISSION_DENIED = [10, 100];

// Rate limiting
export const WEBHOOK_RATE_LIMIT_MAX = 100;
export const WEBHOOK_RATE_LIMIT_WINDOW = '1 minute';
export const API_RATE_LIMIT_MAX_PER_KEY = 100;
export const API_RATE_LIMIT_MAX_PER_IP = 10;
export const API_VALIDATE_RATE_LIMIT_MAX = 10;

// Queue defaults
export const QUEUE_DEFAULT_ATTEMPTS = 3;
export const QUEUE_BACKOFF_DELAY = 5000; // 5 seconds
export const QUEUE_BACKOFF_TYPE = 'exponential' as const;

// Health check
export const HEALTH_FAILED_JOBS_THRESHOLD = 10;