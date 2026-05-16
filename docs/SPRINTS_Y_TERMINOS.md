# Sprints y Terminos Tecnicos

## Objetivo del documento

Este archivo resume que se implemento por sprint y aclara terminos que pueden sonar complejos durante el desarrollo.

## Resumen por sprint

### Sprint Base

- Integracion de frontend React + TypeScript + Vite con tablero Kanban y modulo SPV.
- Endpoints principales de votos, puntos, analisis IA y metricas.
- Seguridad base: auth, validacion de payloads, rate limit e idempotencia.

### Sprint 1 (Ledger + Outbox)

- Hash-chain para auditoria de inventario.
- Verificador de integridad del ledger.
- Outbox events y dispatcher para entrega at-least-once.
- Endpoints versionados `/api/v1/*` para integraciones externas.

### Sprint 2 (Policy + Dispatcher)

- Policy Engine desacoplado para evaluar reglas y generar `ProposedMutation`.
- Versionado de reglas de valorizacion.
- Lifecycle de inventario: `transform`, `destroy`, `transfer`.
- Panel de trazabilidad en Kanban (requestId/eventId) para soporte operativo.

## Terminos clave (explicados simple)

- `requestId`: identificador unico de una solicitud API para rastrear un error o transaccion de punta a punta.
- `eventId`: identificador unico de un evento de negocio (por ejemplo, resultado de una actividad externa).
- `Idempotencia`: repetir la misma solicitud no duplica el efecto.
- `Concurrencia`: varias solicitudes al mismo tiempo sin romper consistencia de datos.
- `Outbox Pattern`: guardar eventos en DB local y enviarlos luego con reintentos seguros.
- `At-least-once`: un evento se intenta entregar una o mas veces hasta confirmar.
- `Policy Engine`: motor de reglas desacoplado que decide mutaciones propuestas segun contexto.
- `ProposedMutation`: propuesta de cambio (sin aplicar aun) que luego pasa por validacion y ejecucion transaccional.
- `Hash-chain`: cada evento incluye hash del evento anterior para detectar alteraciones.
- `Firma de auditoria`: firma HMAC de un reporte para verificar que no fue alterado en transito.

## Glosario operativo integrado

- `SPV`: puntos del sistema central generados por actividad y votos.
- `LiveOps`: sistema local (parque real/3D) con economia propia.
- `inventory_catalog`: catalogo de items comprables (globales o locales).
- `user_inventory`: inventario de items por usuario.
- `credit`: acredita puntos SPV al wallet.
- `debit`: debita puntos SPV del wallet.
- `transfer`: mueve puntos entre usuarios.
- `convert`: convierte entre unidades/sistemas (SPV <-> LiveOps, SPV <-> objetos).
- `scope=global`: item o regla valida para todo el ecosistema.
- `scope=local`: item o regla asociada a un `park_id`.
- `rate`: cotizacion usada para conversion entre sistemas.
- `points_wallet`: saldo disponible por usuario.
- `points_ledger`: historial contable append-only de movimientos.
- `cross_system_transactions`: bitacora de conversiones y operaciones entre dominios.

## Aclaracion sobre "override opcional en request"

Significa que el cliente puede enviar un valor explicito para un caso puntual, pero el backend sigue validando reglas.

Ejemplo practico:

- Transformacion de objeto con `pointsDeltaOverride`.
- Si no se envia override, se calcula por reglas de politica o por configuracion del catalogo.
- Si se envia override, se acepta solo dentro de limites permitidos y queda auditado.

## Regla principal de negocio SPV

Formula principal de puntos:

`puntosSPV = horasActividad * votosTotales`

`votosTotales = votosLocales + votosGlobales`

`score` puede existir como señal de logro, no como reemplazo de la formula base de puntos.

## Responsabilidad del monitor de transacciones

- El monitor principal debe vivir en SVP, porque SVP es la fuente de verdad del ledger y de las reglas contables.
- Cada plataforma externa (TierList, juegos, apps) puede tener su monitor local para UX y alertas internas.
- En integracion, la plataforma externa envia eventos y SVP valida, registra, audita y responde con trazabilidad (`requestId`, `eventId`, `transactionId`).
- El endpoint `GET /api/inventory/ledger/verify` puede devolver firma de auditoria cuando `LEDGER_AUDIT_SIGNING_SECRET` esta configurado.

## Sobre libro contable publico y privacidad

- SVP puede exponer un ledger publico parcial para auditoria, pero no debe publicar datos personales.
- Recomendado: publicar solo identificadores anonimizados y agregados, no PII.
- El balance nominal por usuario debe mantenerse en endpoints autenticados y con permisos.