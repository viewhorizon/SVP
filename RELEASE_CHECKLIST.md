# Release Checklist

## Antes de Publicar

- `npm run check`
- `npm run build`
- Revisar `backend/openapi.yaml`
- Revisar variables en `.env.example`

## Validaciones Minimas API

- `GET /health` responde 200
- `GET /docs` carga Swagger UI
- `POST /api/points/credit` valida idempotencia con `Idempotency-Key`
- `POST /api/webhooks/points/credit` valida HMAC (`x-webhook-timestamp`, `x-webhook-signature`)

## Validaciones Minimas UI

- Kanban renderiza columnas y tareas
- Importar archivo estructurado funciona
- Analizar documento via IA funciona (o fallback local)
- Vista Metricas muestra FODA/SMART

## Publicacion

```bash
git add .
git commit -m "release: cierre funcionalidades SPV + Kanban"
git push origin main
```

## Post Publicacion

- Confirmar ejecucion de `.github/workflows/ci.yml`
- Verificar estado verde en GitHub Actions
- Registrar cambios en `README.GLM_DELIVERABLES.md`