# Railway — Tres Cielos

Fuente de verdad del proyecto: este directorio (Infrastructure as Code).

```bash
railway login
railway link
railway config plan
railway config apply
```

Runbook: [docs/setup/07-railway-deploy.md](../docs/setup/07-railway-deploy.md)

No pongas secretos en `railway.ts`. Usa `preserve()` + `railway variable set`.
