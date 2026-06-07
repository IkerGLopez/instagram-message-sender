# Instagram Client Retention System

Automated discount code generation and DM dispatch for new Instagram followers. When someone follows your corporate account, they instantly receive a personalized welcome DM with a unique 3% discount code.

## Architecture

```
Instagram Follow → Webhook → Queue → Generate Code → Send DM → Track Redemption
```

### Components

| Component | Description |
|-----------|-------------|
| **Webhook Receiver** | Receives Instagram follow events via `POST /webhooks/instagram` with HMAC-SHA256 signature verification |
| **Discount Code Engine** | Generates unique `WELCOME-XXXXXXXX` codes (32^8 combinations, 30-day expiry) |
| **DM Dispatcher** | Sends welcome messages via Instagram Messenger API with rate limiting (1 msg/sec) |
| **Validation API** | `GET /api/v1/codes/validate` — e-commerce store verifies codes before checkout |
| **Redeem API** | `POST /api/v1/codes/redeem` — marks codes as used (idempotent by order_id) |
| **Processing Worker** | Async BullMQ worker that handles the follow → code → DM flow |

### Tech Stack

- **Runtime**: Node.js 22 + TypeScript (ESM)
- **Framework**: Fastify 5 with Zod validation
- **Database**: PostgreSQL 16 with Prisma ORM
- **Queue**: Redis 7 + BullMQ (async processing, rate limiting)
- **Testing**: Vitest (30 tests, unit + integration)

## Prerequisites

- Node.js >= 22
- Docker + Docker Compose (for PostgreSQL and Redis)
- pnpm (recommended) or npm

## Quick Start

### 1. Start Infrastructure

```bash
docker compose up -d
```

This starts PostgreSQL (port 5432) and Redis (port 6379).

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Set Up Environment

```bash
cp .env.example .env
```

Edit `.env` with your values. For local development, you can use placeholder Instagram credentials — the webhook and DM sending will work in test mode.

### 4. Database Setup

```bash
pnpm db:generate    # Generate Prisma client
pnpm db:migrate     # Run migrations
pnpm db:seed        # Seed demo data (creates test API key + discount code)
```

### 5. Run the Application

You need **two terminals** — one for the HTTP server, one for the worker:

```bash
# Terminal 1 — HTTP server (webhooks + API)
pnpm dev

# Terminal 2 — Background worker (processes queue jobs)
pnpm dev:worker
```

The API will be available at `http://localhost:3000`.

## API Endpoints

### Webhook Receiver

```
POST /webhooks/instagram
```

Receives Instagram follow events. Validates HMAC-SHA256 signature, enqueues for async processing.

**Headers required:**
- `X-Hub-Signature-256: sha256=<hmac_signature>`

### Code Validation

```
GET /api/v1/codes/validate?code=WELCOME-XXXXXXXX
X-API-Key: sk_test_demo_key_12345
```

Returns whether a discount code is valid, expired, or already redeemed.

### Code Redemption

```
POST /api/v1/codes/redeem
X-API-Key: sk_test_demo_key_12345

{
  "code": "WELCOME-XXXXXXXX",
  "order_id": "ORD-2026-001",
  "customer_ip": "203.0.113.45"
}
```

Marks a code as redeemed. Idempotent — same `order_id` returns success without side effects.

### Health Check

```
GET /health
```

Returns status of PostgreSQL, Redis, Instagram token, and queue health.

## Testing

```bash
pnpm test           # Run all tests
pnpm test:watch     # Watch mode
pnpm test:coverage  # With coverage report
```

30 tests cover: HMAC validation, code generation, webhook routes, and codes API.

## Project Structure

```
src/
├── app.ts                    # Fastify app builder
├── server.ts                 # HTTP server entry point
├── worker.ts                 # BullMQ worker entry point
├── config/
│   ├── env.ts                # Zod-validated environment variables
│   └── constants.ts          # Business rules and defaults
├── health/
│   └── health.ts             # GET /health endpoint
├── middleware/
│   ├── api-key-auth.ts       # API key authentication
│   ├── error-handler.ts      # Global error handler
│   └── hmac-validator.ts     # Instagram webhook signature verification
├── plugins/
│   ├── bullmq.ts             # Queue setup (follow + DM queues)
│   ├── prisma.ts             # Prisma client plugin
│   └── redis.ts              # Redis connection plugin
├── routes/
│   ├── api/
│   │   ├── codes.ts          # Validation + redeem endpoints
│   │   └── codes.schema.ts   # Zod schemas for request validation
│   └── webhooks/
│       ├── instagram.ts      # Webhook receiver + verification handshake
│       └── instagram.schema.ts
├── services/
│   ├── code-engine.ts        # Unique code generation with collision retry
│   ├── dm-dispatcher.ts      # Instagram Messenger API client
│   ├── token-manager.ts      # Access token validity management
│   └── webhook-processor.ts  # Follow event processing logic
├── types/
│   └── fastify.d.ts          # Fastify instance type augmentation
└── utils/
    ├── build-message.ts      # Welcome message template
    ├── crypto.ts             # HMAC verification + API key hashing
    ├── logger.ts             # Pino logger with secret redaction
    └── retry.ts              # Exponential backoff utility

prisma/
├── schema.prisma             # Database schema (4 models)
└── seed.ts                   # Demo data seeding

test/
├── fixtures/
│   └── test-helpers.ts       # Mock Prisma, Redis, Queue
├── routes/
│   ├── api/codes.test.ts     # 12 integration tests
│   └── webhooks/instagram.test.ts  # 6 integration tests
└── unit/
    ├── code-engine.test.ts   # 4 unit tests
    └── hmac-validator.test.ts # 8 unit tests
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `INSTAGRAM_APP_ID` | Meta app ID | — |
| `INSTAGRAM_APP_SECRET` | For HMAC webhook verification | — |
| `INSTAGRAM_PAGE_ACCESS_TOKEN` | Long-lived token (60 days) | — |
| `INSTAGRAM_WEBHOOK_VERIFY_TOKEN` | Webhook registration token (≥32 chars) | — |
| `INSTAGRAM_BUSINESS_ACCOUNT_ID` | Corporate account ID | — |
| `DATABASE_URL` | PostgreSQL connection string | — |
| `REDIS_URL` | Redis connection string | — |
| `API_KEY_HASH_SECRET` | Salt for API key hashing | — |
| `STORE_BASE_URL` | E-commerce store URL for CTA links | — |
| `NODE_ENV` | `development` / `staging` / `production` | `development` |
| `LOG_LEVEL` | `trace` / `debug` / `info` / `warn` / `error` | `info` |
| `PORT` | HTTP server port | `3000` |

## Security

- **Webhook signature verification**: HMAC-SHA256 with timing-safe comparison
- **API key authentication**: Hashed keys stored in DB, validated via middleware
- **Rate limiting**: Per-IP for webhooks, per-key for API endpoints
- **Secret redaction**: Sensitive env vars stripped from logs via Pino redact
- **Idempotent redemption**: Same `order_id` produces identical results, prevents double-charging

## Business Rules

- **One code per user**: Each `instagram_user_id` receives exactly one welcome code, regardless of follow/unfollow cycles
- **Code format**: `WELCOME-[A-Z2-9]{8}` (32-char alphabet, ~1.1 billion combinations)
- **Expiry**: 30 days from generation
- **Discount**: 3% single-use
- **DM rate limit**: 1 message per second (Instagram API constraint)

## Development

```bash
pnpm db:studio    # Open Prisma Studio (visual DB browser)
pnpm build        # Compile TypeScript
pnpm lint         # Run linter
```

## License

Internal — Confidential
