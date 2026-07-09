# Archive Report: cleanup-and-align-v3

**Archived**: 2026-07-07
**Mode**: Hybrid (Engram + OpenSpec)
**SDD Cycle**: Propose → Spec → Design → Tasks → Apply → Verify → Archive

---

## Change Summary

Refactored the codebase from follow-triggered DM flow to comment-triggered DM with keyword matching (SPECS.md v3.0.0). Removed dead v1.0.0 (code generation, API endpoints) and v2.0.0 (validation API) artifacts. Replaced trigger mechanism from follow events to keyword-matched comment events, implemented 1-DM-per-user deduplication via new `DmRecord` table, and deleted the entire API layer (auth middleware, routes, error handling).

**Before**: Follow-triggered DM with unique code generation + validation/redeem API
**After**: Comment-triggered DM with static discount code, no validation API

---

## Specs Delta

### Domain: keyword-matching (NEW)

Created as new domain spec — no prior baseline existed.

| Requirement | Action | Details |
|---|---|---|
| Keyword Detection | Added | Match comment text against TRIGGER_KEYWORD; discard non-matches |
| Case-Insensitive Matching | Added | Lowercase, mixed case detection |
| Word-Boundary Enforcement | Added | Reject partial words (BASUST ≠ BASUSTA); accept within sentence, with punctuation |
| TRIGGER_KEYWORD Configuration | Added | Read from env var; fail-fast on missing |

### Domain: follower-dm (MODIFIED)

| Requirement | Action | Details |
|---|---|---|
| DM Message Content | Modified | Trigger: follow events → keyword-matched comment events. Dedup: none → 1 DM per user via DmRecord. Content: static code without store URL (unchanged) |
| Code Validation Endpoint | Removed (prior: v2.0.0) | Static code needs no validation |
| Code Redemption Endpoint | Removed (prior: v2.0.0) | Redeemed verbally on-site |
| Unique Code Generation | Removed (prior: v2.0.0) | Replaced by STATIC_DISCOUNT_CODE env var |
| Discount Code Database Model | Removed (prior: v2.0.0) | No DB-stored codes |

---

## Key Decisions

| Decision | Rationale |
|---|---|
| **Keyword-match as pure function** | No state needed; simpler to test. `matchesKeyword(text, keyword): boolean` with `\b` word-boundary regex. |
| **Route-layer keyword gating** | Discard non-matching comments before enqueue to keep queue lean. Worker never sees keyword logic. |
| **DmRecord deduplication** | New table with unique constraint on `instagramUserId`. Check before enqueue for 1-DM-per-user guarantee. |
| **Prisma migrate dev for migration** | Generated from schema diff; reviewed SQL before applying. |
| **Chained PRs: stacked-to-main** | 4+2 PRs to stay under 400-line review budget. PR 1 (foundation) → PR 2 (core flow) → PR 3a/3b (cleanup + peripheral) → PR 4 (tests) → post-judgment fix. |
| **TimingSafeEqual preserved** | Kept in `crypto.ts` — still used by `verifyInstagramSignature()`. Only `hashApiKey` removed. |
| **InstagramFollower model preserved** | In SPECS.md v3.0.0 but no flow uses it. Kept for analytics potential; removed from processing. |

---

## Issues Found and Resolved

### Pre-Archive Issues (from verify-report)

| Severity | Issue | Resolution |
|---|---|---|
| ~~CRITICAL~~ | Integration tests fail: `.env` missing `TRIGGER_KEYWORD` | ✅ Resolved — `.env` now contains `TRIGGER_KEYWORD=BASUSTA` (post-judgment fix) |
| WARNING | `.env` has dead entries (`API_KEY_HASH_SECRET`, `STORE_BASE_URL`) | ✅ Resolved — entries removed from `.env` |
| WARNING | `render.yaml` still references removed env vars | ⚠️ Unresolved — deployment manifest not in scope of this change |
| WARNING | `README.md` documents `pnpm db:seed` (removed) | ⚠️ Unresolved — documentation debt, non-blocking |
| SUGGESTION | `specs/SPECS.md` references stale env vars | ⚠️ Unresolved — separate documentation update needed |

### Judgment-Day Review Issues

| Issue | Resolution |
|---|---|
| Race condition: DmRecord upsert concurrency | Fixed — replaced `upsert` with `findFirst` gate before enqueue + `create` at DM dispatch time |
| Dead code: WebhookEvent update unreachable | Fixed — removed unused event update path |

---

## Remaining Known Issues

1. **`render.yaml` stale env vars**: Still references `API_KEY_HASH_SECRET` and `STORE_BASE_URL`. Must be updated before production deploy.
2. **`README.md` stale docs**: References `pnpm db:seed` (removed). Documentation debt.
3. **`specs/SPECS.md` outdated env table**: Still shows `API_KEY_HASH_SECRET`. Should add `TRIGGER_KEYWORD`.

None of these are blockers — they are documentation/deployment-manifest debt outside the scope of this SDD change.

---

## Files Changed Summary

### Created (3 files)
| File | Purpose |
|---|---|
| `src/utils/keyword-match.ts` | Pure function: case-insensitive word-boundary keyword detection |
| `src/queues/comment-queue.ts` | BullMQ queue named `instagram-comment` |
| `test/unit/keyword-match.test.ts` | 14 unit tests covering keyword matching |

### Modified (22 files)
| File | Changes |
|---|---|
| `src/routes/webhooks/instagram.ts` | Parse comment payload, keyword-gate, DmRecord dedup |
| `src/routes/webhooks/instagram.schema.ts` | Zod schema: `field: 'comments'` |
| `src/services/webhook-processor.ts` | processFollowEvent → processCommentEvent |
| `src/config/env.ts` | Remove API_KEY_HASH_SECRET, add TRIGGER_KEYWORD |
| `src/config/constants.ts` | Remove API rate limits, update DM template |
| `src/types/fastify.d.ts` | followQueue → commentQueue, remove apiKeyAuth |
| `src/utils/crypto.ts` | Remove hashApiKey |
| `src/utils/logger.ts` | Remove API_KEY_HASH_SECRET from redact |
| `src/plugins/bullmq.ts` | createFollowQueue → createCommentQueue |
| `src/plugins/swagger.ts` | Updated description + version |
| `src/middleware/error-handler.ts` | Remove UnauthorizedError |
| `src/queues/index.ts` | Export comment queue, remove follow exports |
| `src/queues/job-handlers.ts` | Rename processFollowEventJob → processCommentEventJob |
| `src/worker.ts` | Follow worker → comment worker |
| `src/app.ts` | Remove apiKeyAuth, API routes, API rate limits |
| `src/health/health.ts` | followQueue → commentQueue |
| `src/routes/legal.ts` | Updated legal text (follow → comment) |
| `src/utils/build-message.ts` | Verified static code interpolation |
| `package.json` | Updated description, removed db:seed |
| `.env.example` | Removed API_KEY_HASH_SECRET |
| `test-webhook.mjs` | Comment payload shape |
| `check-queue.mjs` | Updated queue key patterns |

### Deleted (3 files)
| File | Reason |
|---|---|
| `src/middleware/api-key-auth.ts` | Dead code — no API routes remain |
| `src/queues/follow-queue.ts` | Replaced by comment-queue.ts |
| `prisma/seed.ts` | Dead code — no API keys to seed |

### Database Migration
| File | Changes |
|---|---|
| `prisma/migrations/20260707210955_v3_comment_flow/` | Creates `instagram_comments` + `dm_records`, drops `api_keys` |

### Test Files Modified (5 files)
| File | Changes |
|---|---|
| `test/fixtures/test-helpers.ts` | Comment payloads, remove apiKey mocks, add dmRecord mocks |
| `test/fixtures/webhook-payloads.ts` | Follow payloads → comment payloads |
| `test/fixtures/test-db.ts` | Updated table list |
| `test/unit/hmac-validator.test.ts` | Removed hashApiKey tests |
| `test/routes/webhooks/instagram.test.ts` | Comment flow, keyword tests |
| `test/integration/webhook-route.test.ts` | Comment payloads |

### PR Delivery
| PR | Scope | Lines | Commits |
|---|---|---|---|
| PR 1 | Database + Config + New modules | 132 | 6 |
| PR 2 | Core Webhook Flow | 265 | 4 |
| PR 3a | Cleanup — compilation fix | 85 | 1 |
| PR 3b | Peripheral files | 139 | 3 |
| PR 4 | Tests | 300 | 1 |
| Post-judgment | Race conditions, dead code fixes | 124 | 1 |
| **Total** | | **~1045** | **16** |

---

## Implementation Verification

- ✅ Build: `tsc` exits clean (0 errors)
- ✅ Unit tests: 26/26 pass (keyword-match: 14, hmac-validator: 5, webhook routes: 7)
- ✅ Task completion: 36/36 tasks complete
- ✅ Spec compliance: 11/11 scenarios compliant
- ✅ Design coherence: 8/8 decisions followed
- ✅ Migration: Correct SQL, schema matches Prisma
- ✅ Integration tests: Pass after `.env` fix (TRIGGER_KEYWORD=BASUSTA)

---

## Engram Observation Traceability

| Artifact | Obs ID | Topic Key |
|---|---|---|
| Proposal | #295 | `sdd/cleanup-and-align-v3/proposal` |
| Spec | #296 | `sdd/cleanup-and-align-v3/spec` |
| Design | #297 | `sdd/cleanup-and-align-v3/design` |
| Tasks | #298 | `sdd/cleanup-and-align-v3/tasks` |
| Apply Progress | #299 | `sdd/cleanup-and-align-v3/apply-progress` |
| Verify Report | #302 | `sdd/cleanup-and-align-v3/verify-report` |
| Archive Report | (this) | `sdd/cleanup-and-align-v3/archive-report` |

---

## SDD Cycle Complete

The change has been fully planned, implemented, verified, and archived. Source of truth updated in `openspec/specs/keyword-matching/spec.md` (new) and `openspec/specs/follower-dm/spec.md` (modified).
