# Tasks: Complete Implementation Gap Closure

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~700-900 (new: ~600, modified: ~150) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 2 → PR 3 |
| Delivery strategy | ask-always |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Rate limiter fix + queue factories | PR 1 | Base = main; immediate safety fix |
| 2 | Job handlers + refactor bullmq/worker | PR 2 | Base = PR 1; structural extraction |
| 3 | Swagger plugin + test fixtures + integration tests + Dockerfile | PR 3 | Base = PR 2; infrastructure completion |

## Phase 1: Critical Safety Fix

- [x] **1.1** `src/plugins/bullmq.ts` — Add `limiter: { max: 1, duration: 1000 }` to dmQueue options
- [x] **1.2** `src/queues/follow-queue.ts` — Create factory `createFollowQueue(connection)` exporting `followQueue` with name `instagram-follow`
- [x] **1.3** `src/queues/dm-queue.ts` — Create factory `createDmQueue(connection)` exporting `dmQueue` with name `instagram-dm` and rate limiter

## Phase 2: Structural Extraction

- [x] **2.1** `src/queues/job-handlers.ts` — Export `processFollowEventJob` and `processDmDispatchJob` with typed interfaces
- [x] **2.2** `src/plugins/bullmq.ts` — Refactor to import from `src/queues/` instead of inline definitions
- [x] **2.3** `src/worker.ts` — Import handlers from `src/queues/job-handlers.ts`; remove inline processor code

## Phase 3: Infrastructure Completion

- [x] **3.1** `src/plugins/swagger.ts` — Create dev-only OpenAPI plugin
- [x] **3.2** `src/app.ts` — Register swagger plugin (conditionally skip in production)
- [x] **3.3** `test/fixtures/webhook-payloads.ts` — Export valid Instagram webhook payloads
- [x] **3.4** `test/fixtures/test-db.ts` — Export `setupTestDb()` and `teardownTestDb()` with transaction rollback
- [x] **3.5** `test/integration/webhook-route.test.ts` — Test POST `/webhooks/instagram` with HMAC validation
- [x] **3.6** `test/integration/health-route.test.ts` — Test GET `/health` (200/503 scenarios)

## Phase 4: Containerization

- [x] **4.1** `Dockerfile` — Multi-stage build supporting both server.js and worker.js

## Task Details

### task-01-rate-limiter
- [x] **files**: `src/plugins/bullmq.ts`
- [x] **description**: Add `limiter: { max: 1, duration: 1000 }` to dmQueue options. CRITICAL safety fix.
- [x] **acceptance**: `dmQueue.opts.limiter` returns `{ max: 1, duration: 1000 }`

### task-02-follow-queue
- [x] **files**: `src/queues/follow-queue.ts` (create)
- [x] **description**: Export `createFollowQueue(connection: Redis): Queue` with name `instagram-follow`
- [x] **acceptance**: File exists, exports `createFollowQueue` and `FollowEventJob` interface

### task-03-dm-queue
- [x] **files**: `src/queues/dm-queue.ts` (create)
- [x] **description**: Export `createDmQueue(connection: Redis): Queue` with name `instagram-dm` and rate limiter
- [x] **acceptance**: File exists, exports `createDmQueue` with rate limiter config

### task-04-job-handlers
- [x] **files**: `src/queues/job-handlers.ts` (create)
- [x] **description**: Export `processFollowEventJob` and `processDmDispatchJob` with typed Job interfaces
- [x] **acceptance**: `grep -E "export.*processFollowEventJob|export.*processDmDispatchJob" src/queues/job-handlers.ts`

### task-05-refactor-bullmq
- [x] **files**: `src/plugins/bullmq.ts` (modify)
- [x] **description**: Import from `src/queues/follow-queue.ts` and `src/queues/dm-queue.ts` instead of inline definitions
- [x] **acceptance**: `src/plugins/bullmq.ts` imports from `src/queues/`

### task-06-refactor-worker
- [x] **files**: `src/worker.ts` (modify)
- [x] **description**: Import from `src/queues/`; remove inline processor lambdas
- [x] **acceptance**: Worker uses imported handlers; inline processing code removed

### task-07-swagger-plugin
- [x] **files**: `src/plugins/swagger.ts` (create)
- [x] **description**: Dev-only OpenAPI plugin with `@fastify/swagger` + `@fastify/swagger-ui`
- [x] **acceptance**: Exports default function compatible with `fastify.register()`

### task-08-register-swagger
- [x] **files**: `src/app.ts` (modify)
- [x] **description**: Register swagger plugin after bullmqPlugin; skip in production
- [x] **acceptance**: `GET /docs` returns Swagger UI in dev; 404 in production

### task-09-webhook-fixtures
- [x] **files**: `test/fixtures/webhook-payloads.ts` (create)
- [x] **description**: Export valid Instagram follow/mention webhook payloads matching schema
- [x] **acceptance**: Exports `followPayload`, `mentionPayload`

### task-10-test-db-fixtures
- [x] **files**: `test/fixtures/test-db.ts` (create)
- [x] **description**: Export `setupTestDb()` and `teardownTestDb()` using Prisma transaction rollback
- [x] **acceptance**: Exports both functions

### task-11-integration-webhook-test
- [x] **files**: `test/integration/webhook-route.test.ts` (create)
- [x] **description**: Test HMAC validation and job queuing on POST `/webhooks/instagram`
- [x] **acceptance**: `vitest test/integration/webhook-route.test.ts` passes

### task-12-integration-health-test
- [x] **files**: `test/integration/health-route.test.ts` (create)
- [x] **description**: Test GET `/health` returns 200 when healthy, 503 when degraded
- [x] **acceptance**: `vitest test/integration/health-route.test.ts` passes

### task-13-dockerfile
- [x] **files**: `Dockerfile` (create)
- [x] **description**: Multi-stage build (builder + runner) for server.js and worker.js
- [x] **acceptance**: `docker build -t instagram-sender .` succeeds

## Implementation Order

```
PR 1 (Safety + Foundation):
  1.1 → 1.2 → 1.3
  
PR 2 (Structural Refactor):
  2.1 → 2.2 → 2.3  (depends on PR 1)
  
PR 3 (Infrastructure + Tests):
  3.1 → 3.2 → 3.3 → 3.4 → 3.5 → 3.6 → 4.1  (depends on PR 2)
```

Parallel potential: 1.2 ∥ 1.3, 3.3 ∥ 3.4, 3.5 ∥ 3.6