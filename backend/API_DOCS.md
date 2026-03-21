# SPV API - Documentación

## Backend Endpoints

### Votos API (K-11)

#### `POST /api/votes`
**Descripción**: Registrar un voto y generar puntos automáticamente

**Headers**:
```
Authorization: Bearer <firebase_token>
Content-Type: application/json
```

**Body**:
```json
{
  "activityId": "uuid-de-actividad",
  "activityScope": "local", // "global" | "local" | "digital" | "real"
  "requestId": "uuid-opcional (default: random)",
  "eventId": "uuid-opcional (default: random)",
  "metadata": {}
}
```

**Respuestas**:

200/201 OK - Voto procesado:
```json
{
  "idempotent": false,
  "pointsGranted": 3,
  "balance": {
    "available_points": 123,
    "lifetime_points": 1240
  },
  "limits": {
    "dailyLimit": 5,
    "usedVotes": 2,
    "remainingVotes": 3
  },
  "events": [
    { "event_id": "...", "type": "VOTE_CAST" },
    { "request_id": "...", "type": "POINTS_GRANTED" }
  ]
}
```

200 OK - Voto ya procesado (idempotente):
```json
{
  "idempotent": true,
  "message": "Voto ya procesado previamente",
  "pointsGranted": 0,
  "balance": { "available_points": 123, "lifetime_points": 1240 }
}
```

429 Too Many Requests - Límite excedido:
```json
{
  "error": "Has alcanzado el límite diario de votos",
  "limits": {
    "dailyLimit": 5,
    "usedVotes": 5,
    "remainingVotes": 0
  }
}
```

400 Bad Request - Datos inválidos:
```json
{ "error": "activityId es requerido" }
```

---

#### `GET /api/votes/count`
**Descripción**: Contar votos del usuario (hoy, opcionalmente por actividad)

**Headers**:
```
Authorization: Bearer <firebase_token>
```

**Query Parameters**:
- `activityId` (opcional): UUID de la actividad específica

**Respuesta**:
```json
{
  "userId": "uuid",
  "activityId": "uuid",
  "votesToday": 3
}
```

---

#### `GET /api/votes/limits`
**Descripción**: Consultar límites diarios del usuario

**Headers**:
```
Authorization: Bearer <firebase_token>
```

**Respuesta**:
```json
{
  "userId": "uuid",
  "dailyLimit": 5,
  "usedVotes": 2,
  "remainingVotes": 3,
  "nextResetAt": "2026-03-19T00:00:00Z"
}
```

---

### Puntos API (K-12)

#### `POST /api/points/credit`
**Descripción**: Acreditar puntos a un usuario (operación atómica con ledger)

**Headers**:
```
Authorization: Bearer <firebase_token>
Content-Type: application/json
```

**Body**:
```json
{
  "userId": "uuid-del-usuario (default: propio)",
  "amount": 10,
  "requestId": "uuid-opcional (default: random)",
  "eventId": "uuid-opcional (default: random)",
  "reason": "manual_credit" (opcional)
}
```

**Respuestas**:

201 Created:
```json
{
  "userId": "uuid",
  "amount": 10,
  "requestId": "uuid",
  "eventId": "uuid",
  "balance": {
    "available_points": 132,
    "lifetime_points": 1250
  }
}
```

400 Bad Request:
```json
{ "error": "amount debe ser un número positivo" }
```

---

#### `POST /api/points/debit`
**Descripción**: Debitar puntos (valida saldo disponible)

**Headers**:
```
Authorization: Bearer <firebase_token>
Content-Type: application/json
```

**Body**:
```json
{
  "userId": "uuid-del-usuario (default: propio)",
  "amount": 5,
  "requestId": "uuid-opcional",
  "eventId": "uuid-opcional",
  "reason": "manual_debit" (opcional)
}
```

**Respuestas**:

201 Created:
```json
{
  "userId": "uuid",
  "amount": 5,
  "balance": { "available_points": 120, "lifetime_points": 1240 }
}
```

409 Conflict - Saldo insuficiente:
```json
{ "error": "Saldo insuficiente" }
```

---

#### `POST /api/points/transfer`
**Descripción**: Transferir puntos entre usuarios (transaccional)

**Headers**:
```
Authorization: Bearer <firebase_token>
```

**Body**:
```json
{
  "toUserId": "uuid-del-destinatario",
  "amount": 10,
  "requestId": "uuid-opcional"
}
```

**Respuestas**:

201 Created:
```json
{
  "fromUserId": "uuid",
  "toUserId": "uuid",
  "amount": 10,
  "fromBalance": { "available_points": 110, "lifetime_points": 1240 },
  "toBalance": { "available_points": 10, "lifetime_points": 10 },
  "transferId": "uuid"
}
```

400/409:
```json
{ "error": "Error descripción" }
```

---

#### `POST /api/points/convert`
**Descripción**: Convertir puntos a objetos/inventario (llama a cross_system_transactions)

**Headers**:
```
Authorization: Bearer <firebase_token>
```

**Body**:
```json
{
  "itemId": "uuid-del-item",
  "pointsCost": 50,
  "requestId": "uuid-opcional"
}
```

**Respuestas**:

201 Created:
```json
{
  "userId": "uuid",
  "itemId": "uuid",
  "pointsCost": 50,
  "balanceAfter": { "available_points": 70, "lifetime_points": 1240 },
  "crossSystemTransactionId": "uuid",
  "convertedAt": "2026-03-18T12:00:00Z"
}
```

---

#### `GET /api/points/balance/:userId`
**Descripción**: Consultar saldo disponible + histórico

**Headers**:
```
Authorization: Bearer <firebase_token>
```

**Respuesta**:
```json
{
  "userId": "uuid",
  "available_points": 120,
  "lifetime_points": 1240,
  "last_ledger_at": "2026-03-18T12:00:00Z",
  "created_at": "2026-01-01T00:00:00Z",
  "updated_at": "2026-03-18T12:00:00Z"
}
```

---

## Base de Datos

### Tablas Core SPV

#### `points_wallet`
- `user_id` (UUID, PK) - ID del usuario
- `available_points` (BIGINT) - Puntos disponibles
- `lifetime_points` (BIGINT) - Histórico total
- `last_ledger_at` (TIMESTAMPTZ) - Última actualización

#### `points_ledger`
- `ledger_id` (UUID, PK) - ID del registro ledger
- `request_id` (UUID) - Para idempotencia
- `event_id` (UUID, UNIQUE) - Evento de dominio único
- `user_id` (UUID) - Usuario afectado
- `direction` (ENUM: CREDIT/DEBIT) - Dirección del movimiento
- `operation_type` (ENUM) - Tipo de operación
- `amount` (BIGINT) - Cantidad de puntos
- `balance_before/after` - Balance antes/después
- `related_user_id` - Usuario relacionado (transferencias)
- `activity_id` - Actividad relacionada (votos)
- `metadata` (JSONB) - Datos flexibles

#### `votes`
- `vote_id` (UUID, PK)
- `user_id` (UUID)
- `activity_id` (UUID)
- `request_id` (UUID) - Para idempotencia
- `event_id` (UUID)
- `points_generated` (BIGINT) - Puntos generados
- `activity_scope` (VARCHAR) - global/local/digital/real
- `metadata` (JSONB)

#### `point_rules`
- reglas de conversión votos→puntos versionadas
- formula JSONB con multipliers

#### `point_limits`
- límites por día/usuario/actividad
- para antifraude

---

## Convenciones

- **Auth**: Firebase token en header `Authorization: Bearer <token>`
- **HTTP Status**: Estándar (200, 201, 400, 409, 429, 500)
- **Errores**: `{ "error": "mensaje" }`
- **Transacciones**: Siempre con `withTransaction`
- **IDempotencia**: Cada request tiene `request_id` opcional
- **UUIDs**: Todos los IDs son UUID
- **Timestamps**: UTC con `NOW()`

---

## Ejecución

```bash
# Desarrollo
cd backend
npm install
node src/app.ts

# O con pm2
pm2 start src/app.ts --name spv-api

# Variables de entorno
DATABASE_URL=postgresql://...
PORT=4000

# Health check
curl http://localhost:4000/health
```

---

## Integraciones

- **SQLite**: Para votos `points_ledger` (SQLite ledger de respaldo opcional)
- **Firebase**: Para autenticación de usuarios
- **Cross System**: `cross_system_transactions` para integración Inventario/Parque 3D