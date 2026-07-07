# SPECS.md — Sistema Automatizado de Retención de Clientes vía Instagram DM

**Versión:** 3.0.0  
**Fecha:** 2026-07-07  
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

Este documento describe la arquitectura técnica y el contrato de integración para un **sistema de retención de clientes basado en interacción por comentarios en Instagram**. El sistema detecta en tiempo real cuando un usuario comenta en una publicación de la cuenta corporativa con una palabra clave específica (ej: "BASUSTA") y responde automáticamente con un Mensaje Directo (DM) personalizado que incluye:

- Un mensaje de bienvenida con tono de marca.
- Un **código de descuento estático** que el cliente debe presentar verbalmente o mostrar en pantalla al momento de la compra en el establecimiento físico.
- El código es un **contrato escrito extraoficial** — no se valida ni canjea a través de ninguna API. El personal del establecimiento aplica el descuento de forma manual al reconocer el código.

### 1.2 Valor de Negocio

| Dimensión | Impacto Esperado |
|---|---|
| Conversión de comentarios | Reducción del tiempo entre *comentario* y primera visita al establecimiento |
| Experiencia de usuario | Respuesta inmediata y automatizada a interacciones de interés |
| Tasa de abandono | Incentivo económico inmediato (descuento 3%) aplicado de forma manual en el establecimiento |
| LTV (Lifetime Value) | Primer punto de contacto transaccional gestionado |

### 1.3 Alcance del Documento

Este SDD cubre el diseño de los siguientes componentes:

- **Webhook Receiver:** Servicio que recibe y procesa los eventos de comentarios desde la Instagram Graph API.
- **Keyword Matcher:** Módulo que detecta palabras clave específicas en los comentarios recibidos.
- **DM Dispatcher:** Módulo de envío de mensajes directos vía Instagram Messenger API con código de descuento estático.
- **Database Layer:** Modelo de datos relacional para registro de DMs enviados y deduplicación.

### 1.4 Fuera del Alcance (Out of Scope)

- Validación o canje de códigos de descuento vía API (el código se presenta verbalmente en el establecimiento).
- Integración con sistemas de CRM (Salesforce, HubSpot, etc.).
- Envío de mensajes de seguimiento (*follow-up*) o secuencias de nurturing.
- Lógica interna del carrito de compra (responsabilidad de la plataforma e-commerce).
- Panel de administración visual (se asume acceso directo a base de datos o herramienta BI).

---

## 2. System Architecture

### 2.1 Descripción del Flujo del Sistema

El flujo de eventos sigue el siguiente orden de operaciones:

1. Un usuario de Instagram comenta en una publicación de la cuenta corporativa con una palabra clave específica (ej: "BASUSTA").
2. Instagram Graph API emite un evento webhook hacia el endpoint registrado en nuestro backend.
3. El **Webhook Receiver** valida la firma del payload, extrae el `instagram_user_id` del usuario que comentó y el texto del comentario, y encola el evento para procesamiento asíncrono.
4. El **Worker de Procesamiento** consume el evento de la cola:
   a. Verifica que el comentario contenga la palabra clave configurada (`TRIGGER_KEYWORD`).
   b. Verifica en la base de datos si este usuario ya recibió un DM (deduplicación).
   c. Construye el mensaje DM con el copy de bienvenida y el código de descuento estático.
   d. Persiste el registro en la base de datos indicando que se envió el DM.
   e. Llama a la **Instagram Messenger API** para enviar el DM.
   f. Actualiza el registro con `dm_sent_at` y el `message_id` de confirmación.
5. El usuario recibe el DM con el código de descuento y lo presenta verbalmente o muestra en pantalla al acudir al establecimiento físico.
6. El personal del establecimiento aplica el descuento manualmente al reconocer el código.

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
    participant Staff as Personal del<br/>Establecimiento

    Usuario->>IG: Comentario en publicación:<br/>"BASUSTA"
    IG->>WH: POST /webhooks/instagram<br/>{event: "comments", user_id: "IG_USER_ID", text: "BASUSTA"}
    WH->>WH: Validar firma HMAC-SHA256
    WH->>Queue: Encolar evento de comentario
    WH-->>IG: HTTP 200 OK (ACK inmediato)

    Queue->>Worker: Despachar evento
    Worker->>Worker: Verificar keyword match<br/>(case-insensitive)
    Worker->>DB: SELECT * FROM dm_records<br/>WHERE instagram_user_id = 'IG_USER_ID'
    DB-->>Worker: No existe registro → proceder

    Worker->>DB: INSERT INTO dm_records<br/>(user_id, code, dm_sent_at)
    DB-->>Worker: OK — registro creado

    Worker->>IGDM: POST /me/messages<br/>{recipient: IG_USER_ID, message: DM_PAYLOAD}
    IGDM-->>Worker: {message_id: "mid.xxx"}
    Worker->>DB: UPDATE dm_records<br/>SET dm_sent_at = NOW(), message_id = 'mid.xxx'

    Note over Usuario,Staff: — Posteriormente, el usuario acude al establecimiento —

    Usuario->>Staff: Muestra el DM con el código<br/>de descuento
    Staff->>Staff: Reconoce el código y aplica<br/>el descuento manualmente
```

### 2.3 Diagrama de Componentes

```mermaid
graph TB
    subgraph External["🌐 Servicios Externos"]
        IG_API["Instagram Graph API<br/>graph.facebook.com/v21.0"]
    end

    subgraph Backend["⚙️ Nuestro Backend (Node.js / TypeScript)"]
        WH_RECEIVER["Webhook Receiver<br/>POST /webhooks/instagram"]
        KEYWORD_MATCHER["Keyword Matcher<br/>(Servicio interno)"]
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
    WORKER --> KEYWORD_MATCHER
    KEYWORD_MATCHER --> POSTGRES
    WORKER --> DM_DISPATCHER
    DM_DISPATCHER -->|Send DM| IG_API
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
| **Testing** | Vitest (unit) + Supertest (integration) | Cobertura del webhook, keyword matching y envío de DMs |

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

#### Tabla: `instagram_comments`

Registra los comentarios que activaron el flujo de descuento. Sirve como fuente de verdad para la deduplicación y auditoría.

```sql
CREATE TABLE instagram_comments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    comment_id          VARCHAR(64) NOT NULL UNIQUE,  -- ID estable del comentario de IG
    instagram_user_id   VARCHAR(64) NOT NULL,         -- ID del usuario que comentó
    media_id            VARCHAR(64),                  -- ID de la publicación comentada
    comment_text        TEXT NOT NULL,                -- Texto original del comentario
    commented_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_instagram_comments_user_id ON instagram_comments(instagram_user_id);
CREATE INDEX idx_instagram_comments_commented_at ON instagram_comments(commented_at);
```

#### Tabla: `instagram_followers`

Registra a los usuarios que han seguido la cuenta. Se mantiene para compatibilidad y analytics.

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

#### Tabla: `dm_records`

Registro de DMs enviados con el código de descuento. Sirve para deduplicación (un usuario solo recibe un DM) y auditoría.

```sql
CREATE TABLE dm_records (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instagram_user_id   VARCHAR(64) NOT NULL UNIQUE,  -- Un DM por usuario
    comment_id          VARCHAR(64),                  -- ID del comentario que activó el DM
    media_id            VARCHAR(64),                  -- ID de la publicación comentada
    discount_code       VARCHAR(64) NOT NULL,         -- Código estático enviado (ej: DESCUENTO_INSTAGRAM)
    dm_message_id       VARCHAR(128),                 -- message_id retornado por IG API
    dm_sent_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_dm_records_user_id ON dm_records(instagram_user_id);
CREATE INDEX idx_dm_records_sent_at ON dm_records(dm_sent_at);
```

#### Tabla: `webhook_events`

Registro de auditoría de todos los eventos recibidos de Instagram. Esencial para debugging y re-procesamiento.

```sql
CREATE TYPE webhook_processing_status AS ENUM ('PENDING', 'PROCESSED', 'FAILED', 'SKIPPED');

CREATE TABLE webhook_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type      VARCHAR(64) NOT NULL,           -- Ej: 'comment', 'follow', 'unfollow'
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

enum WebhookProcessingStatus {
  PENDING
  PROCESSED
  FAILED
  SKIPPED
}

model InstagramComment {
  id              String    @id @default(uuid()) @db.Uuid
  commentId       String    @unique @map("comment_id") @db.VarChar(64)
  instagramUserId String    @map("instagram_user_id") @db.VarChar(64)
  mediaId         String?   @map("media_id") @db.VarChar(64)
  commentText     String    @map("comment_text") @db.Text
  commentedAt     DateTime  @default(now()) @map("commented_at") @db.Timestamptz
  createdAt       DateTime  @default(now()) @map("created_at") @db.Timestamptz
  updatedAt       DateTime  @updatedAt @map("updated_at") @db.Timestamptz

  @@map("instagram_comments")
  @@index([instagramUserId])
  @@index([commentedAt])
}

model InstagramFollower {
  id              String    @id @default(uuid()) @db.Uuid
  instagramUserId String    @unique @map("instagram_user_id") @db.VarChar(64)
  followedAt      DateTime  @default(now()) @map("followed_at") @db.Timestamptz
  unfollowedAt    DateTime? @map("unfollowed_at") @db.Timestamptz
  followCount     Int       @default(1) @map("follow_count")
  createdAt       DateTime  @default(now()) @map("created_at") @db.Timestamptz
  updatedAt       DateTime  @updatedAt @map("updated_at") @db.Timestamptz

  @@map("instagram_followers")
  @@index([followedAt])
}

model DmRecord {
  id              String   @id @default(uuid()) @db.Uuid
  instagramUserId String   @unique @map("instagram_user_id") @db.VarChar(64)
  commentId       String?  @map("comment_id") @db.VarChar(64)
  mediaId         String?  @map("media_id") @db.VarChar(64)
  discountCode    String   @map("discount_code") @db.VarChar(64)
  dmMessageId     String?  @map("dm_message_id") @db.VarChar(128)
  dmSentAt        DateTime @default(now()) @map("dm_sent_at") @db.Timestamptz
  createdAt       DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt       DateTime @updatedAt @map("updated_at") @db.Timestamptz

  @@map("dm_records")
  @@index([instagramUserId])
  @@index([dmSentAt])
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
- **Suscripciones de campos:** `messages`, `comments`

> **Importante:** La Instagram Graph API emite eventos de comentarios a través de la **Webhooks API for Instagram** bajo el objeto `instagram` con el campo `comments`. Este campo requiere nivel de acceso **Advanced Access** aprobado por Meta.

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

#### 5.1.3 Payload del Evento de Comentario (POST)

```json
{
  "object": "instagram",
  "entry": [
    {
      "id": "INSTAGRAM_BUSINESS_ACCOUNT_ID",
      "time": 1716124800,
      "changes": [
        {
          "field": "comments",
          "value": {
            "media": {
              "id": "MEDIA_ID"
            },
            "comment": {
              "id": "COMMENT_ID",
              "created_time": 1716124800,
              "text": "BASUSTA",
              "from": {
                "id": "123456789012345",
                "username": "usuario_comentador"
              }
            }
          }
        }
      ]
    }
  ]
}
```

> **Nota:** El campo `username` puede no estar disponible en todos los contextos. El identificador canónico y estable es `from.id`. No almacenar `username` como clave primaria. El texto del comentario se encuentra en `comment.text` y debe compararse con la palabra clave configurada (`TRIGGER_KEYWORD`) de forma case-insensitive.

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
3. Extraer el campo `comment.text` del payload y verificar que contenga la palabra clave configurada (`TRIGGER_KEYWORD`).
4. Si el comentario NO contiene la keyword, descartar el evento (log only).
5. Si el comentario SÍ contiene la keyword, verificar que el usuario no haya recibido ya un DM (deduplicación).
6. Encolar el evento en Redis/SQS de forma asíncrona (fire-and-forget desde la perspectiva del request).

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

#### `GET /health`

**Propósito:** Endpoint de verificación de estado del servicio.

**Respuesta (HTTP 200):**
```json
{
  "status": "ok",
  "timestamp": "2026-07-07T14:00:00.000Z",
  "services": {
    "database": "ok",
    "redis": "ok",
    "instagram_token_valid": true,
    "instagram_token_expires_in_days": 45
  }
}
```

---

### 5.3 Código de Descuento (Estático — Sin Validación API)

#### Configuración

El código de descuento se configura mediante la variable de entorno `STATIC_DISCOUNT_CODE`. No se genera dinámicamente ni se valida a través de ninguna API.

```bash
STATIC_DISCOUNT_CODE=DESCUENTO_INSTAGRAM
```

#### Parámetros del Código

| Parámetro | Valor |
|---|---|
| Código | Configurado vía `STATIC_DISCOUNT_CODE` |
| Validación | Manual — el personal del establecimiento reconoce el código visualmente |
| Naturaleza | Contrato escrito extraoficial, no un token técnico |
| Uso | El cliente muestra el DM al acudir al establecimiento |

> **Nota:** No existe endpoint de validación ni de canje. El código se presenta verbalmente o se muestra en pantalla al personal del establecimiento, que aplica el descuento de forma manual. El sistema solo registra quién recibió el DM para evitar envíos duplicados.

---

### 5.4 Template del DM de Bienvenida

```typescript
function buildWelcomeMessage(code: string): string {
  return [
    `¡Hola! 👋 Gracias por tu interés.`,
    ``,
    `Tenemos un regalo para ti: muestra este código en nuestro establecimiento`,
    `y obtén un 3% de descuento en tu visita. 🎉`,
    ``,
    `Tu código: *${code}*`,
    ``,
    `¡Te esperamos! 💙`,
  ].join('\n');
}
```

> **Limitaciones de Instagram DM:** Los mensajes directos no soportan HTML. El formateo con `*texto*` puede no renderizarse en todos los clientes. Mantener el texto plano como fallback. El código se presenta visualmente al personal del establecimiento — no hay enlace CTA ni validación online.

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

### 6.2 Prevención de Abuso: Comentarios Repetidos

El escenario más común de abuso es un usuario que comenta múltiples veces para recibir múltiples DMs.

#### Regla de Negocio

> **Un usuario de Instagram (identificado por `instagram_user_id`) solo puede recibir un DM de por vida**, independientemente del número de comentarios que realice con la palabra clave.

#### Implementación

```typescript
async function handleCommentWithKeyword(
  instagramUserId: string,
  commentText: string,
  commentId: string
): Promise<void> {
  // 1. Verificar si ya se envió un DM a este usuario
  const existingRecord = await db.dmRecord.findFirst({
    where: { instagramUserId },
  });

  if (existingRecord) {
    // Registrar el intento pero NO enviar otro DM
    await db.webhookEvent.update({
      where: { id: currentEventId },
      data: {
        processingStatus: 'SKIPPED',
        errorMessage: `DM already sent: message_id=${existingRecord.dmMessageId}`,
      },
    });
    return;
  }

  // 2. Registrar el comentario en instagram_comments
  await db.instagramComment.upsert({
    where: { commentId },
    update: {},
    create: {
      commentId,
      instagramUserId,
      commentText,
      commentedAt: new Date(),
    },
  });

  // 3. Proceder con el envío del DM (solo si es el primer comentario con keyword)
  // ...
}
```

#### Detección de Comportamiento Sospechoso

Implementar un job diario que detecte patrones de abuso coordinado:

```sql
-- Usuarios con más de 3 comentarios con keyword en los últimos 7 días
SELECT instagram_user_id, COUNT(*) as comment_count
FROM instagram_comments
WHERE commented_at > NOW() - INTERVAL '7 days'
GROUP BY instagram_user_id
HAVING COUNT(*) > 3
ORDER BY comment_count DESC;
```

---

### 6.3 Seguridad de los Endpoints

#### 6.3.1 Headers de Seguridad HTTP

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

#### 6.3.2 Variables de Entorno Requeridas

```bash
# Instagram / Meta
INSTAGRAM_APP_ID=
INSTAGRAM_APP_SECRET=           # Para verificación HMAC del webhook
INSTAGRAM_PAGE_ACCESS_TOKEN=    # Token de largo plazo (60 días)
INSTAGRAM_WEBHOOK_VERIFY_TOKEN= # Token de verificación del webhook (≥32 chars)
INSTAGRAM_BUSINESS_ACCOUNT_ID=

# Trigger y Descuento
TRIGGER_KEYWORD=BASUSTA
STATIC_DISCOUNT_CODE=DESCUENTO_INSTAGRAM

# Base de Datos
DATABASE_URL=postgresql://user:password@host:5432/dbname?sslmode=require

# Redis
REDIS_URL=redis://user:password@host:6379

# Aplicación
API_KEY_HASH_SECRET=            # Salt para hashing de API keys (si se usan endpoints protegidos)
NODE_ENV=production
LOG_LEVEL=info
```

---

### 6.4 Edge Cases Adicionales

| Escenario | Comportamiento Esperado |
|---|---|
| Instagram no puede entregar el DM (cuenta privada, DMs cerrados) | Registrar error en `webhook_events`; el registro queda en DB pero `dm_message_id` es NULL. Implementar job de reintento con límite de 3 intentos en 24h |
| El webhook llega duplicado (mismo evento dos veces) | Usar `webhook_events.raw_payload` con hash para deduplicar. La verificación de DM existente en DB actúa como segunda barrera |
| El token de Instagram expira durante el procesamiento | El worker detecta error `#190`, publica un evento en la cola de gestión, detiene el procesamiento de DMs y espera token renovado |
| La tienda web llama a `/redeem` varias veces para el mismo pedido | No aplica — no existe endpoint de canje |
| El usuario bloquea la cuenta de empresa antes de recibir el DM | Instagram API retornará error `(#100)` o similar. Marcar como fallido; no reintentar (el usuario activamente no desea contacto) |
| Comentario editado después de ser procesado | El webhook no emite eventos de edición de comentarios. Se procesa el texto original recibido. |
| Múltiples keywords en un solo comentario | Si el comentario contiene la keyword configurada, se procesa una sola vez. No se envían múltiples DMs. |
| El usuario comparte el código con otra persona | No hay mitigación técnica — el código es estático y visible. El personal del establecimiento decide si aplica el descuento. |

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

- [ ] Cuando un usuario comenta con la palabra clave configurada, recibe un DM en < 30 segundos.
- [ ] Los comentarios que NO contienen la palabra clave son descartados sin enviar DM.
- [ ] La comparación de la palabra clave es case-insensitive ("basusta", "BASUSTA", "BasuSta" son equivalentes).
- [ ] Un mismo `instagram_user_id` no recibe más de un DM, sin importar cuántos comentarios realice.
- [ ] El DM contiene el código de descuento estático configurado vía `STATIC_DISCOUNT_CODE`.
- [ ] El registro del DM enviado se persiste en la base de datos con `instagram_user_id`, `comment_id`, y `dm_message_id`.
- [ ] El endpoint `/health` retorna el estado de PostgreSQL, Redis y el token de Instagram.

### 8.2 Criterios de Aceptación de Seguridad

- [ ] Requests al webhook con firma HMAC inválida retornan `403` y son registrados.
- [ ] Las variables de entorno con secretos no aparecen en los logs de la aplicación.
- [ ] El webhook responde al handshake de verificación de Instagram (GET con `hub.challenge`).

### 8.3 Tests de Regresión Prioritarios

```typescript
// Ejemplos de test cases (Vitest)
describe('Keyword Matcher', () => {
  it('should match exact keyword "BASUSTA"', async () => { ... });
  it('should match case-insensitive "basusta"', async () => { ... });
  it('should match keyword within longer text "quiero BASUSTA por favor"', async () => { ... });
  it('should NOT match partial "BASUST"', async () => { ... });
  it('should NOT match unrelated comment "me gusta!"', async () => { ... });
});

describe('POST /webhooks/instagram', () => {
  it('should return 200 and enqueue job for comment with keyword', async () => { ... });
  it('should return 200 and discard comment without keyword', async () => { ... });
  it('should return 403 for invalid HMAC signature', async () => { ... });
  it('should return 200 for GET verification handshake', async () => { ... });
});

describe('DM Dispatcher', () => {
  it('should send DM with static discount code', async () => { ... });
  it('should NOT send duplicate DM to same user', async () => { ... });
  it('should persist dm_record after successful send', async () => { ... });
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

*Fin del documento SPECS.md — v3.0.0*  
*Changelog:*  
*- v3.0.0 — Eliminado sistema de validación/canje de códigos. El DM es un "contrato escrito" con código estático que se presenta verbalmente en el establecimiento.*  
*- v2.0.0 — Trigger cambiado de "follow" a "comment" con keyword matching (ej: "BASUSTA").*  
*Próxima revisión programada: tras aprobación del equipo de ingeniería y legal (uso de datos de usuarios de Instagram).*