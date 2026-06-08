# Proposal: Static Discount Code Scope

## Intent

Replace the dynamic per-follower discount code system (`WELCOME-XXXXXXXX`) with a single static code (`DESCUENTO_INSTAGRAM`) configured via environment variable. The existing unique-code generation, validation, and redemption infrastructure is entirely removed — the code is now displayed in DMs and redeemed verbally at the camping location.

## Scope

### In Scope
- Configure static code via `STATIC_DISCOUNT_CODE` env var (no code generation)
- Remove `DiscountCode` Prisma model, `DiscountStatus` enum, and `discountCodes` relation
- Delete code-engine service, codes API routes, and related test files
- Remove `/api/v1/codes/validate` and `/api/v1/codes/redeem` endpoints
- Simplify DM message: static code only, no store URL
- Update webhook processor, job handlers, worker, and app bootstrap
- Clean up constants, seed script, swagger docs, test helpers

### Out of Scope
- Data migration of existing discount codes (codes become inert)
- Any new discount redemption flow (redeemed verbally on-site)
- Additional configuration UI for the static code

## Capabilities

### New Capabilities
- `static-discount-config`: Static discount code configuration via environment variable

### Modified Capabilities
- `follower-dm`: DM message content changes — static code instead of unique code + URL

## Approach

1. **DB Schema**: Drop `DiscountCode` model, `DiscountStatus` enum, and `discountCodes` relation from Prisma schema
2. **Config**: Add `STATIC_DISCOUNT_CODE` to environment configuration; remove `DISCOUNT_CODE_LENGTH`, `CODE_CHARSET`, `DISCOUNT_EXPIRY_DAYS`
3. **Code Removal**: Delete `code-engine.ts`, `routes/api/codes.ts`, `routes/api/codes.schema.ts`, `test-redeem.mjs`
4. **DM Message**: Update `build-message.ts` to render static code without store URL
5. **Worker/Handlers**: Remove code validation from `worker.ts`, `job-handlers.ts`, `webhook-processor.ts`
6. **Tests**: Delete `test/routes/api/codes.test.ts`, `test/unit/code-engine.test.ts`; simplify `test-helpers.ts`
7. **Swagger**: Remove code endpoints from `swagger.ts`

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `prisma/schema.prisma` | Modified | Drop DiscountCode model, DiscountStatus enum, discountCodes relation |
| `constants.ts` | Modified | Remove code generation constants; add STATIC_DISCOUNT_CODE |
| `code-engine.ts` | Removed | Entire file deleted |
| `routes/api/codes.ts` | Removed | Entire file deleted |
| `routes/api/codes.schema.ts` | Removed | Entire file deleted |
| `build-message.ts` | Modified | Simplify to static code without URL |
| `job-handlers.ts` | Modified | Remove code validation flow |
| `worker.ts` | Modified | Remove code validation entry point |
| `webhook-processor.ts` | Modified | Remove code redemption handling |
| `app.ts` | Modified | Remove codes router registration |
| `seed.ts` | Modified | Remove discount code seeding |
| `swagger.ts` | Modified | Remove code endpoints |
| `test-helpers.ts` | Modified | Remove code test utilities |
| `test/routes/api/codes.test.ts` | Removed | Entire file deleted |
| `test/unit/code-engine.test.ts` | Removed | Entire file deleted |
| `test-redeem.mjs` | Removed | Entire file deleted |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Env var not set at runtime | Low | Validate on startup; fail fast with clear error |
| Existing codes in flight become invalid | Low | Acceptable — no data migration needed per user request |

## Rollback Plan

1. Revert Prisma schema: re-add `DiscountCode` model and `DiscountStatus` enum
2. Restore `code-engine.ts`, `routes/api/codes.ts`, `routes/api/codes.schema.ts`
3. Restore test files and test helpers
4. Revert `build-message.ts`, `constants.ts`, and all modified files
5. Run `npx prisma migrate deploy` to restore DB schema

## Dependencies

- `STATIC_DISCOUNT_CODE` env var must be set in all environments
- Prisma migration to drop the `discountCodes` table

## Success Criteria

- [ ] `STATIC_DISCOUNT_CODE` env var is validated on startup
- [ ] `DiscountCode` table and `discountCodes` relation removed from schema
- [ ] All code generation/validation endpoints removed
- [ ] DM messages display static code without store URL
- [ ] ~466 lines of test code removed
- [ ] Application starts and functions without discount code tables