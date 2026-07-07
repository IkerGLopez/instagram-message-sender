# Proposal: Cleanup and Align Codebase to v3.0.0

## Intent

Align the codebase to SPECS.md v3.0.0 (comment-triggered DMs with static discount code). Remove remaining v1.0.0 (follow-triggered, code generation, API endpoints) and v2.0.0 (validation API) artifacts. Prisma schema is partially updated; execution flow still processes follow events and migrations lag behind.

## Scope

### In Scope
- Replace follow webhook handler with comment event processing (keyword "BASUSTA")
- Implement keyword matching (case-insensitive, no partial-word matches)
- Delete api-key-auth middleware, UnauthorizedError, hashApiKey util, seed script
- Remove `API_KEY_HASH_SECRET` from env config; add `TRIGGER_KEYWORD`
- Rename queue: `instagram-follow` → `instagram-comment`
- Add `instagram_comments` + `dm_records` migration; drop `api_keys` migration
- Update DM template, legal pages, Swagger description
- Remove dead API rate-limit constants
- Update all tests, fixtures, and CLI scripts (test-webhook.mjs, check-queue.mjs)
- Update package.json description

### Out of Scope
- New features beyond v3.0.0, UI changes, deployment pipeline, data migration of existing rows

## Capabilities

### New Capabilities
- `keyword-matching`: Case-insensitive keyword detection in comment text, rejecting partial-word matches

### Modified Capabilities
- `follower-dm`: Trigger requirement changes from follow events to keyword-matched comment events; DM content (static code only, no URL) unchanged

## Approach

Refactor-heavy, no greenfield. Core behavioral changes: webhook payload parsing (comments vs follows) and keyword matching.

1. **Webhook**: Parse `changes[].field === 'comments'`, extract text, user ID, comment ID
2. **Keyword match**: Compare comment text against `TRIGGER_KEYWORD` (case-insensitive, word-boundary aware)
3. **Processor**: Upsert `InstagramComment`, check `DmRecord` for dedup, enqueue DM
4. **Queue**: Replace `follow-queue.ts` with `comment-queue.ts`; rename to `instagram-comment`
5. **Worker**: Adapt job handlers and worker for comment events
6. **Cleanup**: Delete dead API auth code, update constants/env/legal
7. **Migration**: Generate Prisma migration for new tables + drop `api_keys`
8. **Tests**: Update payloads to comment shape, add keyword-match tests, remove `hashApiKey` tests

## Affected Areas

| Area | Impact |
|------|--------|
| `src/routes/webhooks/instagram.{ts,schema.ts}` | Modified — parse comments |
| `src/services/webhook-processor.ts` | Modified — keyword gate, comment upsert, DM dedup |
| `src/queues/follow-queue.ts` | Removed |
| `src/queues/comment-queue.ts` | New |
| `src/queues/job-handlers.ts`, `src/worker.ts` | Modified — rename follow→comment |
| `src/config/env.ts`, `src/config/constants.ts` | Modified — drop API_KEY, add TRIGGER_KEYWORD |
| `src/middleware/api-key-auth.ts`, `prisma/seed.ts` | Removed |
| `src/middleware/error-handler.ts` | Modified — remove UnauthorizedError |
| `src/utils/crypto.ts` | Modified — remove hashApiKey |
| `src/utils/keyword-match.ts` | New |
| `src/utils/logger.ts`, `src/plugins/{bullmq,swagger}.ts` | Modified |
| `src/app.ts`, `src/types/fastify.d.ts` | Modified — remove apiKeyAuth |
| `src/health/health.ts` | Modified — followQueue → commentQueue |
| `src/routes/legal.ts` | Modified — reflect comment-triggered flow |
| `prisma/` (migration) | New — instagram_comments, dm_records, drop api_keys |
| `test/**` | Modified — comment payloads, keyword tests, updated mocks |
| `test-webhook.mjs`, `check-queue.mjs`, `package.json` | Modified |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Orphaned follow jobs in Redis after queue rename | Medium | Drain old queue before deploy; document in migration notes |
| Prisma migration ordering | Low | Generate with `--create-only`, review SQL before apply |
| Circular imports in job handlers | Low | Keep existing dynamic import pattern |
| Legal pages expose stale v1 content publicly | Low | Static HTML, update immediately |

## Rollback Plan

1. Revert Prisma migrations (restore api_keys, drop instagram_comments + dm_records)
2. Restore deleted files (api-key-auth.ts, follow-queue.ts, seed.ts)
3. Git revert all source changes
4. Re-add `API_KEY_HASH_SECRET` to env config
5. Restore old queue names in Redis

## Dependencies

- `TRIGGER_KEYWORD` env var must be set in all environments
- Existing Redis follow jobs must be drained before queue rename

## Success Criteria

- [ ] Comment with keyword enqueues DM dispatch; comment without keyword discarded
- [ ] Same user cannot receive >1 DM (dedup)
- [ ] `STATIC_DISCOUNT_CODE` required on startup; `API_KEY_HASH_SECRET` no longer required
- [ ] All tests pass with updated comment payloads
- [ ] No follow-queue, api-key-auth, or hashApiKey references remain
- [ ] `api_keys` table dropped; `instagram_comments` and `dm_records` created
