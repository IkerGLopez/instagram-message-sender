// Maximum retries for code generation collision
export const CODE_MAX_RETRIES = 5;

// Code expiry in days
export const CODE_EXPIRY_DAYS = 30;

// Safe alphabet for discount codes (excludes ambiguous chars: 0, O, 1, I, L)
export const SAFE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

// Code format regex
export const CODE_FORMAT_REGEX = /^WELCOME-[A-Z2-9]{8}$/;

// DM welcome message template
export const DM_WELCOME_TEMPLATE = (code: string, storeUrl: string): string =>
  `¡Gracias por seguirnos! 🎉

Acá tenés tu código de descuento exclusivo:

🏷️ ${code}

Usalo en nuestra tienda para obtener un 3% de descuento:
${storeUrl}?code=${code}

¡Gracias por ser parte de nuestra comunidad!`;

// CTA URL builder
export const buildCtaUrl = (storeBaseUrl: string, code: string): string =>
  `${storeBaseUrl}?code=${code}`;

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
