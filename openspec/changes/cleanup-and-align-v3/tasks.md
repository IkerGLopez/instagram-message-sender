# Tasks: Cleanup and Align Codebase to v3.0.0

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 500–700 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1: Migration + new modules + config (~150 lines) → PR 2: Core logic + cleanup (deletes) + worker (~250 lines) → PR 3: Tests + peripheral (~200 lines) |
| Delivery strategy | ask-on-risk |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Migration + new modules + config | PR 1 | Foundation: keyword-match, comment-queue, env/constants/types |
| 2 | Core webhook flow + cleanup deletes | PR 2 | Processor, worker, job-handlers, schema; delete api-key-auth, follow-queue, seed |
| 3 | Tests + peripheral files | PR 3 | All test updates, legal, swagger, scripts, package.json |

## Phase 1: Database & Foundation

- [x] 1.1 Run `npx prisma migrate diff --from-migrations --to-schema-datamodel` to generate migration SQL (creates `instagram_comments`, `dm_records` tables; drops `api_keys`). Migration file at `prisma/migrations/20260707210955_v3_comment_flow/migration.sql`.
- [x] 1.2 Update `test/fixtures/test-db.ts` — table list `['DiscountCode','InstagramFollower','WebhookEvent','ApiKey']` → `['DmRecord','InstagramComment','InstagramFollower','WebhookEvent']`
- [x] 1.3 Create `src/utils/keyword-match.ts` — pure function `matchesKeyword(text: string, keyword: string): boolean` (case-insensitive word-boundary regex per design)
- [x] 1.4 Create `src/queues/comment-queue.ts` — queue name `instagram-comment`, export `createCommentQueue`, `CommentEventJob` interface, same config as follow-queue

## Phase 2: Config & Types (cross-cutting, no runtime deps)

- [x] 2.1 Update `src/config/env.ts` — remove `API_KEY_HASH_SECRET` from schema, add `TRIGGER_KEYWORD: z.string().min(1)`; remove from `Env` type
- [x] 2.2 Update `src/config/constants.ts` — remove `API_RATE_LIMIT_MAX_PER_KEY`, `API_RATE_LIMIT_MAX_PER_IP`, `API_VALIDATE_RATE_LIMIT_MAX`; update `DM_WELCOME_TEMPLATE` text ("Gracias por seguirnos" → "Gracias por tu interés")
- [x] 2.3 Update `src/types/fastify.d.ts` — `followQueue` → `commentQueue`, remove `apiKeyAuth` and `FastifyRequest/FastifyReply` imports
- [x] 2.4 Update `src/utils/logger.ts` — remove `'API_KEY_HASH_SECRET'` from redact paths
- [x] 2.5 Update `.env.example` — remove `API_KEY_HASH_SECRET` line (already has `TRIGGER_KEYWORD`)

## Phase 3: Core Webhook Flow

- [x] 3.1 Update `src/routes/webhooks/instagram.schema.ts` — Zod schema: `field: z.literal('comments')`, value shape with `comment.id`, `comment.text`, `comment.from.id`, `media.id`
- [x] 3.2 Update `src/routes/webhooks/instagram.ts` — parse `field === 'comments'`, call `matchesKeyword(text, env.TRIGGER_KEYWORD)`, upsert `instagramComment`, check `dmRecord` dedup, enqueue `commentQueue` instead of `followQueue`; update eventType and log messages
- [x] 3.3 Update `src/services/webhook-processor.ts` — rename to `processCommentEvent`, receive `CommentEventJob`, include keyword check and `DmRecord.upsert` with dedup (insert on DM send, check before enqueue)
- [x] 3.4 Update `src/queues/index.ts` — export `createCommentQueue`, `COMMENT_QUEUE_NAME`, `CommentEventJob`; remove follow exports; rename handler exports
- [x] 3.5 Update `src/queues/job-handlers.ts` — rename `processFollowEventJob` → `processCommentEventJob`, import `CommentEventJob` from comment-queue, update processor call
- [x] 3.6 Update `src/plugins/bullmq.ts` — `createFollowQueue` → `createCommentQueue`, rename decorator `followQueue` → `commentQueue`, update Fastify module augmentation
- [x] 3.7 Update `src/worker.ts` — replace follow queue/worker with comment equivalents, update queue names (`instagram-follow` → `instagram-comment`), rename log messages, update shutdown references

## Phase 4: Cleanup (delete dead code, remove references)

- [ ] 4.1 **Delete** `src/middleware/api-key-auth.ts` (file + `UnauthorizedError` class)
- [ ] 4.2 **Delete** `prisma/seed.ts` (API key seeding — dead code)
- [ ] 4.3 **Delete** `src/queues/follow-queue.ts` (replaced by comment-queue.ts)
- [ ] 4.4 Update `src/utils/crypto.ts` — remove `hashApiKey` function and `timingSafeEqual` import (keep `verifyInstagramSignature`, `createHmac` import stays)
- [ ] 4.5 Update `src/middleware/error-handler.ts` — remove `import { UnauthorizedError } from './api-key-auth.js'` and its handler block
- [ ] 4.6 Update `src/app.ts` — remove `apiKeyAuthMiddleware` import, remove `app.decorate('apiKeyAuth', ...)` line, remove empty API routes block (lines 93–100), remove `API_RATE_LIMIT_MAX_PER_KEY` import, remove dead imports

## Phase 5: Peripheral Files

- [ ] 5.1 Update `src/plugins/swagger.ts` — description: "followers" → "comment-triggered", version → `3.0.0`
- [ ] 5.2 Update `src/health/health.ts` — `(app as any).followQueue` → `(app as any).commentQueue`, update queue detail string
- [ ] 5.3 Update `src/routes/legal.ts` — replace "seguidores"/"seguimiento" with "usuarios que comentan"/"comentario"; update service descriptions
- [ ] 5.4 Update `src/utils/build-message.ts` — verify template interpolation works with updated constant (no structural change needed, just review)
- [ ] 5.5 Update `package.json` — description: "comment-triggered DM dispatch with static discount code"; remove `db:seed` script and `prisma.seed` config
- [ ] 5.6 Update `test-webhook.mjs` — payload: `field: 'comments'` shape with comment text containing keyword
- [ ] 5.7 Update `check-queue.mjs` — `bull:follow-queue` → `bull:comment-queue`, update key patterns

## Phase 6: Tests

- [ ] 6.1 Update `test/fixtures/test-helpers.ts` — replace `validFollowPayload` with `validCommentPayload` (comment shape); remove `apiKey` mock from `createMockPrisma`; add `instagramComment` and `dmRecord` mock methods
- [ ] 6.2 Update `test/fixtures/webhook-payloads.ts` — replace follow payloads with comment payloads (valid with keyword, valid without keyword, malformed)
- [ ] 6.3 **Create** `test/unit/keyword-match.test.ts` — 9 test cases from spec (exact, case-insensitive, word boundary, no partial, empty keyword guard)
- [ ] 6.4 Update `test/unit/hmac-validator.test.ts` — remove `hashApiKey` import and test suite; keep `verifyInstagramSignature` tests
- [ ] 6.5 Update `test/routes/webhooks/instagram.test.ts` — replace `validFollowPayload` import with `validCommentPayload`; rename `followQueue` mocks to `commentQueue`; update assertions for comment flow
- [ ] 6.6 Update `test/integration/webhook-route.test.ts` — replace follow payload imports with comment payloads; update test descriptions
