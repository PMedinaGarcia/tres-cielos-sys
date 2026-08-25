# Criterios de éxito del producto — Event Master System (Tres Cielos)

Documento de aceptación de **producto completo** (no solo setup). Define cuándo el sistema es el producto esperado: embudo Meta/WhatsApp → Agentic RAG → CRM → asignación → panel por rol, con un jardín activo.

**Fuente de verdad:** documentación en `docs/` (producto, backend, frontend, database, infrastructure). Si el código diverge, se alinea el código a estos contratos salvo change order firmado.

**Referencias clave**

| Área | Docs |
|---|---|
| Embudo y calificación | [../producto/01-diseno-estrategico.md](../producto/01-diseno-estrategico.md) |
| Fases, UAT, go-live G1–G11 | [../producto/02-fases-golive.md](../producto/02-fases-golive.md) |
| Cotización C1–C7 | [../producto/03-criterios-exito-cotizacion.md](../producto/03-criterios-exito-cotizacion.md) |
| Roles, carga, F1–F7, telemetría | [../producto/04-escenarios-rol-carga-telemetria.md](../producto/04-escenarios-rol-carga-telemetria.md) |
| Dominios NestJS | [../backend/01-dominios.md](../backend/01-dominios.md) |
| Orquestador / RAG / ingesta | [../backend/02-orquestador-agentico.md](../backend/02-orquestador-agentico.md), [03](../backend/03-rag-avanzado.md), [04](../backend/04-ingesta-conocimiento.md) |
| Aceptación multimodal / matriz tests | [../backend/09-aceptacion-y-matriz-tests.md](../backend/09-aceptacion-y-matriz-tests.md) (D-MED-*, UI-KNW-*, T-MED-*, ports, fixtures) |
| DTOs y contratos | [../backend/05-dtos-y-tipos.md](../backend/05-dtos-y-tipos.md) |
| RBAC | [../backend/06-guards-y-rbac.md](../backend/06-guards-y-rbac.md) |
| Superficies UI | [../frontend/00-superficies.md](../frontend/00-superficies.md), [02-routing](../frontend/02-routing-y-paginas.md) |
| Modelo y catálogo | [../database/01-modelo-conceptual.md](../database/01-modelo-conceptual.md), [02](../database/02-catalogo-paquetes.md) |
| Infra | [../infrastructure/01-stack-y-entornos.md](../infrastructure/01-stack-y-entornos.md), [../infrastructure/02-plan-implementacion-chatbot-infra.md](../infrastructure/02-plan-implementacion-chatbot-infra.md) |
| **Gate go-live chatbot** | [09-criterios-salida-produccion-chatbot.md](09-criterios-salida-produccion-chatbot.md) — C3/C5/C4, D-BOT/D-MED, UAT firmable, rollback, NO-GO |

---

## 1. Visión del producto terminado (Definition of Done de producto)

### 1.1 Qué es “terminado” en go-live Jardín 1

El producto está **listo** cuando un prospecto de campaña digital (Facebook, Instagram o WhatsApp) puede:

1. Conversar con el bot (Agentic RAG: guion + tools de catálogo Prisma + RAG híbrido + handoff).
2. Quedar perfilado como `en_exploracion` o `calificado`, y opcionalmente `listo_para_cotizar` con brief usable.
3. Generar expediente en CRM alineado al chat (misma verdad de lead).
4. Ser asignado por el enrutador (sede → disponibilidad → round-robin) o quedar en cola de coordinador.
5. Ser atendido por un asesor en el panel (bandeja propia, brief, pipeline) con SLA visual 15–30 min en escalaciones.
6. Dejar traza auditable (`EventoOperativo`, `RegistroConsultaCatalogo`, `RegistroRecuperacion`).

Y el equipo operativo puede:

- Coordinar carga multi-asesor y reasignar (F2, F6).
- Publicar conocimiento/catálogo con frescura **&lt; 60 s** (C4).
- Auditar bot + humano en telemetría operativa (F7).
- Respetar RBAC estricto (F1) y minimalismo de bandeja asesor (F5).

### 1.2 Definition of Done — checklist binario de producto

| ID | Condición | Estado requerido |
|---|---|---|
| DoD-1 | Canales FB + IG en producción (o UAT firmado equivalente al corte); WA según etapa 9 del mismo corte o plan explícito | Cumplido |
| DoD-2 | Orquestador enruta guion / catálogo / RAG / handoff / safe sin montos inventados (C3 = 0) | Cumplido |
| DoD-3 | Calificación + `listo_para_cotizar` según reglas de producto | Cumplido |
| DoD-4 | CRM + brief + pipeline humano operativo | Cumplido |
| DoD-5 | Asignación automática + reasignación manual trazable | Cumplido |
| DoD-6 | Notificaciones panel (+ email si pactado) para nuevo / calificado / escalación | Cumplido |
| DoD-7 | Panel con 10 superficies y matriz de roles | Cumplido |
| DoD-8 | Solo Jardín 1 activo; Jardín 2 no recibe leads operativos | Cumplido |
| DoD-9 | Conocimiento mínimo + ≥1 SKU/precio vigente (G8) | Cumplido |
| DoD-10 | UAT §3 de fases firmado; F1–F7 y C3/C5 en verde; G1–G11 | Cumplido |
| DoD-11 | Capacitación ≤8 h impartida; guía entregada | Cumplido |
| DoD-12 | Anti-alcance §12 respetado (sin features excluidas “por accidente”) | Cumplido |
| DoD-13 | Ingesta multimodal operable: PDF/Word/XLS-split/foto/video con object storage, tariff/OCR gate y C3=0 (detalle [backend/09](../backend/09-aceptacion-y-matriz-tests.md)) | Cumplido |

**DoD multimodal (breve):** uploads allowlist MIME → `StoragePort` → job parser (scrub tarifas) → embed/FTS solo narrativa → publicar con frescura **&lt; 60 s** (C4); montos **nunca** desde OCR/PDF/foto (C3); fragmentos de media pasan rerank ≥ **0.85** (C5). Matriz D-MED-*/T-MED-* en [backend/09](../backend/09-aceptacion-y-matriz-tests.md).

**Producto terminado ≠** BI comercial, PDF automático de cotización, segundo jardín activo, drips multi-día, widget web, scoring ML.

### 1.3 Resultado de negocio esperado

| Resultado | Medición |
|---|---|
| Primer contacto → expediente usable | Alta automática + campos/brief visibles en panel |
| Respuesta bot en segundos/minutos | Latencia de respuesta bot medible en logs/EventoOperativo |
| Handoff con ventana humana | Alerta + badge SLA; contacto objetivo 15–30 min (adopción cliente) |
| Precisión de precios | 0 montos fuera de `PaquetePrecio` vigente (C3) |
| Asesor no re-pregunta lo ya dicho | Brief completo en ≥70 % leads calificados UAT (C2) |

---

## 2. Actores / roles y qué deben poder lograr

### 2.1 Actores externos (no usuarios del panel)

| Actor | Éxito verificable |
|---|---|
| **Prospecto** (FB / IG / WA) | Recibe respuestas coherentes; precios solo de catálogo; puede pedir humano y es escalado; no ve panel ni datos de otros leads |
| **Meta** | Webhooks firmados; mensajes entrantes/salientes asociados a conversación |
| **Twilio WhatsApp** | Mismo cerebro agentico; plantilla utility usable fuera de ventana (caso UAT); cupo contabilizado |
| **Proveedores IA** (embeddings, LLM, Cohere Rerank) | Respuestas ancladas; rerank umbral **0.85**; fallo → safe/handoff, no inventar |
| **Email transaccional** (si pactado) | Alerta de calificado/escalación entregada al destinatario |

### 2.2 Roles del panel

| Rol | Debe poder lograr | No debe poder |
|---|---|---|
| **Asesor** | Ver solo su bandeja/pipeline/alertas; responder / tomar control; editar expediente asignado; ver brief; mover etapa; marcar alerta atendida; ver resumen `urgentes · listos · abiertos` | Ver carga del equipo, telemetría bot, publicar conocimiento/catálogo, reasignar (v1), cupo, admin |
| **Coordinador** | Todo lo del asesor a nivel sede + bandeja equipo + `/asignacion` (métricas, cola sin dueño, reasignar, disponibilidad) + cupo lectura + alertas de sede; vigilar SLA | Publicar catálogo/conocimiento (salvo pacto borradores); mutar enrutador; admin completo |
| **Admin** (Tres Cielos / Medina) | Todo lo anterior + usuarios/roles/sedes/criterios/enrutador + publicar conocimiento/catálogo + telemetría completa + cupo | Nada de lo listado en anti-alcance (BI, PDF cotización auto, etc.) |

### 2.3 Escenarios de éxito por rol (día típico)

| Rol | Flujo de éxito | Evidencia |
|---|---|---|
| Asesor — calificado / listo | Alerta → bandeja priorizada → brief → contacto → etapa `propuesta` | Notificación + expediente + `EventoOperativo` humano |
| Asesor — escalación | Alerta SLA → tomar control → responder → alerta atendida | `toma_control` + `primer_mensaje_post_escalacion` con `dentroVentanaSla` |
| Coordinador — desbalance | `/asignacion` → cola sin dueño / fuera SLA → reasignar → bandejas origen/destino OK | F6 + historial `Asignacion` `regla=manual` |
| Admin — calidad | Telemetría hilo → ruta/tools/RAG → corrige doc/precio → frescura &lt; 60 s | F7 + C4 |
| Admin — ops | Publica K + catálogo; monitorea cupo 1,000 | Job `listo` + `ContadorUso` |

Detalle de producto: [../producto/04-escenarios-rol-carga-telemetria.md](../producto/04-escenarios-rol-carga-telemetria.md) §2 y §8.

---

## 3. Criterios de éxito por dominio / módulo

Cada criterio es **verificable**. Prioridad MoSCoW en §9.

### 3.1 Identidad y acceso (Auth / RBAC)

| ID | Criterio | Umbral / regla | Evidencia |
|---|---|---|---|
| D-AUTH-1 | Login con email/password emite sesión/JWT con `PanelAuthContext` (`userId`, `role`, `sedeIds`, `activo`, `disponible`) | Shape según DTOs §4.1 / RBAC §6 | Test login + `/auth/me` |
| D-AUTH-2 | Usuario `activo=false` no opera aunque el token no expire | 401 | Caso UAT |
| D-AUTH-3 | Guards: Auth → Roles → SedeScope → Ownership (asesor) | Orden documentado | Tests de guards |
| D-AUTH-4 | Asesor A no lista ni abre recursos de asesor B | F1; 404/403 según política | Prueba dos usuarios |
| D-AUTH-5 | Webhooks Meta/Twilio **no** usan JWT de panel; usan firma | Firma inválida → rechazo | Test webhook |

### 3.2 Canales

| ID | Criterio | Umbral | Evidencia |
|---|---|---|---|
| D-CH-1 | Mensaje FB crea/actualiza conversación visible en bandeja | 100 % pruebas controladas | UAT 3.1 |
| D-CH-2 | Mensaje IG igual | Idem | UAT 3.1 |
| D-CH-3 | WhatsApp mismo cerebro agentico + visible en bandeja unificada | Idem | UAT 3.5 |
| D-CH-4 | Respuesta saliente por el **mismo canal** de origen del hilo | 100 % | Logs + transcript |
| D-CH-5 | Mensajes distinguen autor `prospecto` / `bot` / `asesor` | Enum cerrado | `MensajeDto` |
| D-CH-6 | Unidades de mensajería contabilizadas hacia cupo | Contador incrementa | Vista cupo / DB |
| D-CH-7 | Plantilla utility WA fuera de ventana (caso controlado) | Aprobada y usable | UAT 3.5 |

### 3.3 Conversación / orquestador agentico

| ID | Criterio | Umbral | Evidencia |
|---|---|---|---|
| D-BOT-1 | Orden de routing: guion → handoff forzado → catálogo → RAG → safe | Sin excepciones de precio vía RAG | Casos tipados + logs `ruta` |
| D-BOT-2 | Precio/paquete/inclusiones **solo** tools Prisma | C3 = **0** montos inventados | Transcripts + `RegistroConsultaCatalogo` |
| D-BOT-3 | FAQ/políticas solo fragmentos rerank ≥ **0.85** con cita | C5 | `RegistroRecuperacion` + scores |
| D-BOT-4 | Rerank &lt; 0.85 o sin filas → safe + handoff, sin inventar | 100 % | Logs `motivoHandoff` |
| D-BOT-5 | Pedido de humano / queja / conflicto → `estadoBot=escalado` + alerta | 100 % | Panel + notificación |
| D-BOT-6 | Tomar control → `estadoBot=humano`; bot deja de responder | 100 % | `EventoOperativo.toma_control` |
| D-BOT-7 | Devolver a bot: default **deshabilitado** (409) salvo política | Comportamiento documentado | Test API |
| D-BOT-8 | Cada decisión/mensaje bot emite `EventoOperativo` con `ruta`, tools/RAG, cupo | ≥1 evento por mensaje saliente bot | Telemetría F7 |
| D-BOT-9 | Guion captura obligatorios de calificación | Cobertura C1 ≥ **80 %** hilos UAT | Muestra UAT |

### 3.4 Calificación y brief

| ID | Criterio | Umbral | Evidencia |
|---|---|---|---|
| D-CAL-1 | Obligatorios incompletos → `en_exploracion` | 100 % | Expedientes prueba |
| D-CAL-2 | Obligatorios + intención → `calificado` + dispara asignación/notif | 100 % | Eventos |
| D-CAL-3 | Brief completo → `listo_para_cotizar` (campos §2 cotización) | Reglas exactas | Flag en `Oportunidad` + brief |
| D-CAL-4 | Completitud brief en UAT | C2 ≥ **70 %** calificados | Expedientes |
| D-CAL-5 | Asesor completa datos faltantes → recalcula calificación / flag | Observable | PATCH expediente |
| D-CAL-6 | Coherencia aforo–paquete (C7) | No recomienda `aforo_max` &lt; aforo sin advertencia/alternativa/handoff | Casos tipados |

### 3.5 CRM / oportunidades / pipeline

| ID | Criterio | Umbral | Evidencia |
|---|---|---|---|
| D-CRM-1 | Alta temprana de lead/oportunidad al primer contacto útil | Preferencia producto | Expediente creado |
| D-CRM-2 | Chat y expediente muestran la misma verdad de campos | Sin divergencia en UAT | Comparación chat↔ficha |
| D-CRM-3 | Brief muestra bloque consolidado (tipo/fecha/aforo/sede/paquete/precio/inclusiones/presupuesto/restricciones/fuentes) | Shape `BriefCotizacion` | UI expediente |
| D-CRM-4 | Si precio de catálogo cambia: briefs abiertos marcan `precioCatalogoDesactualizado` (no reescribe propuestas humanas ya enviadas) | 100 % | Caso UAT |
| D-CRM-5 | Etapas: `nuevo_bot` → `calificado` → `contactado` → `propuesta` → `negociacion` → `ganado` / `perdido` | Enum cerrado | Pipeline UI |
| D-CRM-6 | Perdido exige `motivoPerdido` tipificado | Validación 422 si falta | Test |
| D-CRM-7 | Timeline: mensajes clave, etapas, asignaciones; ops según rol | Visible admin | UI |

### 3.6 Asignación

| ID | Criterio | Umbral | Evidencia |
|---|---|---|---|
| D-ASG-1 | Al `calificado`: sede → disponibilidad → round-robin | Algoritmo cerrado | Historial `regla` |
| D-ASG-2 | Escalación: prioriza dueño vigente; si no, misma regla | Documentado | Casos |
| D-ASG-3 | `en_exploracion`: sin asignación agresiva; cola coordinación | Visible en carga | UI |
| D-ASG-4 | Sin candidatos → cola coordinador + notificación prioritaria | Invariante: calificado no invisible | UAT |
| D-ASG-5 | Solo asesores del jardín activo | Jardín 2 no asignable | Config + prueba |
| D-ASG-6 | Toda asignación deja registro (regla, actor, timestamp, vigente/sustituida) | 100 % | `Asignacion` |
| D-ASG-7 | Reasignación solo coord/admin; actualiza bandejas origen/destino ≤ efecto F6 | F6 | Caso dos asesores |
| D-ASG-8 | Tras calificar, hilo en bandeja del asignado en ≤ **5 s** | F3 | Cronómetro UAT |
| D-ASG-9 | Métricas carga: abiertas, escaladas pendientes, listos sin propuesta, fuera SLA, disponibilidad | Shape DTOs §3.5 | `GET /carga` |

### 3.7 Notificaciones

| ID | Criterio | Umbral | Evidencia |
|---|---|---|---|
| D-NTF-1 | Tipos: `lead_nuevo`, `lead_calificado`, `listo_para_cotizar`, `escalacion` | Enum | Feed |
| D-NTF-2 | Escalación destaca ventana 15–30 min; a 30 min sin atención → `fuera_ventana` | F4 | Badge UI |
| D-NTF-3 | Estados: pendiente / leída / atendida | Transiciones API | `NotificacionDto` |
| D-NTF-4 | Asesor solo alertas propias; coord/admin sede | Scope RBAC | Prueba roles |
| D-NTF-5 | Email transaccional si está en el acuerdo | Entrega verificable | UAT 3.4 |

### 3.8 Conocimiento (RAG) e ingesta

| ID | Criterio | Umbral | Evidencia |
|---|---|---|---|
| D-KNW-1 | Solo documentos `publicado` indexados para el bot | Borrador no aparece | Pregunta prueba |
| D-KNW-2 | Publicar/archivar → inválida versión anterior; job &lt; **60 s** a `listo` (incluye PDF/Word/foto/video) | C4 / G9 | Job + pregunta |
| D-KNW-3 | Documento archivado deja de recuperarse de inmediato | 100 % | UAT 3.6 |
| D-KNW-4 | Existe `RegistroRecuperacion` auditable en respuestas RAG | C6 | Admin drill-down |
| D-KNW-5 | Inventario mínimo go-live: K01, K02, K04, K08, K09 (+ K05 opcional) | G8 | Checklist firma |
| D-KNW-6 | Job &gt; 60 s o error → alerta admin actionable | Sin spinner infinito | UI conocimiento |
| D-KNW-7 | Foto (jpeg/png/webp) vía Vision: narrativa indexable; tarifa → OCR gate (no monto recuperable) | C3; ver D-MED-8/10 | UAT U-MED-5/6 + [backend/09](../backend/09-aceptacion-y-matriz-tests.md) |
| D-KNW-8 | Video (mp4/mov): transcript (ffmpeg + TranscriptionPort) indexable; mismo SLA C4 a `listo` | Job + cita | UAT U-MED-7 |
| D-KNW-9 | Adjunto de lead (canal) no publica a biblioteca K global ni entra a hybrid search operativo | 100 % | UAT U-MED-8 |
| D-KNW-10 | Object storage obligatorio para binarios fuente; DB solo metadatos + `storageKey` | D-MED-3 | Infra + integration |

Detalle MIME, parsers, UI-KNW, T-MED y fixtures: [../backend/09-aceptacion-y-matriz-tests.md](../backend/09-aceptacion-y-matriz-tests.md).

### 3.8b Media / MIME / pipeline (D-MED-*)

Resumen de aceptación multimodal. Tabla completa y suites en [backend/09](../backend/09-aceptacion-y-matriz-tests.md) §2.

| ID | Criterio | Umbral | Evidencia |
|---|---|---|---|
| D-MED-1 | Allowlist MIME conocimiento (PDF, Word, XLS/CSV, jpeg/png/webp, mp4/mov) | Fuera de lista → 422 `UNSUPPORTED_MIME` | T-MED-MIME |
| D-MED-2 | MIME por magic bytes, no solo extensión / `Content-Type` client | Spoof → rechazo o reclasificación segura | Unit |
| D-MED-3 | Upload vía `StoragePort`; key opaca en API/logs | 100 % | T-MED-STOR |
| D-MED-4 | Estados job: `recibido` → `parseando` → `chunking` → `embebiendo` → `listo` \| `error` | Visibles en UI | UI-KNW-3 |
| D-MED-5 | PDF: scrub tablas/tarifas; 0 montos indexados como precio recuperable | C3 | T-MED-PDF |
| D-MED-6 | Word: chunks por heading + mismo scrub de montos | C3 | T-MED-DOCX |
| D-MED-7 | XLS **split**: precios → catálogo Prisma; narrativa → K sin montos | Nunca chunk hoja precios → pgvector | T-MED-XLS |
| D-MED-8 | Foto → `VisionPort`; meta `origen=vision` | Mock en CI | T-MED-IMG |
| D-MED-9 | Video → ffmpeg + `TranscriptionPort` | Worker con ffmpeg | T-MED-VID |
| D-MED-10 | OCR / tariff gate → `no_recuperable_precio`; orquestador no responde montos desde esos chunks | 100 % golden tariff | T-MED-OCR |
| D-MED-11 | Adjunto lead ≠ publicación K | Scope conversación | T-MED-LEAD |
| D-MED-12 | Límites tamaño por MIME (PDF/Word ≤25 MB; XLS ≤10; img ≤8; video ≤100) | 413 / `PAYLOAD_TOO_LARGE` | Contract |
| D-MED-13 | Fallo Vision/Transcription/S3 → job `error` + alerta; sin versión searchable a medias | NF-R-2 | T-MED-FAIL |
| D-MED-14 | Post-`listo`, frescura bot &lt; 60 s | C4 / D-KNW-2 | UAT / `@live` |

### 3.9 Catálogo de paquetes

| ID | Criterio | Umbral | Evidencia |
|---|---|---|---|
| D-CAT-1 | Tools: `buscar_paquetes`, `obtener_precio_paquete`, `listar_inclusiones`, `comparar_paquetes`, `evaluar_reglas_paquete`, `transferir_a_humano` | Contrato orquestador | Logs tools |
| D-CAT-2 | `SIN_PRECIO_VIGENTE` → no estimar; handoff | 100 % | Caso |
| D-CAT-3 | Import Excel/CSV deja `ImportacionCatalogo` (OK/error) | Auditable | Historial UI |
| D-CAT-4 | Publicar precio invalida anterior; briefs abiertos avisan stale | Ver D-CRM-4 | UAT |
| D-CAT-5 | ≥1 SKU/precio vigente en go-live | G8 | Catálogo prod |
| D-CAT-6 | `RegistroConsultaCatalogo` en 100 % respuestas de precio/paquete | C6 | Auditoría |

### 3.10 Cupo y uso

| ID | Criterio | Umbral | Evidencia |
|---|---|---|---|
| D-CUP-1 | Contador vs tope **1,000** unidades/mes del jardín activo | Visible coord/admin | `/cupo` |
| D-CUP-2 | Desglose simple Meta / WA / email + uso Agentic RAG | Si datos disponibles | UI |
| D-CUP-3 | Aproximación a tope → aviso admin/Medina (no bloqueo obligatorio sin política) | Alerta no punitiva | Caso / config |
| D-CUP-4 | Cupo por sede preparado para 2.º jardín; go-live solo jardín 1 | Modelo | Config |

### 3.11 Auditoría y telemetría operativa

| ID | Criterio | Umbral | Evidencia |
|---|---|---|---|
| D-TEL-1 | Eventos bot: ruta, tools+latencia, rerank, IDs, cupo, handoff, paso guion, calificación | Payload DTOs §3.3 | F7 |
| D-TEL-2 | Eventos humano: asignación, alerta, toma control, primer mensaje post-escalación, edición, etapa, reasignación | Payload §3.4 | F7 |
| D-TEL-3 | Resumen sede: tasa handoff, rutas, % briefs listos, cumplimiento SLA, carga | Shape telemetría | `/telemetria/sede/...` |
| D-TEL-4 | Drill-down a recuperaciones y consultas catálogo | Admin | UI |
| D-TEL-5 | No sustituye SIEM ni guardia 24/7 | Fuera de alcance | — |

---

## 4. Criterios por superficie frontend

Mapa de rutas: [../frontend/02-routing-y-paginas.md](../frontend/02-routing-y-paginas.md). Superficies: [../frontend/00-superficies.md](../frontend/00-superficies.md).

### 4.1 Criterios transversales UI

| ID | Criterio | Evidencia |
|---|---|---|
| UI-X-1 | Post-login redirect: asesor → `/alertas` o `/bandeja`; coord/admin → `/asignacion` | Navegación UAT |
| UI-X-2 | SideNav solo ítems del rol; deep link no autorizado → 403 producto o redirect | Gate UI + API |
| UI-X-3 | 401 → `/login`; 403 toast mensaje producto; 404 empty “No encontramos…” | Matriz errores |
| UI-X-4 | Una CTA primaria en atención; sin cards decorativas ni BI en bandeja asesor | F5 + review UX |
| UI-X-5 | Capacitabilidad: usable en sesión ≤5 usuarios con guía breve | Acta capacitación |
| UI-X-6 | Responsive: móvil lista→detalle; brief en sheet | Smoke móvil |

### 4.2 Por superficie

| Superficie | Ruta(s) | Criterios de éxito | Roles | Evidencia |
|---|---|---|---|---|
| **Login** | `/login` | Credenciales válidas → sesión; inválidas → error claro | Público | Test |
| **Alertas** | `/alertas` | Feed tipos; SLA visual; deep link a hilo/expediente; marcar atendida | A propias / C+D sede | F4 |
| **Bandeja** | `/bandeja`, `/bandeja/[id]` | Prioridad fija; scope ownership; CTA Responder/Tomar control; brief aside mínimo; F3 ≤5 s | A/C/D | F1, F3, F5 |
| **Expediente** | `/expedientes/[id]` | Ficha + brief + editar + etapa + tipificar perdido + timeline | A asignados / C+D sede | UAT 3.2 |
| **Pipeline** | `/pipeline` | Columnas/lista por etapa; tarjeta mínima; sin métricas campaña | A/C/D | UI |
| **Asignación/carga** | `/asignacion` | Tabla métricas + cola sin dueño + regla en lenguaje claro + Reasignar; **asesor 403** | C/D | F2, F6 |
| **Conocimiento** | `/conocimiento` | Biblioteca multimodal; upload+progress; estados publicación; job &lt;60 s; publicar/archivar; badge scrub tarifas; RBAC (UI-KNW-*) | Admin (+C pacto) | UAT 3.6 + [backend/09](../backend/09-aceptacion-y-matriz-tests.md) |
| **Catálogo** | `/catalogo` | SKUs, precios, import, historial, preview tools (admin) | C lectura / D write | UAT 3.3 |
| **Cupo** | `/cupo` | Consumo vs 1,000 + aviso tope | C/D | Vista |
| **Admin** | `/admin/*` | Usuarios, sedes, criterios, tipificaciones, enrutador | D write / C L | Smoke |
| **Telemetría** | `/telemetria`, `/telemetria/hilos/[id]` | Resumen sede + timeline; **asesor sin acceso** | D (+C limitado) | F7 |

### 4.3 Estados vacíos (adopción)

| Estado | Copy / comportamiento esperado |
|---|---|
| Bandeja vacía | Mensaje claro de que leads de campañas aparecerán ahí |
| Sin asignación | Visible en carga; CTA coordinador |
| Doc borrador | Bot no lo usa hasta publicar |
| Job error | Aviso actionable |
| Cupo alto | Aviso no punitivo + contacto Medina |
| Hilo sin eventos | Empty telemetría (“Aún no hay decisiones del bot…”) |

---

## 5. Criterios de API / contratos (alineados a DTOs)

Fuente: [../backend/05-dtos-y-tipos.md](../backend/05-dtos-y-tipos.md), consumo UI: [../frontend/05-api-y-hooks.md](../frontend/05-api-y-hooks.md).

### 5.1 Convenciones obligatorias

| Regla | Criterio de éxito |
|---|---|
| JSON API | `camelCase` (`listoParaCotizar`, `sedeId`) |
| Enums dominio | `snake_case` ES cerrados (`en_exploracion`, `listo_para_cotizar`) |
| Envelope | `{ data }` / `{ data, meta }` / `{ error: { code, message, details? } }` |
| Validación | Nest: `ValidationPipe` whitelist + forbidNonWhitelisted; FE: Zod espejo |
| IDs | UUID string; timestamps ISO-8601 UTC |
| Dinero | número + `moneda` (MXN); **nunca** inventado por LLM |

### 5.2 Endpoints críticos — aceptación

| Contrato | Criterio | Código esperado |
|---|---|---|
| `POST /auth/login` | LoginRequest → LoginResponse con user+rol+sedeIds | 200 / 401 |
| `GET /auth/me` | Mismo user shape | 200 / 401 |
| `GET /conversaciones` | `BandejaItem[]` + meta + `resumenPropio?`; filtros según rol | 200; asesor sin ampliar scope |
| `GET /conversaciones/:id` | Detail + mensajes; ownership | 200 / 404 |
| `POST .../mensajes` | Humano 1..4096; puede emitir `primer_mensaje_post_escalacion` | 201/200 |
| `POST .../tomar-control` | `estadoBot→humano` + evento | 200 |
| `POST .../devolver-a-bot` | Default 409 | 409 |
| `GET/PATCH /oportunidades/:id` | Detail / actualización parcial; recalcula flags | 200 / 404 / 422 |
| `GET .../brief` | `BriefCotizacion` canónico | 200 |
| `GET /oportunidades?vista=pipeline` | Tarjetas mínimas | 200 |
| `POST /asignaciones` | ReasignarRequest → AsignacionDto `regla=manual` | 200; asesor 403 |
| `GET /carga` | Shape §3.5 DTOs | 200; asesor 403 |
| `PATCH /usuarios/:id/disponibilidad` | `{ disponible }` | 200; roles C/D |
| `GET/POST notificaciones` | List / leer / atender | 200 + eventos |
| `GET /telemetria/...` | Eventos / resumen / registros | 200; asesor 403 |
| Catálogo / conocimiento | CRUD/import/publicar según matriz | 200/403 |
| Tools internas catálogo | Sin filas → `[]` o `SIN_PRECIO_VIGENTE`; nunca estimar | Contrato orquestador |

### 5.3 Anti-alucinación (contrato duro)

| Dato | Si falta | Código / comportamiento |
|---|---|---|
| Precio | Safe + handoff `sin_catalogo` | Sin monto en respuesta |
| Inclusiones | No mezclar SKUs | — |
| Disponibilidad fecha concreta | No afirmar (sin calendario ops v1) | Handoff |
| FAQ | Rerank &lt; 0.85 | Handoff `rerank_bajo` |
| Descuento no catalogado | Handoff | — |

### 5.4 Paridad FE ↔ BE

| Criterio | Evidencia |
|---|---|
| Enums compartidos Zod/shared alineados a Prisma/DTOs | Package shared + tests de contrato |
| Cliente HTTP mapea 401/403/404 según producto | Test integración UI |
| Query params engañosos de asesor ignorados o 403 | Test API F1 |

---

## 6. Criterios no funcionales

### 6.1 Rendimiento

| ID | Criterio | Umbral sugerido | Evidencia |
|---|---|---|---|
| NF-P-1 | Aparición de hilo en bandeja post-calificación | ≤ **5 s** (F3) | UAT cronometrado |
| NF-P-2 | Frescura conocimiento/catálogo en bot | **&lt; 60 s** (C4) | Caso fechado |
| NF-P-3 | Latencia respuesta bot (p95 orientativa v1) | Documentar baseline en staging; cuello típico = LLM/rerank | Métricas infra |
| NF-P-4 | Listados panel (bandeja/carga) con predicados en DB (no filtrar en memoria) | F1 + paginación | Code review / explain |
| NF-P-5 | Job ingesta timeout/reintentos + alerta si &gt; 60 s | Runbook | Logs/alertas |

### 6.2 Seguridad

| ID | Criterio | Evidencia |
|---|---|---|
| NF-S-1 | HTTPS en edge (staging/prod) | Config |
| NF-S-2 | Webhooks con verificación de firma Meta/Twilio | Tests |
| NF-S-3 | Secretos fuera del repo; separados por entorno | Inventario secretos |
| NF-S-4 | RBAC + ownership en **API** (UI no es autoridad) | Tests F1 |
| NF-S-5 | Política 404 anti-enumeración en GET recurso ajeno | Tests |
| NF-S-6 | Rate limiting básico en webhooks públicos | Config |
| NF-S-7 | Mínimo privilegio DB/storage | Roles DB |
| NF-S-8 | No loggear PII innecesaria en 401/403 | Sample logs |

### 6.3 Accesibilidad y usabilidad operativa

| ID | Criterio | Evidencia |
|---|---|---|
| NF-A-1 | Contraste legible en badges SLA (warning/danger) y CTA primaria | Review UX |
| NF-A-2 | Formularios con errores de campo en español; focus en invalid | Smoke |
| NF-A-3 | Navegación teclado en flujos login + bandeja (mínimo v1) | Checklist a11y básico |
| NF-A-4 | Empty/forbidden states comprensibles (no stack traces) | UI |
| NF-A-5 | Capacitabilidad ≤5 usuarios / ≤8 h | Acta Etapa 8 |

### 6.4 Confiabilidad

| ID | Criterio | Evidencia |
|---|---|---|
| NF-R-1 | Fallo LLM/rerank → safe/handoff, no respuesta inventada | Chaos/staging |
| NF-R-2 | Worker ingesta reintentable; estado `error` visible | UI + logs |
| NF-R-3 | Historial mensajes/asignaciones/eventos **inmutable** (no reescritura silenciosa) | Modelo conceptual |
| NF-R-4 | Entornos aislados: staging ≠ prod (DB, claves, vectores) | Infra §5 |
| NF-R-5 | Idempotencia razonable de webhooks (no duplicar mensaje por reintento proveedor) | Tests canales |

---

## 7. Criterios de infraestructura y operación

Fuente: [../infrastructure/01-stack-y-entornos.md](../infrastructure/01-stack-y-entornos.md).

| ID | Criterio | Umbral / regla | Evidencia |
|---|---|---|---|
| INF-1 | Componentes: API NestJS, worker ingesta, panel Next.js, PostgreSQL + **pgvector** + FTS | Desplegados staging/prod | Diagrama + health |
| INF-2 | Extensión pgvector + FTS (ES recomendado) + índices vector/GIN/B-tree | Migraciones Prisma OK | DB check |
| INF-3 | Cola jobs con prioridad alta en publicar/archivar documento | SLA &lt; 60 s | Métricas jobs |
| INF-4 | Entornos `dev` / `staging` / `prod` con secretos y datos separados | Sin cruce vectores | Inventario |
| INF-5 | Backups automatizados Postgres + retención según acuerdo comercial | Restore probado al menos 1 vez pre go-live | Acta restore |
| INF-6 | Logs estructurados: webhooks, ruta orquestador, tools, rerank, jobs | Consultables | Sample |
| INF-7 | Alertas ops: fallo sostenido webhooks, cola &gt; 60 s, error LLM/rerank | Canal Medina | Config alertas |
| INF-8 | Telemetría de producto (`EventoOperativo`) además de logs infra | Panel telemetría | F7 |
| INF-9 | Uptime orientativo v1 (un jardín, ~1k msgs/mes): objetivo **≥ 99.5 %** mensuales del panel+API en horario laboral pactado (excluye ventanas de mantenimiento anunciadas) | Informe post go-live | Monitoreo |
| INF-10 | RPO/RTO sugeridos v1: RPO ≤ **24 h** (backup diario); RTO ≤ **8 h** laborales ante fallo crítico DB (ajustar si el contrato comercial fija otros) | Runbook | Restore drill |
| INF-11 | Health endpoints públicos mínimos (`/health` API) sin exponer secretos | Probe | HTTP 200 |
| INF-12 | Sin SIEM ni guardia 24/7 en membresía base | Explícito en alcance | — |
| INF-13 | Object storage S3-compatible **obligatorio** para binarios K + adjuntos; worker video con **ffmpeg** | D-KNW-10 / D-MED-3/9 | Bucket + imagen worker |

---

## 8. Criterios de calidad (tests, coverage, lint, CI)

El repo aún puede estar en fase documental; estos umbrales aplican **cuando exista código** y son requisito de salida a producción.

### 8.1 Pirámide de pruebas (mínimo)

| Capa | Qué cubrir | Prioridad |
|---|---|---|
| Unit | Calificación, `listo_para_cotizar`, algoritmo asignación, predicados ownership, validación brief, **MIME/scrub/tariff gate** | Must |
| Integration API | Auth, bandeja F1, reasignación F6, telemetría F7, publicar conocimiento &lt;60 s (staging), tools `SIN_PRECIO_VIGENTE`, **parsers T-MED-* con fixtures** | Must |
| Contract | Enums/Zod ↔ DTOs; envelope error; **UNSUPPORTED_MIME / PAYLOAD_TOO_LARGE** | Must |
| E2E / UAT scripted | Flujos §3 de [02-fases-golive](../producto/02-fases-golive.md) en staging; **U-MED por MIME** ([backend/09](../backend/09-aceptacion-y-matriz-tests.md) §9) | Must |
| `@live` staging | Vision/Transcription/Rerank reales; T-MED-FRESH | Should (bloquea go-live media) |
| Load (opcional v1) | Smoke de webhooks concurrentes bajos | Could |

### 8.2 Umbrales sugeridos

| Señal | Umbral sugerido | Notas |
|---|---|---|
| Coverage líneas (servicios de dominio crítico: calificación, asignación, orquestador routing, RBAC, **parsers/MIME/storage iface**) | ≥ **70 %** | No exigir 70 % global si hay UI generada; sí en módulos listados |
| Coverage branches en anti-alucinación / handoff / **scrub tariff** | ≥ **80 %** | C3/C5; D-MED-5/6/10 |
| Lint / format | 0 errores en CI | ESLint/Prettier o equivalente acordado |
| Typecheck | `tsc --noEmit` / Nest build verde | CI |
| CI pipeline | lint + typecheck + unit + integration en PR | Badge verde obligatorio para merge a main |
| Secrets en CI | No hardcode; vars de entorno | Scan básico |
| Migraciones | Prisma migrate en CI staging automatizable | Doc setup 02/03 |

### 8.3 Casos de prueba obligatorios (mapeo a IDs de producto)

| Suite | Debe demostrar |
|---|---|
| Dos asesores | F1 |
| Carga multi-asesor | F2 |
| Calificar → bandeja ≤5 s | F3 |
| Escalación SLA visual | F4 |
| Viewport asesor minimalista | F5 (checklist manual OK) |
| Reasignación origen/destino | F6 |
| Telemetría mensaje bot + turno humano | F7 |
| Precio solo catálogo | C3 |
| Rerank bajo → handoff | C5 |
| Republicación &lt; 60 s | C4 |
| PDF/foto tarifa → scrub; monto solo tools | C3 + D-MED-10 |
| Suites T-MED-* (mock ports) | [backend/09](../backend/09-aceptacion-y-matriz-tests.md) |
| Jardín 2 no operativo | UAT 3.7 |

---

## 9. Matriz de aceptación MoSCoW / P0–P2

Leyenda: **Must (P0)** = bloquea go-live · **Should (P1)** = esperado en corte go-live o inmediato post · **Could (P2)** = deseable sin bloquear Jardín 1.

### 9.1 Must / P0 (go-live)

| ID producto | Descripción corta |
|---|---|
| DoD-1…12 (núcleo) | Embudo + CRM + asignación + panel roles + UAT firmado |
| C3, C5, C4 | Precisión precio, handoff confianza, frescura |
| C1, C2 | Cobertura captura y completitud brief (umbrales UAT) |
| F1–F7 | RBAC, carga, latencia bandeja, SLA UI, minimalismo, reasignación, telemetría |
| G1–G11 | Criterio go-live fases |
| D-CH-1..3 | Canales del corte (FB/IG; WA si incluido en el mismo corte) |
| D-BOT-*, D-CAL-*, D-ASG-1..8, D-CRM-1..6 | Dominios críticos |
| D-KNW-1..10, D-MED-1..14, D-CAT-1..5 | Conocimiento mínimo + multimodal + catálogo |
| NF-S-1..5, INF-1..5, INF-7, **INF-13 storage** | Seguridad e infra mínima |
| CI verde + tests F1/F6/C3 + T-MED mock | Calidad |

### 9.2 Should / P1

| Ítem | Notas |
|---|---|
| C6, C7 | Trazabilidad 100 % y coherencia aforo |
| Email transaccional | Si está en acuerdo |
| WA plantillas utility | Si etapa 9 en el mismo corte; si no, plan fechado |
| D-CUP-* vista cupo | Contador interno como mínimo |
| NF-P-3 baseline latencia | Documentar en staging |
| NF-A-3 teclado básico | |
| Coordinador lectura telemetría sede | Preferido para SLA |
| Restore drill backup | Pre go-live |
| `@live` T-MED-FRESH / Vision real en staging | Bloquea go-live media (DoD-13) |

### 9.3 Could / P2

| Ítem | Notas |
|---|---|
| Devolución a bot | Política opcional; default off |
| Desglose fino cupo por canal | Si datos disponibles |
| Load testing formal | |
| a11y WCAG completo | Más allá del mínimo operativo |
| Uptime SLO contractual estricto | Si no está en membresía |

### 9.4 Won’t (go-live) — ver §12

Todo lo listado como fuera de alcance es **Won’t** para este corte.

---

## 10. Checklist de salida a producción (go-live Jardín 1)

Completar **todos** los ítems. Fuente alineada a G1–G11 + UAT §3.

### 10.1 Aprobaciones y personas

- [ ] Responsable único de aprobaciones Tres Cielos nominado
- [ ] Guiones conversacionales aprobados (G1)
- [ ] UAT checklist firmado (G2) — ver §10.3
- [ ] Capacitación impartida ≤8 h + material entregado (G6)
- [ ] Compromiso de contacto humano 15–30 min post-escalación (adopción)

### 10.2 Accesos e integraciones

- [ ] Meta Business / páginas FB–IG productivas
- [ ] Twilio + WA Business + plantillas (si WA en corte)
- [ ] Credenciales LLM / embeddings / Cohere Rerank / **OpenAI Vision+Transcription** en gestor de secretos prod
- [ ] Object storage S3-compatible (`S3_*`) configurado; worker con **ffmpeg** para video
- [ ] SMTP/email si aplica
- [ ] Usuarios panel (asesores, coordinador, admin) creados y roles correctos

### 10.3 UAT técnico (resumen — detalle en fases §3)

- [ ] Captación FB/IG (+ WA si aplica)
- [ ] Calificación / brief / CRM
- [ ] Catálogo y 0 precios inventados
- [ ] Asignación + notificaciones + F1–F7
- [ ] Frescura &lt; 60 s + RegistroRecuperacion
- [ ] UAT multimodal U-MED-1…8 (PDF, Word, XLS split, foto, foto tarifa, video, adjunto lead) — [backend/09](../backend/09-aceptacion-y-matriz-tests.md) §9
- [ ] Solo Jardín 1 operativo
- [ ] C3 y C5 en verde (G10); F1, F5, F7 (G11)

### 10.4 Datos y configuración

- [ ] K01, K02, K04, K08, K09 publicados (K05 opcional) (G8)
- [ ] ≥1 SKU/precio vigente (G8)
- [ ] Enrutador: sede + disponibilidad + round-robin documentado en UI
- [ ] Tipificaciones de perdido cargadas
- [ ] Cupo periodo inicial en cero o baseline conocido

### 10.5 Infra y operación

- [ ] Staging ≠ prod validado
- [ ] Backups activos + restore drill (INF-5/10)
- [ ] Alertas webhooks / cola / LLM configuradas
- [ ] Health checks y HTTPS
- [ ] Runbook Medina: rotación secretos, escalación incidentes P2/P3 membresía
- [ ] Feature flags / `ADMIN_API_READY` según setup (si aplica) en estado prod seguro

### 10.6 Go / No-Go

| Decisión | Condición |
|---|---|
| **GO** | Todos los Must/P0 + G1–G11 + checklist §10 firmados |
| **NO-GO** | Cualquier Must rojo; C3 fallido; F1 fallido; Jardín 2 recibiendo leads; frescura no demostrada |

Tras GO: membresía según propuesta (inicio a los 15 días o fecha pactada); excedentes/add-ons fuera de este criterio.

---

## 11. Evidencias requeridas para marcar un criterio como cumplido

### 11.1 Tipos de evidencia aceptados

| Tipo | Cuándo aplica | Formato mínimo |
|---|---|---|
| **Acta / correo de aprobación** | Guiones, UAT, go-live | Fecha, firmante, alcance |
| **Caso UAT numerado** | Flujos bot/panel | Pasos, esperado, resultado, captura o ID expediente |
| **Export / query auditable** | C3, C6, telemetría | IDs `RegistroConsultaCatalogo` / `RegistroRecuperacion` / `EventoOperativo` |
| **Grabación o cronómetro** | F3, C4, SLA visual | Timestamp inicio/fin |
| **Prueba automatizada CI** | F1, F6, guards, validación | Nombre test + pipeline verde |
| **Review UX checklist** | F5, minimalismo | Lista §5.3 producto roles firmada |
| **Config snapshot** | Sedes, enrutador, secretos presentes (no valores) | Checklist ops |
| **Restore drill** | Backups | Fecha + RTO observado |

### 11.2 Regla de cierre de criterio

Un criterio Must se marca **cumplido** solo si:

1. Tiene evidencia de §11.1 almacenada (Notion/Drive/repo `docs/` de actas — sin secretos), y
2. No hay defecto abierto P0 relacionado, y
3. El owner (QA Medina o responsable cliente según fila) firmó.

### 11.3 Matriz evidencia ↔ familias de criterios

| Familia | Evidencia mínima |
|---|---|
| C1–C7 | Muestra UAT + auditoría registros |
| F1–F7 | Pruebas dos usuarios + capturas UI + (F3/F4) tiempo |
| G1–G11 | Acta go-live consolidada |
| Dominios D-* | Tests + al menos 1 caso UAT por dominio Must |
| API | Contract tests + colección Postman/Insomnia o e2e |
| Infra | Dashboard alertas + backup restore |
| Calidad | Badge CI + reporte coverage módulos críticos |

---

## 12. Anti-criterios / fuera de alcance explícito

Lo siguiente **no** forma parte del éxito del producto en go-live Jardín 1. Implementarlo “por iniciativa” sin change order cuenta como **desalineación**.

### 12.1 Canales y marketing

- Widget web, Google Ads como canal nativo, SMS masivo, email marketing masivo
- Marketing masivo por WhatsApp / drips post-contacto autónomos
- Agente autónomo multi-día o negociación libre de descuentos

### 12.2 Comercial / BI

- Emisión automática de PDF de cotización, contrato, anticipo o factura
- Cerrar precio final negociado o descuentos no catalogados vía bot
- BI comercial, reportes marketing, dashboards ejecutivos de conversión multi-periodo
- Scoring predictivo / ML / reactivación masiva de fríos
- Afirmar disponibilidad de fecha en calendario de operaciones (sin integración futura explícita)

### 12.3 Sedes y membresía

- Segundo jardín **activo** operando leads (existe inactivo / preparado; activación = change order + cupo/membresía adicionales)
- Facturación automática de excedentes de cupo dentro del panel

### 12.4 Seguridad / ops avanzados

- SIEM, SOC, guardia 24/7
- White-label / multi-marca
- App móvil nativa / push móvil

### 12.5 UX que no debe aparecer

- Analítica de equipo en bandeja del asesor
- Charts complejos en carga/cupo (meter simple sí)
- Design system de marketing / landing en el panel
- Confundir telemetría operativa con BI

### 12.6 Qué sí está incluido (no confundir con exclusiones)

| Incluido | Doc |
|---|---|
| Telemetría operativa bot + humano | producto/04 §7 |
| Vista carga multi-asesor | superficies §3.4 |
| Criterios F1–F7 | producto/04 §6 |
| Brief de cotización (humano emite propuesta) | producto/03 |
| Agentic RAG acotado + catálogo Prisma | backend/02–04 |

---

## 13. Trazabilidad: de este documento a la docs existente

| Sección de este doc | Origen principal |
|---|---|
| §1 DoD / visión | producto/01 embudo; producto/02 G1–G11; README arquitectura |
| §2 Roles | producto/04; frontend/00 §4; backend/06 |
| §3 Dominios | backend/01; orquestador/RAG/ingesta; producto/03; **backend/09 (D-MED)** |
| §4 Superficies | frontend/00, 02, 03; F1–F7; UI-KNW en backend/09 |
| §5 API | backend/05; frontend/05 |
| §6 NFR | infrastructure/01; producto umbrales F3/C4; RBAC |
| §7 Infra | infrastructure/01 (+ umbrales operativos sugeridos explícitos aquí; storage/ffmpeg) |
| §8 Calidad | Derivado de F/C/G + matriz T-MED en backend/09 |
| §9 MoSCoW | Síntesis de Must = G + C críticos + F + anti-alcance |
| §10 Go-live | producto/02 §3 y §5 |
| §11 Evidencias | producto/02–04 tablas “evidencia” |
| §12 Anti-criterios | producto/02 §7; producto/03 §6–7; producto/04 §7.4; dominios § límites v1 |

### Relación con setup 01–03

| Setup | Cómo valida este doc |
|---|---|
| [01-frontend-setup](01-frontend-setup.md) | Habilita superficies §4 y gates; no sustituye F1–F7 |
| [02-backend-setup](02-backend-setup.md) | Habilita dominios §3 y contratos §5 |
| [03-infraestructura-setup](03-infraestructura-setup.md) | Habilita §7; backups/observabilidad |

---

## 14. Criterio de cierre de este entregable

Quedan definidos: DoD de producto Jardín 1, logros por actor/rol, criterios medibles por dominio y superficie, contratos API/DTO, NFR, infra/ops, calidad/CI, matriz MoSCoW P0–P2, checklist go-live, evidencias de aceptación y anti-alcance explícito — alineados a la documentación de producto, backend, frontend, database e infraestructura del repo, sin inventar features fuera de esas fuentes.

---

## 15. Gate de salida a producción del chatbot

Este documento cubre el **DoD de producto completo** (panel + CRM + bot). El candado operativo específico para **encender el Agentic RAG en prod** (checklists pre-prod/prod, matriz UAT firmable del bot, rollback API/worker/flag, criterios NO-GO como alucinación de montos o Cohere ausente) está en:

**[09 — Criterios de salida a producción del chatbot](09-criterios-salida-produccion-chatbot.md)**

Plan de infra asociado: [../infrastructure/02-plan-implementacion-chatbot-infra.md](../infrastructure/02-plan-implementacion-chatbot-infra.md).
