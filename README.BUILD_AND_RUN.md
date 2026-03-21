# Build and Run Guide

## Requisitos Previos
- Node.js 18+ (recomendado 20+)
- npm 9+

## Scripts Disponibles

```bash
npm run dev             # Inicia servidor de desarrollo (vite dev server)
npm run build           # Construye para producción con singlefile (v0.dev compatible)
npm run build:prod-no-single  # Construye sin singlefile (CSP-friendly)
npm run preview         # Prevéw el build local
npm run preview:prod    # Prevéw build prod-no-single
npm run check           # Verifica TypeScript sin generar archivos
```

## ¿Por qué dos comandos de build?

### `npm run build` (default)
Usa `vite.config.ts` que incluye `vite-plugin-singlefile`.  
Genera un solo archivo `index.html` con JS/CSS inline.

**Pros:** Despliegue simple, un solo archivo  
**Contras:** Puede fallar en entornos con CSP estricto (v0.dev, some sandboxes)

**Usar para:** v0.dev preview, standalone HTML simple

### `npm run build:prod-no-single`
Usa `vite.config.prod.ts` sin `vite-plugin-singlefile`.  
Genera separado: `index.html`, `assets/*.js`, `assets/*.css`

**Pros Mayor compatibilidad con CSP,cache optimizado  
**Contras:** Múltiples archivos, despliegue más complex

**Usar para:** Producción real, Vercel/Netlify/Cloudflare Pages deployment

## Configuración de Entorno

Variables de entorno (opcional):
```bash
# Copia example:
cp .env.example .env

# Editar .env (opcional):
VITE_API_BASE_URL=http://localhost:3000/api
VITE_DEBUG=false
VITE_THEME_DEFAULT=auto
```

## Diagnóstico de Problemas

### Preview en blanco

1. Build local works?
```bash
npm run build
npm run preview
# Abre http://localhost:4173
```

2. Si funciona local pero blank en v0.dev:
```bash
npm run build:prod-no-single
# Sube dist-prod/ en vez de dist/
```

3. Debug en browser:
- Abre DevTools (F12)
- Pega el contenido de `debug-inject.js` en Console
- Ejecuta `debugTool.fullDiagnosis()`

4. Verifica console errors:
- `[window.error]` - Errores de runtime
- `[unhandledrejection]` - Promesas rechazadas
- Failed to resolve module - Imports rotos

### Build酸菜
```bash
# Cleanup dependencies
rm -rf node_modules package-lock.json
npm install

# Verifica TypeScript
npm run check
```

### LocalStorage Issues
La app usa `localStorage` intensamente. Si está deshabilitado:
- Puede fallar el montaje
- Use `debug-inject.js` → `debugTool.clearAll()` para limpiar

## Estructura de Proyecto

```
.
├── src/
│   ├── components/       # Componentes reutilizables
│   ├── services/         # API y business logic
│   ├── App.tsx          # Shell principal
│   ├── SPVSystem.tsx    # Sistema de Votes y Puntos
│   ├── KanbanBoard.tsx  # Tablero Kanban
│   └── main.tsx         # Punto de entrada
├── backend/
│   ├── src/            # Node.js/Express backend
│   └── sql/            # PostgreSQL schema
├── shared/             # Tipos compartidos (futuro)
├── vite.config.ts      # Config dev + prod (singlefile)
├── vite.config.prod.ts # Config prod sin singlefile
├── debug-inject.js     # Script de diagnóstico browser-side
├── TROUBLESHOOTING.md  # Guía detallada de troubleshooting
└── .env.example        # Template de env variables
```

## Contactar para Soporte

Antes de reportar issues, incluye:
1. Navegador y versión
2. Node.js version: `node --version`
3. Build command usado
4. Console errors completos
5. Si el problema ocurre localmente también

Lee `TROUBLESHOOTING.md` para detalles más profundos.