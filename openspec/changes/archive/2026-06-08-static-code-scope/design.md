# Design: Static Discount Code Scope

## Technical Approach

Replace the dynamic per-follower discount code system (`WELCOME-XXXXXXXX`) with a single static code configured via `STATIC_DISCOUNT_CODE` env var. The code is displayed in DMs and redeemed verbally on-site — no database storage, no generation logic, no validation endpoints.

## Architecture Decisions

### Decision: Static code via env var with fail-fast validation

**Choice**: Require `STATIC_DISCOUNT_CODE` at startup; reject if missing/empty.
**Alternatives considered**: Lazy lookup (delays error to first use), optional with fallback (hides misconfiguration).
**Rationale**: Fail-fast prevents silent misbehavior. Discount codes are core to the product — misconfiguration should crash immediately.

### Decision: Remove CodeEngine service entirely

**Choice**: Delete `src/services/code-engine.ts` — no code generation, no collision handling.
**Alternatives considered**: Keep but make no-op (confusing), extract to separate package (overkill).
**Rationale**: CodeEngine only served the dynamic code pattern. With static codes, it has zero callers.

### Decision: Remove `/api/v1/codes/*` routes entirely

**Choice**: Delete routes for validate and redeem — codes are redeemed verbally.
**Alternatives considered**: Keep routes as no-ops (misleading), deprecate with 410 (maintains dead code).
**Rationale**: Endpoints that do nothing are worse than absent endpoints. Cleaner to remove.

### Decision: Simplify DM job to no database updates

**Choice**: `DmDispatchJob` carries `instagramUserId` only; no `discountCodeId`, no `code` in job data.
**Alternatives considered**: Keep job data but stop writing to DB (still creates unused records).
**Rationale**: No code stored → no update needed. Message built from env var at dispatch time.

## Data Flow

```
Webhook → webhook-processor → follow-queue → worker → dm-queue → DM sent
                ↓                                      ↓
         (upsert follower)                    (static code from env)
```

**Before**: Webhook → generate code → create DB record → queue DM job → update DB → send DM
**After**: Webhook → upsert follower → queue DM job → send DM (static code from env)

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `prisma/schema.prisma` | Modify | Remove `DiscountCode` model, `DiscountStatus` enum, `discountCodes` relation on `InstagramFollower` |
| `src/config/env.ts` | Modify | Add `STATIC_DISCOUNT_CODE: z.string().min(1)` to schema; fail-fast on missing |
| `src/config/constants.ts` | Modify | Remove `CODE_MAX_RETRIES`, `CODE_EXPIRY_DAYS`, `SAFE_ALPHABET`, `CODE_FORMAT_REGEX`; update `DM_WELCOME_TEMPLATE` to exclude URL |
| `src/services/code-engine.ts` | Delete | Entire file — code generation removed |
| `src/routes/api/codes.ts` | Delete | Entire file — validate/redeem endpoints removed |
| `src/routes/api/codes.schema.ts` | Delete | Entire file — schema dependencies removed |
| `src/services/webhook-processor.ts` | Modify | Remove code generation, DB creation, existing-code check; queue job with only `instagramUserId` |
| `src/queues/dm-queue.ts` | Modify | `DmDispatchJob` becomes `{ instagramUserId: string }` — no code fields |
| `src/queues/job-handlers.ts` | Modify | Remove `CodeEngine` dependency; `processDmDispatchJob` builds message from env |
| `src/worker.ts` | Modify | Remove `CodeEngine` instantiation; pass only `instagramUserId` to job |
| `src/app.ts` | Modify | Remove `codesRoutes` import and registration |
| `prisma/seed.ts` | Modify | Remove discount code seeding |
| `src/plugins/swagger.ts` | Modify | Update description (remove "discount code generation") |
| `test/fixtures/test-helpers.ts` | Modify | Remove `discountCode` mock from `createMockPrisma` |
| `test/routes/api/codes.test.ts` | Delete | Entire file |
| `test/unit/code-engine.test.ts` | Delete | Entire file |
| `test-redeem.mjs` | Delete | Entire file |

## Interfaces / Contracts

### env.ts changes

```typescript
// Added
STATIC_DISCOUNT_CODE: z.string().min(1),

// Removed
STORE_BASE_URL: z.string().url(), // No longer needed in DM
```

### dm-queue.ts job interface

```typescript
// Before
export interface DmDispatchJob {
  discountCodeId: string;
  instagramUserId: string;
  code: string;
}

// After
export interface DmDispatchJob {
  instagramUserId: string;
}
```

### build-message.ts

```typescript
// Before
export function buildWelcomeMessage(code: string, storeUrl: string): string

// After
export function buildWelcomeMessage(): string  // Uses env.STATIC_DISCOUNT_CODE
```

### DM template (constants.ts)

```typescript
// Before
DM_WELCOME_TEMPLATE = (code, storeUrl) => `...${code}...${storeUrl}?code=${code}...`

// After — static code only, no URL
DM_WELCOME_TEMPLATE = () => `¡Gracias por seguirnos! 🎉

Acá tenés tu código de descuento exclusivo:

🏷️ ${STATIC_DISCOUNT_CODE}

Usalo en nuestra tienda para obtener un 3% de descuento.

¡Gracias por ser parte de nuestra comunidad!`
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `buildMessage()` renders correct static code | Direct import, assert template output |
| Unit | `env.ts` startup validation | Mock `process.env`, assert throws on missing |
| Integration | Follow event → DM job queued with correct `instagramUserId` | Queue mock, verify job data shape |
| Integration | DM dispatch sends correct message | DM dispatcher mock, assert message contains static code |

## Migration / Rollout

1. **Prisma migration**: `npx prisma migrate dev` to drop `discount_codes` table
2. **Deploy order**: App must have `STATIC_DISCOUNT_CODE` set before running — validate on startup
3. **No data migration needed**: Existing codes become inert (per proposal decision)

## Open Questions

None — all decisions resolved in proposal/spec phase.