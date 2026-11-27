# Troubleshooting - Sistema Votos y Puntos

## Preview en blanco

1. Revisar consola del navegador.
1. Ejecutar `npm run build` y luego `npm run preview`.
1. Probar `node scripts/diagnose.js`.

## Errores comunes

- Imports rotos en componentes Kanban.
- LocalStorage deshabilitado en entorno restringido.
- Dependencias no instaladas.

## Checklist rapido

1. `npm install`
1. `npm run check`
1. `npm run build`