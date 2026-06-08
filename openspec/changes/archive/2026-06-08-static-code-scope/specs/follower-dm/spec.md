# Delta for Follower DM

## MODIFIED Requirements

### Requirement: DM Message Content

The system MUST send a DM to followers containing the static discount code without a store URL.

(Previously: DM contained unique code `WELCOME-XXXXXXXX` plus store URL)

#### Scenario: Follow webhook triggers DM with static code

- GIVEN a follow webhook is received for a user
- WHEN the system processes the follow event
- THEN the system MUST send a DM containing only the static discount code
- AND the DM MUST NOT contain a store URL
- AND the DM text MUST be formatted for Instagram direct messaging

#### Scenario: Re-follow sends same static code DM

- GIVEN a user who previously received a discount DM follows again
- WHEN the system processes the new follow event
- THEN the system MUST send the same static discount code
- AND no unique code SHALL be generated or used

## REMOVED Requirements

### Requirement: Code Validation Endpoint

(Reason: Static code system does not require validation)

### Requirement: Code Redemption Endpoint

(Reason: Static code is redeemed verbally on-site, not via API)

### Requirement: Unique Code Generation

(Reason: Replaced by static configuration via environment variable)

### Requirement: Discount Code Database Model

(Reason: No discount codes are stored; the system uses a single static code)