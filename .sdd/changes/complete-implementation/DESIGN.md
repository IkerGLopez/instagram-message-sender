# Design: Complete Implementation Gap Closure

## Technical Approach

Close the ~30% gap between design and implementation through three parallel tracks:
1. **Immediate safety fix** — add rate limiter to DM queue
2. **Structural extraction** — move inline queue definitions to `src/queues/` modules  
3. **Infrastructure completion** — add Swagger plugin, test fixtures, integration tests, and Dockerfile

## Architecture Decisions

### Decision: Rate limiter goes on dmQueue, not individual jobs

**Choice**: Add `limiter: { max: 1, duration: 1000 }` at the queue level  
**Alternatives considered**: Per-job rate limiting with `removeOnComplete` delays; token bucket in DMDispatcher  
**Rationale**: BullMQ's built-in limiter is Redis-native, persistent across worker restarts, and requires zero application code. The spec requires this exact config.

### Decision: Queue extraction uses factory pattern with connection injection

**Choice**: Each queue file exports a function `(connection: Redis) => Queue`  
**Alternatives considered**: Export pre-configured singletons; use dependency injection container  
**Rationale**: Worker and Fastify plugin have separate Redis connections. Factory pattern avoids circular deps and mirrors BullMQ's own usage pattern.

### Decision: Job handlers remain in-process with the worker

**Choice**: `job-handlers.ts` exports async functions, worker imports and passes them to BullMQ workers  
**Alternatives considered**: Extract to separate microservice; use BullMQ's sandboxed workers  
**Rationale**: Current concurrency (5 follow, 1 DM) doesn't warrant microservice extraction. Handlers need access to Prisma and services already co-located in worker process.

### Decision: Swagger plugin is dev-only

**Choice**: `@fastify/swagger` + `@fastify/swagger-ui` registered conditionally based on `NODE_ENV !== 'production'`  
**Alternatives considered**: Always-on with auth gate; separate OpenAPI spec file  
**Rationale**: Security concern for production; overhead minimal given traffic patterns.

### Decision: Test fixtures use transaction rollback pattern

**Choice**: `test-db.ts` exports `setupTestDb()` and `teardownTestDb()` using Prisma transaction rollback  
**Alternatives considered**: SQLite in-memory; separate test database container  
**Rationale**: Project already uses Prisma with PostgreSQL. Transaction rollback provides test isolation without extra infrastructure.

## Data Flow

```
Fastify App                    Worker Process
    │                              │
    ├── src/plugins/bullmq.ts ─────┼── src/queues/follow-queue.ts
    │         │                    ├── src/queues/dm-queue.ts (rate-limited)
    │         │                    │
    │         ▼                    ▼
    │   Queue.add() ────────── Worker.process()
    │                              │
    │                              ├── src/queues/job-handlers.ts
    │                              │         │
    │                              │         ▼
    │                              │   processFollowEventJob() ──► WebhookProcessor
    │                              │   processDmDispatchJob() ──► DMDispatcher
    │                              │
    └──────────────────────────────┘
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/plugins/bullmq.ts` | Modify | Add `limiter: { max: 1, duration: 1000 }` to dmQueue options |
| `src/queues/follow-queue.ts` | Create | Export `createFollowQueue(connection)` factory |
| `src/queues/dm-queue.ts` | Create | Export `createDmQueue(connection)` with rate limiter config |
| `src/queues/job-handlers.ts` | Create | Export `processFollowEventJob` and `processDmDispatchJob` |
| `src/worker.ts` | Modify | Import from `src/queues/*`; remove inline processor code |
| `src/plugins/swagger.ts` | Create | Export default async function with @fastify/swagger |
| `test/fixtures/webhook-payloads.ts` | Create | Export sample IG webhook payloads |
| `test/fixtures/test-db.ts` | Create | Export `setupTestDb()` and `teardownTestDb()` |
| `test/integration/webhook-route.test.ts` | Create | Test POST /webhooks/instagram with HMAC |
| `test/integration/health-route.test.ts` | Create | Test GET /health |
| `test/routes/*.test.ts` | Move | → `test/integration/` |
| `Dockerfile` | Create | Multi-stage build (builder + runner) |

## Key Code Patterns

### dm-queue.ts with rate limiter

```typescript
import { Queue } from 'bullmq';
import type { Redis } from 'ioredis';
import { QUEUE_DEFAULT_ATTEMPTS, QUEUE_BACKOFF_DELAY, QUEUE_BACKOFF_TYPE } from '../config/constants.js';

export function createDmQueue(connection: Redis): Queue {
  return new Queue('instagram-dm', {
    connection,
    limiter: {
      max: 1,
      duration: 1000,
    },
    defaultJobOptions: {
      attempts: QUEUE_DEFAULT_ATTEMPTS,
      backoff: { type: QUEUE_BACKOFF_TYPE, delay: QUEUE_BACKOFF_DELAY },
      removeOnComplete: { age: 3600, count: 100 },
      removeOnFail: { age: 86400 },
    },
  });
}
```

### job-handlers.ts pattern

```typescript
import type { Job } from 'bullmq';
import { logger } from '../utils/logger.js';
import { WebhookProcessor } from '../services/webhook-processor.js';
import { DMDispatcher } from '../services/dm-dispatcher.js';
import { buildWelcomeMessage } from '../utils/build-message.js';
import { env } from '../config/env.js';
import type { PrismaClient } from '@prisma/client';

export interface DmDispatchJobData {
  discountCodeId: string;
  instagramUserId: string;
  code: string;
}

export async function processDmDispatchJob(job: Job<DmDispatchJobData>, db: PrismaClient, dmDispatcher: DMDispatcher): Promise<void> {
  const { discountCodeId, instagramUserId, code } = job.data;
  logger.info({ jobId: job.id, discountCodeId }, 'Processing DM dispatch');

  const messageText = buildWelcomeMessage(code, env.STORE_BASE_URL);
  const result = await dmDispatcher.sendWelcomeMessage(instagramUserId, messageText);

  await db.discountCode.update({
    where: { id: discountCodeId },
    data: { dmSentAt: new Date(), dmMessageId: result.messageId },
  });

  logger.info({ discountCodeId, messageId: result.messageId }, 'DM dispatched successfully');
}
```

### worker.ts imports handlers

```typescript
import { Worker } from 'bullmq';
import { createFollowQueue, createDmQueue } from './queues/follow-queue.js';
import { createDmQueue } from './queues/dm-queue.js';
import { processFollowEventJob, processDmDispatchJob } from './queues/job-handlers.js';

const followQueue = createFollowQueue(redis);
const dmQueue = createDmQueue(redis);

const followWorker = new Worker('instagram-follow', (job) => 
  processFollowEventJob(job, db, webhookProcessor), { connection: redis, concurrency: 5 });

const dmWorker = new Worker('instagram-dm', (job) => 
  processDmDispatchJob(job, db, dmDispatcher), { connection: redis, concurrency: 1 });
```

### Swagger plugin (dev-only)

```typescript
import fp from 'fastify-plugin';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import type { FastifyInstance } from 'fastify';

export const swaggerPlugin = fp(async (app: FastifyInstance) => {
  if (process.env.NODE_ENV === 'production') return;

  await app.register(swagger, { openapi: '3.0.0' });
  await app.register(swaggerUi, { routePrefix: '/docs' });
});
```

### Dockerfile multi-stage

```dockerfile
# Stage 1: Builder
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

# Stage 2: Runner
FROM node:22-alpine AS runner
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile --prod
COPY prisma ./prisma/
RUN pnpm --filter @prisma/client generate
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY .env.example ./
CMD ["node", "dist/server.js"]
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | HMAC validator, code engine | `test/unit/*.test.ts` |
| Integration | Webhook endpoint, health endpoint | `test/integration/*.test.ts` with fixtures |
| E2E | Full flow (follow → code → DM) | Manual or separate e2e suite |

## Migration / Rollback

**Rollback plan**:
- Rate limiter: Remove `limiter` key from dmQueue config — instant revert
- New files: Delete `src/queues/`, `src/plugins/swagger.ts`, `test/integration/`, `test/fixtures/`, `Dockerfile`
- Test reorganization: Git revert the directory rename

All changes are additive. No data migration required.

## Open Questions

- [ ] Should `src/plugins/bullmq.ts` still export queues after extraction, or only `src/queues/` files?
- [ ] Do we keep the existing `test/routes/` tests or migrate all to `test/integration/`?
- [ ] Should Dockerfile use `pnpm` or fall back to `npm` for broader compatibility?