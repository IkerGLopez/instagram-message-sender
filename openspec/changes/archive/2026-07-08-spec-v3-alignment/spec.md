# Delta Spec: spec-v3-alignment

Aligns codebase with SPECS.md v3.0.0 across 5 gap groups: Legal (HIGH), WebhookEvent/Processor (MEDIUM), DM Template (MEDIUM), DM Dispatcher Tests (MEDIUM), LOW alignments (schema annotations, analytics fields, health, docs).

## ADDED — Legal Routes

### Requirement: Service Conditions Legal Text
The `/service-conditions` endpoint MUST describe the discount as a static code applicable at a physical establishment, with no single-use restriction and no expiration date.

| Scenario | Given | When | Then |
|---|---|---|---|
| GET returns correct legal text | App running | GET /service-conditions | Response contains: "codigo de descuento fijo", "establecimiento fisico", no mention of "un solo uso", "fecha de expiracion", or "tienda online" |

## ADDED — WebhookEvent Schema

### Requirement: Timestamp Columns
WebhookEvent MUST use `receivedAt` (DateTime, @default(now())) and `processedAt` (DateTime?, nullable, @db.Timestamptz). `createdAt` and `updatedAt` SHALL be removed.

| Scenario | Given | When | Then |
|---|---|---|---|
| New event created | Webhook received | Event saved to DB | receivedAt=now(), processedAt=null |
| Event processed | Event has status PENDING | Processor marks PROCESSED | processedAt set to current timestamp |

### Requirement: Processor Sets processedAt
WebhookProcessor.processCommentEvent() MUST set `processedAt` to `new Date()` when updating WebhookEvent status to PROCESSED.

## MODIFIED — follower-dm

### Requirement: DM Message Content
DM_WELCOME_TEMPLATE MUST include "establecimiento fisico" and "3%" per SPECS.md section 5.4. (Previously: template contained only static code placeholder without physical-store or percentage language.)

| Scenario | Given | When | Then |
|---|---|---|---|
| Welcome message includes spec terms | Static code configured | buildWelcomeMessage() invoked | Output contains "establecimiento" AND "3%" |

## ADDED — follower-dm Tests

### Requirement: DM Dispatcher Unit Tests
Three unit tests MUST exist per SPECS.md section 8.3, using mocked Instagram API and database.

| Scenario | Given | When | Then |
|---|---|---|---|
| Send DM with static code | Mocked IG API, clean DB | Dispatcher processes DM job | Instagram DM API called with static discount code |
| No duplicate DM | dm_record exists for instagramUserId | Process another comment from same user | No second DM sent; event logged as SKIPPED |
| Persist dm_record | DM sent successfully | Dispatcher completes | dm_record row exists with discountCode, instagramUserId, dmSentAt |

## ADDED — Data Model

### Requirement: InstagramFollower Analytics Fields
InstagramFollower MUST include `unfollowedAt` (DateTime?, nullable) and `followCount` (Int, @default(0)).

### Requirement: DB-Native Type Annotations
All Prisma schema String columns MUST specify `@db.VarChar(N)` with appropriate max length. All DateTime columns MUST specify `@db.Timestamptz`.

## ADDED — Health

### Requirement: Health Field Names
`/health` endpoint MUST return `database` (not `postgres`) as the key for PostgreSQL check results. Token sub-object MUST use `instagram_token` key with `status` and `detail` fields.

| Scenario | Given | When | Then |
|---|---|---|---|
| Health response keys match spec | App running, DB up | GET /health | JSON contains `services.database.status` (not `services.postgres`) |

## REMOVED — Documentation

- README.md: remove `seed.ts` reference from project structure tree. (Reason: seed.ts was deleted but README still lists it.)
- SPECS.md section 6.3.2: remove `API_KEY_HASH_SECRET` environment variable entry. (Reason: API key hash mechanism is unused and was never implemented.)
