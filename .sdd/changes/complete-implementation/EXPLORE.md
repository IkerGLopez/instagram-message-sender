# Exploration: Gap Analysis — DESIGN.md vs Codebase

**Topic:** instagram-client-retention  
**Explored:** 2026-06-07  
**Status:** Complete

---

## Executive Summary

The codebase is ~70% aligned with the DESIGN.md. The core architecture is correct (Fastify, Prisma, BullMQ, Axios, Zod), and the main services are implemented. However, the DESIGN describes several files that are **missing entirely** and the codebase has files **not mentioned in the design**. The most critical gap is the **missing `src/queues/` directory** (job-handlers.ts, follow-queue.ts, dm-queue.ts) — the design shows queue definitions here, but in code they're spread across `src/plugins/bullmq.ts` and `src/worker.ts`.

---

## Missing Files (in DESIGN, not in repo)

| File | Description per DESIGN | Gap |
|------|------------------------|-----|
| `src/queues/follow-queue.ts` | Queue definition for follow events | **MISSING** — queue is defined inline in `src/plugins/bullmq.ts` |
| `src/queues/dm-queue.ts` | Queue definition for DM dispatch | **MISSING** — queue is defined inline in `src/plugins/bullmq.ts` |
| `src/queues/job-handlers.ts` | Job processor functions consumed by worker | **MISSING** — job processing logic is in `src/worker.ts` directly |
| `src/plugins/swagger.ts` | OpenAPI documentation plugin (dev only) | **MISSING** — no swagger plugin registered |
| `test/fixtures/webhook-payloads.ts` | Test fixtures for webhook payloads | **MISSING** — `test/fixtures/test-helpers.ts` exists but is different |
| `test/integration/webhook-route.test.ts` | Integration tests for webhook route | **MISSING** — only `test/routes/webhooks/instagram.test.ts` exists |
| `test/integration/health-route.test.ts` | Integration tests for health endpoint | **MISSING** — no integration test for health |

---

## Existing Files NOT in DESIGN

| File | Why It Exists |
|------|---------------|
| `src/utils/build-message.ts` | Not in DESIGN, but used by worker.ts to build welcome messages |
| `src/types/fastify.d.ts` | Type augmentation for Fastify instance |
| `prisma/seed.ts` | Database seeding script, out of DESIGN scope |

---

## Empty Directories

| Directory | Status |
|-----------|--------|
| `src/queues/` | **EMPTY** — No `.ts` files (queues defined in `plugins/bullmq.ts` and `worker.ts`) |
| `test/integration/` | **EMPTY** — No integration test files (only `test/routes/` which is not the same path) |
| `test/fixtures/` | **PARTIAL** — `test-helpers.ts` exists but `webhook-payloads.ts` and `test-db.ts` are missing |

---

## Inconsistencies: Design vs Code

### 1. Queue Architecture
- **DESIGN:** Queues defined in `src/queues/follow-queue.ts` and `src/queues/dm-queue.ts`, consumed by `job-handlers.ts`
- **REALITY:** Queues defined inline in `src/plugins/bullmq.ts`; job processing directly in `src/worker.ts`
- **Impact:** Low — works correctly, but violates the architecture layer separation

### 2. DM Worker Rate Limiting
- **DESIGN:** BullMQ limiter `{ max: 1, duration: 1000 }` on worker
- **REALITY:** Worker has `concurrency: 1` but **no rate limiter** on the `dmQueue` — the design's rate limit enforcement is missing
- **Impact:** Medium — could violate Instagram's 1 msg/sec constraint under load

### 3. Missing Swagger Plugin
- **DESIGN:** `src/plugins/swagger.ts` for OpenAPI docs
- **REALITY:** No swagger plugin registered in `app.ts`
- **Impact:** Low — not critical for v1, docs can be added later

### 4. Test Structure
- **DESIGN:** Tests under `test/unit/`, `test/integration/`, `test/fixtures/`
- **REALITY:** Tests under `test/unit/`, `test/routes/`, `test/fixtures/` — `test/routes/` not in design
- **Impact:** Low — works but inconsistent with design path structure

### 5. Docker Build
- **DESIGN:** `Dockerfile` with multi-stage build for both server and worker
- **REALITY:** `Dockerfile` is **missing**
- **Impact:** Medium — deployment requires manual Docker setup

---

## Architecture Alignment Summary

| Component | DESIGN Decision | Implemented | Notes |
|-----------|-----------------|-------------|-------|
| Runtime | Node.js 22 + TypeScript | ✅ Yes | `engines.node >= 22.0.0` |
| Web Framework | Fastify 5.x | ✅ Yes | `fastify: ^5.2.0` |
| ORM | Prisma 6 | ✅ Yes | `@prisma/client: ^6.19.3` |
| Queue | BullMQ + Redis | ✅ Yes | `bullmq: ^5.34.0` |
| HTTP Client | Axios | ✅ Yes | `axios: ^1.7.0` |
| Validation | Zod 3 | ✅ Yes | `zod: ^3.24.0` |
| Rate Limiting | @fastify/rate-limit | ✅ Yes | Implemented |
| HMAC Validation | middleware/hmac-validator.ts | ✅ Yes | Implemented |
| API Key Auth | middleware/api-key-auth.ts | ✅ Yes | Implemented |
| Code Engine | services/code-engine.ts | ✅ Yes | Implemented |
| DM Dispatcher | services/dm-dispatcher.ts | ✅ Yes | Implemented |
| Webhook Processor | services/webhook-processor.ts | ✅ Yes | Implemented |
| Token Manager | services/token-manager.ts | ✅ Yes | Implemented but not used in worker |
| Health Endpoint | health/health.ts | ✅ Yes | Implemented |

---

## Recommended Scope for SDD Change

The DESIGN.md describes a complete system, but only ~70% is implemented. The SDD change should be named **"complete-implementation"** and should cover:

1. **Queue layer refactor** — Extract queue definitions to `src/queues/` directory
2. **DM rate limiter** — Add BullMQ limiter to `dm-queue` to enforce 1 msg/sec
3. **Dockerfile** — Add production Dockerfile
4. **Missing tests** — Add integration tests for webhook, health, and codes routes
5. **Test fixtures** — Add `webhook-payloads.ts` and `test-db.ts`
6. **Swagger plugin** — Add `src/plugins/swagger.ts` (low priority)
7. **Job handlers extraction** — Consider extracting job handlers to `src/queues/job-handlers.ts`

---

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| **DM rate limiting missing** — could exceed Instagram's 1 msg/sec limit | Medium | Add `limiter: { max: 1, duration: 1000 }` to dmQueue in `bullmq.ts` |
| **Dockerfile missing** — no production deployment path | Medium | Create multi-stage Dockerfile |
| **Inconsistent test structure** — `test/routes/` vs `test/integration/` | Low | Align test paths with DESIGN |
| **Queue layer inconsistency** — queues in plugins instead of queues/ dir | Low | Refactor for cleaner architecture separation |

---

## Next Recommended

- **sdd-propose** — Create a new change proposal for "complete-implementation" covering the missing pieces above

---

## Skill Resolution

- **skill_resolution:** `fallback-path`
- **Reason:** The skill file at `sdd-explore/SKILL.md` was loaded via `skill()` tool and the task matched the trigger condition. However, `sdd-phase-common.md` retrieval section uses a fallback registry approach (`skills/_shared/skills-registry.json`) which doesn't exist in the expected location. Fell back to reading the skill file directly.