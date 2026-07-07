# keyword-matching Specification

## Purpose

Detects a configured trigger keyword in Instagram comment text using case-insensitive, word-boundary-aware matching. Configurable via `TRIGGER_KEYWORD` env var.

## Requirements

### Requirement: Keyword Detection

The system MUST compare each incoming comment text against the trigger keyword. Comments without the keyword MUST be discarded without DM dispatch.

| Scenario | Given | Comment | Then |
|---|---|---|---|
| Exact match | TRIGGER_KEYWORD="BASUSTA" | "BASUSTA" | Keyword detected; event proceeds |
| No match | TRIGGER_KEYWORD="BASUSTA" | "me gusta!" | NOT detected; event discarded |

### Requirement: Case-Insensitive Matching

The system MUST match the keyword case-insensitively.

| Scenario | Given | Comment | Then |
|---|---|---|---|
| Lowercase | TRIGGER_KEYWORD="BASUSTA" | "basusta" | Detected |
| Mixed case | TRIGGER_KEYWORD="BASUSTA" | "BasuSta" | Detected |

### Requirement: Word-Boundary Enforcement

The system MUST NOT match partial words. A keyword match SHALL only occur when delimited by whitespace, punctuation, or string boundaries.

| Scenario | Given | Comment | Then |
|---|---|---|---|
| Partial word | TRIGGER_KEYWORD="BASUSTA" | "BASUST" | NOT detected |
| Within sentence | TRIGGER_KEYWORD="BASUSTA" | "quiero BASUSTA por favor" | Detected |
| Trailing punctuation | TRIGGER_KEYWORD="BASUSTA" | "BASUSTA!" | Detected |

### Requirement: TRIGGER_KEYWORD Configuration

The system MUST read the trigger keyword from `TRIGGER_KEYWORD` env var. The application MUST fail fast on startup if the variable is missing or empty.

| Scenario | Given | When | Then |
|---|---|---|---|
| Valid config | TRIGGER_KEYWORD="BASUSTA" | App starts | Keyword available |
| Missing config | TRIGGER_KEYWORD unset | App starts | Fails with clear error |
