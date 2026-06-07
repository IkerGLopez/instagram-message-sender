# SPECS.md — Sistema Automatizado de Retención de Clientes vía Instagram DM

**Versión:** 1.0.0  
**Fecha:** 2026-05-19  
**Estado:** Borrador para Revisión Técnica  
**Clasificación:** Interno — Confidencial

---

## Tabla de Contenidos

1. [Executive Summary](#1-executive-summary)
2. [System Architecture](#2-system-architecture)
3. [Technology Stack](#3-technology-stack)
4. [Data Models](#4-data-models)
5. [API Contract & Webhooks](#5-api-contract--webhooks)
6. [Security & Edge Cases](#6-security--edge-cases)
7. [Deployment & Infrastructure](#7-deployment--infrastructure)
8. [Acceptance Criteria & Testing](#8-acceptance-criteria--testing)
9. [Glosario](#9-glosario)

---

## 1. Executive Summary

### 1.1 Objetivo del Proyecto

Este documento describe la arquitectura técnica y el contrato de integración para un **sistema de retención de clientes de primera interacción** basado en Instagram. El sistema detecta en tiempo real cuando un usuario nuevo sigue la cuenta corporativa de Instagram y responde automáticamente con un Mensaje Directo (DM) personalizado que incluye:

- Un mensaje de bienvenida con tono de marca.
- Un **código de descuento único, de un solo uso**, con validez temporal, equivalente al **3% de descuento** en la tienda online.
- Un **enlace de Call To Action (CTA)** que dirige al usuario a la tienda web con el código pre-aplicado como parámetro URL.

### 1.2 Valor de Negocio

| Dimensión | Impacto Esperado |
|---|---|
| Conversión de nuevos seguidores | Reducción del tiempo entre *follow* y primera compra |
| Experiencia de usuario | Personalización inmediata y automatizada |
| Tasa de abandono | Incentivo económico inmediato (descuento 3%) |
| LTV (Lifetime Value) | Primer punto de contacto transaccional gestionado |

### 1.3 Alcance del Documento

Este SDD cubre el diseño de los siguientes componentes:

- **Webhook Receiver:** Servicio que recibe y procesa los eventos de nuevos seguidores desde la Instagram Graph API.
- **Discount Code Engine:** Módulo de generación y gestión de códigos únicos.
- **Database Layer:** Modelo de datos relacional para el ciclo de vida del código.
- **Validation API:** Endpoint público para que la tienda web verifique códigos en tiempo real.
- **DM Dispatcher:** Módulo de envío de mensajes directos vía Instagram Messenger API.

### 1.4 Fuera del Alcance (Out of Scope)

- Integración con sistemas de CRM (Salesforce, HubSpot, etc.).
- Envío de mensajes de seguimiento (*follow-up*) o secuencias de nurturing.
- Lógica interna del carrito de compra (responsabilidad de la plataforma e-commerce).
- Panel de administración visual (se asume acceso directo a base de datos o herramienta BI).

---

## 2. System Architecture

### 2.1 Descripción del Flujo del Sistema

El flujo de eventos sigue el siguiente orden de operaciones:

1. Un usuario de Instagram realiza la acción de *follow* a la cuenta corporativa.
2. Instagram Graph API emite un evento webhook hacia el endpoint registrado en nuestro backend.
3. El **Webhook Receiver** valida la firma del payload, extrae el `instagram_user_id` del nuevo seguidor y encola el evento para procesamiento asíncrono.
4. El **Worker de Procesamiento** consume el evento de la cola:
   a. Verifica en la base de datos si este usuario ya recibió un código (deduplicación).
   b. Llama al **Discount Code Engine** para generar un código único.
   c. Persiste el registro en la base de datos con estado `ACTIVE`.
   d. Construye el mensaje DM con el copy de bienvenida, el código y el enlace CTA.
   e. Llama a la **Instagram Messenger API** para enviar el DM.
   f. Actualiza el registro con `dm_sent_at` y el `message_id` de confirmación.
5. Cuando el usuario visita el enlace CTA en la tienda web, la plataforma e-commerce consulta el **Validation API** con el código.
6. El Validation API retorna el estado del código (válido/inválido/expirado/ya canjeado).
7. La tienda web aplica o rechaza el descuento según la respuesta.
8. Si el código se aplica en el checkout, la tienda notifica al Validation API para marcar el código como `REDEEMED`.

### 2.2 Diagrama de Secuencia

```mermaid
sequenceDiagram
    actor Usuario as 👤 Usuario de Instagram
    participant IG as Instagram Graph API
    participant WH as Webhook Receiver<br/>(Nuestro Backend)
    participant Queue as Message Queue<br/>(Redis / SQS)
    participant Worker as Processing Worker
    participant DB as Base de Datos<br/>(PostgreSQL)
    participant IGDM as Instagram<br/>Messenger API
    participant Store as Tienda Web<br/>(e-commerce)

    Usuario->>IG: Acción: Follow a cuenta corporativa
    IG->>WH: POST /webhooks/instagram<br/>{event: "follow", user_id: "IG_USER_ID"}
    WH->>WH: Validar firma HMAC-SHA256
    WH->>Queue: Encolar evento de nuevo seguidor
    WH-->>IG: HTTP 200 OK (ACK inmediato)

    Queue->>Worker: Despachar evento
    Worker->>DB: SELECT * FROM discount_codes<br/>WHERE instagram_user_id = 'IG_USER_ID'
    DB-->>Worker: No existe registro → proceder

    Worker->>Worker: Generar código único<br/>WELCOME-[A-Z0-9]{8}
    Worker->>DB: INSERT INTO discount_codes<br/>(user_id, code, status, expires_at)
    DB-->>Worker: OK — registro creado

    Worker->>IGDM: POST /me/messages<br/>{recipient: IG_USER_ID, message: DM_PAYLOAD}
    IGDM-->>Worker: {message_id: "mid.xxx"}
    Worker->>DB: UPDATE discount_codes<br/>SET dm_sent_at = NOW(), message_id = 'mid.xxx'

    Note over Usuario,Store: — Posteriormente, el usuario visita el enlace CTA —

    Usuario->>Store: GET /canjear?code=WELCOME-XXXXXXXX
    Store->>WH: GET /api/v1/codes/validate?code=WELCOME-XXXXXXXX
    WH->>DB: SELECT * FROM discount_codes WHERE code = 'WELCOME-XXXXXXXX'
    DB-->>WH: {status: "ACTIVE", discount_pct: 3, expires_at: "..."}
    WH-->>Store: HTTP 200 {valid: true, discount_percentage: 3}

    Store->>Usuario: Aplica 3% de descuento en carrito

    Usuario->>Store: Completa el checkout
    Store->>WH: POST /api/v1/codes/redeem<br/>{code: "WELCOME-XXXXXXXX", order_id: "ORD-999"}
    WH->>DB: UPDATE discount_codes<br/>SET status = 'REDEEMED', redeemed_at = NOW(), order_id = 'ORD-999'
    DB-->>WH: OK
    WH-->>Store: HTTP 200 {success: true}
```

### 2.3 Diagrama de Componentes

```mermaid
graph TB
    subgraph External["🌐 Servicios Externos"]
        IG_API["Instagram Graph API<br/>graph.facebook.com/v21.0"]
        STORE["Tienda Web<br/>(Shopify / WooCommerce / Custom)"]
    end

    subgraph Backend["⚙️ Nuestro Backend (Node.js / Python)"]
        WH_RECEIVER["Webhook Receiver<br/>POST /webhooks/instagram"]
        VALIDATION_API["Validation API<br/>GET /api/v1/codes/validate<br/>POST /api/v1/codes/redeem"]
        CODE_ENGINE["Discount Code Engine<br/>(Servicio interno)"]
        DM_DISPATCHER["DM Dispatcher<br/>(Instagram Messenger Client)"]
        WORKER["Processing Worker<br/>(Async Consumer)"]
    end

    subgraph Queue["📬 Cola de Mensajes"]
        REDIS["Redis Streams / BullMQ<br/>(o AWS SQS)"]
    end

    subgraph DB_Layer["🗄️ Capa de Datos"]
        POSTGRES["PostgreSQL<br/>Base de datos principal"]
        REDIS_CACHE["Redis Cache<br/>(Rate limiting / Idempotencia)"]
    end

    IG_API -->|Webhook events| WH_RECEIVER
    WH_RECEIVER --> REDIS
    WH_RECEIVER -->|ACK 200| IG_API
    REDIS --> WORKER
    WORKER --> CODE_ENGINE
    CODE_ENGINE --> POSTGRES
    WORKER --> DM_DISPATCHER
    DM_DISPATCHER -->|Send DM| IG_API
    STORE -->|Validate / Redeem| VALIDATION_API
    VALIDATION_API --> POSTGRES
    WH_RECEIVER --> REDIS_CACHE
    WORKER --> REDIS_CACHE
```

---

## 3. Technology Stack

### 3.1 Stack Recomendado

| Capa | Tecnología | Justificación |
|---|---|---|
| **Runtime Backend** | Node.js 22 LTS + TypeScript | Ecosistema maduro para webhooks, soporte nativo async/await, tipado estático reduce errores en integraciones API |
| **Framework Web** | Fastify 5.x | Mayor throughput que Express para endpoints de webhook de alta frecuencia; validación de esquema nativa con JSON Schema |
| **Base de Datos Principal** | PostgreSQL 16 | ACID compliance para integridad de códigos de descuento; soporte para `FOR UPDATE SKIP LOCKED` en procesamiento de colas |
| **Cache / Cola** | Redis 7 (con BullMQ) | Rate limiting distribuido, deduplicación de eventos, cola de trabajo asíncrona con reintentos |
| **ORM / Query Builder** | Prisma 6 o Drizzle ORM | Migraciones tipadas, generación automática de tipos TypeScript desde el esquema DB |
| **Hosting Backend** | Railway / Render / AWS ECS | Railway y Render: deploy desde GitHub con zero-downtime. AWS ECS para mayor control y escala |
| **Hosting DB** | Supabase (PostgreSQL gestionado) o AWS RDS | Backups automáticos, réplicas de lectura, monitoreo integrado |
| **Secrets Management** | Doppler / AWS Secrets Manager | Las credenciales de Instagram (tokens, app secret) jamás deben estar en el código fuente |
| **Monitoreo / Alertas** | Sentry (errores) + Grafana/Prometheus (métricas) | Trazabilidad de fallos en el envío de DMs y alertas de rate limiting |
| **Testing** | Vitest (unit) + Supertest (integration) | Cobertura de los endpoints de validación y el motor de códigos |

### 3.2 Dependencias de Terceros Críticas

```json
{
  "dependencies": {
    "fastify": "^5.0.0",
    "@fastify/helmet": "^12.0.0",
    "@fastify/rate-limit": "^10.0.0",
    "bullmq": "^5.0.0",
    "ioredis": "^5.0.0",
    "prisma": "^6.0.0",
    "@prisma/client": "^6.0.0",
    "nanoid": "^5.0.0",
    "axios": "^1.7.0",
    "zod": "^3.23.0",
    "pino": "^9.0.0"
  }
}
```

> **Nota de Seguridad:** El token de acceso de largo plazo (`Page Access Token`) de la Instagram Graph API debe rotarse cada 60 días. Implementar un job de rotación automática mediante el endpoint `/oauth/access_token?grant_type=fb_exchange_token`.

---

## 4. Data Models

### 4.1 Esquema de Base de Datos (PostgreSQL)

#### Tabla: `instagram_followers`

Registra a los usuarios que han seguido la cuenta. Sirve como fuente de verdad para la deduplicación.

```sql
CREATE TABLE instagram_followers (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instagram_user_id   VARCHAR(64) NOT NULL UNIQUE,  -- ID estable de IG, no el @username
    followed_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    unfollowed_at       TIMESTAMPTZ,                  -- NULL si aún sigue la cuenta
    follow_count        INTEGER NOT NULL DEFAULT 1,   -- Contador de follows/unfollows
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_instagram_followers_user_id ON instagram_followers(instagram_user_id);
```

#### Tabla: `discount_codes`

Ciclo de vida completo de cada código generado.

```sql
CREATE TYPE discount_status AS ENUM ('ACTIVE', 'REDEEMED', 'EXPIRED', 'REVOKED');

CREATE TABLE discount_codes (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code                VARCHAR(32) NOT NULL UNIQUE,          -- Ej: WELCOME-A3F8KP2Z
    instagram_user_id   VARCHAR(64) NOT NULL,
    follower_id         UUID REFERENCES instagram_followers(id) ON DELETE SET NULL,
    discount_percentage NUMERIC(5,2) NOT NULL DEFAULT 3.00,
    status              discount_status NOT NULL DEFAULT 'ACTIVE',
    
    -- Metadatos de envío
    dm_sent_at          TIMESTAMPTZ,
    dm_message_id       VARCHAR(128),                         -- message_id retornado por IG API
    
    -- Metadatos de canje
    redeemed_at         TIMESTAMPTZ,
    order_id            VARCHAR(128),                         -- ID del pedido en la tienda web
    redeemed_ip         INET,                                 -- IP desde donde se canjeó
    
    -- Control de expiración
    expires_at          TIMESTAMPTZ NOT NULL,                 -- DEFAULT: NOW() + INTERVAL '30 days'
    
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_discount_codes_code ON discount_codes(code);
CREATE INDEX idx_discount_codes_instagram_user ON discount_codes(instagram_user_id);
CREATE INDEX idx_discount_codes_status ON discount_codes(status);
CREATE INDEX idx_discount_codes_expires_at ON discount_codes(expires_at) WHERE status = 'ACTIVE';
```

#### Tabla: `webhook_events`

Registro de auditoría de todos los eventos recibidos de Instagram. Esencial para debugging y re-procesamiento.

```sql
CREATE TYPE webhook_processing_status AS ENUM ('PENDING', 'PROCESSED', 'FAILED', 'SKIPPED');

CREATE TABLE webhook_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type      VARCHAR(64) NOT NULL,           -- Ej: 'follow', 'unfollow'
    instagram_user_id VARCHAR(64),
    raw_payload     JSONB NOT NULL,                 -- Payload completo del webhook
    processing_status webhook_processing_status NOT NULL DEFAULT 'PENDING',
    error_message   TEXT,
    processed_at    TIMESTAMPTZ,
    received_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_webhook_events_user_id ON webhook_events(instagram_user_id);
CREATE INDEX idx_webhook_events_status ON webhook_events(processing_status);
CREATE INDEX idx_webhook_events_received_at ON webhook_events(received_at DESC);
```

### 4.2 Modelo de Datos (Prisma Schema)

```prisma
// schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum DiscountStatus {
  ACTIVE
  REDEEMED
  EXPIRED
  REVOKED
}

enum WebhookProcessingStatus {
  PENDING
  PROCESSED
  FAILED
  SKIPPED
}

model InstagramFollower {
  id              String    @id @default(uuid()) @db.Uuid
  instagramUserId String    @unique @map("instagram_user_id") @db.VarChar(64)
  followedAt      DateTime  @default(now()) @map("followed_at") @db.Timestamptz
  unfollowedAt    DateTime? @map("unfollowed_at") @db.Timestamptz
  followCount     Int       @default(1) @map("follow_count")
  createdAt       DateTime  @default(now()) @map("created_at") @db.Timestamptz
  updatedAt       DateTime  @updatedAt @map("updated_at") @db.Timestamptz

  discountCodes   DiscountCode[]

  @@map("instagram_followers")
}

model DiscountCode {
  id                  String          @id @default(uuid()) @db.Uuid
  code                String          @unique @db.VarChar(32)
  instagramUserId     String          @map("instagram_user_id") @db.VarChar(64)
  followerId          String?         @map("follower_id") @db.Uuid
  discountPercentage  Decimal         @default(3.00) @map("discount_percentage") @db.Decimal(5,2)
  status              DiscountStatus  @default(ACTIVE)
  dmSentAt            DateTime?       @map("dm_sent_at") @db.Timestamptz
  dmMessageId         String?         @map("dm_message_id") @db.VarChar(128)
  redeemedAt          DateTime?       @map("redeemed_at") @db.Timestamptz
  orderId             String?         @map("order_id") @db.VarChar(128)
  redeemedIp          String?         @map("redeemed_ip") @db.Inet
  expiresAt           DateTime        @map("expires_at") @db.Timestamptz
  createdAt           DateTime        @default(now()) @map("created_at") @db.Timestamptz
  updatedAt           DateTime        @updatedAt @map("updated_at") @db.Timestamptz

  follower            InstagramFollower? @relation(fields: [followerId], references: [id])

  @@map("discount_codes")
}

model WebhookEvent {
  id                  String                    @id @default(uuid()) @db.Uuid
  eventType           String                    @map("event_type") @db.VarChar(64)
  instagramUserId     String?                   @map("instagram_user_id") @db.VarChar(64)
  rawPayload          Json                      @map("raw_payload")
  processingStatus    WebhookProcessingStatus   @default(PENDING) @map("processing_status")
  errorMessage        String?                   @map("error_message")
  processedAt         DateTime?                 @map("processed_at") @db.Timestamptz
  receivedAt          DateTime                  @default(now()) @map("received_at") @db.Timestamptz

  @@map("webhook_events")
}
```

---

## 5. API Contract & Webhooks

### 5.1 Configuración del Webhook de Instagram

#### 5.1.1 Registro del Webhook

El webhook debe registrarse en el **Meta for Developers Dashboard** bajo la configuración de la aplicación Instagram:

- **Callback URL:** `https://api.tudominio.com/webhooks/instagram`
- **Verify Token:** Variable de entorno `INSTAGRAM_WEBHOOK_VERIFY_TOKEN` (string aleatorio de ≥32 caracteres)
- **Suscripciones de campos:** `messages`, `follows`

> **Importante:** La Instagram Graph API actualmente emite eventos de seguidor a través de la **Webhooks API for Instagram** bajo el objeto `instagram` con el campo `follows`. Verificar disponibilidad en el tier de acceso de la aplicación (requiere nivel **Advanced Access** aprobado por Meta).

#### 5.1.2 Handshake de Verificación (GET)

Instagram enviará una petición GET para verificar el endpoint antes de activar el webhook:

```
GET /webhooks/instagram
  ?hub.mode=subscribe
  &hub.verify_token=TU_VERIFY_TOKEN
  &hub.challenge=CHALLENGE_STRING
```

**Respuesta esperada del servidor:**

```
HTTP 200 OK
Content-Type: text/plain

CHALLENGE_STRING
```

#### 5.1.3 Payload del Evento de Nuevo Seguidor (POST)

```json
{
  "object": "instagram",
  "entry": [
    {
      "id": "INSTAGRAM_BUSINESS_ACCOUNT_ID",
      "time": 1716124800,
      "changes": [
        {
          "field": "follows",
          "value": {
            "verb": "follow",
            "action": "add",
            "from": {
              "id": "123456789012345",
              "username": "nuevo_seguidor_username"
            },
            "to": {
              "id": "INSTAGRAM_BUSINESS_ACCOUNT_ID"
            }
          }
        }
      ]
    }
  ]
}
```

> **Nota:** El campo `username` puede no estar disponible en todos los contextos. El identificador canónico y estable es `from.id`. No almacenar `username` como clave primaria.

#### 5.1.4 Validación de Firma HMAC-SHA256

Cada request POST de Instagram incluye el header `X-Hub-Signature-256`. El backend **DEBE** verificar este header antes de procesar cualquier payload:

```typescript
import crypto from 'crypto';

function verifyInstagramSignature(
  rawBody: Buffer,
  signature: string,
  appSecret: string
): boolean {
  const expectedSignature = 'sha256=' + crypto
    .createHmac('sha256', appSecret)
    .update(rawBody)
    .digest('hex');
  
  // Usar timingSafeEqual para prevenir timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}
```

---

### 5.2 Endpoints del Backend

#### `POST /webhooks/instagram`

**Propósito:** Receptor principal de eventos de Instagram. Debe responder en < 200ms.

**Headers requeridos:**
```
Content-Type: application/json
X-Hub-Signature-256: sha256=<hmac_signature>
```

**Lógica de procesamiento:**
1. Verificar firma HMAC → retornar `403` si no es válida.
2. Retornar `200 OK` inmediatamente.
3. Encolar el evento en Redis/SQS de forma asíncrona (fire-and-forget desde la perspectiva del request).

**Respuesta de éxito:**
```json
HTTP 200 OK
{}
```

**Respuesta de firma inválida:**
```json
HTTP 403 Forbidden
{
  "error": "invalid_signature"
}
```

---

#### `GET /api/v1/codes/validate`

**Propósito:** Permite a la tienda web verificar si un código de descuento es válido antes de aplicarlo al carrito.

**Autenticación:** API Key en header `X-API-Key` (rotación trimestral).

**Request:**
```
GET /api/v1/codes/validate?code=WELCOME-A3F8KP2Z
X-API-Key: sk_live_xxxxxxxxxxxx
```

**Respuesta — Código válido (HTTP 200):**
```json
{
  "valid": true,
  "code": "WELCOME-A3F8KP2Z",
  "discount_percentage": 3.00,
  "expires_at": "2026-06-19T00:00:00.000Z",
  "status": "ACTIVE"
}
```

**Respuesta — Código inválido (HTTP 200):**

> Se retorna siempre `200` para no exponer información mediante códigos de error HTTP. La validez se comunica en el body.

```json
{
  "valid": false,
  "reason": "EXPIRED" // Posibles valores: "NOT_FOUND" | "EXPIRED" | "ALREADY_REDEEMED" | "REVOKED"
}
```

**Esquema de validación Zod:**
```typescript
const ValidateCodeQuerySchema = z.object({
  code: z.string()
    .min(10)
    .max(32)
    .regex(/^WELCOME-[A-Z0-9]{8}$/, 'Invalid code format')
});
```

---

#### `POST /api/v1/codes/redeem`

**Propósito:** Marca un código como canjeado tras la finalización del checkout. Operación idempotente.

**Autenticación:** API Key en header `X-API-Key`.

**Request body:**
```json
{
  "code": "WELCOME-A3F8KP2Z",
  "order_id": "ORD-2026-00999",
  "customer_ip": "203.0.113.45"
}
```

**Respuesta de éxito (HTTP 200):**
```json
{
  "success": true,
  "code": "WELCOME-A3F8KP2Z",
  "redeemed_at": "2026-05-19T14:30:00.000Z"
}
```

**Respuesta — Código ya canjeado (HTTP 409):**
```json
{
  "success": false,
  "error": "CODE_ALREADY_REDEEMED",
  "redeemed_at": "2026-05-19T10:00:00.000Z"
}
```

> **Implementación de idempotencia:** Si el `order_id` ya existe para ese código, retornar `200 OK` con los datos originales (en lugar de error). Esto cubre reintentos del sistema de la tienda.

---

### 5.3 Motor de Generación de Códigos (Servicio Interno)

#### Algoritmo de Generación

```typescript
import { customAlphabet } from 'nanoid';

// Alfabeto sin caracteres ambiguos: excluye 0, O, I, 1, L
const SAFE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const generateUniqueSegment = customAlphabet(SAFE_ALPHABET, 8);

async function generateDiscountCode(
  db: PrismaClient,
  maxRetries: number = 5
): Promise<string> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const code = `WELCOME-${generateUniqueSegment()}`;
    
    // Verificar unicidad en DB (probabilidad de colisión: < 1 en 1 billón con SAFE_ALPHABET^8)
    const existing = await db.discountCode.findUnique({ where: { code } });
    if (!existing) return code;
  }
  
  throw new Error('Failed to generate unique code after maximum retries');
}
```

#### Parámetros del Código

| Parámetro | Valor |
|---|---|
| Prefijo | `WELCOME-` |
| Longitud del segmento aleatorio | 8 caracteres |
| Alfabeto | Alfanumérico mayúscula sin ambigüedades (32 chars) |
| Espacio de combinaciones | 32^8 = ~1.1 billones |
| Tiempo de expiración | 30 días desde la generación |
| Case-insensitive matching | Sí (normalizar a uppercase en validación) |

---

### 5.4 Template del DM de Bienvenida

```typescript
function buildWelcomeMessage(code: string, storeUrl: string): string {
  const ctaUrl = `${storeUrl}/canjear?code=${code}`;
  
  return [
    `¡Hola! 👋 Gracias por seguirnos.`,
    ``,
    `Para darte la bienvenida, tenemos un regalo para ti: usa el código`,
    `*${code}*`,
    `y obtén un 3% de descuento en tu próxima compra. 🎉`,
    ``,
    `👉 Aplícalo directamente aquí: ${ctaUrl}`,
    ``,
    `¡El código es válido durante 30 días. No lo dejes escapar! 💙`,
  ].join('\n');
}
```

> **Limitaciones de Instagram DM:** Los mensajes directos no soportan HTML. El formateo con `*texto*` puede no renderizarse en todos los clientes. Mantener el texto plano como fallback. La URL larga puede acortarse con un servicio propio si se requiere tracking de clics.

---

## 6. Security & Edge Cases

### 6.1 Rate Limiting de la Instagram Graph API

Instagram impone límites estrictos en la Messenger API. El incumplimiento resulta en bloqueos temporales o permanentes de la cuenta.

#### Límites conocidos (sujetos a cambio por Meta)

| Tipo | Límite |
|---|---|
| Mensajes por segundo (por usuario destinatario) | 1 mensaje / segundo |
| Mensajes por hora (total de la cuenta) | Varía según nivel de acceso aprobado |
| Webhooks sin ACK | Suspensión del endpoint tras N fallos consecutivos |

#### Estrategia de Mitigación: Cola con Rate Limiting

```typescript
// Configuración de BullMQ con rate limiting
const dmQueue = new Queue('instagram-dm', {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000, // 5s base, luego 10s, 20s...
    },
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 500 },
  },
});

// Worker con límite de 1 DM por segundo
const dmWorker = new Worker('instagram-dm', processDmJob, {
  connection: redis,
  limiter: {
    max: 1,
    duration: 1000, // 1 mensaje por cada 1000ms
  },
  concurrency: 1,
});
```

#### Manejo de errores de la API de Instagram

| Código de Error IG | Significado | Acción |
|---|---|---|
| `(#4)` Application request limit reached | Rate limit global | Backoff exponencial + alerta |
| `(#10)` Permission denied | Permisos insuficientes | Alerta crítica + revisión manual |
| `(#100)` Invalid parameter | Payload malformado | Log + descarte del job (no reintentar) |
| `(#190)` Invalid OAuth token | Token expirado | Trigger de rotación de token + retry |
| `(#613)` Calls to this api have exceeded the rate limit | Rate limit de DMs | Backoff 60s + retry |

---

### 6.2 Prevención de Abuso: Follow/Unfollow Repetido

El escenario más común de abuso es un usuario que hace follow → recibe código → hace unfollow → hace follow de nuevo para obtener un segundo código.

#### Regla de Negocio

> **Un usuario de Instagram (identificado por `instagram_user_id`) solo puede recibir un código de descuento de bienvenida de por vida**, independientemente del número de veces que siga/deje de seguir la cuenta.

#### Implementación

```typescript
async function handleNewFollower(instagramUserId: string): Promise<void> {
  // 1. Verificar si ya existe un código para este usuario (incluye REDEEMED, EXPIRED, REVOKED)
  const existingCode = await db.discountCode.findFirst({
    where: { instagramUserId },
  });

  if (existingCode) {
    // Registrar el intento pero NO generar nuevo código
    await db.webhookEvent.update({
      where: { id: currentEventId },
      data: {
        processingStatus: 'SKIPPED',
        errorMessage: `Code already issued: ${existingCode.code} (status: ${existingCode.status})`,
      },
    });
    return;
  }

  // 2. Actualizar contador de follows en instagram_followers
  await db.instagramFollower.upsert({
    where: { instagramUserId },
    update: {
      followedAt: new Date(),
      unfollowedAt: null,
      followCount: { increment: 1 },
    },
    create: {
      instagramUserId,
      followCount: 1,
    },
  });

  // 3. Proceder con la generación del código (solo si es el primer follow)
  // ...
}
```

#### Detección de Comportamiento Sospechoso

Implementar un job diario que detecte patrones de abuso coordinado:

```sql
-- Usuarios con más de 3 follows/unfollows en los últimos 7 días
SELECT instagram_user_id, follow_count, followed_at
FROM instagram_followers
WHERE follow_count > 3
  AND followed_at > NOW() - INTERVAL '7 days'
ORDER BY follow_count DESC;
```

---

### 6.3 Seguridad de los Endpoints

#### 6.3.1 Autenticación del Validation API

- Usar API Keys rotativas con hash almacenado en DB (nunca el valor plano).
- Implementar scopes: la tienda web solo tiene acceso a `codes:validate` y `codes:redeem`.
- Rate limiting por API Key: máximo 100 requests/minuto por clave.

```typescript
// Middleware de autenticación
async function authenticateApiKey(request: FastifyRequest): Promise<void> {
  const apiKey = request.headers['x-api-key'];
  if (!apiKey) throw new UnauthorizedError('Missing API key');
  
  const keyHash = crypto.createHash('sha256').update(apiKey as string).digest('hex');
  const validKey = await db.apiKey.findFirst({
    where: { keyHash, isActive: true, expiresAt: { gt: new Date() } },
  });
  
  if (!validKey) throw new UnauthorizedError('Invalid or expired API key');
}
```

#### 6.3.2 Seguridad del Enlace CTA

El parámetro `?code=` en la URL es legible por cualquiera. Medidas de mitigación:

| Riesgo | Mitigación |
|---|---|
| Compartir el enlace con terceros | El código es de un solo uso; el primero en canjear "gana" |
| Enumeración de códigos (brute force) | Rate limiting en `/codes/validate` (10 req/min por IP); formato de código con 1.1B de combinaciones |
| Modificación del parámetro URL | La tienda web valida el código en el backend antes de aplicarlo; nunca confiar en el frontend |
| IDOR (Insecure Direct Object Reference) | El código no expone el `user_id`; son entidades separadas sin relación pública |

#### 6.3.3 Headers de Seguridad HTTP

Configurar en Fastify:

```typescript
await app.register(helmet, {
  contentSecurityPolicy: true,
  hsts: { maxAge: 31536000 },
  frameguard: { action: 'deny' },
  noSniff: true,
  xssFilter: true,
});
```

#### 6.3.4 Variables de Entorno Requeridas

```bash
# Instagram / Meta
INSTAGRAM_APP_ID=
INSTAGRAM_APP_SECRET=           # Para verificación HMAC del webhook
INSTAGRAM_PAGE_ACCESS_TOKEN=    # Token de largo plazo (60 días)
INSTAGRAM_WEBHOOK_VERIFY_TOKEN= # Token de verificación del webhook (≥32 chars)
INSTAGRAM_BUSINESS_ACCOUNT_ID=

# Base de Datos
DATABASE_URL=postgresql://user:password@host:5432/dbname?sslmode=require

# Redis
REDIS_URL=redis://user:password@host:6379

# Aplicación
API_KEY_HASH_SECRET=            # Salt para hashing de API keys
STORE_BASE_URL=https://midominio.com
NODE_ENV=production
LOG_LEVEL=info
```

---

### 6.4 Edge Cases Adicionales

| Escenario | Comportamiento Esperado |
|---|---|
| Instagram no puede entregar el DM (cuenta privada, DMs cerrados) | Registrar error en `webhook_events`; el código queda en DB pero `dm_sent_at` es NULL. Implementar job de reintento con límite de 3 intentos en 24h |
| El webhook llega duplicado (mismo evento dos veces) | Usar `webhook_events.raw_payload` con hash para deduplicar. La verificación de código existente en DB actúa como segunda barrera |
| El token de Instagram expira durante el procesamiento | El worker detecta error `#190`, publica un evento en la cola de gestión, detiene el procesamiento de DMs y espera token renovado |
| Expiración masiva de códigos | Job cron diario: `UPDATE discount_codes SET status = 'EXPIRED' WHERE status = 'ACTIVE' AND expires_at < NOW()` |
| La tienda web llama a `/redeem` varias veces para el mismo pedido | Idempotencia por `order_id`: si ya existe, retornar el resultado original sin modificar la DB |
| El usuario bloquea la cuenta de empresa antes de recibir el DM | Instagram API retornará error `(#100)` o similar. Marcar como fallido; no reintentar (el usuario activamente no desea contacto) |

---

## 7. Deployment & Infrastructure

### 7.1 Variables de Entorno por Ambiente

| Variable | Desarrollo | Staging | Producción |
|---|---|---|---|
| `NODE_ENV` | `development` | `staging` | `production` |
| `LOG_LEVEL` | `debug` | `info` | `warn` |
| `DATABASE_URL` | Local PostgreSQL | DB de staging | DB producción (RDS/Supabase) |
| `INSTAGRAM_APP_ID` | App de prueba (Sandbox) | App de staging | App de producción |

### 7.2 Pipeline CI/CD Recomendado

```yaml
# .github/workflows/deploy.yml (esquema simplificado)
stages:
  - lint_and_typecheck    # tsc --noEmit + eslint
  - unit_tests            # vitest run
  - integration_tests     # tests contra DB de test
  - build_docker_image    # docker build + push a registry
  - deploy_staging        # deploy automático en merge a main
  - smoke_tests           # verificar /health y /webhooks/instagram (GET)
  - deploy_production     # manual trigger con aprobación
```

### 7.3 Health Check Endpoint

```
GET /health

HTTP 200 OK
{
  "status": "ok",
  "timestamp": "2026-05-19T14:00:00.000Z",
  "services": {
    "database": "ok",
    "redis": "ok",
    "instagram_token_valid": true,
    "instagram_token_expires_in_days": 45
  }
}
```

---

## 8. Acceptance Criteria & Testing

### 8.1 Criterios de Aceptación Funcionales

- [ ] Cuando un usuario nuevo hace follow, recibe un DM en < 30 segundos.
- [ ] El código generado es único en la base de datos (verificado por constraint `UNIQUE`).
- [ ] Un mismo `instagram_user_id` no recibe más de un código, sin importar cuántos follows realice.
- [ ] El endpoint `/codes/validate` retorna `valid: true` para un código `ACTIVE` no expirado.
- [ ] El endpoint `/codes/validate` retorna `valid: false` para un código `REDEEMED`.
- [ ] El endpoint `/codes/redeem` es idempotente: llamadas múltiples con el mismo `order_id` producen el mismo resultado.
- [ ] Los códigos con `expires_at` en el pasado son rechazados en validación.

### 8.2 Criterios de Aceptación de Seguridad

- [ ] Requests al webhook con firma HMAC inválida retornan `403` y son registrados.
- [ ] El endpoint `/codes/validate` sin `X-API-Key` retorna `401`.
- [ ] Un brute force de 11 requests/min al endpoint de validación desde la misma IP recibe `429`.
- [ ] Las variables de entorno con secretos no aparecen en los logs de la aplicación.

### 8.3 Tests de Regresión Prioritarios

```typescript
// Ejemplos de test cases (Vitest)
describe('Discount Code Engine', () => {
  it('should generate codes matching pattern /^WELCOME-[A-Z2-9]{8}$/', async () => { ... });
  it('should retry on collision and succeed', async () => { ... });
  it('should throw after max retries exceeded', async () => { ... });
});

describe('POST /webhooks/instagram', () => {
  it('should return 200 and enqueue job for valid follow event', async () => { ... });
  it('should return 403 for invalid HMAC signature', async () => { ... });
  it('should return 200 for GET verification handshake', async () => { ... });
});

describe('GET /api/v1/codes/validate', () => {
  it('should return valid:true for ACTIVE non-expired code', async () => { ... });
  it('should return valid:false with reason EXPIRED for expired code', async () => { ... });
  it('should return valid:false with reason ALREADY_REDEEMED for redeemed code', async () => { ... });
  it('should return 401 without API key', async () => { ... });
});
```

---

## 9. Glosario

| Término | Definición |
|---|---|
| **DM** | Direct Message. Mensaje privado en Instagram. |
| **Webhook** | Mecanismo de notificación push donde un servidor externo (Instagram) llama a nuestro endpoint cuando ocurre un evento. |
| **HMAC-SHA256** | Hash-based Message Authentication Code. Algoritmo de verificación de integridad y autenticidad del payload. |
| **Idempotente** | Operación que produce el mismo resultado sin importar cuántas veces se ejecute con los mismos parámetros. |
| **Rate Limiting** | Restricción en el número de peticiones permitidas en un período de tiempo. |
| **LTV** | Lifetime Value. Valor total que un cliente genera a lo largo de su relación con la empresa. |
| **CTA** | Call To Action. Elemento de comunicación diseñado para provocar una acción inmediata del usuario. |
| **ACID** | Atomicity, Consistency, Isolation, Durability. Propiedades que garantizan la fiabilidad de las transacciones en bases de datos. |
| **ACK** | Acknowledge. Confirmación de recepción de un mensaje o evento. |
| **TTL** | Time To Live. Tiempo de vida de un registro o cache antes de ser eliminado automáticamente. |

---

*Fin del documento SPECS.md — v1.0.0*  
*Próxima revisión programada: tras aprobación del equipo de ingeniería y legal (uso de datos de usuarios de Instagram).*