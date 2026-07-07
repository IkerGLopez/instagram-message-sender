# Tasks: Spec v3.0.0 Alignment

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~150 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

## Phase 1: Schema Foundation

- [x] T1 — Prisma migration: WebhookEvent rename + InstagramFollower fields + DB annotations (B+E)
  **Files**: `prisma/schema.prisma`, new migration SQL
  **Change**: Rename `createdAt`→`receivedAt` (WebhookEvent), remove `updatedAt`, add `processedAt` (DateTime?, nullable, @db.Timestamptz). Add `unfollowedAt` (DateTime?) + `followCount` (Int @default(0)) to InstagramFollower. Add `@db.VarChar(N)` on all String columns per SPECS.md §4.2, `@db.Timestamptz` on all DateTime columns. Hand-edit generated migration to use ALTER TABLE RENAME (preserves data).
  **Verify**: `prisma migrate dev` + `prisma generate` + `tsc --noEmit`
  **Group**: B+E | **Depends on**: none | **Est.** ~40 lines

- [x] T2 — Set `processedAt` in webhook-processor
  **Files**: `src/services/webhook-processor.ts`
  **Change**: Add `processedAt: new Date()` to `webhookEvent.update()` data object (line 44-47 block).
  **Verify**: `tsc --noEmit`; inspect update call includes `processedAt` field
  **Group**: B | **Depends on**: T1 | **Est.** ~2 lines

## Phase 2: Application Logic

- [x] T3 — Fix `/service-conditions` legal text (§3)
  **Files**: `src/routes/legal.ts`
  **Change**: Replace §3 `<li>` items (lines 82-84): remove "un solo uso", "fecha de expiración", "tienda online". Insert static-code, physical-establishment, manual-application text per delta spec.
  **Verify**: Start app → `curl localhost:PORT/service-conditions` → HTML contains "codigo de descuento fijo", no mention of "un solo uso"
  **Group**: A | **Depends on**: none | **Est.** ~6 lines

- [x] T4 — Update DM_WELCOME_TEMPLATE wording
  **Files**: `src/config/constants.ts`
  **Change**: Replace template (lines 1-9) with wording from SPECS.md §5.4: include "establecimiento", "3%", `*{CODE}*`, `¡Hola! 👋`, `¡Te esperamos! 💙`.
  **Verify**: `tsc --noEmit`; buildWelcomeMessage() output contains "establecimiento" AND "3%"
  **Group**: C | **Depends on**: none | **Est.** ~8 lines

## Phase 3: Health & Docs

- [x] T5 — Rename health field `postgres`→`database`
  **Files**: `src/health/health.ts`
  **Change**: Lines 15, 18: `health.postgres` → `health.database`.
  **Verify**: `curl localhost:PORT/health` → JSON key is `services.database` (not `services.postgres`)
  **Group**: E | **Depends on**: none | **Est.** ~4 lines

- [x] T6 — Remove stale references from README + SPECS.md
  **Files**: `README.md`, `specs/SPECS.md`
  **Change**: Remove `prisma/seed.ts` line from README project structure tree. Remove `API_KEY_HASH_SECRET` env variable entry from SPECS.md §6.3.2.
  **Verify**: `rg "seed\.ts" README.md` → no results. `rg "API_KEY_HASH_SECRET" specs/SPECS.md` → no results.
  **Group**: E | **Depends on**: none | **Est.** ~4 lines

## Phase 4: Tests

- [x] T7 — Test: DM dispatch with static discount code
  **Files**: `test/unit/dm-dispatcher.test.ts` (create)
  **Change**: Mock `dmRecord.findFirst`→`null`, `sendWelcomeMessage`→`{ messageId: 'mid.123' }`. Assert `sendWelcomeMessage` called with userId + text containing `STATIC_DISCOUNT_CODE`; `dmRecord.create` called with `{ instagramUserId, discountCode, dmMessageId }`.
  **Verify**: `npx vitest run test/unit/dm-dispatcher.test.ts`
  **Group**: D | **Depends on**: T1, T2 | **Est.** ~25 lines

- [x] T8 — Test: No duplicate DM (idempotency guard)
  **Files**: `test/unit/dm-dispatcher.test.ts`
  **Change**: Mock `dmRecord.findFirst`→existing record. Assert `sendWelcomeMessage` NOT called; handler returns without creating new record.
  **Verify**: `npx vitest run test/unit/dm-dispatcher.test.ts`
  **Group**: D | **Depends on**: T1, T2 | **Est.** ~25 lines

- [x] T9 — Test: Persist dm_record after successful send
  **Files**: `test/unit/dm-dispatcher.test.ts`
  **Change**: Mock `dmRecord.findFirst`→`null`, `sendWelcomeMessage`→`{ messageId: 'mid.456' }`. Assert `dmRecord.create` called with `{ instagramUserId, discountCode, dmMessageId }` matching expected values.
  **Verify**: `npx vitest run test/unit/dm-dispatcher.test.ts`
  **Group**: D | **Depends on**: T1, T2 | **Est.** ~25 lines
