# Static Discount Configuration Specification

## Purpose

Configure a single static discount code via environment variable, replacing the removed dynamic per-follower code generation system.

## Requirements

### Requirement: Static Code Environment Variable

The system MUST read the static discount code from the `STATIC_DISCOUNT_CODE` environment variable.

### Requirement: Startup Validation

The application MUST validate that `STATIC_DISCOUNT_CODE` is set on startup and MUST fail fast with a clear error message if it is missing or empty.

### Requirement: No Code Generation

The system MUST NOT generate unique discount codes per follower. No code generation logic, character set selection, or expiry handling SHALL exist.

### Requirement: Code Availability

The system MUST make the static discount code available to all downstream components (webhook processor, job handlers, DM builder) without database lookups.

## Scenarios

#### Scenario: Application starts with valid env var

- GIVEN `STATIC_DISCOUNT_CODE` is set to `"DESCUENTO_INSTAGRAM"`
- WHEN the application starts
- THEN the application initializes successfully
- AND the static code `"DESCUENTO_INSTAGRAM"` is available for use

#### Scenario: Application starts without env var

- GIVEN `STATIC_DISCOUNT_CODE` is not set or is empty
- WHEN the application starts
- THEN the application MUST fail immediately
- AND display error: "STATIC_DISCOUNT_CODE environment variable is required"