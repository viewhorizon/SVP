# Aportes y Sugerencias - Ecosistema SPV + Inventario

Documento de referencia para integracion de:

1. Sistema de votos y puntos.
1. Inventario de objetos.
1. Actividades y conversion de puntos.

## Flujo general

Votos -> Puntos <- Actividades -> Inventario

## API sugerida

- `/api/votes`
- `/api/points`
- `/api/inventory`
- `/api/activities`

## Seguridad recomendada

- JWT con expiracion corta.
- Rate limiting por usuario e IP.
- Validaciones de transferencias y saldo.