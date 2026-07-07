# Design: Cleanup and Align Codebase to v3.0.0

## Technical Approach

Refactor the codebase from follow-triggered DM flow to comment-triggered flow with keyword matching. Leverage existing patterns (queue/worker, BullMQ, Prisma, Fastify decorators) — no greenfield architecture. Core behavioral changes: parse `field: 'comments'` webhook payload (different shape from `follows`) and gate processing on case-insensitive keyword match.

## Architecture Decisions

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Extract `keyword-match.ts` as pure function vs class | No state needed; simpler to test | **Pure function `matchesKeyword(text, keyword): boolean`** |
| Put keyword check in webhook route vs worker | Route-layer keeps webhook fast; worker adds latency but enables retry | **Route layer** — discard non-matching comments before enqueue, keeping queue lean |
| Create migration via `prisma migrate dev` vs raw SQL | Prisma migration generates from schema diff; SQL gives control over drop timing | **Prisma migrate dev** — generates migration from schema diff; review before applying |
| Remove `InstagramFollower` model | Still in SPECS.md v3.0.0 for analytics, but no flow uses it | **Keep model, remove from processing flow** — no migration needed, just code cleanup |

## Data Flow

```
POST /webhooks/instagram
         │
         ▼
   HMAC validation
         │
         ▼
   Zod schema parse (field: 'comments')
         │
         ▼
   keyword-match(text, TRIGGER_KEYWORD)
    │            │
    NO           YES
    │            │
    ▼            ▼
  SKIP      Upsert InstagramComment
  (log)          │
                 ▼
            DmRecord.findFirst(instagramUserId)
              │            │
            EXISTS      NOT FOUND
              │            │
              ▼            ▼
            SKIP     Enqueue comment-queue
            (log)         │
                          ▼
                     Worker picks up
                          │
                          ▼
                    Send DM (DMDispatcher)
                          │
                          ▼
                    INSERT DmRecord
                          │
                          ▼
                    Update webhook_event → PROCESSED
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/utils/keyword-match.ts` | **Create** | Pure function: case-insensitive word-boundary match against TRIGGER_KEYWORD |
| `src/queues/comment-queue.ts` | **Create** | Queue named `instagram-comment` — same config as follow-queue |
| `prisma/migrations/{timestamp}_v3_comment_flow/` | **Create** | Migration: `instagram_comments` + `dm_records` tables, drop `api_keys` |
| `src/routes/webhooks/instagram.schema.ts` | Modify | Zod schema: `field: 'comments'` with nested `value.comment.text`, `value.comment.from.id`, `value.comment.id`, `value.media.id` |
| `src/routes/webhooks/instagram.ts` | Modify | Parse comments payload, keyword-gate before enqueue, rename queue reference |
| `src/config/env.ts` | Modify | Remove `API_KEY_HASH_SECRET`, add `TRIGGER_KEYWORD: z.string().min(1)` |
| `src/config/constants.ts` | Modify | Remove `API_RATE_LIMIT_MAX_PER_KEY`, `API_RATE_LIMIT_MAX_PER_IP`, `API_VALIDATE_RATE_LIMIT_MAX`; update `DM_WELCOME_TEMPLATE` text |
| `src/app.ts` | Modify | Remove `apiKeyAuth` decorate, remove api-key-auth import, remove API rates import, remove empty API routes block |
| `src/middleware/error-handler.ts` | Modify | Remove `UnauthorizedError` import and handler block |
| `src/plugins/bullmq.ts` | Modify | Replace `createFollowQueue` → `createCommentQueue`, rename decorator `followQueue` → `commentQueue` |
| `src/plugins/swagger.ts` | Modify | Update description: "followers" → "comment-triggered" |
| `src/queues/index.ts` | Modify | Export `createCommentQueue`, `COMMENT_QUEUE_NAME`, `CommentEventJob`; remove follow exports |
| `src/queues/job-handlers.ts` | Modify | Rename `processFollowEventJob` → `processCommentEventJob`; adapt to comment+keyword flow |
| `src/worker.ts` | Modify | Replace follow worker → comment worker, update queue names, imports |
| `src/types/fastify.d.ts` | Modify | `followQueue` → `commentQueue`; remove `apiKeyAuth` |
| `src/health/health.ts` | Modify | `followQueue` → `commentQueue` reference |
| `src/routes/legal.ts` | Modify | "seguiendo" → "comentando", "seguimiento" → "comentario" |
| `src/utils/crypto.ts` | Modify | Remove `hashApiKey` function |
| `src/utils/logger.ts` | Modify | Remove `API_KEY_HASH_SECRET` from redact paths |
| `src/services/webhook-processor.ts` | Modify | Rename `processFollowEvent` → `processCommentEvent`; add keyword match, comment upsert, DmRecord dedup |
| `package.json` | Modify | Update description: "comment-triggered DM dispatch" |
| `.env.example` | Modify | Remove `API_KEY_HASH_SECRET` (already has `TRIGGER_KEYWORD`) |
| `test-webhook.mjs` | Modify | Send `field: 'comments'` payload |
| `check-queue.mjs` | Modify | `bull:follow-queue` → `bull:comment-queue` |
| `test/fixtures/webhook-payloads.ts` | Modify | Replace follow payloads with comment payloads |
| `test/fixtures/test-helpers.ts` | Modify | Replace `validFollowPayload` with `validCommentPayload`; remove `apiKey` mocks; add `instagramComment`, `dmRecord` mocks |
| `test/fixtures/test-db.ts` | Modify | Table list: remove `DiscountCode`, `ApiKey`; add `InstagramComment`, `DmRecord` |
| `test/routes/webhooks/instagram.test.ts` | Modify | Replace follow payload assertions with comment payload; rename queue mocks |
| `test/integration/webhook-route.test.ts` | Modify | Replace follow payloads with comment payloads |
| `test/unit/hmac-validator.test.ts` | Modify | Remove `hashApiKey` test suite; keep `verifyInstagramSignature` tests |
| `test/unit/keyword-match.test.ts` | **Create** | Unit tests: exact match, case-insensitive, word boundary, no partial match, empty keyword guard |
| `src/middleware/api-key-auth.ts` | **Delete** | Dead code — no API routes remain |
| `prisma/seed.ts` | **Delete** | Dead code — no API keys to seed |
| `src/queues/follow-queue.ts` | **Delete** | Replaced by comment-queue.ts |

## Interfaces / Contracts

### Comment webhook payload (Instagram → Us)

```json
{
  "object": "instagram",
  "entry": [{
    "id": "BUSINESS_ACCOUNT_ID",
    "time": 1716124800,
    "changes": [{
      "field": "comments",
      "value": {
        "media": { "id": "MEDIA_ID" },
        "comment": {
          "id": "COMMENT_ID",
          "created_time": 1716124800,
          "text": "BASUSTA",
          "from": { "id": "1234567890", "username": "user" }
        }
      }
    }]
  }]
}
```

### `keyword-match.ts`

```typescript
export function matchesKeyword(text: string, keyword: string): boolean {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(?:^|\\W)${escaped}(?:$|\\W)`, 'i');
  return regex.test(text);
}
```

### CommentEventJob (BullMQ)

```typescript
export interface CommentEventJob {
  instagramUserId: string;
  commentText: string;
  commentId: string;
  mediaId?: string;
  rawPayload: Record<string, unknown>;
  webhookEventId: string;
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `matchesKeyword` — exact, case-insensitive, word boundary, no partial | Vitest, table-driven, 9 cases from spec |
| Unit | `verifyInstagramSignature` — valid/invalid/length mismatch | Vitest (existing tests, keep) |
| Unit | Comment webhook schema validation | Vitest (updated from current follow tests) |
| Unit | `buildWelcomeMessage` — static code interpolation | Vitest (existing test) |
| Unit | `hashApiKey` tests | **Remove** — function deleted |
| Integration | POST /webhooks/instagram — ACK, enqueue on keyword, discard on no keyword | Supertest + mock BullMQ |
| Integration | GET /webhooks/instagram — handshake | Supertest (existing tests, keep) |
| Integration | GET /health — queue names updated | Supertest (existing tests, modify) |

## Migration / Rollout

### Migration strategy

1. `prisma db push` — sync schema to dev (create `instagram_comments`, `dm_records`, drop `api_keys`)
2. `prisma migrate dev --name v3_comment_flow` — generate migration from schema diff
3. Review generated SQL
4. Apply via `prisma migrate deploy` in staging/production

### Preflight checklist

- [ ] Drain existing `instagram-follow` queue via BullMQ dashboard or Redis CLI
- [ ] Set `TRIGGER_KEYWORD` env var in all environments
- [ ] Remove `API_KEY_HASH_SECRET` from all environments
- [ ] Confirm `api_keys` table has no active consumers before dropping

### Rollback

1. Revert migration (restore `api_keys`, drop `instagram_comments` + `dm_records`)
2. Git revert source changes
3. Restore `API_KEY_HASH_SECRET` env var

## Open Questions

- None — all design decisions resolved in codebase analysis
