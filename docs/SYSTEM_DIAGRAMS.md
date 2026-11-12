# Diagramas canónicos del sistema SVP

> Estos diagramas describen la implementación actual. Deben actualizarse junto con cambios de rutas, contratos, módulos o persistencia.

## 1. Diagrama estructural

```mermaid
flowchart TB
  UI["src/components y vistas"] --> Hook["src/hooks/useSpv.ts"]
  Hook --> Client["src/services/spvApi.ts\nAdaptador externo"]
  Hook --> NeonClient["src/services/neonClient.ts\nCliente vista SVP"]
  Client --> HTTP["src/services/httpClient.ts"]
  NeonClient --> HTTP
  HTTP --> Routes["backend/src/routes"]
  Routes --> Validation["backend/src/validation/schemas.ts"]
  Routes --> Services["backend/src/services"]
  Services --> Repositories["backend/src/db"]
  Repositories --> Neon[("PostgreSQL / Neon")]
  Routes --> Ops["Operaciones y monitoreo"]
```

## 2. Diagrama de clases y responsabilidades

```mermaid
classDiagram
  class SPVSystem {
    +renderActivities()
    +renderOperations()
    +handleSimulation()
  }
  class UseSpv {
    +activities
    +points
    +history
    +castVote(activityId)
    +refresh()
  }
  class SpvApi {
    +getActivities()
    +castVote(request)
    +getPoints()
    +getTransactions()
  }
  class HttpClient {
    +requestJSON(path, options)
    +requestId
    +errorState
  }
  class SpvMvpController {
    +getActivities()
    +castVote(request)
    +getStrategicState()
  }
  class ValidationSchemas {
    +validateVote(request)
    +validateExternalContext(request)
  }
  class NeonModel {
    +queryParameterized(sql, params)
    +transaction(callback)
  }
  SPVSystem --> UseSpv : consumes
  UseSpv --> SpvApi : delegates
  SpvApi --> HttpClient : uses
  HttpClient --> SpvMvpController : HTTP contract
  SpvMvpController --> ValidationSchemas : validates
  SpvMvpController --> NeonModel : persists
```

## 3. Flujo de código: actividad externa a valor SVP

```mermaid
sequenceDiagram
  participant E as Plataforma externa
  participant V as Vista SVP
  participant H as useSpv
  participant A as spvApi/httpClient
  participant C as Controlador Express
  participant M as Modelo/Neon

  E->>V: actividad + externalReference
  V->>H: seleccionar actividad
  H->>A: POST /api/svp/votes
  A->>C: contrato validado con requestId
  C->>C: validar usuario, actividad, puntos e idempotencia
  C->>M: transacción voto + ledger + historial
  M-->>C: saldo, impacto, tarea y objetivo
  C-->>A: respuesta de impacto SVP
  A-->>H: estado actualizado
  H-->>V: puntos, historial y notificación
```

## 4. Diagrama de actividad: simulación y validación

```mermaid
flowchart TD
  Start([Inicio]) --> ChooseDomain{"Seleccionar contexto externo"}
  ChooseDomain --> Inventory["Inventory: objeto gamer"]
  ChooseDomain --> CRM["CRM: actividad de cliente"]
  ChooseDomain --> Ecommerce["E-commerce: operación comercial"]
  ChooseDomain --> Custom["Custom: actividad externa identificada"]
  Inventory --> SelectActivity["Seleccionar actividad SVP real"]
  CRM --> SelectActivity
  Ecommerce --> SelectActivity
  Custom --> CreateCard["Crear actividad mediante formulario SVP"]
  CreateCard --> SelectActivity
  SelectActivity --> Contract["Construir contrato externo"]
  Contract --> Validate{"¿Contrato válido?"}
  Validate -- No --> Error["Mostrar error + requestId; no persistir"]
  Validate -- Sí --> Vote["Emitir voto"]
  Vote --> Persist["Persistir voto y puntos en Neon"]
  Persist --> Impact["Actualizar saldo, historial, tarea y objetivo"]
  Impact --> Feedback["Mostrar feedback y logs operativos"]
  Error --> End([Fin])
  Feedback --> End
```

## Reglas de lectura

- `spvApi.ts` es el adaptador de integración para plataformas externas; no es un script descartable.
- `neonClient.ts` sirve al flujo de vista SVP y no reemplaza automáticamente el contrato externo.
- Inventory, CRM, E-commerce y Custom son contextos de origen; no son mercados ni dinero por sí mismos.
- Los puntos son valor SVP acumulado. Su cotización, comercialización o uso sobre objetos de inventario requiere reglas e integración externa explícitas.
- Una respuesta válida debe conservar trazabilidad: `externalDomain`, `externalReference`, `operationId`, `valueUnit`, voto, ledger e impacto.
- Todo error de contrato debe detener la persistencia y mostrar un estado observable; nunca debe convertirse silenciosamente en datos de demostración.

## Relación con el plan original

La implementación sigue el flujo MVC documentado:

```text
Vista → Hook → Adaptador/cliente → Controlador → Validación → Servicio/modelo → Neon
```

La arquitectura usa módulos y funciones TypeScript, no una jerarquía clásica de clases. El diagrama de clases representa responsabilidades y contratos, no afirma que cada caja sea una clase concreta en el runtime.
