# Design: Spec v3.0.0 Alignment

## Technical Approach

Five independent gap groups addressed sequentially. Group E DB annotations merge into Group B's migration (single schema change). All changes are local and compile-safe — no API contract breakage.

## Architecture Decisions

| Decision | Choice | Rejected | Rationale |
|---|---|---|---|
| Column rename method | `prisma migrate dev --create-only` + hand-edit to `ALTER TABLE RENAME` | `prisma db push` or auto-generated DROP+ADD | RENAME preserves `createdAt` values as `receivedAt`. Auto-generated migration does DROP+ADD which loses data |
| Single migration for B+E | One migration covering rename, new columns, DB annotations | Separate migrations per group | Reduces migration count; all schema changes are additive/rename — no conflicting operations |
| DM Dispatcher test target | Test `processDmDispatchJob()` (the queue handler) | Test `DMDispatcher` class directly | The job handler is the integration point where idempotency and persistence live; DMDispatcher is a thin axios wrapper |
| Health token structure | Keep existing `instagram_token: { status, detail }` format | Flat `instagram_token_valid` boolean | Current code already matches delta spec object format; only `postgres`→`database` rename needed |

## Data Flow

```
Webhook arrives → WebhookProcessor sets processedAt on WebhookEvent.update()
                                            ↑ NEW: processedAt: new Date()
                                            ↓
              → DM Queue → processDmDispatchJob (job-handlers.ts)
                    ├─ findFirst dmRecord → SKIP if exists (idempotency)
                    ├─ sendWelcomeMessage → Instagram API
                    └─ dmRecord.create     → persists dmMessageId, discountCode
```

## File Changes

| File | Action | Change |
|------|--------|--------|
| `src/routes/legal.ts` | Modify | Replace §3 `<li>` items (lines 82-84): remove "un solo uso", "fecha de expiración", "tienda online"; insert static-code, physical-establishment, manual-application text |
| `prisma/schema.prisma` | Modify | `WebhookEvent`: rename `createdAt`→`receivedAt` (map `created_at`→`received_at`), remove `updatedAt`, add `processedAt` (DateTime?, nullable, @db.Timestamptz), rename index. `InstagramFollower`: add `unfollowedAt` (DateTime?), `followCount` (Int @default(1)). ALL models: add `@db.VarChar(N)` on String columns, `@db.Timestamptz` on DateTime columns. See SPECS.md §4.2 for exact lengths |
| `prisma/migrations/*_rename_webhook_columns/migration.sql` | Create+Edit | Hand-edit generated migration: `ALTER TABLE webhook_events RENAME COLUMN created_at TO received_at; ALTER TABLE webhook_events DROP COLUMN updated_at; ALTER TABLE webhook_events ADD COLUMN processed_at TIMESTAMPTZ;` + new columns/annotations for all other tables |
| `src/services/webhook-processor.ts` | Modify | Add `processedAt: new Date()` to `webhookEvent.update()` data object (line 44-48) |
| `src/config/constants.ts` | Modify | Replace `DM_WELCOME_TEMPLATE` (lines 3-9) with template from SPECS.md §5.4: "establecimiento", "3%", `*{CODE}*`, `¡Hola! 👋`, `¡Te esperamos! 💙` |
| `src/health/health.ts` | Modify | Line 15: `health.postgres`→`health.database`. Token field already matches spec object format — no change needed |
| `test/unit/dm-dispatcher.test.ts` | Create | 3 tests for `processDmDispatchJob()` using mocked Prisma + DMDispatcher (details below) |
| `README.md` | Modify | Line 150: remove `prisma/seed.ts` line from project structure tree |
| `specs/SPECS.md` | Modify | §6.3.2: remove `API_KEY_HASH_SECRET` env variable entry (line 716) |

## Test Strategy: Group D

**Target**: `src/queues/job-handlers.ts` → `processDmDispatchJob()`  
**Mock strategy**: `vi.mock('@/services/dm-dispatcher.js')` replaces DMDispatcher class; `createMockPrisma()` from test-helpers provides DB mocks. Build a mock BullMQ `Job` with `{ data: { instagramUserId, commentId, mediaId } }`.

| Test | Mock Setup | Assertion |
|------|-----------|-----------|
| Send DM with static code | `dmRecord.findFirst` → `null`; `sendWelcomeMessage` → `{ messageId: 'mid.123' }` | `sendWelcomeMessage` called with userId + text containing `env.STATIC_DISCOUNT_CODE`; `dmRecord.create` called with correct fields |
| No duplicate DM (idempotency) | `dmRecord.findFirst` → `{ id: 'x', dmMessageId: 'existing' }` | `sendWelcomeMessage` NOT called; function returns without creating record |
| Persist dm_record | `dmRecord.findFirst` → `null`; `sendWelcomeMessage` → `{ messageId: 'mid.456' }` | `dmRecord.create` called with `{ instagramUserId, discountCode, dmMessageId }` matching expected values |

File: `test/unit/dm-dispatcher.test.ts`. Vitest `@/` alias resolves to `src/`.

## Migration / Rollout

**Migration (UP)**:
```sql
-- Rename preserves existing createdAt values as receivedAt
ALTER TABLE webhook_events RENAME COLUMN created_at TO received_at;
ALTER TABLE webhook_events DROP COLUMN updated_at;
ALTER TABLE webhook_events ADD COLUMN processed_at TIMESTAMPTZ;
-- InstagramFollower additions + type annotation ALTERs for all tables
```

**Rollback (DOWN)**:
```sql
ALTER TABLE webhook_events RENAME COLUMN received_at TO created_at;
ALTER TABLE webhook_events DROP COLUMN processed_at;
ALTER TABLE webhook_events ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
-- Reverse annotations + drop unfollowedAt/followCount columns
```

**Downtime**: None required. Column renames are O(1) catalog changes in PostgreSQL. Run in low-traffic window. After deploy, `prisma generate` must succeed before any TypeScript compilation.

## Execution Order

1. **Group A** (legal.ts) — no dependencies, can run first or parallel with C
2. **Group B + E schema** (prisma schema + migration + webhook-processor) — single migration, followed by `prisma generate` and build verification
3. **Group C** (constants.ts template) — no dependencies, but should complete before D if tests assert template wording
4. **Group D** (tests) — verify that C template appears in DM and B idempotency works
5. **Group E docs** (README, SPECS.md) — no dependencies, last

Groups A and C can be done in parallel. Groups B+E and D depend on B+E being complete first.

## Open Questions

- [ ] Who reviews the legal text change to ensure it matches the physical establishment's actual discount policy?
- [ ] Is the monitoring dashboard querying `services.postgres` directly? If so, update it BEFORE deploying the health rename.

## Risk Mitigation

| Risk | Mitigation | Verification |
|------|-----------|-------------|
| Column rename breaks Prisma client | `prisma generate` must succeed post-schema change | Run `tsc --noEmit` on full codebase after generate |
| Health field rename breaks monitoring | Coordinate with ops; if using uptime robots, update check before deploy | Verify `/health` response shape in staging |
| Legal text is public-facing | Mirror spec language exactly; stakeholder sign-off | Manual review of rendered `/service-conditions` HTML |
