# Apply Progress: cleanup-and-align-v3 — PR 1 + PR 2

**Date**: 2026-07-07
**Mode**: Standard (strict_tdd: false)
**Artifact Store**: Hybrid (Engram + OpenSpec)

## PR 1 — Completed (Migration + Foundation)
- [x] 1.1 — Migration generated: `prisma/migrations/20260707210955_v3_comment_flow/migration.sql`
- [x] 1.2 — Updated `test/fixtures/test-db.ts` table list
- [x] 1.3 — Created `src/utils/keyword-match.ts`
- [x] 1.4 — Created `src/queues/comment-queue.ts`
- [x] 2.1 — Updated `src/config/env.ts`
- [x] 2.2 — Updated `src/config/constants.ts`
- [x] 2.4 — Updated `src/utils/logger.ts`
- [x] 2.5 — `.env.example` already compliant

## PR 2 — Completed (Core Webhook Flow)
- [x] 2.3 — Updated `src/types/fastify.d.ts`: `followQueue` → `commentQueue`, removed `apiKeyAuth`
- [x] 3.1 — Updated `src/routes/webhooks/instagram.schema.ts`: Zod schema for `field: 'comments'`
- [x] 3.2 — Updated `src/routes/webhooks/instagram.ts`: keyword-gate, comment upsert, DmRecord dedup, comment-queue
- [x] 3.3 — Updated `src/services/webhook-processor.ts`: `processCommentEvent` with comment upsert and DM enqueue
- [x] 3.4 — Updated `src/queues/index.ts`: export comment-queue types and handlers
- [x] 3.5 — Updated `src/queues/job-handlers.ts`: `processCommentEventJob`, DmRecord creation in DM handler
- [x] 3.6 — Updated `src/plugins/bullmq.ts`: `createCommentQueue`, `commentQueue` decorator
- [x] 3.7 — Updated `src/worker.ts`: comment worker replacing follow worker

## Remaining Tasks (for PR 3)
- [ ] Phase 4: Cleanup (4.1–4.6) — delete api-key-auth.ts, follow-queue.ts, seed.ts; update crypto.ts, error-handler.ts, app.ts
- [ ] Phase 5: Peripheral Files (5.1–5.7) — swagger, health, legal, build-message, package.json, test scripts
- [ ] Phase 6: Tests (6.1–6.6) — test helpers, payloads, keyword-match, hmac-validator, webhook routes, integration

## Files Changed (PR 2)
| File | Action | Lines |
|------|--------|-------|
| `src/types/fastify.d.ts` | Modified | +3 -4 |
| `src/routes/webhooks/instagram.schema.ts` | Modified | +13 -7 |
| `src/queues/comment-queue.ts` | Modified | +3 |
| `src/routes/webhooks/instagram.ts` | Modified | +70 -31 |
| `src/services/webhook-processor.ts` | Modified | +27 -17 |
| `src/queues/job-handlers.ts` | Modified | +44 -18 |
| `src/queues/dm-queue.ts` | Modified | +2 |
| `src/queues/index.ts` | Modified | +8 -8 |
| `src/plugins/bullmq.ts` | Modified | +10 -10 |
| `src/worker.ts` | Modified | +22 -21 |

**PR 2 total**: 178 insertions, 87 deletions = 265 changed lines
**Combined total (PR 1 + PR 2)**: 295 insertions, 102 deletions = 397 changed lines

## Commits (PR 2)
```
e05c381 feat(worker): migrate from follow to comment worker
01b0490 feat(queue): rewrite processor and handler for comment events
56675cf feat(webhook): rewrite POST handler for comment-triggered DM flow
327213b feat(schema): update webhook schema and types for comment flow
```

## Deviations from Design
- None — implementation matches design.md data flow exactly.
- DmRecord dedup check (`findFirst`) happens in the route handler (keyword-gate layer), not in the processor. The processor creates the DmRecord after DM send succeeds. This correctly prevents duplicate DMs and avoids useless queue entries.
- `CommentEventJob` interface was extended with `commentText`, `commentId`, `mediaId` per the design contract (was missing these fields in PR 1).
- `DmDispatchJob` interface was extended with `commentId?`, `mediaId?` to support the DmRecord creation in the DM handler.
- `DmDispatchJobDeps` interface was extended with `prisma: PrismaClient` to support DmRecord creation.

## Issues Found
- `src/app.ts` still imports removed exports (`WEBHOOK_RATE_LIMIT_MAX`, `WEBHOOK_RATE_LIMIT_WINDOW`, `API_RATE_LIMIT_MAX_PER_KEY`, `apiKeyAuthMiddleware`) — these are task 4.6 (Phase 4, PR 3).
- `src/middleware/api-key-auth.ts` still exists (references removed `hashApiKey` export from crypto.ts) — task 4.1/4.4 (Phase 4, PR 3).
- `src/middleware/error-handler.ts` still imports `UnauthorizedError` from api-key-auth — task 4.5 (Phase 4, PR 3).
- `tsc --noEmit` will show compilation errors until Phase 4 cleanup is completed.

## Workload / PR Boundary
- Mode: chained PR slice (stacked-to-main)
- Current work unit: Unit 2 — Core webhook flow + cleanup deletes
- Chain strategy: stacked-to-main
- PR 2 budget: 265 / 400 lines (66% — under budget)
- Combined budget: 397 / 400 lines (99% — at limit)
