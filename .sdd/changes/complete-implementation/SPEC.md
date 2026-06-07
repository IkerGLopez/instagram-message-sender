# Delta Spec: Complete Implementation Gap Closure

**Change:** complete-implementation  
**Status:** draft  
**Created:** 2026-06-07

---

## ADDED Requirements

### Requirement: DM Rate Limiter MUST be configured on dmQueue

The system SHALL enforce Instagram's 1 message per second constraint by configuring BullMQ's built-in limiter on the DM dispatch queue with `max: 1` and `duration: 1000`.

The `dmQueue` in `src/plugins/bullmq.ts` or `src/queues/dm-queue.ts` MUST include:

```typescript
{
  limiter: {
    max: 1,
    duration: 1000
  }
}
```

This prevents account ban risk from violating Instagram's rate limit.

#### Scenario: Rate limiter is configured

- GIVEN a BullMQ queue named `instagram-dm` is instantiated
- WHEN the queue options are evaluated
- THEN the limiter configuration MUST be present with `max: 1` and `duration: 1000`

#### Scenario: Rate limiter prevents burst sending

- GIVEN the dmQueue has rate limiter configured
- WHEN two DM dispatch jobs are added to the queue simultaneously
- THEN only one job processes per 1-second window

---

### Requirement: Queue Definitions MUST be extracted to src/queues/

The system SHALL contain queue definitions in `src/queues/` directory rather than inline in plugin files.

#### Scenario: follow-queue.ts exists

- GIVEN the application codebase
- WHEN inspecting `src/queues/follow-queue.ts`
- THEN the file MUST export a `followQueue` instance with name `instagram-follow`
- AND the file MUST export job schemas for `FollowEventJob`

#### Scenario: dm-queue.ts exists with rate limiter

- GIVEN the application codebase
- WHEN inspecting `src/queues/dm-queue.ts`
- THEN the file MUST export a `dmQueue` instance with name `instagram-dm`
- AND the queue MUST have `limiter: { max: 1, duration: 1000 }` configured
- AND the file MUST export job schemas for `DmDispatchJob`

#### Scenario: job-handlers.ts exists

- GIVEN the application codebase
- WHEN inspecting `src/queues/job-handlers.ts`
- THEN the file MUST export `processFollowEventJob` function
- AND the file MUST export `processDmDispatchJob` function
- AND each handler MUST accept a BullMQ `Job` object with typed data

---

### Requirement: worker.ts MUST use job handlers from src/queues/job-handlers.ts

The worker process SHALL import job processor functions from `src/queues/job-handlers.ts` rather than containing inline processing logic.

#### Scenario: Worker imports handlers

- GIVEN `src/worker.ts` is executed
- WHEN the BullMQ worker is created for `instagram-follow` queue
- THEN the processor MUST call `processFollowEventJob` from `src/queues/job-handlers.ts`
- AND when the worker is created for `instagram-dm` queue
- THEN the processor MUST call `processDmDispatchJob` from `src/queues/job-handlers.ts`

---

### Requirement: Swagger Plugin MUST exist in src/plugins/swagger.ts

The system SHALL provide OpenAPI documentation via a Fastify plugin at `src/plugins/swagger.ts`.

#### Scenario: Swagger plugin exports function

- GIVEN the codebase
- WHEN `src/plugins/swagger.ts` is loaded
- THEN it MUST export a default function compatible with `fastify.register()`
- AND it SHOULD expose OpenAPI schema at `/docs` or `/swagger` endpoint in development

---

### Requirement: Test Fixtures MUST be available in test/fixtures/

The integration test infrastructure SHALL provide realistic webhook payloads and database helpers.

#### Scenario: webhook-payloads.ts exists

- GIVEN the test suite
- WHEN `test/fixtures/webhook-payloads.ts` is imported
- THEN it MUST export a valid Instagram follow webhook payload matching the schema in `src/routes/webhooks/instagram.schema.ts`
- AND it SHOULD export payloads for both sandbox and production formats

#### Scenario: test-db.ts provides database helpers

- GIVEN the integration tests
- WHEN `test/fixtures/test-db.ts` is imported
- THEN it MUST export a function to create a test database connection
- AND it MUST export a function to clean up the test database after each test
- AND it MUST use transactions that roll back after each test for isolation

---

### Requirement: Integration Tests MUST be in test/integration/

Integration tests SHALL be organized under `test/integration/` directory.

#### Scenario: webhook-route.test.ts exists

- GIVEN the integration test suite
- WHEN running tests with `vitest test/integration/webhook-route.test.ts`
- THEN it MUST test the `POST /webhooks/instagram` endpoint
- AND it MUST verify HMAC signature validation
- AND it MUST verify job queuing on valid requests

#### Scenario: health-route.test.ts exists

- GIVEN the integration test suite
- WHEN running tests with `vitest test/integration/health-route.test.ts`
- THEN it MUST test the `GET /health` endpoint
- AND it MUST verify 200 response when all services are healthy
- AND it MUST verify 503 response when database is unavailable

---

### Requirement: Dockerfile MUST enable production containerization

The system SHALL be deployable via Docker with a multi-stage build.

#### Scenario: Dockerfile builds successfully

- GIVEN Docker is available
- WHEN running `docker build -t instagram-sender .`
- THEN the build MUST complete without errors
- AND the resulting image MUST contain the compiled TypeScript output in `dist/`
- AND the image MUST have `node_modules`, `prisma` schema, and generated Prisma client

#### Scenario: Dockerfile supports both server and worker processes

- GIVEN the production Docker image
- WHEN running `docker run <image> node dist/server.js`
- THEN the HTTP server MUST start on port 3000
- AND WHEN running `docker run <image> node dist/worker.js`
- THEN the BullMQ worker MUST connect to Redis and process jobs

---

## MODIFIED Requirements

### Requirement: Existing dmQueue in bullmq.ts MUST have rate limiter added

The `dmQueue` configuration in `src/plugins/bullmq.ts` MUST be modified to include the rate limiter configuration.

(Previously: dmQueue had no limiter configured, risking Instagram API rate limit violations)

#### Scenario: Existing dmQueue has limiter added

- GIVEN `src/plugins/bullmq.ts` contains a `dmQueue` definition
- WHEN the file is modified
- THEN `limiter: { max: 1, duration: 1000 }` MUST be added to the dmQueue options

---

## Acceptance Criteria

| Requirement | Verification |
|-------------|--------------|
| DM rate limiter configured | `docker exec <container> node -e "const {dmQueue} = require('./dist/plugins/bullmq'); console.log(dmQueue.opts.limiter)"` returns `{ max: 1, duration: 1000 }` |
| Queue files in src/queues/ | `ls src/queues/` returns `follow-queue.ts`, `dm-queue.ts`, `job-handlers.ts` |
| job-handlers.ts exports handlers | `grep -E "export.*processFollowEventJob\|export.*processDmDispatchJob" src/queues/job-handlers.ts` |
| swagger.ts exists | `test -f src/plugins/swagger.ts && echo "exists"` |
| test fixtures exist | `ls test/fixtures/` returns `webhook-payloads.ts`, `test-db.ts` |
| integration tests exist | `ls test/integration/` returns `webhook-route.test.ts`, `health-route.test.ts` |
| Dockerfile builds | `docker build .` exits with code 0 |
| All existing tests pass | `pnpm test` exits with code 0 |

---

## Non-Functional Requirements

| Category | Requirement |
|----------|-------------|
| **Reliability** | DM rate limiter MUST NOT cause job loss; BullMQ persists jobs to Redis |
| **Performance** | Rate limiter adds ≤1ms latency to job dispatch |
| **Security** | Dockerfile MUST NOT copy `.env` files; only `.env.example` |
| **Observability** | Worker MUST log when rate limiter throttles a job |
| **Rollback** | Removing `limiter` key from dmQueue config reverts rate limiting instantly |