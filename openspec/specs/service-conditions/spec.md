# service-conditions Specification

## Purpose

Legal text endpoint describing the terms of service and discount conditions.

## Requirements

### Requirement: Service Conditions Legal Text

The `/service-conditions` endpoint MUST describe the discount as a static code applicable at a physical establishment, with no single-use restriction and no expiration date.

| Scenario | Given | When | Then |
|---|---|---|---|
| GET returns correct legal text | App running | GET /service-conditions | Response contains: "codigo de descuento fijo", "establecimiento fisico", no mention of "un solo uso", "fecha de expiracion", or "tienda online" |
