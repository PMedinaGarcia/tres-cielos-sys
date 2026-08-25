# Frontend — plan de implementación: chatbot / experiencia conversacional (UI)

Plan **accionable** para cablear en el panel Next.js (`apps/web`) la experiencia conversacional: bandeja, expediente/brief, alertas de escalación, telemetría del bot y el efecto de conocimiento multimodal sobre la calidad de respuestas. **Solo documentación** — no implementa código en `apps/`.

**Estado del repo:** sin scaffold Next.js aún ([01-estructura.md](01-estructura.md)). Este plan asume el árbol objetivo `apps/web` y los contratos ya fijados en `frontend/00–08` y `backend/02`, `07`, `08`, `09`.

**Alineación backend:** este documento **no inventa** contratos; es el espejo UI de [../backend/10-plan-implementacion-chatbot.md](../backend/10-plan-implementacion-chatbot.md) (cerebro Nest) y de:

| Fuente | Qué respeta la UI |
|---|---|
| [../backend/10-plan-implementacion-chatbot.md](../backend/10-plan-implementacion-chatbot.md) | Handoff → notif SLA; tomar control → bot silencio (BE Fase F6 / D-BOT-6); panel JWT ≠ webhooks |
| [../backend/02-orquestador-agentico.md](../backend/02-orquestador-agentico.md) | Estados bot, rutas, handoff, anti-alucinación, telemetría |
| [../backend/07-pipeline-openai-y-proveedores.md](../backend/07-pipeline-openai-y-proveedores.md) | Fallos → safe/handoff; cupo IA; UI no llama OpenAI |
| [../backend/08-ingesta-multimodal.md](../backend/08-ingesta-multimodal.md) | Biblioteca K vs adjuntos canal; gate precio |
| [../backend/09-aceptacion-y-matriz-tests.md](../backend/09-aceptacion-y-matriz-tests.md) | UI-KNW-*, C3/C5, pirámide de tests |
| [../setup/04-criterios-de-exito.md](../setup/04-criterios-de-exito.md) | F1–F7, UI-X-*, DoD panel |

**Paralelismo BE↔FE:** FE-1…3 (bandeja/handoff/alertas) pueden arrancar contra MSW hasta que Nest exponga controllers de panel; el E2E real de “tomar control → bot silencio” requiere **backend Fase F** (`POST /conversaciones/:id/tomar-control` + JWT Ownership). FE-7 (conocimiento) se alinea a backend Fase E. No contradecir rutas/estados/`MotivoHandoff` del plan BE.

---

## 1. Objetivo UI del chatbot

### 1.1 Qué es (y qué no es) el “chatbot” en frontend

| Actor | Canal / superficie | Rol respecto al bot |
|---|---|---|
| **Prospecto** | Meta FB/IG + WhatsApp (fuera del panel) | Solo conversa con el bot/humano por canal. **No** hay widget web público ni chat embebido en Next.js v1 ([01-estructura.md](01-estructura.md) §1). |
| **Asesor** | Panel: `/alertas`, `/bandeja`, `/expedientes`, `/pipeline` | Atiende hilos asignados; ve mensajes bot+humano; toma control; responde; usa brief tipado. **No** ve telemetría ops profunda ni publica K. |
| **Coordinador** | + `/asignacion`, cupo, alertas sede, telemetría limitada | Equilibra carga; vigila SLA; puede ver bandeja equipo. |
| **Admin** | + `/conocimiento`, `/catalogo`, `/telemetria`, `/admin` | Audita rutas/tools/rerank; publica conocimiento multimodal y catálogo que alimentan al bot. |

El **cerebro del bot vive en Nest** (`ConversationOrchestratorModule`). El panel:

1. **Refleja** estado conversacional (`estadoBot`, mensajes, brief, calificación).
2. **Interviene** en handoff (tomar control, mensaje humano, atender alerta).
3. **Mejora calidad** del bot vía ops (publicar K / catálogo) — no genera respuestas LLM en el browser.

### 1.2 Objetivos de producto medibles en UI

1. Asesor sabe **qué hacer ahora** (prioridad: escalación → `listo_para_cotizar` → calificado sin contactar → resto).
2. Tras handoff, el lead recibe atención humana con **SLA visual 15–30 min** (F4).
3. Brief de cotización **tipado** (`BriefCotizacion`); **nunca** montos “estimados” inventados en UI.
4. Aparición de hilo post-calificación en bandeja destino ≤ **5 s** (F3) vía **polling 2–3 s** (no inventar WebSocket si no está en contrato; ver §4.5).
5. Admin puede correlacionar mala respuesta ↔ ruta (`guion`/`catalogo`/`rag`/`handoff`/`safe`) ↔ material (`tipoMaterial`) ↔ catálogo.
6. RBAC estricto (F1): asesor A no ve hilos de B; sin telemetría sede; sin `/conocimiento` write.

### 1.3 Anti-alcance UI chatbot (v1)

| No construir | Motivo |
|---|---|
| Chat widget / landing conversacional | Prospecto solo canal |
| Llamadas a OpenAI/Cohere desde Next | Solo Nest ([backend/07](../backend/07-pipeline-openai-y-proveedores.md)) |
| WebSocket “inventado” como requisito | Docs FE fijan polling 2–3 s como fallback go-live ([04](04-estado-y-datos.md) §5.2) |
| Mostrar precios OCR/RAG en preview o transcript como “estimado” | C3 / gate `no_recuperable_precio` |
| Reenviar Asset de biblioteca al lead | [08](08-cableado-conocimiento-multimodal.md) §1.2 |
| Devolver a bot como default | v1: humano mantiene control; `devolver-a-bot` → 409 esperado |
| Analytics de conversión en bandeja | F5 / anti-BI |

---

## 2. Baseline scaffold vs docs

### 2.1 Situación actual (baseline)

| Capa | Estado |
|---|---|
| `apps/web` | **Ausente** — solo contrato en docs |
| `packages/shared` | **Ausente** — enums/Zod propuestos en [07-tipos.md](07-tipos.md) |
| Cliente API / hooks | Contrato [05-api-y-hooks.md](05-api-y-hooks.md); 0 % código |
| Auth / middleware | Contrato [06-auth-y-config.md](06-auth-y-config.md) |
| Superficies / rutas | Mapa [00](00-superficies.md) / [02](02-routing-y-paginas.md) |
| Conocimiento multimodal UI | Contrato completo [08](08-cableado-conocimiento-multimodal.md) |
| Backend chatbot | Orquestador documentado; implementación Nest pendiente |

### 2.2 Gap checklist (antes de PRs de features chat)

| # | Gap | Bloquea | Acción previa |
|---|---|---|---|
| G1 | Scaffold Next App Router + Tailwind + TanStack Query | Todo | Seguir [../setup/01-frontend-setup.md](../setup/01-frontend-setup.md) |
| G2 | `packages/shared`: `EstadoBot`, `MotivoHandoff`, `BandejaItem`, `MensajeDto`, `BriefCotizacion`, `EventoOperativo` | Tipado vertical slice | Portar de [../backend/05-dtos-y-tipos.md](../backend/05-dtos-y-tipos.md) |
| G3 | `lib/api/client.ts` envelope `{ data }` / `{ error }` | Hooks | [05](05-api-y-hooks.md) §1 |
| G4 | `AuthProvider` + middleware + `lib/rbac` | Gates F1 | [06](06-auth-y-config.md) |
| G5 | Feature flags: `ADMIN_API_READY`, telemetría coord, `DEVOLVER_A_BOT` | CTAs opcionales | [06](06-auth-y-config.md) flags |
| G6 | Prefijo API (`NEXT_PUBLIC_API_PREFIX`) | Paths | Parametrizar; no hardcodear `/api/v1` |
| G7 | Canal realtime | F3 | **Go-live = polling**; SSE/WS solo si backend lo expone después |

### 2.3 Principio de implementación

> **Vertical slices** por superficie de atención (auth → bandeja → mensaje humano → alertas → brief → telemetría → conocimiento), no “montar las 10 pantallas vacías”.

Cada slice entrega: ruta + componentes feature + hooks + MSW fixtures + checklist F*/UI-* parcial.

---

## 3. Superficies afectadas

Mapa de impacto del chatbot en el panel (detalle de pantallas en [00-superficies.md](00-superficies.md)).

| # | Superficie | Ruta(s) | Relación con el bot | Prioridad FE |
|---|---|---|---|---|
| 1 | **Bandeja** | `/bandeja`, `/bandeja/[conversacionId]` | Transcript bot/humano; `estadoBot`; tomar control; composer; SLA; brief aside | **P0** |
| 2 | **Centro de alertas** | `/alertas` | `escalacion`, `lead_calificado`, `listo_para_cotizar`; deep link hilo | **P0** |
| 3 | **Expediente** | `/expedientes/[oportunidadId]` | Brief tipado; motivo handoff; timeline; etapa post-humano | **P0** |
| 4 | **Pipeline** | `/pipeline` | Etapas `nuevo_bot` → …; badge listo; abrir expediente | **P1** |
| 5 | **Asignación / carga** | `/asignacion` | Escaladas sin contacto; fuera SLA; reasignar afecta ownership del hilo | **P1** (coord/admin) |
| 6 | **Conocimiento** | `/conocimiento` | Calidad RAG del bot; UI-KNW; ver [08](08-cableado-conocimiento-multimodal.md) | **P1** (admin) |
| 7 | **Catálogo** | `/catalogo` | Tools de precio; stale brief; preview tool | **P1** (admin) |
| 8 | **Telemetría** | `/telemetria`, `/telemetria/hilos/[conversacionId]` | Ruta, tools, rerank, `tipoMaterial` | **P1** (admin) |
| 9 | **Cupo** | `/cupo` | Uso Agentic RAG / tokens (lectura) | **P2** (gap DTO) |
| 10 | **Admin ligera** | `/admin/...` | Criterios calificación, enrutador (afectan bot/asignación) | **P2** |

### 3.1 Viewport asesor (F5) — composición obligatoria

```
┌─────────────┬──────────────────────────┬─────────────────┐
│ ThreadList  │ ThreadView + banners     │ BriefAside      │
│ + QueueSum  │ + TakeControl | Composer │ (ocasión/fecha/ │
│             │ (UNA CTA primaria)       │  aforo/paquete) │
└─────────────┴──────────────────────────┴─────────────────┘
```

**Prohibido en este viewport:** stats de equipo, `EventoOperativo` de rutas del bot, carga multi-asesor, charts.

### 3.2 Prospecto

Sin superficie Next.js. Cualquier “preview de respuesta del bot” en staging es **herramienta admin** (telemetría / pregunta de prueba vía API si existe), no chat público.

---

## 4. Arquitectura FE: hooks, query keys, componentes, estados bot

### 4.1 Carpetas bajo `apps/web` (chat-centric)

```
apps/web/
├── app/(panel)/
│   ├── bandeja/
│   │   ├── page.tsx                    # lista + empty
│   │   └── [conversacionId]/page.tsx  # hilo activo
│   ├── alertas/page.tsx
│   ├── expedientes/[oportunidadId]/page.tsx
│   ├── pipeline/page.tsx
│   ├── telemetria/
│   │   ├── page.tsx
│   │   └── hilos/[conversacionId]/page.tsx
│   ├── conocimiento/…                  # ver plan 08
│   └── catalogo/…
├── components/
│   ├── bandeja/
│   │   ├── ThreadList.tsx
│   │   ├── ThreadListItem.tsx
│   │   ├── ThreadFilters.tsx
│   │   ├── QueueSummary.tsx
│   │   ├── ThreadView.tsx              # transcript
│   │   ├── MessageBubble.tsx           # actor: lead | bot | humano
│   │   ├── BotEstadoBadge.tsx          # activo | escalado | humano
│   │   ├── EscalationBanner.tsx
│   │   ├── SlaBadge.tsx
│   │   ├── MessageComposer.tsx
│   │   ├── TakeControlButton.tsx
│   │   ├── BriefAside.tsx
│   │   └── OpenExpedienteLink.tsx
│   ├── alertas/
│   ├── expediente/
│   │   ├── BriefCotizacionForm.tsx
│   │   ├── Timeline.tsx                # filtra eventos ops por rol
│   │   └── …
│   └── telemetria/
│       ├── SedeOpsSummary.tsx
│       ├── EventoOperativoTimeline.tsx
│       ├── RutaOrquestadorChip.tsx     # guion|catalogo|rag|handoff|safe
│       ├── RerankScoreRow.tsx
│       ├── ToolsInvocadasList.tsx
│       └── RegistroRecuperacionDetail.tsx
├── hooks/                              # o features/*/hooks
│   ├── useBandeja.ts
│   ├── useConversacion.ts
│   ├── useEnviarMensaje.ts
│   ├── useTomarControl.ts
│   ├── useDevolverABot.ts
│   ├── useNotificaciones.ts
│   ├── useBrief.ts
│   ├── useTelemetriaHilo.ts
│   └── …
└── lib/
    ├── api/endpoints/conversaciones.ts
    ├── api/endpoints/notificaciones.ts
    ├── format/sla.ts                   # clocks 15–30 min
    └── rbac/
```

### 4.2 Query keys canónicos (chat)

Extiende [04-estado-y-datos.md](04-estado-y-datos.md) §3:

```ts
['conversaciones', 'list', ConversacionListQuery]
['conversaciones', 'detail', conversacionId]
['conversaciones', 'resumen-propio']
['notificaciones', 'list', query]
['oportunidades', 'detail', oportunidadId]
['oportunidades', 'brief', oportunidadId]
['telemetria', 'hilo', conversacionId]
['telemetria', 'sede', sedeId, periodo]
['telemetria', 'recuperacion', registroId]
['telemetria', 'consulta-catalogo', registroId]
```

Reglas:

- Bandeja + notificaciones: `staleTime` **5–15 s**; `refetchInterval: 2000–3000` si pestaña visible y **sin** canal realtime.
- Detail de hilo abierto: mismo intervalo o ligeramente más agresivo (2 s) para mensajes nuevos.
- Pausar poll si `document.visibilityState === 'hidden'`.
- Tras mutación mensaje/control: invalidar `detail` + `list` + `notificaciones` + (admin) `telemetria/hilo`.

### 4.3 Hooks del dominio conversacional

| Hook | Endpoint | Notas |
|---|---|---|
| `useBandeja(query)` | `GET /conversaciones` | Asesor: **no** enviar `asesorId`/`sinAsignar`. Poll 2–3 s. |
| `useResumenPropio()` | meta de list o campo `resumenPropio` | `X urgentes · Y listos · Z abiertos` |
| `useConversacion(id)` | `GET /conversaciones/:id` | Mensajes + `estadoBot` + motivo handoff |
| `useEnviarMensaje(id)` | `POST .../mensajes` | Body `EnviarMensajeHumanoRequest`; limpia draft |
| `useTomarControl(id)` | `POST .../tomar-control` | Optimistic opcional → `humano` |
| `useDevolverABot(id)` | `POST .../devolver-a-bot` | Esperar **409** v1; UI copy “no habilitado” |
| `useNotificaciones(q)` | `GET /notificaciones` | Poll paralelo bandeja |
| `useMarcarNotificacion()` | `POST .../leer` \| `.../atender` | |
| `useBrief(oportunidadId)` | `GET .../brief` | Tipado; stale price flag |
| `useOportunidad` / `useActualizarOportunidad` | CRM | Post-atención humana |
| `useTelemetriaHilo` / `useTelemetriaSede` | telemetría | Solo admin/(coord); **no montar** en asesor |
| Hooks conocimiento | ver [08](08-cableado-conocimiento-multimodal.md) §5 | Calidad bot |

Capa fina API: `conversacionesApi`, `notificacionesApi`, `telemetriaApi` en `lib/api/endpoints/*` ([05](05-api-y-hooks.md) §3).

### 4.4 Estados del bot en UI (`EstadoBot`)

| `estadoBot` | Badge | Comportamiento UI |
|---|---|---|
| `activo` | Bot | Bot responde en canal. CTA primaria: **Tomar control** (si ownership). Composer deshabilitado o secundario hasta control (política: preferir tomar control primero). |
| `escalado` | Escalado + `SlaBadge` | Bot pausado. Banner con `motivoHandoff`. CTA primaria: **Tomar control**. Reloj SLA. |
| `humano` | Humano | Composer habilitado. No auto-respuestas bot. Opcional: CTA “devolver a bot” oculta/disabled (409). |

Transiciones esperadas (backend es autoridad):

```
activo ──handoff──► escalado ──tomar-control──► humano
activo ──tomar-control──► humano
humano ──devolver-a-bot──► activo   (v1: 409 / no UI)
```

View model sugerido (`BandejaRowVM` / hilo):

```ts
type ChatThreadVM = {
  conversacionId: string;
  estadoBot: 'activo' | 'escalado' | 'humano';
  motivoHandoff?: MotivoHandoff;
  urgenciaSla: 'dentro_ventana' | 'fuera_ventana' | 'sin_sla';
  slaElapsedMs: number;          // cliente desde escaladoEn
  primaryCta: 'tomar_control' | 'responder' | 'none';
  canCompose: boolean;
};
```

### 4.5 Transcript (`ThreadView`)

| Actor mensaje | Origen DTO | Presentación |
|---|---|---|
| Lead / prospecto | canal entrante | Burbuja izquierda; adjuntos canal = metadato (no re-publicar a K) |
| Bot | saliente orquestador | Burbuja “Bot”; si hay cita RAG mostrar texto de cita **sin** reinterpretar montos |
| Humano (asesor) | `POST .../mensajes` | Burbuja derecha + nombre operador |

Reglas anti-alucinación en render:

- Si el mensaje bot menciona precio, la UI **no** reformatea ni redondea montos client-side fuera del string canónico del DTO.
- No calcular “estimados” en `BriefAside` ni en empty states.
- `BriefCotizacion.precioCatalogo` solo desde API; si `precioCatalogoDesactualizado` → badge warning ([00](00-superficies.md) §3.2).

### 4.6 Polling (decisión fijada)

```ts
const BANDEJA_POLL_MS = 2_500; // 2–3 s
const ALERTAS_POLL_MS = 2_500;
const HILO_POLL_MS = 2_000;    // hilo abierto

refetchInterval: (query) =>
  typeof document !== 'undefined' && document.visibilityState === 'hidden'
    ? false
    : BANDEJA_POLL_MS
```

No bloquear go-live esperando WebSocket. Si más adelante Nest expone SSE, el mismo `invalidateQueries` de [04](04-estado-y-datos.md) §5.1 se enchufa sin reescribir superficies.

---

## 5. Cableado API completo: turno humano + toma de control + notifs escalación

### 5.1 Secuencia — escalación → atención (happy path)

```
1. Orquestador (Nest): estadoBot=escalado + Notificacion tipo=escalacion + mensaje safe al lead
2. Panel (poll):
   useNotificaciones → AlertItem destacado (dentro/fuera ventana)
   useBandeja → ThreadListItem prioridad #1 + SlaBadge
3. Asesor abre /bandeja/[conversacionId] (o deep link desde alerta)
4. UI: EscalationBanner(motivoHandoff) + TakeControlButton (CTA primaria)
5. useTomarControl → POST /conversaciones/:id/tomar-control
   ← estadoBot=humano; EventoOperativo humano (backend)
6. Invalidar detail + list + telemetría hilo
7. MessageComposer activo → useEnviarMensaje
   POST /conversaciones/:id/mensajes { contenido }
   ← puede emitir primer_mensaje_post_escalacion (SLA)
8. useMarcarNotificacion → POST /notificaciones/:id/atender
9. Opcional: OpenExpedienteLink → completar brief / etapa propuesta
```

### 5.2 Contrato endpoints (consumo UI)

| Paso | Método | Path | Body / notes | Error UI |
|---|---|---|---|---|
| Listar | `GET` | `/conversaciones` | `ConversacionListQuery` | 401→login |
| Detail | `GET` | `/conversaciones/:id` | Ownership | 404 empty / 403 toast |
| Control | `POST` | `/conversaciones/:id/tomar-control` | `{ motivo? }` opcional | 403/409 toast |
| Mensaje | `POST` | `/conversaciones/:id/mensajes` | `EnviarMensajeHumanoRequest` | 422 campos |
| Devolver | `POST` | `/conversaciones/:id/devolver-a-bot` | — | **409** copy v1 |
| Alertas | `GET` | `/notificaciones` | filtros tipo/estado | |
| Leer | `POST` | `/notificaciones/:id/leer` | | |
| Atender | `POST` | `/notificaciones/:id/atender` | | |
| Brief | `GET` | `/oportunidades/:id/brief` | | |
| Patch CRM | `PATCH` | `/oportunidades/:id` | etapa, campos | |

Shapes: [../backend/05-dtos-y-tipos.md](../backend/05-dtos-y-tipos.md) · consumo: [05-api-y-hooks.md](05-api-y-hooks.md) §2.

### 5.3 Motivos de handoff visibles (`MotivoHandoff`)

Copy ES en `EscalationBanner` / expediente (enum cerrado [07](07-tipos.md)):

| Código | Copy UI sugerido |
|---|---|
| `solicitud_usuario` | El lead pidió hablar con una persona |
| `rerank_bajo` | Baja confianza en la documentación |
| `sin_catalogo` | Sin precio/paquete vigente en catálogo |
| `sin_cita_rag` | No se pudo citar fuente |
| `conflicto` / `queja` | Conflicto o queja — atención humana |
| `descuento_fuera_catalogo` | Descuento fuera de política |
| `sede_no_cubierta` | Sede no operativa / no cubierta |
| `ambiguedad` | Ambigüedad que el bot no puede resolver |
| `adjunto_no_soportado` | Adjunto no soportado o demasiado largo |
| `material_ocr_tarifas` | Material con tarifas; no cotizar desde OCR |
| `proveedor_ia` / `cupo_ia` | Degradación por proveedor/cupo IA |
| `otro` | Escalación (ver detalle en telemetría) |

Asesor ve el motivo en banner; **no** ve scores de rerank ni tools (eso es telemetría admin).

### 5.4 Invalidaciones post-mutation (checklist)

| Mutation | Invalidar |
|---|---|
| `tomar-control` | `conversaciones/detail`, `list`, `resumen-propio`, `telemetria/hilo` |
| `enviar-mensaje` | `detail`, `list`, `notificaciones` (si cierra SLA), `telemetria/hilo` |
| `atender` notificación | `notificaciones/list` |
| `reasignar` (coord) | `carga`, `list`, `detail`, `oportunidad`, `notificaciones` |
| Publicar K / precio | ver [08](08-cableado-conocimiento-multimodal.md); briefs abiertos stale |

### 5.5 Race conditions (cableado)

Ver §11. En implementación:

- Deshabilitar `TakeControlButton` mientras `isPending`.
- Si poll trae `estadoBot=humano` de otro asesor (reasignación): toast + redirect empty ownership.
- Composer: no double-submit (disable + idempotency key si backend lo soporta).

---

## 6. Conocimiento multimodal UI y calidad del bot

Contrato detallado: **[08-cableado-conocimiento-multimodal.md](08-cableado-conocimiento-multimodal.md)**. Este plan solo fija el vínculo chatbot ↔ K.

### 6.1 Cómo afecta la calidad percibida en bandeja

| Acción admin en `/conocimiento` o `/catalogo` | Efecto en bot (Nest) | Efecto visible en UI chat |
|---|---|---|
| Publicar FAQ/PDF narrativo (`pipelineEstado=listo`) | RAG recupera + cita + `tipoMaterial` | Menos handoffs `rerank_bajo` / `sin_cita_rag`; telemetría muestra recuperación |
| Publicar foto/video (texto derivado) | Fragmentos en hybrid search | Idem; badge material en telemetría |
| Archivar doc | Exclusión del índice | Bot deja de citar ese archivo |
| Import/publicar precio catálogo | Tools Prisma | Respuestas de precio correctas; briefs pueden marcar `precioCatalogoDesactualizado` |
| Material con scrub tarifas | Gate `no_recuperable_precio` | UI-KNW-6 badge; bot no cotiza desde OCR |

### 6.2 Qué **no** hace la UI de chat con multimodal

- No adjuntar Assets de biblioteca al composer del asesor como “reenviar al lead”.
- No mostrar montos del preview OCR en `BriefAside`.
- No auto-indexar adjuntos entrantes del lead (solo metadato en transcript).

### 6.3 Orden de implementación relativo

1. Bandeja + handoff humano (P0) puede avanzar **en paralelo** a upload K.
2. Antes de UAT de calidad bot (C4/C5): cablear [08](08-cableado-conocimiento-multimodal.md) + telemetría `tipoMaterial`.
3. Criterios **UI-KNW-1…10** son aceptación de K; el chatbot UAT consume el resultado (menos escalaciones falsas).

---

## 7. Telemetría bot visible (admin)

### 7.1 Quién ve qué

| Rol | `/telemetria` resumen sede | Drill-down hilo | En bandeja |
|---|---|---|---|
| Asesor | **No** (F7) | No | Solo motivo handoff + SLA |
| Coordinador | Lectura limitada (pacto; preferido SLA) | Según pacto | Igual que asesor + filtros equipo |
| Admin | Sí | Sí completo | Sin montar timeline ops en viewport F5 |

### 7.2 Contenido del drill-down (`EventoOperativo` actor bot)

Ruta: `/telemetria/hilos/[conversacionId]` · hook `useTelemetriaHilo(conversacionId)`.

| Bloque UI | Campos | Componente |
|---|---|---|
| Timeline | timestamp, actor bot/humano, tipo evento | `EventoOperativoTimeline` |
| Ruta | `guion` \| `catalogo` \| `rag` \| `handoff` \| `safe` | `RutaOrquestadorChip` |
| Tools | nombre tool, latencia, IDs filas catálogo | `ToolsInvocadasList` |
| RAG / rerank | scores, umbral 0.85, IDs fragmentos | `RerankScoreRow` |
| Material | `tipoMaterial`, `nombreArchivoCita`, `noRecuperablePrecio` | `RegistroRecuperacionDetail` |
| Handoff | `motivoHandoff` | banner en evento |
| Humano | toma control, primer mensaje post-escalación, latencia | mismos timeline |
| Cupo | tokens/unidades estimadas | fila meta |

Resumen sede (`useTelemetriaSede`): tasa handoff, distribución de rutas, % briefs listos, cumplimiento SLA humano, carga — **no** BI marketing.

### 7.3 Deep links útiles

| Desde | Hacia |
|---|---|
| Bandeja (admin only, menú) | `/telemetria/hilos/[conversacionId]` |
| Evento RAG | `GET /telemetria/registros/recuperacion/:id` |
| Evento catálogo | `GET /telemetria/registros/catalogo/:id` |
| Alerta SLA | `/bandeja/[id]` (asesor) o telemetría (admin audit) |

---

## 8. Fases de implementación FE (ordenadas)

Cada fase = entregable **binario** (sí/no) + PR sugerido. Dependencies: API Nest del slice disponible o MSW con fixtures del contrato.

### Fase FE-0 — Scaffold y auth (prerrequisito)

| Entregable | Done when |
|---|---|
| Next App Router en `apps/web` | Build verde |
| TanStack Query + `api` client | Login + `/auth/me` |
| Middleware + RoleGate | Asesor no entra `/telemetria` |
| `packages/shared` enums chat | Zod parse fixtures |

**PR sugerido:** `feat(web): scaffold panel + auth gates`

### Fase FE-1 — Bandeja read-only + estados bot

| Entregable | Done when |
|---|---|
| `/bandeja` + `/bandeja/[id]` | Lista + transcript |
| `useBandeja` / `useConversacion` + poll 2–3 s | F3 medible con mock |
| Badges `estadoBot`, canal, calificado, listo, SLA | Enums correctos |
| Orden prioridad fijo | Checklist F5 parcial (sin CTA mutate) |
| Empty states | Copy §9 |
| Ownership 404 | F1 smoke |

**PR sugerido:** `feat(web): bandeja conversaciones + poll`

### Fase FE-2 — Turno humano (tomar control + mensajes)

| Entregable | Done when |
|---|---|
| `TakeControlButton` + `useTomarControl` | `estadoBot → humano` |
| `MessageComposer` + `useEnviarMensaje` | Mensaje en transcript |
| CTA única según estado | F5 |
| `devolver-a-bot` maneja 409 | Sin crash |
| Invalidaciones correctas | Devtools Query |

**PR sugerido:** `feat(web): handoff humano y composer`

### Fase FE-3 — Alertas y SLA visual

| Entregable | Done when |
|---|---|
| `/alertas` + `useNotificaciones` poll | Feed |
| Deep link a hilo/expediente | Navegación |
| `SlaBadge` dentro/fuera 15–30 min | F4 |
| Leer / atender | Estados notificación |

**PR sugerido:** `feat(web): centro de alertas + SLA`

### Fase FE-4 — Expediente + brief tipado

| Entregable | Done when |
|---|---|
| `/expedientes/[id]` + `BriefCotizacionForm` | Campos tipados |
| Aviso `precioCatalogoDesactualizado` | Badge |
| `BriefAside` en bandeja consume mismo DTO | Una verdad |
| PATCH oportunidad / etapa | Pipeline sync |
| **Cero** UI de montos estimados | Review C3 |

**PR sugerido:** `feat(web): expediente y brief cotización`

### Fase FE-5 — Pipeline + asignación (impacto ownership)

| Entregable | Done when |
|---|---|
| `/pipeline` tarjetas | Etapas |
| `/asignacion` (C/D) | F2 |
| Reasignar → origen pierde hilo | F6 |

**PR sugerido:** `feat(web): pipeline y carga multi-asesor`

### Fase FE-6 — Telemetría bot (admin)

| Entregable | Done when |
|---|---|
| `/telemetria` + drill-down hilo | Ruta/tools/rerank |
| Asesor 403 ruta | F7 |
| Link `tipoMaterial` | UI-KNW-9 |

**PR sugerido:** `feat(web): telemetria operativa bot+humano`

### Fase FE-7 — Conocimiento multimodal + catálogo (calidad bot)

| Entregable | Done when |
|---|---|
| Cableado completo [08](08-cableado-conocimiento-multimodal.md) | UI-KNW-1…10 |
| Separación `/catalogo` import | XlsxDestinoDialog |
| Publicar → bot cita (UAT staging) | C4 |

**PR sugerido:** `feat(web): conocimiento multimodal y catalogo`

### Fase FE-8 — Hardening UX chat + e2e

| Entregable | Done when |
|---|---|
| Race polling / ownership (§11) | Tests |
| Responsive lista→detalle + brief sheet | UI-X-6 |
| E2E smoke (§10) | CI |
| Checklist §9 verde | UAT |

**PR sugerido:** `test(web): chatbot ui acceptance + e2e smoke`

### Orden visual de dependencias

```
FE-0 → FE-1 → FE-2 → FE-3
              ↘ FE-4 → FE-5
FE-0 → FE-6 (puede paralelizar tras FE-1 con MSW)
FE-0 → FE-7 (paralelo; necesario antes de UAT calidad)
FE-1…7 → FE-8
```

---

## 9. Checklist de aceptación UI chatbot

Marcar en UAT / PR de cierre FE chatbot. Fuentes: F1–F7 ([setup/04](../setup/04-criterios-de-exito.md)), UI-KNW ([backend/09](../backend/09-aceptacion-y-matriz-tests.md) + [08](08-cableado-conocimiento-multimodal.md)), UI-X.

### 9.1 F1–F7 (panel conversacional)

| ID | Criterio UI chatbot | Evidencia |
|---|---|---|
| **F1** | Asesor A no lista/abre hilos de B; 404/empty; sin query `asesorId` engañoso | Dos usuarios |
| **F2** | Asesor no entra `/asignacion` | Gate + 403 |
| **F3** | Post-calificación, hilo en bandeja ≤ 5 s (poll 2–3 s) | Cronómetro |
| **F4** | Badges SLA dentro/fuera en `/alertas` y `/bandeja` | Captura |
| **F5** | Viewport asesor: cola+hilo+brief+1 CTA; sin telemetría/carga | Checklist UX |
| **F6** | Tras reasignar, origen pierde deep link; destino gana | Caso dos asesores |
| **F7** | Asesor sin `/telemetria`; admin ve evento bot + turno humano | Rutas + payload |

### 9.2 UI-KNW (calidad bot vía conocimiento)

Cumplir **UI-KNW-1…10** de [08](08-cableado-conocimiento-multimodal.md) §10 (y alineación backend/09 §3). Mínimo para cerrar chat+K:

- [ ] UI-KNW-5 RBAC conocimiento
- [ ] UI-KNW-8 sin reenviar Asset al lead
- [ ] UI-KNW-9 `tipoMaterial` en telemetría
- [ ] Publicación refleja “vigente para el bot”

### 9.3 Anti-alucinación / brief (UI)

| ID | Criterio | Evidencia |
|---|---|---|
| UI-BOT-1 | Ningún label “precio estimado” / cálculo client-side de montos | Grep UI + review |
| UI-BOT-2 | Brief solo campos `BriefCotizacion` | Form Zod |
| UI-BOT-3 | Stale price badge si `precioCatalogoDesactualizado` | Fixture |
| UI-BOT-4 | Motivo handoff tipado; no free-text inventado | Enum |

### 9.4 Empty / error / forbidden states

| Caso | Copy / comportamiento |
|---|---|
| Bandeja vacía | «Sin conversaciones; los leads de campañas aparecerán aquí» |
| Hilo 404 ownership | «No encontramos esta conversación» (no filtrar en cliente) |
| 403 ruta | Página/toast producto |
| Escalación sin motivo | Fallback «Escalación» + link telemetría (admin) |
| Telemetría hilo nuevo | «Aún no hay decisiones del bot en este hilo» |
| Job K error | Toast `PIPELINE_ERROR` + CTA ([08](08-cableado-conocimiento-multimodal.md) §7) |
| Network offline | Banner + retry Query |
| `devolver-a-bot` 409 | «Devolver al bot no está habilitado en esta versión» |
| Composer sin control | Deshabilitado + hint «Toma el control para responder» |

### 9.5 UI-X (setup/04)

- [ ] UI-X-1 Redirect post-login por rol
- [ ] UI-X-4 Una CTA primaria en atención
- [ ] UI-X-6 Responsive lista→detalle; brief sheet móvil

---

## 10. Plan de tests FE

### 10.1 Unit — componentes

| Área | Casos | Ubicación sugerida |
|---|---|---|
| `BotEstadoBadge` / `SlaBadge` | Variantes activo/escalado/humano; dentro/fuera | `components/bandeja/*.test.tsx` |
| `EscalationBanner` | Todos `MotivoHandoff` con copy ES | |
| `ThreadList` sort | Orden prioridad producto | |
| `BriefAside` | No renderiza monto si `paquete` null; stale badge | |
| `RoleGate` | Asesor no monta telemetría | |
| `priorityRank` VM | Función pura | `lib/bandeja/priority.test.ts` |
| Format SLA | Boundaries 15/30 min | `lib/format/sla.test.ts` |

### 10.2 Contract / MSW

| Suite | Qué valida |
|---|---|
| Zod parse fixtures `BandejaItem`, `ConversacionDetail`, `BriefCotizacion`, `EventoOperativo` | Drift FE↔BE |
| MSW `GET /conversaciones` scoped por rol | F1 |
| MSW `POST tomar-control` → detail `humano` | Transición |
| MSW `POST devolver-a-bot` → 409 | UX |
| MSW `GET /telemetria/...` → 403 asesor | F7 |
| MSW conocimiento multipart | UI-KNW (reusar plan 08) |

Ubicación: `apps/web/src/test/msw/handlers/*` + `packages/shared` fixtures JSON alineadas a backend DTOs.

### 10.3 E2E smoke (Playwright objetivo)

| Spec | Flujo |
|---|---|
| `e2e/auth-roles.spec.ts` | Login asesor vs admin; gates |
| `e2e/bandeja-handoff.spec.ts` | Ver escalado → tomar control → enviar mensaje → atender alerta |
| `e2e/f3-poll-appearance.spec.ts` | Mock delay calificación → aparición ≤ 5 s |
| `e2e/f5-minimalismo.spec.ts` | Assert ausencia de selectores telemetría/carga en DOM asesor |
| `e2e/conocimiento-upload.spec.ts` | UI-KNW-1..3 (backend/09 mapa) |
| `e2e/telemetria-rbac.spec.ts` | Asesor blocked |

Entorno: staging o MSW full; secretos no en CI. Marcar `@live` solo con channels reales (fuera de FE unitario).

### 10.4 Manual UAT (script corto)

1. Dos asesores + un admin (F1, F6, F7).
2. Forzar handoff `rerank_bajo` en staging → banner + SLA (F4).
3. Completar brief → badge listo → alerta (UI-BOT).
4. Publicar FAQ → pregunta lead → cita en transcript + registro telemetría (C4/C5).
5. Viewport móvil lista/detalle (UI-X-6).

---

## 11. Riesgos UX

| Riesgo | Sintoma | Mitigación |
|---|---|---|
| **SLA badge drift** | Reloj cliente desfasado vs servidor | Calcular desde `escaladoEn` ISO del API; sync clock; umbrales env documentados 15/30 |
| **Race polling** | Mensaje duplicado / control ya tomado | Disable CTA `isPending`; reconciliar con GET detail post-mutation; toast si `estadoBot` cambió |
| **Ownership race** | Asesor escribe tras reasignación | 403/404 → empty + invalidar list; no optimistic ownership |
| **Doble CTA** | Tomar control + composer a la vez | Regla §4.4: una `primaryCta` |
| **Poll battery / rate limit** | Tabs background golpean API | Pause on `visibilityState`; backoff 429 |
| **Falsa seguridad RBAC** | Ocultar menú pero fetch abierto | Nunca confiar solo en UI; tests F1 API |
| **Stale brief precio** | Cotizar con precio viejo | Badge stale obligatorio; link a catálogo admin |
| **Ruido telemetría en asesor** | Rompe F5 | `RoleGate` + no importar componentes telemetría en árbol bandeja asesor |
| **Optimistic estadoBot incorrecto** | UI dice humano pero bot sigue | Optimistic solo con rollback on error; preferir wait mutation |
| **Deep link alerta vieja** | Abre hilo atendido | Mostrar estado actual; permitir marcar atendida idempotente |

---

## 12. Criterio de cierre FE chatbot

El vertical **chatbot UI** se considera cerrado cuando **todas** se cumplen:

1. **Fases FE-0 … FE-8** con entregables binarios en verde (o deuda explícita firmada solo en cupo/admin paths gap).
2. Checklist **§9** (F1–F7 + UI-BOT + empty/error + UI-KNW mínimos) firmada en UAT.
3. Tests **§10**: unit críticos + MSW contract bandeja/handoff/RBAC + e2e smoke handoff en CI.
4. **Anti-alucinación UI:** zero superficies con montos estimados; brief tipado.
5. **Polling 2–3 s** documentado e implementado; sin dependencia de WebSocket no existente.
6. **RBAC:** asesor sin telemetría ops profunda ni publicación K; matriz [00](00-superficies.md) §4 respetada en nav + routes.
7. Docs alineados a `backend/10` (sin contradicción en estados, handoff, tomar control, motivos).
8. Criterios globales setup/04 relevantes a UI (UI-X, DoD panel conversacional) en verde o waivers escritos.

**No es criterio de cierre FE:** bot 100 % preciso en producción (eso es backend C3/C5 + K/catálogo); el FE cierra cuando **refleja, interviene y audita** correctamente.

---

## 13. Referencias cruzadas

### Frontend

| Doc | Uso |
|---|---|
| [00-superficies.md](00-superficies.md) | 10 superficies, matriz roles, flujos |
| [01-estructura.md](01-estructura.md) | `apps/web` tree, stack |
| [02-routing-y-paginas.md](02-routing-y-paginas.md) | Rutas, gates, F1–F7 routing |
| [03-componentes.md](03-componentes.md) | Inventario Thread*/Brief*/telemetría |
| [04-estado-y-datos.md](04-estado-y-datos.md) | Query keys, poll, flujos escalación |
| [05-api-y-hooks.md](05-api-y-hooks.md) | Endpoints y hooks |
| [06-auth-y-config.md](06-auth-y-config.md) | Sesión, flags |
| [07-tipos.md](07-tipos.md) | `EstadoBot`, `MotivoHandoff`, VMs |
| [08-cableado-conocimiento-multimodal.md](08-cableado-conocimiento-multimodal.md) | Upload K, UI-KNW, calidad bot |

### Backend / producto / setup / infra

| Doc | Uso |
|---|---|
| [../backend/02-orquestador-agentico.md](../backend/02-orquestador-agentico.md) | Cerebro, handoff, rutas, anti-precio OCR |
| [../backend/05-dtos-y-tipos.md](../backend/05-dtos-y-tipos.md) | Wire format panel |
| [../backend/06-guards-y-rbac.md](../backend/06-guards-y-rbac.md) | Autoridad API |
| [../backend/07-pipeline-openai-y-proveedores.md](../backend/07-pipeline-openai-y-proveedores.md) | Sin SDK en FE; degradación safe |
| [../backend/08-ingesta-multimodal.md](../backend/08-ingesta-multimodal.md) | Media + scrub |
| [../backend/09-aceptacion-y-matriz-tests.md](../backend/09-aceptacion-y-matriz-tests.md) | UI-KNW, C3/C5, mapa tests |
| [../backend/10-plan-implementacion-chatbot.md](../backend/10-plan-implementacion-chatbot.md) | Fases A–F cerebro; F6 tomar control; handoff+notif |
| [../producto/04-escenarios-rol-carga-telemetria.md](../producto/04-escenarios-rol-carga-telemetria.md) | F1–F7 detalle |
| [../setup/04-criterios-de-exito.md](../setup/04-criterios-de-exito.md) | DoD, UI-X, NFR F3 |
| [../setup/01-frontend-setup.md](../setup/01-frontend-setup.md) | Arranque scaffold |
| [../infrastructure/01-stack-y-entornos.md](../infrastructure/01-stack-y-entornos.md) | Next ↔ Nest, env |
| [../database/03-assets-y-fragmentos-multimodales.md](../database/03-assets-y-fragmentos-multimodales.md) | `TipoMaterial`, invariantes |

---

## Criterio de cierre de este entregable (doc)

Quedan definidos: objetivo UI por rol, baseline vs gaps, superficies, arquitectura FE (hooks/keys/componentes/estados bot), cableado handoff+notifs, vínculo multimodal→calidad, telemetría admin, fases FE-0…8 con PRs, checklists F*/UI-BOT/UI-KNW, tests, riesgos UX, cierre FE y referencias — **sin código en `apps/`**.
