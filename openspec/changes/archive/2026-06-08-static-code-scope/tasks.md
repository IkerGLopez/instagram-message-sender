# Tasks: Static Discount Code Scope

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~300-450 (deletions dominate) |
| 400-line budget risk | Medium |
| Chained PRs recommended | No |
| Suggested split | Single PR acceptable |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Full implementation | PR 1 | All phases, single focused PR |

## Phase 1: Delete Unused Files

- [x] 1.1 Delete `src/services/code-engine.ts` — code generation service no longer needed
- [x] 1.2 Delete `src/routes/api/codes.ts` — validate/redeem endpoints removed
- [x] 1.3 Delete `src/routes/api/codes.schema.ts` — schema dependencies removed
- [x] 1.4 Delete `test/routes/api/codes.test.ts` — endpoint tests removed
- [x] 1.5 Delete `test/unit/code-engine.test.ts` — code engine unit tests removed
- [x] 1.6 Delete `test-redeem.mjs` — standalone redemption test script removed

## Phase 2: Constants and Environment

- [x] 2.1 Update `src/config/constants.ts` — remove `CODE_MAX_RETRIES`, `CODE_EXPIRY_DAYS`, `SAFE_ALPHABET`, `CODE_FORMAT_REGEX`
- [x] 2.2 Update `src/config/constants.ts` — simplify `DM_WELCOME_TEMPLATE` to static code only, no URL
- [x] 2.3 Update `src/config/env.ts` — add `STATIC_DISCOUNT_CODE: z.string().min(1)` with fail-fast validation

## Phase 3: Message Builder

- [x] 3.1 Update `src/services/build-message.ts` — `buildWelcomeMessage()` takes no parameters, reads `env.STATIC_DISCOUNT_CODE`

## Phase 4: Prisma Schema

- [x] 4.1 Update `prisma/schema.prisma` — remove `DiscountCode` model
- [x] 4.2 Update `prisma/schema.prisma` — remove `DiscountStatus` enum
- [x] 4.3 Update `prisma/schema.prisma` — remove `discountCodes` relation from `InstagramFollower`
- [x] 4.4 Run `npx prisma generate` to update client
- [ ] 4.5 Run `npx prisma migrate dev` to drop table (or deploy migration)

## Phase 5: Queue and Job Handlers

- [x] 5.1 Update `src/queues/dm-queue.ts` — `DmDispatchJob` becomes `{ instagramUserId: string }` only
- [x] 5.2 Update `src/queues/job-handlers.ts` — remove `CodeEngine` dependency, build message from env

## Phase 6: Webhook Processor

- [x] 6.1 Update `src/services/webhook-processor.ts` — remove code generation, DB creation, existing-code check
- [x] 6.2 Update `src/services/webhook-processor.ts` — queue job with only `instagramUserId`

## Phase 7: Worker

- [x] 7.1 Update `src/worker.ts` — remove `CodeEngine` instantiation
- [x] 7.2 Update `src/worker.ts` — pass only `instagramUserId` to DM job

## Phase 8: App Bootstrap

- [x] 8.1 Update `src/app.ts` — remove `codesRoutes` import and registration

## Phase 9: Supporting Files

- [x] 9.1 Update `prisma/seed.ts` — remove discount code seeding logic
- [x] 9.2 Update `src/plugins/swagger.ts` — update description, remove code endpoints
- [x] 9.3 Update `test/fixtures/test-helpers.ts` — remove `discountCode` mock from `createMockPrisma`

## Phase 10: Test Updates

- [x] 10.1 Update webhook integration tests — remove code-related assertions and mock code engine
- [x] 10.2 Verify all tests pass with `npm test`

## Verification Criteria

- [x] Application starts only when `STATIC_DISCOUNT_CODE` env var is set
- [x] Application fails fast with clear error if `STATIC_DISCOUNT_CODE` is missing
- [ ] `npx prisma migrate dev` succeeds (table dropped)
- [x] `npm test` passes with no code-related test failures
- [x] DM message contains static code only, no URL

(End at line 88 - total 88 lines)