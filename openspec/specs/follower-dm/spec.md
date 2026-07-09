# follower-dm Specification

## ADDED Requirements

### Requirement: DM Dispatcher Unit Tests

Three unit tests MUST exist per SPECS.md section 8.3, using mocked Instagram API and database.

#### Scenario: Send DM with static code

- GIVEN a mocked Instagram API and a clean database
- WHEN the dispatcher processes a DM job
- THEN the Instagram DM API SHALL be called with the static discount code

#### Scenario: No duplicate DM

- GIVEN a dm_record exists for the instagramUserId
- WHEN another comment from the same user is processed
- THEN no second DM SHALL be sent
- AND the event SHALL be logged as SKIPPED

#### Scenario: Persist dm_record

- GIVEN a DM is sent successfully
- WHEN the dispatcher completes
- THEN a dm_record row MUST exist with discountCode, instagramUserId, and dmSentAt

## MODIFIED Requirements

### Requirement: DM Message Content

The system MUST send a DM to users whose Instagram comments match the trigger keyword, containing only the static discount code without a store URL. The DM template MUST reference a physical establishment ("establecimiento") and mention a 3% discount per SPECS.md section 5.4. A user SHALL receive at most one DM, regardless of how many keyword-matched comments they make.

#### Scenario: Keyword-matched comment triggers DM

- GIVEN a comment webhook is received with text matching the trigger keyword
- AND the commenting user has not previously received a DM
- WHEN the system processes the comment event
- THEN the system MUST send a DM containing only the static discount code
- AND the DM MUST NOT contain a store URL
- AND the DM MUST mention "establecimiento" AND "3%"

#### Scenario: Repeat keyword comment does not send duplicate DM

- GIVEN a user who previously received a discount DM comments again with the keyword
- WHEN the system processes the new comment event
- THEN the system MUST NOT send another DM
- AND the event SHALL be logged as SKIPPED

## REMOVED Requirements

### Requirement: Code Validation Endpoint

(Reason: Static code system does not require validation)

### Requirement: Code Redemption Endpoint

(Reason: Static code is redeemed verbally on-site, not via API)

### Requirement: Unique Code Generation

(Reason: Replaced by static configuration via environment variable)

### Requirement: Discount Code Database Model

(Reason: No discount codes are stored; the system uses a single static code)
