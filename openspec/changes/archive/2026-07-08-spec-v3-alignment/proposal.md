# Proposal: Align Codebase with Spec v3.0.0

## Intent

The codebase has 10 gaps against specs/SPECS.md v3.0.0 — one HIGH (legal risk in public-facing text), four MEDIUM, and five LOW. This change brings the implementation into full compliance. No new features; purely alignment debt.

## Scope

### In Scope
- Fix `/service-conditions` legal text: "un solo uso", "fecha de expiración", "tienda online" → physical store, static code, manual discount
- Rename `WebhookEvent.createdAt/updatedAt` → `receivedAt/processedAt` + set `processedAt` in processor
- Update `DM_WELCOME_TEMPLATE` to include "establecimiento físico" and "3%" per §5.4
- Add DM Dispatcher tests: send DM with code, no duplicate DM, persist dm_record (§8.3)
- Add `unfollowedAt` + `followCount` to `InstagramFollower` schema
- Add `@db.VarChar(N)` / `@db.Timestamptz` annotations to Prisma schema
- Align health endpoint: `postgres` → `database`, restructure token fields per spec
- Remove `seed.ts` from README; remove `API_KEY_HASH_SECRET` from SPECS.md

### Out of Scope
- New features, DM flow changes, code validation/redemption APIs

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `follower-dm`: DM Message Content requirement expanded to require "establecimiento físico" and "3%" mention per SPECS.md §5.4 template.

## Approach

1. **Legal (HIGH)**: Replace `src/routes/legal.ts` §3 text with physical-store/static-code language.
2. **Schema migration**: Rename `WebhookEvent` columns, add `InstagramFollower` fields, apply DB-native types.
3. **Code fixes**: Set `processedAt`, update template, align health fields.
4. **Tests**: Add 3 mocked DM Dispatcher unit tests.
5. **Docs**: Fix README and SPECS.md.

## Affected Areas

| Area | Impact |
|------|--------|
| `src/routes/legal.ts` | Modified — §3 discount text |
| `prisma/schema.prisma` | Modified — columns, fields, annotations |
| `src/services/webhook-processor.ts` | Modified — set processedAt |
| `src/config/constants.ts` | Modified — DM_WELCOME_TEMPLATE |
| `src/health/health.ts` | Modified — field names |
| `test/unit/dm-dispatcher.test.ts` | New — 3 tests |
| `README.md` | Modified — remove seed.ts ref |
| `specs/SPECS.md` | Modified — remove API_KEY_HASH_SECRET |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Column rename requires downtime | Medium | Run migration in low-traffic window |
| Legal text is public-facing — wrong wording = liability | Low | Mirror spec language exactly; stakeholder review |
| Health field rename breaks monitoring | Low | Coordinate field name update with ops |

## Rollback Plan

Revert migration + git revert. No data loss — column renames are structural only.

## Dependencies

None.

## Success Criteria

- [ ] Legal text: static code, physical store, manual, no expiry/online
- [ ] `WebhookEvent` uses `receivedAt`/`processedAt` with correct timestamps
- [ ] `DM_WELCOME_TEMPLATE` includes "establecimiento físico" and "3%"
- [ ] 3 DM Dispatcher tests pass (send, no-duplicate, persist)
- [ ] Health returns `database` field and structured token info
- [ ] No stale `seed.ts` or `API_KEY_HASH_SECRET` references
