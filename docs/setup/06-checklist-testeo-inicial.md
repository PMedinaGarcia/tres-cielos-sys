# Checklist de testeo del entorno inicial

Validar que el scaffold mínimo está listo para planificar y desarrollar frontend, backend e infraestructura. Ejecutar en orden. Marcar cada ítem al completar.

Referencias: [05-escaneo](05-escaneo-entorno-y-dependencias.md), [07-railway](07-railway-deploy.md), [08-sandbox](08-sandbox-catalogo-xls.md), [backend/09 aceptación multimodal](../backend/09-aceptacion-y-matriz-tests.md).

---

## A. Prerrequisitos de máquina

- [ ] Node.js **22.x** (`node -v`)
- [ ] pnpm **9+** (`pnpm -v`) — `corepack enable` si hace falta
- [ ] Docker Desktop / Engine activo (`docker version`)
- [ ] Docker Compose v2 (`docker compose version`)
- [ ] Git configurado y repo clonado
- [ ] Puertos **3010, 3011, 5440, 6390** libres (re-escanear §2 de [05](05-escaneo-entorno-y-dependencias.md))
- [ ] Copiado `.env.example` → `.env` en raíz (y apps si aplica)

---

## B. Infraestructura local (Compose)

- [ ] `docker compose up -d` sin errores
- [ ] Postgres responde en `localhost:5440`
- [ ] Redis responde en `localhost:6390`
- [ ] Extensión `vector` disponible:  
  `docker compose exec postgres psql -U trescielos -d trescielos_dev -c "CREATE EXTENSION IF NOT EXISTS vector;"`
- [ ] `docker compose ps` muestra ambos servicios `healthy` o `running`

Comandos útiles:

```bash
docker compose up -d
docker compose logs -f postgres
docker compose exec redis redis-cli ping   # PONG
```

---

## C. Monorepo e instalación

- [ ] `pnpm install` en la raíz completa sin errores
- [ ] Workspace ve `apps/web`, `apps/api`, `packages/shared`
- [ ] `pnpm --filter @tres-cielos/shared build` (o typecheck) OK

---

## D. Backend (`apps/api`)

- [ ] `pnpm --filter api prisma:generate`
- [ ] `pnpm --filter api prisma:migrate` (o `migrate dev`) aplica schema
- [ ] `pnpm --filter api sandbox:seed` carga fixtures de catálogo
- [ ] `pnpm --filter api sandbox:eval` pasa asserts golden
- [ ] `pnpm --filter api dev` escucha en **3011**
- [ ] `curl http://localhost:3011/health` → `{"status":"ok"}` (o equivalente)
- [ ] `curl http://localhost:3011/health/ready` → DB ok (± Redis)
- [ ] `curl http://localhost:3011/catalog/sandbox/packages` lista SKUs sembrados
- [ ] Tools stub: `GET /catalog/sandbox/tools/buscar_paquetes?tipoEvento=boda` devuelve filas tipadas

### Smoke backend (copiar/pegar)

```bash
curl -sS http://localhost:3011/health
curl -sS http://localhost:3011/health/ready
curl -sS "http://localhost:3011/catalog/sandbox/tools/obtener_precio_paquete?sku=BODA-J1-ESENCIAL"
```

---

## E. Frontend (`apps/web`)

- [ ] `pnpm --filter web dev` sirve en **http://localhost:3010**
- [ ] Página raíz carga sin error de consola crítico
- [ ] Placeholder `/catalogo` visible
- [ ] `NEXT_PUBLIC_API_URL` apunta a `http://localhost:3011`
- [ ] Desde el browser/network, un fetch a `/health` del API no falla por CORS
- [ ] `pnpm --filter web build` completa

---

## F. Sandbox catálogo XLS (contexto agente)

- [ ] Existen plantillas en `fixtures/catalog/` (xlsx y/o csv)
- [ ] Existe golden JSON alineado a `CatalogSnapshot`
- [ ] Seed no crea embeddings / filas vectoriales de montos
- [ ] `sandbox:eval` falla si se altera un monto esperado (regresión anti-alucinación de fixtures)
- [ ] Leída [08-sandbox-catalogo-xls](08-sandbox-catalogo-xls.md): contexto válido = tool JSON

Casos golden mínimos a verificar (respuesta de tool, no LLM):

| # | Pregunta / intent | Expectativa |
|---|---|---|
| Q1 | Precio paquete esencial boda | Monto del fixture (no inventado) |
| Q2 | Inclusiones SKU premium | Lista tipada del snapshot |
| Q3 | Aforo fuera de rango | Vacío / sin paquete |
| Q4 | SKU inexistente | Error tipado `sin_paquete` / vacío |
| Q5 | Comparar 2 SKUs | Diff con precios del seed |

---

## G. Gate: listo para planificar desarrollo Frontend

- [ ] Panel arranca en 3010
- [ ] Shared types importables desde web
- [ ] Superficies documentadas en `docs/frontend/` siguen siendo el contrato
- [ ] No se requiere Meta/Twilio para maquetar UI
- [ ] Checklist A–E OK

**Criterio:** el equipo puede planificar rutas, componentes y hooks contra API real o mocks sin bloquearse por infra.

---

## H. Gate: listo para planificar desarrollo Backend

- [ ] Nest + Prisma migran y seedan
- [ ] Health/ready verdes
- [ ] Sandbox catalog tools responden datos tipados
- [ ] Contratos DTO en `docs/backend/05` siguen vigentes
- [ ] Cola `inline` documentada; Redis listo para BullMQ
- [ ] Checklist A–D + F OK

**Criterio:** se pueden planificar módulos de dominio (auth, channels, RAG) sobre base ejecutable.

---

## I. Gate: listo para planificar Infra / Railway

- [ ] Compose local estable
- [ ] Leído [07-railway-deploy](07-railway-deploy.md)
- [ ] Variables de `.env.example` mapeadas a Railway
- [ ] Decisión pgvector en Railway documentada (extensión o imagen)
- [ ] Secretos: política de no commitear `.env` verificada
- [ ] Checklist A–B OK

**Criterio:** se puede planificar staging/sandbox en Railway sin reabrir vendor PaaS.

---

## J. Fallos frecuentes

| Síntoma | Causa probable | Acción |
|---|---|---|
| `EADDRINUSE` 3010/3011 | Puerto ocupado | Re-escanear; matar proceso o cambiar puerto en `.env` + docs |
| Prisma no conecta | Compose down o puerto DB ≠ 5440 | `docker compose up -d`; revisar `DATABASE_URL` |
| `/health/ready` 503 | DB o Redis caído | Logs Compose; `REDIS_URL` / `DATABASE_URL` |
| CORS en browser | Origen ≠ `CORS_ORIGINS` | Incluir `http://localhost:3010` |
| `sandbox:seed` falla | Fixture inválido vs Zod | Validar hojas Paquetes/Precios/Inclusiones |
| Extensión `vector` falta | Imagen sin pgvector | Usar `pgvector/pgvector:pg16` |

---

## K. Evidencias para kick-off de desarrollo

Adjuntar o guardar:

1. Salida de `node -v`, `pnpm -v`, `docker compose ps`
2. Captura o log de `/health` y `/health/ready`
3. Log de `sandbox:seed` + `sandbox:eval` OK
4. URL local del panel (3010) y del API (3011)
5. Confirmación de lectura de docs 05–08

Cuando G + H + I estén marcados, el entorno inicial se considera **probado** y se puede planificar el desarrollo por dominio.

---

## L. Smoke multimodal / fixtures knowledge (objetivo)

Ítems **objetivo** aunque el código de parsers/UI aún no exista. Sirven como checklist de aceptación cuando se implemente ingesta multimodal. Detalle: [../backend/09-aceptacion-y-matriz-tests.md](../backend/09-aceptacion-y-matriz-tests.md).

### L.1 Fixtures y layout

- [ ] Existe (o está planificado en repo) `fixtures/knowledge/` con árbol §10 de backend/09
- [ ] Samples: `pdf/faq-sin-precios.pdf`, `pdf/lista-precios-tabla.pdf`, `docx/k02-ficha-jardin1.docx`
- [ ] Samples: `xlsx/` split (precios vs FAQ), `images/horario-visitas.jpg`, `images/tarjeta-precios.jpg`
- [ ] Sample corto `video/bienvenida-30s.mp4` + `golden/*-mocks.json` para CI sin `@live`
- [ ] `golden/scrub-expectations.json` declara fragmentos no recuperables de precio

### L.2 Smoke pipeline (cuando exista API/worker)

- [ ] Upload PDF allowlist → objeto en storage (MinIO/S3/local fake) + metadatos en DB
- [ ] MIME spoof / `.exe` → 422 `UNSUPPORTED_MIME`
- [ ] PDF con tabla $ → scrub; pregunta de precio **no** usa montos del PDF (C3)
- [ ] XLS precios → solo catálogo; 0 vectores de monto
- [ ] Foto narrativa → job `listo`; foto tarifa → badge/gate OCR
- [ ] Video → worker con ffmpeg → transcript → `listo` (o skip documentado si binario ausente en local)
- [ ] Publicar → bot refleja en &lt; 60 s (C4) en staging
- [ ] Adjunto lead no aparece en biblioteca `/conocimiento`
- [ ] Asesor recibe 403 en POST conocimiento (UI-KNW-4 / F1)
- [ ] CI corre T-MED-* con ports mock; `@live` **no** en PR default

### L.3 Gate multimodal

- [ ] Checklist L.1 documentado en kick-off de dominio conocimiento
- [ ] L.2 verde en staging antes de marcar DoD-13 / D-MED-* Must
- [ ] Cross-check C3/C5/C4 en U-MED (§9 backend/09)

**Criterio:** el equipo puede planificar parsers, ports y UI-KNW contra contratos D-MED sin sorpresas de MIME/storage.
