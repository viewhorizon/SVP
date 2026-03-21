# 📋 Aportes y Sugerencias - Ecosistema SPV + Inventario

> Sistema de Votos y Puntos (SPV) + Inventario + Actividades

---

## 🎯 Resumen del Ecosistema

El ecosistema completo está integrado por:

1. **Sistema de Votos y Puntos (SPV)** - Motor de generación de puntos
2. **Inventario** - Gestión de objects/items con propiedades
3. **Actividades** - Generan puntos * hora de actividad realizada
4. **Transformación** - Todos los puntos se pueden transformar en objetos del inventario
5. **Premios** - Generación de objetos como premios por logros

**Flujo:** Votos → Puntos ← Actividades → Inventario

---

## 📊 Base de Datos - Schema PostgreSQL

### Tablas Principales

```sql
-- Usuarios
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Actividades (globales y locales)
CREATE TABLE activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    type ENUM('global', 'local') NOT NULL,
    category VARCHAR(50),
    points_per_hour DECIMAL(10,2) NOT NULL,
    intensity INTEGER CHECK (intensity BETWEEN 1 AND 5), -- 1-5 escala
    total_entities INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Votos registrados
CREATE TABLE votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    activity_id UUID REFERENCES activities(id),
    points_generated DECIMAL(10,2),
    created_at TIMESTAMP DEFAULT NOW(),
    INDEX (user_id, created_at),
    UNIQUE (user_id, activity_id, DATE(created_at))
);

-- Puntos de usuarios
CREATE TABLE user_points (
    user_id UUID PRIMARY KEY REFERENCES users(id),
    points_available INTEGER DEFAULT 0,
    max_points INTEGER DEFAULT 100,
    total_points_accumulated INTEGER DEFAULT 0,
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Transacciones de puntos
CREATE TABLE point_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    type ENUM('vote', 'transfer_in', 'transfer_out', 'earned', 'reward', 'purchase'),
    amount INTEGER NOT NULL,
    description TEXT,
    related_user_id UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Items del catálogo
CREATE TABLE items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    category ENUM('weapon', 'armor', 'tool', 'material', 'currency', 'reward'),
    rarity ENUM('common', 'uncommon', 'rare', 'epic', 'legendary') DEFAULT 'common',
    cost INTEGER NOT NULL,
    properties JSONB, -- {damage, defense, utility, bonus_point_multiplier, etc.}
    created_at TIMESTAMP DEFAULT NOW()
);

-- Inventario de usuarios
CREATE TABLE inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    item_id UUID REFERENCES items(id),
    quantity INTEGER DEFAULT 1,
    obtained_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (user_id, item_id)
);

-- Logros y recompensas
CREATE TABLE achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    name VARCHAR(200),
    description TEXT,
    points_reward INTEGER,
    item_reward JSONB,
    completed_at TIMESTAMP DEFAULT NOW()
);
```

---

## 🔌 API Endpoints Sugeridos

### Sistema de Votos
```
POST   /api/vote                    - Registrar voto, generar puntos
GET    /api/votes/today             - Votos del usuario hoy
GET    /api/votes/create-vote-token - Token anti-spam para validación
```

### Actividades
```
GET    /api/activities              - Listar todas las actividades
GET    /api/activities/:id          - Detalle de una actividad
GET    /api/activities/global       - Solo actividades globales
GET    /api/activities/local        - Solo actividades locales
POST   /api/activities              - Crear nueva actividad (admin)
PUT    /api/activities/:id          - Actualizar actividad (admin)
```

### Sistema de Puntos
```
GET    /api/points                  - Ver puntos del usuario
GET    /api/points/history          - Historial de transacciones
POST   /api/points/transfer         - Transferir puntos entre usuarios
POST   /api/points/receive          - Recibir puntos (webhook/external)
GET    /api/points/transactions     - Lista de transacciones
```

### Inventario y Tienda
```
GET    /api/inventory               - Ver inventario del usuario
POST   /api/inventory/purchase      - Comprar item con puntos
GET    /api/shop                    - Ver catálogo de items
GET    /api/shop/:category          - Items por categoría
```

### Analytics (Admin)
```
GET    /api/analytics/users         - Métricas de usuarios
GET    /api/analytics/activities    - Métricas de actividades
GET    /api/analytics/points        - Estadísticas de puntos
GET    /api/analytics/items         - Popularidad de items
```

### WebSocket (Tiempo Real)
```
WS     /ws/points                   - Actualizaciones de puntos en vivo
WS     /ws/votes                    - Contadores de votos en vivo
WS     /ws/inventory                - Cambios de inventario
```

---

## 🧮 Lógica de Cálculo de Puntos

### Fórmula Principal

```
Puntos_por_voto = (votos_totales_actividad / 1000) × pts_hora × factor_usuario
```

Donde:

```
factor_usuario = base_multiplier 
               + achievement_multiplier 
               + item_bonus_multiplier 
               + activity_streak_bonus
```

Componentes:

| Componente | Descripción | Valores de ejemplo |
|------------|-------------|-------------------|
| `base_multiplier` | Multiplicador base del sistema | 1.0 |
| `achievement_multiplier` | Bonificación por logros desbloqueados | 0.1 - 0.5 |
| `item_bonus_multiplier` | Items de inventario que aumentan generación | 0.05 - 0.3 |
| `activity_streak_bonus` | Racha de votos consecutivos | 0.1 - 0.25 |

### Ejemplo de Cálculo

```
Actividad: "Peluquerías" 
- Votos totales: 50,000
- Puntos/hora: 1.03
- Usuario tiene item bonus (+10% puntos)
- Usuario tiene 3 logros (+15% puntos)
- Racha de 7 días (+10% puntos)

Puntos_por_voto = (50,000 / 1000) × 1.03 × (1 + 0.10 + 0.15 + 0.10)
                = 50 × 1.03 × 1.35
                = 69.525 ≈ 69 puntos
```

---

## 🔄 Diagrama de Flujo del Sistema

```
┌─────────────────┐
│   Usuario vota  │ (Actividad global/local)
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────┐
│  Sistema SPV                    │
│  - Validar límite diario        │
│  - Calcular puntos generados    │
│  - Actualizar contadores        │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  Base de Datos (PostgreSQL)     │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  Puntos del Usuario             │
│  - points_available            │
│  - total_points_accumulated     │
└────────┬────────────────────────┘
         │
   ┌─────┼─────┬────────────┬─────────┐
   ▼     ▼     ▼            ▼         ▼
┌──────┐┌─────┐┌──────────┐┌────────┐┌─────────┐
│Invent││Trans││  Tienda  ││Premios ││ Recibir │
│ario  ││ferir││ (items)  ││Logros  ││ puntos  │
└──────┘└─────┘└──────────┘└────────┘└─────────┘
   │               │             │          │
   └───────────────┴─────────────┴──────────┘
                   │
                   ▼
        ┌─────────────────┐
        │  Items en       │
        │  Inventario     │
        │  (con propiedades)
        └─────────────────┘
```

---

## 🛡️ Recomendaciones de Seguridad

### 1. Autenticación y Autorización
```javascript
// JWT con refresh tokens
- Access token: 15 min expiración
- Refresh token: 7 días expiración
- Usar httpOnly cookies
- Implementar token rotation
```

### 2. Rate Limiting
```javascript
// Límites sugeridos
Votos: 5 por día por usuario
Transferencias: 10 por hora por usuario
Peticiones API: 100 por minuto por IP
```

### 3. Validaciones
```javascript
// Transferencias
- Validar que @usuario existe
- Verificar saldo suficiente
- Límite de transferencia por operación
- Confirmar usuario no está bloqueado

// Votos
- Validar que la actividad existe
- Verificar límite diario
- Prevenir votos simultáneos (race condition)
- Token anti CSRF
```

### 4. Protección contra Abuso
```sql
-- Tablas de control
CREATE TABLE user_limits (
    user_id UUID PRIMARY KEY,
    votes_today INTEGER DEFAULT 0,
    transfers_hour INTEGER DEFAULT 0,
    last_vote_reset TIMESTAMP,
    last_transfer_reset TIMESTAMP
);

CREATE TABLE blocked_users (
    user_id UUID PRIMARY KEY,
    reason TEXT,
    blocked_at TIMESTAMP,
    blocked_until TIMESTAMP
);
```

---

## 🚀 Tecnologías Recomendadas

### Backend
| Propósito | Tecnología | Por qué |
|-----------|------------|---------|
| Runtime | Node.js 20+ | Ecosistema amplio |
| Framework | NestJS | Estructura enterprise, TypeScript nativo |
| ORM | Prisma | Type-safe, migrations automáticas |
| Database | PostgreSQL 16 | Confiable, soporta JSONB |
| Cache | Redis 7+ | Performance para contadores |
| Auth | Passport + JWT | Estándar de la industria |

### Frontend
| Propósito | Tecnología | Por qué |
|-----------|------------|---------|
| Framework | React 18 | Componentes, hooks |
| Build Tool | Vite | Rápido, moderno |
| Styling | Tailwind CSS | Utility-first, responsive |
| Icons | Lucide React | Ligero, árbol |
| State | Zustand | Simple, sin boilerplate |

### Infraestructura
| Propósito | Tecnología | Por qué |
|-----------|------------|---------|
| Container | Docker | Consistencia |
| Reverse Proxy | Nginx | Performance, SSL |
| Web Server | PM2 | Process management |
| Monitoring | Prometheus + Grafana | Métricas |
| Logging | Winston | Logs estructurados |

---

## 📦 Schema de Items (JSONB)

 Ejemplo de estructura para propiedades de items:

```json
{
  "weapon": {
    "damage": 25,
    "speed": 1.5,
    "range": "melee",
    "element": null,
    "durability": 100
  },
  "armor": {
    "defense": 30,
    "mobility": 0.8,
    "resistance": ["fire", "ice"],
    "durability": 100
  },
  "tool": {
    "utility": 1,
    "efficiency": 1.2,
    "durability": 50
  },
  "material": {
    "rarity": "rare",
    "crafting_value": 3,
    "stackable": true,
    "max_stack": 99
  },
  "currency": {
    "type": "points",
    "value": 100,
    "tradable": true
  },
  "reward": {
    "bonus_type": "point_multiplier",
    "bonus_value": 0.1,
    "duration": "permanent"
  }
}
```

---

## ✅ Checklist de Prioridad Alta

1. [ ] Configurar PostgreSQL con schema completo
2. [ ] Implementar API endpoints básicos (vote, points, inventory)
3. [ ] Autenticación JWT con refresh tokens
4. [ ] Rate limiting para votos y transferencias
5. [ ] Lógica de cálculo de puntos según fórmula
6. [ ] Conectar frontend React con backend
7. [ ] Implementar límite diario de votos
8. [ ] Validación completa de transferencias
9. [ ] Sync entre SPV y Inventario
10. [ ] Pruebas de integración

---

## 📊 Métricas a Monitorear

### Sistema SPV
- Votos totales por día
- Votos por actividad
- Puntos generados por hora
- Ratio de conversión votos → puntos

### Inventario
- Items más comprados
- Items por rareza en inventarios
- Puntos gastados en tienda
- Distribución de items por usuario

### Usuarios
- Usuarios activos por día
- Racha de participación media
- Transferencias entre usuarios
- Logros desbloqueados

---

## 🔄 Futuras Mejoras

1. **Marketplace P2P** - Intercambio de items entre usuarios
2. **Staking de puntos** - Delegar puntos por recompensas
3. **Gestión de gremios** - Inventario compartido por equipo
4. **Actividades personales** - Crear y compartir actividades propias
5. **Gamificación avanzada** - Badges, niveles, retos semanales
6. **AI Recommendations** - Sugerir items basados en actividad
7. **Mobile App** - React Native / Capacitor
8. **Blockchain opcional** - Para transacciones verificables

---

## 📞 Próximos Pasos Sugeridos

1. **Revisar plan de preproducción** del usuario
2. **Definir tecnología del backend** (confirmar Node.js/NestJS)
3. **Implementar schema PostgreSQL** en base de datos
4. **Crear backend API** con endpoints principales
5. **Conectar frontend** con backend
6. **Implementar autenticación completa**
7. **Testing end-to-end** del flujo completo
8. **Desplegar** en staging para pruebas

---

**📌 Documento actualizado con todos los aportes proporcionados.**

Fecha: 2026 | Autor: AI Assistant | Proyecto: Ecosistema SPV + Inventario