## Verification Report

**Change**: cleanup-and-align-v3
**Version**: specs v3.0.0
**Mode**: Standard

### Completeness
| Metric | Value |
|--------|-------|
| Tasks total | 36 |
| Tasks complete | 36 |
| Tasks incomplete | 0 |

### Build & Tests Execution
**Build**: ✅ Passed
```text
$ tsc
(exit code 0, no errors)
```

**Tests**: ✅ 26 passed / ❌ 2 failed / ⚠️ 0 skipped
```text
✅ test/unit/keyword-match.test.ts (14 tests) 23ms
✅ test/unit/hmac-validator.test.ts (5 tests) 14ms
✅ test/routes/webhooks/instagram.test.ts (7 tests) 926ms
❌ test/integration/health-route.test.ts — FAIL: parseEnv() throws "Invalid environment variables: TRIGGER_KEYWORD: Required"
❌ test/integration/webhook-route.test.ts — FAIL: parseEnv() throws "Invalid environment variables: TRIGGER_KEYWORD: Required"
```

**Root cause**: `.env` file is missing `TRIGGER_KEYWORD` (still has old `API_KEY_HASH_SECRET` and `STORE_BASE_URL`). `env.ts` runs `parseEnv()` at module import time, which fails before the test runner even starts.

**Coverage**: ➖ Not run (integration failures block full suite)

### Spec Compliance Matrix
| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| REQ-01: Keyword Detection | Exact match | `test/unit/keyword-match.test.ts > detects exact match` | ✅ COMPLIANT |
| REQ-01: Keyword Detection | No match | `test/unit/keyword-match.test.ts > rejects unrelated comment` | ✅ COMPLIANT |
| REQ-02: Case-Insensitive Matching | Lowercase | `test/unit/keyword-match.test.ts > detects case-insensitive lowercase` | ✅ COMPLIANT |
| REQ-02: Case-Insensitive Matching | Mixed case | `test/unit/keyword-match.test.ts > detects case-insensitive mixed case` | ✅ COMPLIANT |
| REQ-03: Word-Boundary Enforcement | Partial word | `test/unit/keyword-match.test.ts > rejects partial prefix match` | ✅ COMPLIANT |
| REQ-03: Word-Boundary Enforcement | Within sentence | `test/unit/keyword-match.test.ts > detects keyword within longer text` | ✅ COMPLIANT |
| REQ-03: Word-Boundary Enforcement | Trailing punctuation | `test/unit/keyword-match.test.ts > detects keyword with trailing punctuation` | ✅ COMPLIANT |
| REQ-04: TRIGGER_KEYWORD Config | Valid config | All unit tests pass with TRIGGER_KEYWORD env mock | ✅ COMPLIANT |
| REQ-04: TRIGGER_KEYWORD Config | Missing config | parseEnv() throws Error (confirmed by integration failure) | ✅ COMPLIANT |
| DM Delta: Keyword comment triggers DM | Keyword-matched + no prior DM | `test/routes/webhooks/instagram.test.ts > returns 200 and enqueues job` | ✅ COMPLIANT |
| DM Delta: Repeat comment skips DM | Prior DM exists | `src/routes/webhooks/instagram.ts` L124-133 — dmRecord.findFirst gate | ✅ COMPLIANT (logic verified) |

**Compliance summary**: 11/11 scenarios compliant

### Correctness (Static Evidence)
| Requirement | Status | Notes |
|------------|--------|-------|
| keyword-match.ts: pure function with \b regex | ✅ Implemented | Uses `new RegExp(\\b${escaped}\\b, 'i')`, escapes regex chars |
| instagram.ts: keyword gating at route layer | ✅ Implemented | L103: discards before enqueue, logs skipped |
| instagram.ts: DmRecord dedup | ✅ Implemented | L124-133: findFirst before enqueue |
| comment-queue.ts: named instagram-comment | ✅ Implemented | COMMENT_QUEUE_NAME = 'instagram-comment' |
| env.ts: API_KEY_HASH_SECRET removed | ✅ Implemented | No mention in schema |
| env.ts: TRIGGER_KEYWORD added | ✅ Implemented | `z.string().min(1)` at L19 |
| crypto.ts: hashApiKey removed | ✅ Implemented | Only verifyInstagramSignature remains |
| app.ts: no apiKeyAuth, no API routes | ✅ Implemented | Clean Fastify app without API middleware |
| error-handler.ts: no UnauthorizedError | ✅ Implemented | Only Zod validation + 4xx + generic 500 |
| constants.ts: API rate limits removed | ✅ Implemented | Only WEBHOOK and queue constants remain |
| DM_WELCOME_TEMPLATE updated | ✅ Implemented | "Gracias por tu interés" — no store URL |
| build-message.ts: only STATIC_DISCOUNT_CODE | ✅ Implemented | No STORE_BASE_URL parameter |
| deleted: api-key-auth.ts | ✅ Deleted | File does not exist |
| deleted: follow-queue.ts | ✅ Deleted | File does not exist |
| deleted: prisma/seed.ts | ✅ Deleted | File does not exist |

### Coherence (Design)
| Decision | Followed? | Notes |
|----------|-----------|-------|
| Keyword match at route layer (discard before enqueue) | ✅ Yes | instagram.ts L103: `matchesKeyword()` gates before any DB ops |
| DmRecord deduplication (1 DM per user) | ✅ Yes | instagram.ts L124-130: `dmRecord.findFirst({ where: { instagramUserId } })` |
| Queue rename: follow → comment | ✅ Yes | comment-queue.ts, bullmq.ts, worker.ts all use `instagram-comment` |
| Keyword-match as pure function | ✅ Yes | `matchesKeyword(text, keyword): boolean` — no side effects, no imports |
| Webhook schema: field='comments' | ✅ Yes | WebhookPayloadSchema uses `z.literal('comments')`, comment shape (value.comment.text, from.id) |
| API_KEY_HASH_SECRET removal | ✅ Yes | env.ts, logger.ts, crypto.ts all clean |
| Static discount code only in DM | ✅ Yes | buildWelcomeMessage() uses only STATIC_DISCOUNT_CODE, no STORE_BASE_URL |
| Fail-fast on missing TRIGGER_KEYWORD | ✅ Yes | parseEnv() throws at startup if missing |

### Issues Found
**CRITICAL**: 
1. Integration tests fail — `.env` file missing `TRIGGER_KEYWORD` env var. Both `test/integration/health-route.test.ts` and `test/integration/webhook-route.test.ts` crash at module import because `parseEnv()` requires `TRIGGER_KEYWORD` but it is not present in the actual `.env` file.

**WARNING**:
1. `.env` file still contains dead entries: `API_KEY_HASH_SECRET` (L14) and `STORE_BASE_URL` (L17) — these env vars are no longer referenced by any source code but remain in the config file.
2. `render.yaml` still references `API_KEY_HASH_SECRET` (L32) and `STORE_BASE_URL` (L34) — deployment manifest not updated for v3.0.0.
3. `README.md` still documents `pnpm db:seed` (L65) — removed from package.json but documentation not updated.

**SUGGESTION**:
1. `specs/SPECS.md` L716 still references `API_KEY_HASH_SECRET` — env vars table should be updated to match v3.0.0 schema.
2. `specs/SPECS.md` env section should add `TRIGGER_KEYWORD` alongside the existing v2 section.

### Migration Check
| Item | Status | Details |
|------|--------|---------|
| Migration file exists | ✅ | `prisma/migrations/20260707210955_v3_comment_flow/migration.sql` |
| Drops api_keys | ✅ | `DROP TABLE "api_keys"` |
| Creates instagram_comments | ✅ | 7 columns, unique on commentId, 2 indices |
| Creates dm_records | ✅ | 8 columns, unique on instagramUserId, 2 indices |
| Schema matches Prisma | ✅ | InstagramComment + DmRecord models match migration exactly |
| api_keys model removed | ✅ | No `ApiKey` model in schema.prisma |

### Verdict
**FAIL**

**Reason**: 2 integration tests fail because `.env` is missing `TRIGGER_KEYWORD`. All 36 implementation tasks are complete, build passes clean, all 26 unit tests pass, and the source code is fully aligned with specs and design. The issue is purely a configuration oversight — `.env` was not updated to add `TRIGGER_KEYWORD` and remove dead `API_KEY_HASH_SECRET`/`STORE_BASE_URL`. Once `.env` is fixed, the integration tests should pass.

**Fix required**: Add `TRIGGER_KEYWORD=BASUSTA` to `.env` and optionally remove `API_KEY_HASH_SECRET` and `STORE_BASE_URL` from `.env` and `render.yaml`.
