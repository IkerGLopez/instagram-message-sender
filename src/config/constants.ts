// DM message template — sent when a user comments with the trigger keyword.
// Contains static discount code; mentions 3% discount at physical establishment.
export const DM_WELCOME_TEMPLATE = `¡Hola! 👋 Gracias por tu interés.

Tenemos un regalo para ti: muestra este código en nuestro establecimiento
y obtén un 3% de descuento en tu visita. 🎉

Tu código: *{CODE}*

¡Te esperamos! 💙`;

// Instagram API base URL
export const INSTAGRAM_GRAPH_API_BASE = 'https://graph.facebook.com/v21.0';

// Instagram API error codes
export const IG_ERROR_RATE_LIMIT = [4, 613];
export const IG_ERROR_TOKEN_EXPIRED = 190;
export const IG_ERROR_PERMISSION_DENIED = [10, 100];

// Rate limiting
export const WEBHOOK_RATE_LIMIT_MAX = 100;
export const WEBHOOK_RATE_LIMIT_WINDOW = '1 minute';

// Queue defaults
export const QUEUE_DEFAULT_ATTEMPTS = 3;
export const QUEUE_BACKOFF_DELAY = 5000; // 5 seconds
export const QUEUE_BACKOFF_TYPE = 'exponential' as const;

// Health check
export const HEALTH_FAILED_JOBS_THRESHOLD = 10;