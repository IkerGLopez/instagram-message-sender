# Delta for follower-dm

## MODIFIED Requirements

### Requirement: DM Message Content

The system MUST send a DM to users whose Instagram comments match the trigger keyword, containing only the static discount code without a store URL. A user SHALL receive at most one DM, regardless of how many keyword-matched comments they make.

(Previously: DM was triggered by follow webhook events. Repeat follows sent another DM with the same code. Now triggered by keyword-matched comment events with deduplication — only one DM per user.)

#### Scenario: Keyword-matched comment triggers DM

- GIVEN a comment webhook is received with text matching the trigger keyword
- AND the commenting user has not previously received a DM
- WHEN the system processes the comment event
- THEN the system MUST send a DM containing only the static discount code
- AND the DM MUST NOT contain a store URL

#### Scenario: Repeat keyword comment does not send duplicate DM

- GIVEN a user who previously received a discount DM comments again with the keyword
- WHEN the system processes the new comment event
- THEN the system MUST NOT send another DM
- AND the event SHALL be logged as SKIPPED
(Previously: re-follow sent another DM with the same static code)
