# Apply Progress: cleanup-and-align-v3

## PR 4: Phase 6 — Tests (FINAL)

**Date**: 2026-07-07
**Mode**: Standard (tdd: false)
**Status**: Complete

### Completed Tasks (this batch)

- [x] 6.1 Update `test/fixtures/test-helpers.ts` — replaced `validFollowPayload` with `validCommentPayload` (comment shape with `field: 'comments'`), removed `apiKey` mocks from `createMockPrisma`, added `instagramComment` and `dmRecord` mock methods
- [x] 6.2 Update `test/fixtures/webhook-payloads.ts` — replaced follow payloads with comment payloads (`validCommentPayload`, `noKeywordPayload`, `invalidSignaturePayload`, `malformedPayload`), all matching `WebhookPayloadSchema`
- [x] 6.3 **Create** `test/unit/keyword-match.test.ts` — 14 tests: exact match, case-insensitive, word boundaries, trailing/leading punctuation, partial prefix/suffix rejection, empty text/keyword guards, special regex char handling
- [x] 6.4 Update `test/unit/hmac-validator.test.ts` — removed `hashApiKey` import and test suite (3 tests deleted), updated env mock (removed `API_KEY_HASH_SECRET`, added `TRIGGER_KEYWORD` + `STATIC_DISCOUNT_CODE`)
- [x] 6.5 Update `test/routes/webhooks/instagram.test.ts` — replaced `followQueue` → `commentQueue`, removed `apiKeyAuth` decorator, added keyword-matching discard test, updated env mock to v3.0.0 schema
- [x] 6.6 Update `test/integration/webhook-route.test.ts` — replaced follow payloads with comment payloads, updated test descriptions

### Commits (PR 4)
- `53661f4` test(fixtures): update test helpers and webhook payloads for comment flow
- `4638eaa` test(unit): add keyword-match unit tests
- `78f1d69` test(unit): remove hashApiKey tests from hmac-validator
- `ed4c8a5` test(routes): update instagram webhook route tests for comment flow
- `98f4ae3` test(integration): update webhook integration tests for comment payloads
- `63a92f8` chore(tasks): mark Phase 6 test tasks complete

### Test Results
```
✓ test/unit/keyword-match.test.ts (14 tests)
✓ test/unit/hmac-validator.test.ts (5 tests)
✓ test/routes/webhooks/instagram.test.ts (7 tests)
Total: 3 files | 26 tests | all passed
```

### Build Verdict
tsc exits clean (0 errors). All tests pass. ✅

### Cumulative Task Status

| Phase | Total | Done | Pending |
|-------|-------|------|---------|
| Phase 1 | 4 | 4 | 0 |
| Phase 2 | 5 | 5 | 0 |
| Phase 3 | 7 | 7 | 0 |
| Phase 4 | 6 | 6 | 0 |
| Phase 5 | 7 | 7 | 0 |
| Phase 6 | 6 | 6 | 0 |

**ALL 36/36 tasks complete. 🎉**

### PR Budget
- PR 4: 230 insertions + 70 deletions = 300 changed lines (< 400, OK)
- Cumulative (PR 1+2+3a+3b+4): 562 insertions + 359 deletions = 921 changed lines

### Next Recommended
`sdd-verify` — full verification against specs, then `sdd-archive`
