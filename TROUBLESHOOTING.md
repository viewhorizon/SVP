# Troubleshooting - Sistema Votos y Puntos

## Preview en blanco / Build Exitoso pero sin render

### Causas comunes y soluciones

#### 1. Error: `priorityStyles is not defined`
- **Causa**: `priorityStyles` está definido en `kanbanService.ts` pero no se importa en `KanbanBoard.tsx`
- **Solución**: Agregar import: `import { priorityStyles } from '@/services/kanbanService';`
- **Estado**: ✅ Corregido

#### 2. vite-plugin-singlefile bloqueando runtime por CSP
- **Causa**: Entornos como v0.dev bloquean scripts inline inyectados por el plugin
- **Solución**: Usar `vite.config.prod.ts` para builds de producción sin singlefile
- **Estado**: ✅ Configuración creada

Build sin singlefile:
```bash
npm run build:prod-no-single
npm run preview:prod
```

#### 3. Error de montaje de React
- **Causa**: Error en JSX antes del render inicial
- **Solución**: AppErrorBoundary captura errores y muestra fallback
- **Estado**: ✅ AppErrorBoundary implementado en `main.tsx`

#### 4. LocalStorage bloqueado/deshabilitado
- **Causa**: Entornos restrictivos pueden deshabilitar localStorage
- **Solución**: Wrap localStorage en try/catch con fallback en memoria
- **Estado**: ✅ Implementado en `kanbanService.ts` (`safeReadTasks`, `persistTasks`)

#### 5. Console errors silenciosos
- **Diagnóstico**: Ejecutar script de diagnóstico
```bash
node scripts/diagnose.js
```
- **Estado**: ✅ Script creado

## Scripts Disponibles

| Script | Descripción |
|--------|-------------|
| `npm run dev` | Development server |
| `npm run build` | Build con vite-plugin-singlefile |
| `npm run preview` | Preview del build |
| `npm run build:prod-no-single` | **Build SIN singlefile** (recomendado para producción) |
| `npm run preview:prod` | Preview del build sin singlefile |
| `npm run check` | Verificación TypeScript |
| `npm run diagnose` | Script de diagnóstico |

## Backend - Errores comunes

### Error: `feature "UUID" is not installed`
```bash
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- Better: pgcrypto para gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

### Error: `require use of type declarations`
- Asegúrate de tener `@types/node` instalado
- File: `src/vite-env.d.ts` contiene definiciones Vite

## Logs de Diagnóstico

El script `scripts/diagnose.js` genera:
- Estado de dependencias
- Estado de archivos críticos
- Errores de montaje detectables

Ejecutar antes de abrir issue:
```bash
npm run diagnose > diagnosis.txt
```

## Contacto de Agentes

| Agente | Responsabilidad |
|--------|-----------------|
| **GLM** | Configuración build, Backend (Node.js/Express), SQL, Scripts diagnóstico |
| **G5c** | Componentes frontend (SPV, Kanban), Lógica UI, Servicios frontend |

## Checklist para Debug Preview en Blanco

1. [ ] Abrir consola del navegador (F12)
2. [ ] Buscar errores JS rojos ("Uncaught...")
3. [ ] Ejecutar `npm run diagnose`
4. [ ] Revisar `TROUBLESHOOTING.md` para el error específico
5. [ ] Si es CSP/vite-plugin-singlefile: usar `build:prod-no-single`
6. [ ] Si es import error: revisar imports en componentes
7. [ ] Ejecutar `npm run build` para verificar tipos