# health Specification

## Purpose

Health check endpoint returning database connectivity and token status.

## Requirements

### Requirement: Health Field Names

`/health` endpoint MUST return `database` (not `postgres`) as the key for PostgreSQL check results. Token sub-object MUST use `instagram_token` key with `status` and `detail` fields.

| Scenario | Given | When | Then |
|---|---|---|---|
| Health response keys match spec | App running, DB up | GET /health | JSON contains `services.database.status` (not `services.postgres`) |
