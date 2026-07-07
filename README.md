# Instagram Client Retention System

Automated DM dispatch for users who comment with a specific keyword on Instagram posts. When someone comments "BASUSTA" (or configured keyword) on a publication, they instantly receive a personalized DM with a static discount code to present at the physical establishment.

## Architecture

```
Instagram Comment (keyword) → Webhook → Queue → Send DM → Record Sent
```

### Components

| Component | Description |
|-----------|-------------|
| **Webhook Receiver** | Receives Instagram comment events via `POST /webhooks/instagram` with HMAC-SHA256 signature verification |
| **Keyword Matcher** | Detects configured trigger keyword in comment text (case-insensitive) |
| **DM Dispatcher** | Sends welcome messages via Instagram Messenger API with rate limiting (1 msg/sec) |
| **Processing Worker** | Async BullMQ worker that handles the comment → DM flow |

> **Note:** There is no code validation or redemption API. The discount code is a static value shown in the DM that the customer presents verbally or on-screen at the physical establishment.

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

Receives Instagram comment events. Validates HMAC-SHA256 signature, checks if comment contains the configured trigger keyword, enqueues for async processing if matched.

**Headers required:**
- `X-Hub-Signature-256: sha256=<hmac_signature>`

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

Tests cover: HMAC validation, keyword matching, webhook routes, and DM dispatch.

## Project Structure

```
src/
├── app.ts                    # Fastify app builder
├── server.ts                 # HTTP server entry point
├── worker.ts                 # BullMQ worker entry point
├── config/
│   ├── env.ts                # Zod-validated environment variables
│   └── constants.ts          # Business rules and defaults (includes TRIGGER_KEYWORD)
├── health/
│   └── health.ts             # GET /health endpoint
├── middleware/
│   ├── error-handler.ts      # Global error handler
│   └── hmac-validator.ts     # Instagram webhook signature verification
├── plugins/
│   ├── bullmq.ts             # Queue setup (comment + DM queues)
│   ├── prisma.ts             # Prisma client plugin
│   └── redis.ts              # Redis connection plugin
├── routes/
│   └── webhooks/
│       ├── instagram.ts      # Webhook receiver + verification handshake
│       └── instagram.schema.ts
├── services/
│   ├── dm-dispatcher.ts      # Instagram Messenger API client
│   ├── token-manager.ts      # Access token validity management
│   └── webhook-processor.ts  # Comment event processing logic
├── types/
│   └── fastify.d.ts          # Fastify instance type augmentation
└── utils/
    ├── build-message.ts      # Welcome message template with static code
    ├── crypto.ts             # HMAC verification
    ├── keyword-match.ts      # Case-insensitive keyword detection
    ├── logger.ts             # Pino logger with secret redaction
    └── retry.ts              # Exponential backoff utility

prisma/
├── schema.prisma             # Database schema (InstagramComment, InstagramFollower, DmRecord, WebhookEvent)

test/
├── fixtures/
│   └── test-helpers.ts       # Mock Prisma, Redis, Queue
├── routes/
│   └── webhooks/instagram.test.ts  # Webhook integration tests
└── unit/
    ├── hmac-validator.test.ts # HMAC signature tests
    └── keyword-match.test.ts # Keyword detection tests
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `INSTAGRAM_APP_ID` | Meta app ID | — |
| `INSTAGRAM_APP_SECRET` | For HMAC webhook verification | — |
| `INSTAGRAM_PAGE_ACCESS_TOKEN` | Long-lived token (60 days) | — |
| `INSTAGRAM_WEBHOOK_VERIFY_TOKEN` | Webhook registration token (≥32 chars) | — |
| `INSTAGRAM_BUSINESS_ACCOUNT_ID` | Corporate account ID | — |
| `TRIGGER_KEYWORD` | Keyword that triggers DM flow (e.g., "BASUSTA") | `BASUSTA` |
| `STATIC_DISCOUNT_CODE` | Static discount code shown in DM (e.g., `DESCUENTO_INSTAGRAM`) | — |
| `DATABASE_URL` | PostgreSQL connection string | — |
| `REDIS_URL` | Redis connection string | — |
| `NODE_ENV` | `development` / `staging` / `production` | `development` |
| `LOG_LEVEL` | `trace` / `debug` / `info` / `warn` / `error` | `info` |
| `PORT` | HTTP server port | `3000` |

## Security

- **Webhook signature verification**: HMAC-SHA256 with timing-safe comparison
- **Rate limiting**: Per-IP for webhooks (prevents abuse)
- **Secret redaction**: Sensitive env vars stripped from logs via Pino redact
- **Deduplication**: Each user receives only one DM, enforced at the database level

## Business Rules

- **One DM per user**: Each `instagram_user_id` receives exactly one DM, regardless of how many comments they make with the keyword
- **Keyword trigger**: DM is only sent when the comment contains the configured trigger keyword (e.g., "BASUSTA")
- **Case-insensitive matching**: "basusta", "BASUSTA", "BasuSta" all trigger the flow
- **Discount code**: Static code configured via `STATIC_DISCOUNT_CODE` env var (e.g., `DESCUENTO_INSTAGRAM`)
- **No API validation**: The code is presented verbally or on-screen at the physical establishment — no technical validation exists
- **DM rate limit**: 1 message per second (Instagram API constraint)

## Development

```bash
pnpm db:studio    # Open Prisma Studio (visual DB browser)
pnpm build        # Compile TypeScript
pnpm lint         # Run linter
```

## License

Internal — Confidential
