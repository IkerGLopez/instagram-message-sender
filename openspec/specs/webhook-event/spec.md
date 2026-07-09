# webhook-event Specification

## Purpose

Webhook event schema and processing — timestamp columns, status transitions, and processor behavior.

## Requirements

### Requirement: Timestamp Columns

WebhookEvent MUST use `receivedAt` (DateTime, @default(now())) and `processedAt` (DateTime?, nullable, @db.Timestamptz). `createdAt` and `updatedAt` SHALL be removed.

| Scenario | Given | When | Then |
|---|---|---|---|
| New event created | Webhook received | Event saved to DB | receivedAt=now(), processedAt=null |
| Event processed | Event has status PENDING | Processor marks PROCESSED | processedAt set to current timestamp |

### Requirement: Processor Sets processedAt

WebhookProcessor.processCommentEvent() MUST set `processedAt` to `new Date()` when updating WebhookEvent status to PROCESSED.
