# Proposal: Complete Implementation Gap Closure

## Intent

Close the ~30% gap between DESIGN.md and the actual codebase. The system is 70% implemented but has critical missing pieces — most urgently, the DM rate limiter that could violate Instagram's 1 msg/sec constraint and get the account banned. Additionally, 8 design-specified files are missing and must be created to achieve a deployable, spec-compliant system.

## Scope

### In Scope
- **Critical**: Add rate limiter to `dmQueue` in `src/plugins/bullmq.ts` — `limiter: { max: 1, duration: 1000 }`
- **Missing files**: Create 8 design-prescribed files
- **Restructure**: Move inline queue definitions to `src/queues/` with proper separation
- **Dockerfile**: Multi-stage production build as specified in design
- **Test infrastructure**: Fix test directory structure to match `test/integration/` convention

### Out of Scope
- Token rotation automation (future work)
- Admin dashboard
- Multi-account support
- Click tracking
- Follow-up sequences

## Capabilities

> This section is the CONTRACT between proposal and specs phases.

### New Capabilities
- `dm-rate-limiter`: Enforce Instagram's 1 msg/sec constraint via BullMQ limiter on the dm-dispatch queue

### Modified Capabilities
- None — this is a structural completion, not a behavioral change

## Approach

1. **Immediate fix** — Add `limiter: { max: 1, duration: 1000 }` to `dmQueue` in `src/plugins/bullmq.ts`
2. **File creation** — Create the 8 missing files in their design-specified locations
3. **Restructure** — Extract inline queue definitions into `src/queues/` modules
4. **Test reorganization** — Rename `test/routes/` → `test/integration/` and add missing fixtures
5. **Dockerfile** — Add multi-stage build from design section 7.2

### Files to Create

| File | Action |
|------|--------|
| `src/queues/follow-queue.ts` | Create |
| `src/queues/dm-queue.ts` | Create (with rate limiter) |
| `src/queues/job-handlers.ts` | Create |
| `src/plugins/swagger.ts` | Create |
| `test/fixtures/webhook-payloads.ts` | Create |
| `test/fixtures/test-db.ts` | Create |
| `test/integration/webhook-route.test.ts` | Create |
| `test/integration/health-route.test.ts` | Create |
| `Dockerfile` | Create |

### Files to Modify

| File | Change |
|------|--------|
| `src/plugins/bullmq.ts` | Add `limiter: { max: 1, duration: 1000 }` to dmQueue |
| `src/worker.ts` | Import and use job handlers from `src/queues/job-handlers.ts` |
| `test/routes/*.test.ts` | Move to `test/integration/` |

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/plugins/bullmq.ts` | Modified | Add rate limiter config |
| `src/queues/` | New | New directory with 3 queue modules |
| `src/plugins/swagger.ts` | New | OpenAPI documentation |
| `test/integration/` | New | Integration test directory |
| `test/fixtures/` | Modified | Add webhook payloads and test-db helpers |
| `Dockerfile` | New | Multi-stage production build |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Rate limiter causes DM backlog | Low | Monitor queue depth; BullMQ handles backpressure |
| Missing env vars in Dockerfile | Low | Multi-stage build copies .env.example, warns if missing |
| Test fixtures diverge from real payloads | Medium | Use actual webhook samples from Instagram Graph API docs |

## Rollback Plan

- **Rate limiter**: Remove `limiter` key from dmQueue config — instant revert
- **New files**: Delete `src/queues/`, `src/plugins/swagger.ts`, `test/integration/`, `test/fixtures/webhook-payloads.ts`, `test/fixtures/test-db.ts`, `Dockerfile`
- **Test reorganization**: Git revert the directory rename
- All changes are additive; rollback is straightforward deletion

## Dependencies

- None — all required dependencies (BullMQ, Fastify, Prisma, etc.) already in package.json

## Success Criteria

- [ ] `dmQueue` has `limiter: { max: 1, duration: 1000 }` configured
- [ ] `src/queues/` contains 3 files: `follow-queue.ts`, `dm-queue.ts`, `job-handlers.ts`
- [ ] `src/plugins/swagger.ts` exists and exports OpenAPI plugin
- [ ] `test/integration/` contains `webhook-route.test.ts` and `health-route.test.ts`
- [ ] `test/fixtures/` contains `webhook-payloads.ts` and `test-db.ts`
- [ ] `Dockerfile` builds successfully with `docker build .`
- [ ] All existing tests pass