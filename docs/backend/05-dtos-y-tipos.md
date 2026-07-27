# DTOs, types y estructura de datos

Contratos de datos del sistema Event Master / Tres Cielos para API NestJS, panel Next.js y telemetría. Derivados del modelo conceptual y dominios de producto; **aún no hay código NestJS/Prisma/Next.js en el repo** — al implementar, estos shapes son la fuente de verdad de wire format hasta que existan DTOs/Zod en código (entonces el código gana y este doc se alinea).

Referencias: [01-dominios.md](01-dominios.md), [02-orquestador-agentico.md](02-orquestador-agentico.md), [../database/01-modelo-conceptual.md](../database/01-modelo-conceptual.md), [../database/02-catalogo-paquetes.md](../database/02-catalogo-paquetes.md), [../producto/01-diseno-estrategico.md](../producto/01-diseno-estrategico.md), [../producto/03-criterios-exito-cotizacion.md](../producto/03-criterios-exito-cotizacion.md), [../producto/04-escenarios-rol-carga-telemetria.md](../producto/04-escenarios-rol-carga-telemetria.md), [../frontend/00-superficies.md](../frontend/00-superficies.md).

## 1. Convenciones

### 1.1 Naming

| Capa | Convención | Ejemplo |
|---|---|---|
| JSON de API (request/response) | `camelCase` | `listoParaCotizar`, `sedeId` |
| Valores de enums de dominio | `snake_case` en español (cerrados) | `en_exploracion`, `listo_para_cotizar` |
| Entidades Prisma / tablas | `PascalCase` modelo; columnas `snake_case` | `Oportunidad.listo_para_cotizar` |
| Tools del orquestador | `snake_case` verbos | `buscar_paquetes` |
| IDs | UUID v4 string | `"a1b2c3d4-..."` |
| Timestamps | ISO-8601 UTC | `"2026-07-27T21:00:00.000Z"` |
| Dinero | número decimal + `moneda` ISO | `monto: 45000`, `moneda: "MXN"` |

### 1.2 Validación por stack

| Capa | Librería | Uso |
|---|---|---|
| NestJS (API) | `class-validator` + `class-transformer` | DTOs de request; `ValidationPipe` global (`whitelist`, `forbidNonWhitelisted`, `transform`) |
| Shared / Next.js | Zod (recomendado en `packages/shared` o equivalente) | Schemas espejo de enums y payloads de UI; inferencia de types |
| Prisma | Enums Prisma alineados a §2 | Persistencia; no inventar valores fuera del catálogo cerrado |

Reglas comunes:

- Strings trimados; vacíos → `400` / Zod fail.
- Enums: solo valores de §2 (`@IsEnum` / `z.enum`).
- Fechas de negocio (`fechaTentativa`): aceptar `YYYY-MM-DD` o rango `{ desde, hasta }`; rechazar fechas &lt; hoy−1 día salvo override admin.
- Aforo: entero `1..N` (N acotado por capacidad de sede; default tope duro `10000`).
- IDs de FK: UUID; inexistente → `404`.
- Nullabilidad: opcional en TypeScript = ausente o `null` solo si el campo es explícitamente nullable en el contrato.

### 1.3 Envelope de respuesta API

```ts
// Éxito
{ "data": T }

// Lista paginada
{
  "data": T[],
  "meta": { "page": number, "pageSize": number, "total": number }
}

// Error
{
  "error": {
    "code": string,       // ej. "VALIDATION_ERROR" | "FORBIDDEN" | "SIN_PRECIO_VIGENTE"
    "message": string,
    "details?": unknown
  }
}
```

### 1.4 Qué el bot **nunca** inventa

| Dato | Fuente obligatoria | Si falta |
|---|---|---|
| Precio / monto / rango | `PaquetePrecio` vía tools | Safe reply + handoff (`sin_catalogo`) |
| Inclusiones tipadas | `PaqueteInclusion` | Idem; no mezclar SKUs |
| Disponibilidad de fecha concreta | Proceso humano (sin calendario ops en v1) | No afirmar; handoff |
| Políticas / FAQ | Fragmentos publicados rerank ≥ 0.85 + cita | Safe + handoff (`rerank_bajo`) |
| Descuentos no catalogados | — | Handoff (`conflicto` / otro) |

## 2. Enums y types de dominio (cerrados)

```ts
/** Rol de Usuario del panel */
type RolUsuario = "asesor" | "coordinador" | "admin";

/** Estado operativo de Sede */
type EstadoSede = "activa" | "inactiva";

/** Canal de mensajería v1 */
type Canal = "facebook" | "instagram" | "whatsapp";

/** Calificación de Oportunidad */
type Calificacion = "calificado" | "en_exploracion";

/** Etapas de pipeline (§5 diseño estratégico) */
type EtapaPipeline =
  | "nuevo_bot"
  | "calificado"
  | "contactado"
  | "propuesta"
  | "negociacion"
  | "ganado"
  | "perdido";

/** Motivo tipificado de perdido */
type MotivoPerdido =
  | "precio"
  | "fecha"
  | "competencia"
  | "sin_respuesta"
  | "otro";

/** Estado del bot en Conversacion */
type EstadoBot = "activo" | "escalado" | "humano";

/** Ruta del orquestador por turno */
type RutaOrquestador = "guion" | "catalogo" | "rag" | "handoff" | "safe";

/** Actor de EventoOperativo / auditoría */
type ActorOperativo = "bot" | "asesor" | "coordinador" | "admin" | "sistema";

/** Motivos de handoff */
type MotivoHandoff =
  | "solicitud_usuario"
  | "rerank_bajo"
  | "sin_catalogo"
  | "sin_cita_rag"
  | "conflicto"
  | "queja"
  | "descuento_fuera_catalogo"
  | "sede_no_cubierta"
  | "ambiguiedad"
  | "otro";

/** Tipo de evento / ocasión (ramo eventos sociales) */
type TipoEvento = "boda" | "xv" | "corporativo" | "social" | "otro" | "multi";

/** Autor de Mensaje */
type AutorMensaje = "prospecto" | "bot" | "asesor";

/** Dirección de Mensaje */
type DireccionMensaje = "entrante" | "saliente";

/** Tipos de Notificacion */
type TipoNotificacion =
  | "lead_nuevo"
  | "lead_calificado"
  | "listo_para_cotizar"
  | "escalacion"
  | "otro";

/** Estado de notificación */
type EstadoNotificacion = "pendiente" | "leida" | "atendida";

/** Canal de entrega de notificación */
type CanalEntregaNotificacion = "panel" | "email";

/** Regla de Asignacion */
type ReglaAsignacion =
  | "sede_disponibilidad_round_robin"
  | "dueño_vigente_escalacion"
  | "cola_coordinador"
  | "manual";

/** Publicación de DocumentoFuente / Paquete / PaquetePrecio */
type EstadoPublicacion = "borrador" | "publicado" | "archivado";

/** Tipo documental RAG */
type TipoDocumento =
  | "faq"
  | "ficha_sede"
  | "politica"
  | "tipos_evento"
  | "safe_reply"
  | "otro";

/** Categoría de inclusión de paquete */
type CategoriaInclusion =
  | "catering"
  | "mobiliario"
  | "audio"
  | "decoracion"
  | "personal"
  | "otro";

/** Unidad de precio */
type UnidadPrecio = "evento" | "persona" | "otro";

/** Tipo de PaqueteRegla */
type TipoPaqueteRegla =
  | "solo_fin_semana"
  | "no_feriados"
  | "anticipo_minimo"
  | "horario"
  | "otro";

/** Resultado de ImportacionCatalogo */
type ResultadoImportacion = "exito" | "parcial" | "fallo";

/** Tools de catálogo (function calling) */
type ToolCatalogo =
  | "buscar_paquetes"
  | "obtener_precio_paquete"
  | "listar_inclusiones"
  | "comparar_paquetes"
  | "evaluar_reglas_paquete"
  | "transferir_a_humano";

/** Tipos de EventoOperativo — bot */
type TipoEventoOperativoBot =
  | "bot_decision"
  | "bot_mensaje_saliente"
  | "bot_evaluacion_calificacion"
  | "bot_handoff";

/** Tipos de EventoOperativo — humano / sistema */
type TipoEventoOperativoHumano =
  | "asignacion_recibida"
  | "alerta_vista"
  | "alerta_atendida"
  | "toma_control"
  | "primer_mensaje_post_escalacion"
  | "edicion_expediente"
  | "cambio_etapa"
  | "reasignacion"
  | "devolucion_a_bot"
  | "publicacion_documento"
  | "publicacion_catalogo";

type TipoEventoOperativo = TipoEventoOperativoBot | TipoEventoOperativoHumano;

/** Urgencia SLA en bandeja (derivado, no persistido como enum libre) */
type UrgenciaSla = "dentro_ventana" | "fuera_ventana" | "sin_sla";

/** Presupuesto: rango o no definido explícito */
type PresupuestoOrientativo =
  | { tipo: "rango"; min?: number; max?: number; moneda: "MXN" }
  | { tipo: "no_definido" };

/** Fecha tentativa */
type FechaTentativa =
  | { tipo: "dia"; fecha: string /* YYYY-MM-DD */; flexible: boolean }
  | { tipo: "rango"; desde: string; hasta: string; flexible: boolean }
  | { tipo: "mes"; anio: number; mes: number; flexible: boolean };
```

### 2.1 Mapa enum → entidad conceptual

| Enum | Entidad / campo |
|---|---|
| `RolUsuario` | `Usuario.rol` |
| `EstadoSede` | `Sede.estado` |
| `Canal` | `Conversacion` / `Mensaje` / `Oportunidad.canalOrigen` |
| `Calificacion` | `Oportunidad.calificacion` |
| `EtapaPipeline` | `Oportunidad.etapa` |
| `EstadoBot` | `Conversacion.estadoBot` |
| `RutaOrquestador` | `Mensaje.ruta` + payload `EventoOperativo` |
| `TipoEventoOperativo*` | `EventoOperativo.tipo` |
| `MotivoHandoff` | Escalación / payload handoff |
| `EstadoPublicacion` | `DocumentoFuente`, `Paquete`, `PaquetePrecio` |

## 3. Payloads JSON clave (shapes canónicos)

### 3.1 `BriefCotizacion`

Snapshot consolidado en `Oportunidad` (JSON versionado o tabla hermana). Relación: `Oportunidad` 1→0..1 vigente + historial opcional.

```json
{
  "version": 3,
  "actualizadoEn": "2026-07-27T21:05:00.000Z",
  "actualizadoPor": "bot",
  "tipoEvento": "boda",
  "fechaTentativa": {
    "tipo": "dia",
    "fecha": "2026-11-14",
    "flexible": false
  },
  "aforo": 150,
  "sedeId": "uuid-jardin-1",
  "sedeNombre": "Jardín 1",
  "paquete": {
    "modo": "sku",
    "paqueteId": "uuid-paquete",
    "codigoSku": "BODA-J1-ESENCIAL",
    "nombre": "Esencial"
  },
  "precioCatalogoAlMomento": {
    "moneda": "MXN",
    "monto": 85000,
    "rangoMin": null,
    "rangoMax": null,
    "unidad": "evento",
    "vigenteDesde": "2026-01-01",
    "vigenteHasta": null,
    "paquetePrecioId": "uuid-precio"
  },
  "precioCatalogoDesactualizado": false,
  "inclusionesClave": [
    {
      "categoria": "catering",
      "nombre": "Menú tres tiempos",
      "cantidad": null,
      "unidad": null
    }
  ],
  "presupuestoOrientativo": {
    "tipo": "rango",
    "min": 70000,
    "max": 100000,
    "moneda": "MXN"
  },
  "restricciones": {
    "outdoorIndoor": null,
    "horario": null,
    "menores": null,
    "notas": "Prefieren ceremonia al aire libre"
  },
  "contacto": {
    "nombre": "María López",
    "canalRespuesta": "whatsapp",
    "telefono": "+52155...",
    "correo": null
  },
  "fuentes": {
    "registroConsultaCatalogoIds": ["uuid-rcc"],
    "registroRecuperacionIds": []
  },
  "listoParaCotizar": true
}
```

| Campo | Obligatorio para `listo_para_cotizar` | Notas |
|---|---|---|
| `tipoEvento` | Sí | Enum `TipoEvento` (sin `multi` como captura de lead) |
| `fechaTentativa` | Sí | |
| `aforo` | Sí | |
| `sedeId` | Sí | |
| `paquete` | Sí | `{ modo: "sku", ... }` **o** `{ modo: "a_medida" }` |
| `presupuestoOrientativo` | Sí | Rango **o** `no_definido` explícito |
| `contacto.nombre` + canal | Sí | |
| `precioCatalogoAlMomento` | No (sí si `modo=sku` y hubo tool) | Nunca inventado; solo de catálogo |
| `restricciones` | No | Vacío permitido si el lead no mencionó |
| `precioCatalogoDesactualizado` | Sistema | `true` si precio del SKU cambió tras snapshot |

Variante `a_medida`:

```json
{
  "paquete": { "modo": "a_medida" },
  "precioCatalogoAlMomento": null
}
```

### 3.2 `EventoOperativo` — común

Relación: `Oportunidad` 1→N; opcional `Conversacion` / `Mensaje`.

```json
{
  "id": "uuid",
  "tipo": "bot_decision",
  "actor": "bot",
  "timestamp": "2026-07-27T21:04:10.000Z",
  "sedeId": "uuid-jardin-1",
  "oportunidadId": "uuid-opp",
  "conversacionId": "uuid-conv",
  "mensajeId": "uuid-msg",
  "payload": {}
}
```

### 3.3 Payload bot (`EventoOperativo.payload`)

```json
{
  "ruta": "catalogo",
  "pasoGuion": "captura_aforo",
  "tools": [
    {
      "nombre": "obtener_precio_paquete",
      "latenciaMs": 42,
      "ok": true,
      "filasSku": ["BODA-J1-ESENCIAL"],
      "errorCode": null
    }
  ],
  "rag": null,
  "cupo": {
    "unidadesMensajeria": 1,
    "tokensEstimados": 1200,
    "usoAgenticRag": true
  },
  "motivoHandoff": null,
  "calificacionResultado": "calificado",
  "listoParaCotizar": true,
  "registroConsultaCatalogoId": "uuid-rcc",
  "registroRecuperacionId": null
}
```

Payload RAG (cuando `ruta = "rag"`):

```json
{
  "ruta": "rag",
  "rag": {
    "scoresRerank": [0.91, 0.88],
    "umbral": 0.85,
    "fragmentoIds": ["uuid-f1", "uuid-f2"],
    "fuentesCita": ["faq-horarios-v3.pdf"],
    "handoffPorBajaConfianza": false
  },
  "tools": [],
  "motivoHandoff": null
}
```

Payload handoff:

```json
{
  "ruta": "handoff",
  "motivoHandoff": "rerank_bajo",
  "pasoGuion": "faq",
  "tools": [],
  "rag": {
    "scoresRerank": [0.62, 0.55],
    "umbral": 0.85,
    "fragmentoIds": [],
    "fuentesCita": [],
    "handoffPorBajaConfianza": true
  }
}
```

| Campo payload bot | Obligatorio |
|---|---|
| `ruta` | Sí |
| `cupo` (tokens/unidades estimadas) | Sí en mensaje saliente / decisión |
| `tools[]` | Si hubo tools |
| `rag` | Si hubo RAG |
| `motivoHandoff` | Si `ruta = handoff` |
| `pasoGuion` | Si aplica guion |
| Resultado calificación / `listoParaCotizar` | Si se evaluó en el turno |

### 3.4 Payload humano (`EventoOperativo.payload`)

Ejemplos por `tipo`:

**`toma_control`**

```json
{
  "estadoBotAnterior": "escalado",
  "estadoBotNuevo": "humano",
  "usuarioId": "uuid-asesor"
}
```

**`primer_mensaje_post_escalacion`**

```json
{
  "latenciaMs": 720000,
  "dentroVentanaSla": true,
  "ventanaMinutos": { "min": 15, "max": 30 },
  "mensajeId": "uuid-msg"
}
```

**`cambio_etapa`**

```json
{
  "etapaDesde": "calificado",
  "etapaHasta": "contactado",
  "usuarioId": "uuid-asesor"
}
```

**`reasignacion`**

```json
{
  "asignacionId": "uuid-asig",
  "usuarioOrigenId": "uuid-a",
  "usuarioDestinoId": "uuid-b",
  "regla": "manual",
  "actorUsuarioId": "uuid-coord"
}
```

**`edicion_expediente`**

```json
{
  "camposTocados": ["aforo", "fechaTentativa", "presupuestoOrientativo"],
  "usuarioId": "uuid-asesor"
}
```

**`alerta_atendida`**

```json
{
  "notificacionId": "uuid-n",
  "tipoNotificacion": "escalacion",
  "latenciaDesdeEmisionMs": 400000
}
```

### 3.5 Métricas de carga por asesor

Shape de fila en superficie Asignación/carga (coordinador/admin). Derivado de `Oportunidad` + `Conversacion` + `Asignacion` vigente; no es entidad persistida.

```json
{
  "asesorId": "uuid",
  "nombre": "Ana Ruiz",
  "disponible": true,
  "sedeId": "uuid-jardin-1",
  "metricas": {
    "abiertasAsignadas": 12,
    "escaladasPendientes": 2,
    "listosSinPropuesta": 3,
    "fueraVentanaSla": 1
  }
}
```

Definiciones (producto §4):

| Campo | Regla |
|---|---|
| `abiertasAsignadas` | Dueño vigente y etapa ∉ `{ ganado, perdido }` |
| `escaladasPendientes` | `estadoBot = escalado` sin primer mensaje humano post-escalación |
| `listosSinPropuesta` | `listoParaCotizar` y etapa aún no `propuesta` |
| `fueraVentanaSla` | Escalación &gt; 30 min sin contacto humano / alerta no atendida |
| `disponible` | Flag para enrutador |

Respuesta de vista de carga:

```json
{
  "data": {
    "sedeId": "uuid-jardin-1",
    "reglaVigente": {
      "codigo": "sede_disponibilidad_round_robin",
      "descripcion": "Round-robin por sede, solo disponibles"
    },
    "asesores": [ /* CargaAsesor[] */ ],
    "colaSinAsignar": {
      "calificadosSinDueno": 1,
      "exploracionPendiente": 4
    }
  }
}
```

### 3.6 Item de bandeja

Fila de lista en Bandeja (asesor: solo asignados). Relación: proyección de `Conversacion` + `Oportunidad` + `Lead` + última `Notificacion` relevante.

```json
{
  "conversacionId": "uuid-conv",
  "oportunidadId": "uuid-opp",
  "leadId": "uuid-lead",
  "preview": "¿Cuánto cuesta el paquete esencial…",
  "canal": "whatsapp",
  "estadoBot": "escalado",
  "calificacion": "calificado",
  "listoParaCotizar": true,
  "etapa": "calificado",
  "urgenciaSla": "dentro_ventana",
  "motivoHandoff": "solicitud_usuario",
  "asesorAsignadoId": "uuid-asesor",
  "sinAsignar": false,
  "contactoNombre": "María López",
  "briefMini": {
    "tipoEvento": "boda",
    "fechaTentativaResumen": "2026-11-14",
    "aforo": 150,
    "paqueteResumen": "BODA-J1-ESENCIAL"
  },
  "ultimoMensajeEn": "2026-07-27T21:04:00.000Z",
  "prioridad": 1
}
```

Orden de prioridad fijo (menor `prioridad` = más arriba):

1. Escalación (`urgenciaSla` dentro/fuera).
2. `listoParaCotizar`.
3. Calificado sin contactar (`etapa = calificado`).
4. Resto.

Resumen ligero del asesor (única analítica propia):

```json
{
  "urgentes": 2,
  "listos": 3,
  "abiertos": 11
}
```

## 4. DTOs por dominio crítico

Notación: `+` obligatorio, `?` opcional. Responses envueltas en `{ data }` salvo webhooks.

### 4.1 Auth / identidad

**`POST /auth/login` — LoginRequest**

| Campo | Tipo | |
|---|---|---|
| `email` | string (email) | + |
| `password` | string (min 8) | + |

**LoginResponse**

```json
{
  "accessToken": "jwt",
  "expiresIn": 3600,
  "user": {
    "id": "uuid",
    "nombre": "Ana Ruiz",
    "email": "ana@...",
    "rol": "asesor",
    "sedeIds": ["uuid-jardin-1"],
    "disponible": true,
    "activo": true
  }
}
```

**`GET /auth/me` — MeResponse:** mismo `user`.

Relación: `Usuario` ↔ `Sede` (N:M). RBAC filtra todos los DTO de lectura posteriores.

### 4.2 Conversación / mensajes

**Webhook normalizado interno (Channels → Orchestrator)** — no es API pública del panel:

```json
{
  "canal": "whatsapp",
  "externalThreadId": "wa:+52155...",
  "externalMessageId": "SM...",
  "texto": "Hola, quiero cotizar una boda",
  "recibidoEn": "2026-07-27T21:00:00.000Z",
  "perfilCanal": { "nombre": "María", "psid": null, "waId": "+52155..." }
}
```

**`GET /conversaciones` — ConversacionListQuery**

| Campo | Tipo | |
|---|---|---|
| `canal?` | `Canal` | |
| `estadoBot?` | `EstadoBot` | |
| `calificacion?` | `Calificacion` | |
| `listoParaCotizar?` | boolean | |
| `urgenciaSla?` | `UrgenciaSla` | |
| `asesorId?` | UUID | Solo coord/admin |
| `sinAsignar?` | boolean | Solo coord/admin |
| `page?` / `pageSize?` | number | |

**Response:** `BandejaItem[]` (§3.6) + `meta` + opcional `resumenPropio`.

**`GET /conversaciones/:id` — ConversacionDetail**

```json
{
  "id": "uuid",
  "oportunidadId": "uuid",
  "estadoBot": "escalado",
  "escaladoEn": "2026-07-27T21:03:00.000Z",
  "motivoHandoff": "solicitud_usuario",
  "canalPredominante": "whatsapp",
  "sedeId": "uuid",
  "pasoGuion": "captura_presupuesto",
  "mensajes": [ /* MensajeDto[] */ ]
}
```

**MensajeDto**

| Campo | Tipo | |
|---|---|---|
| `id` | UUID | + |
| `direccion` | `DireccionMensaje` | + |
| `autor` | `AutorMensaje` | + |
| `canal` | `Canal` | + |
| `contenido` | string | + |
| `timestamp` | ISO | + |
| `consumioCupo` | boolean | + |
| `ruta?` | `RutaOrquestador` | Saliente bot |
| `plantillaUtilityId?` | string | WA fuera de ventana |

**`POST /conversaciones/:id/mensajes` — EnviarMensajeHumanoRequest**

| Campo | Tipo | |
|---|---|---|
| `contenido` | string (1..4096) | + |

Efectos: crea `Mensaje` autor `asesor`; puede emitir `primer_mensaje_post_escalacion` si aplica; requiere `estadoBot ∈ { escalado, humano }` o toma de control previa.

**`POST /conversaciones/:id/tomar-control` — body vacío o `{ motivo?: string }`**

Efectos: `estadoBot → humano` + `EventoOperativo.toma_control`.

**`POST /conversaciones/:id/devolver-a-bot`** — solo si política v1 habilitada; default deshabilitado → `409`.

### 4.3 Oportunidad / expediente / brief

**`GET /oportunidades/:id` — OportunidadDetail**

```json
{
  "id": "uuid",
  "lead": {
    "id": "uuid",
    "nombre": "María López",
    "telefono": "+52155...",
    "correo": null,
    "identificadoresExternos": { "whatsapp": "+52155...", "metaPsid": null }
  },
  "calificacion": "calificado",
  "listoParaCotizar": true,
  "etapa": "calificado",
  "motivoPerdido": null,
  "canalOrigen": "whatsapp",
  "sedeId": "uuid",
  "tipoEvento": "boda",
  "fechaTentativa": { "tipo": "dia", "fecha": "2026-11-14", "flexible": false },
  "aforo": 150,
  "presupuestoOrientativo": { "tipo": "no_definido" },
  "paqueteTentativoId": "uuid-paquete",
  "aMedida": false,
  "restricciones": {},
  "asesorAsignadoId": "uuid-asesor",
  "brief": { /* BriefCotizacion */ },
  "conversacionIds": ["uuid-conv"]
}
```

**`PATCH /oportunidades/:id` — ActualizarOportunidadRequest** (parcial; asesor solo asignados)

Campos editables: perfilado (`tipoEvento`, `fechaTentativa`, `aforo`, `presupuestoOrientativo`, `paqueteTentativoId`, `aMedida`, `restricciones`, contacto lead), `etapa`, `motivoPerdido` si `etapa=perdido`.

Efectos: recalcular `calificacion` / `listoParaCotizar`; emitir `edicion_expediente` y/o `cambio_etapa`.

**`GET /oportunidades/:id/brief` → BriefCotizacion**

**Pipeline `GET /oportunidades?vista=pipeline`:** tarjetas mínimas `{ id, nombre, tipoEvento, fechaResumen, aforo, asesorId, canal, listoParaCotizar, etapa }`.

Relación: `Lead` 1→N `Oportunidad`; `Oportunidad` 1→0..1 `BriefCotizacion` vigente.

### 4.4 Asignación / carga

**`POST /asignaciones` — ReasignarRequest** (coord/admin)

| Campo | Tipo | |
|---|---|---|
| `oportunidadId` | UUID | + |
| `usuarioDestinoId` | UUID | + |
| `motivo?` | string | |

Response: `AsignacionDto`

```json
{
  "id": "uuid",
  "oportunidadId": "uuid",
  "usuarioDestinoId": "uuid",
  "regla": "manual",
  "actor": "coordinador",
  "actorUsuarioId": "uuid",
  "timestamp": "...",
  "vigente": true
}
```

**`GET /carga` →** shape §3.5 (sede activa del caller).

**`PATCH /usuarios/:id/disponibilidad` — `{ disponible: boolean }`** (coord/admin).

Asignación automática (sistema, no endpoint de panel): al pasar a `calificado` o escalar sin dueño → `regla: sede_disponibilidad_round_robin` o `cola_coordinador`.

Relación: `Oportunidad` 1→N `Asignacion` (una `vigente`).

### 4.5 Notificaciones

**`GET /notificaciones`**

Query: `estado?`, `tipo?`, `page?`. Scope: propias (asesor) / sede (coord/admin).

**NotificacionDto**

```json
{
  "id": "uuid",
  "tipo": "escalacion",
  "estado": "pendiente",
  "canalEntrega": "panel",
  "oportunidadId": "uuid",
  "conversacionId": "uuid",
  "destinatarioUserId": "uuid",
  "creadoEn": "...",
  "ventanaSla": {
    "aplica": true,
    "limiteMinutos": 30,
    "urgencia": "dentro_ventana"
  },
  "payload": {
    "motivoHandoff": "solicitud_usuario",
    "resumen": "Lead pide hablar con asesor"
  }
}
```

**`POST /notificaciones/:id/leer`** → `estado: leida` (+ evento `alerta_vista` opcional).

**`POST /notificaciones/:id/atender`** → `estado: atendida` + `alerta_atendida`.

Relación: `Notificacion` → `Oportunidad` / `Conversacion`.

### 4.6 Telemetría

**`GET /telemetria/hilos/:conversacionId`** (admin; coord según pacto)

```json
{
  "eventos": [ /* EventoOperativo[] ordenados por timestamp */ ]
}
```

**`GET /telemetria/sede/:sedeId/resumen`**

```json
{
  "periodo": { "desde": "...", "hasta": "..." },
  "tasaHandoff": 0.18,
  "rutasMasUsadas": [
    { "ruta": "guion", "count": 120 },
    { "ruta": "catalogo", "count": 80 },
    { "ruta": "rag", "count": 45 },
    { "ruta": "handoff", "count": 30 },
    { "ruta": "safe", "count": 12 }
  ],
  "pctBriefsListoParaCotizar": 0.62,
  "cumplimientoSlaHumano": 0.85,
  "cargaPorAsesor": [ /* CargaAsesor.metricas */ ]
}
```

**`GET /telemetria/registros/recuperacion/:id` → RegistroRecuperacionDto**

**`GET /telemetria/registros/catalogo/:id` → RegistroConsultaCatalogoDto`**

```json
{
  "id": "uuid",
  "mensajeId": "uuid",
  "conversacionId": "uuid",
  "tool": "obtener_precio_paquete",
  "filtros": { "paqueteId": "uuid", "fecha": "2026-11-14" },
  "filasDevueltas": [{ "paqueteId": "uuid", "codigoSku": "BODA-J1-ESENCIAL", "monto": 85000 }],
  "timestamp": "..."
}
```

Relación: `EventoOperativo` 0..1→ `RegistroRecuperacion` / `RegistroConsultaCatalogo`; estos 0..1→ `Mensaje`.

### 4.7 Catálogo

Contratos alineados a [../database/02-catalogo-paquetes.md](../database/02-catalogo-paquetes.md). Tools internas (no HTTP público del bot):

**`buscar_paquetes` input**

```json
{ "tipoEvento": "boda", "sedeId": "uuid?", "aforo": 150, "fecha": "2026-11-14?" }
```

**output:** `PaqueteResumen[]` solo `estado=publicado` que cumplan aforo/vigencia; `[]` → handoff.

**`obtener_precio_paquete` input:** `{ "paqueteId": "uuid", "fecha?": "YYYY-MM-DD" }`  
**output ok:** precio vigente; **error:** `{ "code": "SIN_PRECIO_VIGENTE" }` — prohibido estimar.

**`listar_inclusiones`:** `{ "paqueteId" }` → inclusiones ordenadas.

**`comparar_paquetes`:** `{ "ids": ["uuid", "..."] }` máx. 3.

**`evaluar_reglas_paquete`:** `{ "paqueteId", "fecha?", "aforo?" }` → reglas + `mensajeProspecto`.

**Admin HTTP (CRUD / import)** — PaqueteDto (lectura):

```json
{
  "id": "uuid",
  "codigoSku": "BODA-J1-ESENCIAL",
  "nombre": "Esencial",
  "tipoEvento": "boda",
  "sedeId": "uuid",
  "aforoMin": 50,
  "aforoMax": 200,
  "descripcionCorta": "...",
  "estado": "publicado",
  "version": 2,
  "publicadoEn": "...",
  "precios": [ /* PaquetePrecio */ ],
  "inclusiones": [ /* PaqueteInclusion */ ],
  "reglas": [ /* PaqueteRegla */ ]
}
```

**`POST /catalogo/importaciones`:** multipart Excel/CSV → `ImportacionCatalogo` `{ resultado, filasOk, filasError, detalleErrores[] }`.

Publicar: `POST /catalogo/paquetes/:id/publicar` — invalida versión anterior; briefs abiertos con ese SKU → `precioCatalogoDesactualizado: true`.

### 4.8 Conocimiento (RAG)

**DocumentoFuenteDto**

| Campo | Tipo | |
|---|---|---|
| `id` | UUID | + |
| `titulo` | string | + |
| `tipo` | `TipoDocumento` | + |
| `sedeId` | UUID \| null | null = global |
| `version` | number | + |
| `estado` | `EstadoPublicacion` | + |
| `publicadoEn?` | ISO | |
| `nombreArchivoCita` | string | + |
| `jobIngesta?` | `{ estado: "en_cola"\|"indexando"\|"listo"\|"error", actualizadoEn }` | |

**`POST /conocimiento/documentos`** — crear borrador (+ archivo).  
**`POST /conocimiento/documentos/:id/publicar`** — indexación &lt; 60 s; bot solo consume `publicado`.  
**`POST /conocimiento/documentos/:id/archivar`**.

El bot **no** expone CRUD; solo recupera fragmentos activos vía pipeline.

## 5. Estado conversacional del orquestador

Persistido en `Conversacion` / `Oportunidad` (no confundir con DTOs de panel):

```json
{
  "pasoGuion": "captura_aforo",
  "camposCapturados": {
    "nombre": "María López",
    "tipoEvento": "boda",
    "fechaTentativa": { "tipo": "dia", "fecha": "2026-11-14", "flexible": false },
    "aforo": 150,
    "sedeId": "uuid",
    "presupuestoOrientativo": null,
    "intencionCotizar": true
  },
  "paqueteTentativoId": null,
  "ultimaRuta": "guion",
  "estadoBot": "activo"
}
```

## 6. Obligatorios vs opcionales — calificación y brief

### 6.1 Para `calificado`

| Campo | Origen |
|---|---|
| Nombre | Guion |
| Canal + identificador | Sistema / canal |
| Tipo de evento | Guion |
| Fecha tentativa | Guion |
| Aforo | Guion |
| Sede de interés | Guion / sede activa fija |
| Intención de cotizar/reservar | Guion (afirmación) |

Opcionales que no bloquean: presupuesto, paquete, teléfono extra, correo, restricciones, UTM.

### 6.2 Para `listo_para_cotizar`

Todos los de calificación **más**: paquete SKU o `a_medida`, presupuesto rango o `no_definido`, contacto verificable. Restricciones solo si el lead las dijo.

### 6.3 Campos solo sistema (nunca preguntados al lead)

`estadoBot`, asesor asignado, historial asignaciones, `listoParaCotizar`, snapshot brief, cupo, IDs externos, timestamps, `EventoOperativo`.

## 7. Relación DTO → modelo conceptual (resumen)

```
LoginResponse.user          → Usuario
BandejaItem                 → Conversacion + Oportunidad + Lead
MensajeDto                  → Mensaje
OportunidadDetail           → Oportunidad + Lead
BriefCotizacion             → BriefCotizacion
AsignacionDto               → Asignacion
CargaAsesor / GET carga     → proyección Asignacion + Oportunidad + Conversacion
NotificacionDto             → Notificacion
EventoOperativo             → EventoOperativo
RegistroConsultaCatalogoDto → RegistroConsultaCatalogo
RegistroRecuperacionDto     → RegistroRecuperacion
PaqueteDto (+ precios…)     → Paquete / PaquetePrecio / Inclusion / Regla
DocumentoFuenteDto          → DocumentoFuente (→ FragmentoVectorial en worker)
```

## 8. Criterio de cierre

Quedan fijados: convenciones camelCase API + enums snake_case de dominio, validación class-validator/Zod, enums cerrados, DTOs por dominio crítico, shapes JSON de Brief, EventoOperativo (bot/humano), carga por asesor e item de bandeja, reglas de obligatoriedad y anti-alucinación de precios, y el mapa a entidades del modelo conceptual. Al existir código, sincronizar este documento con los DTOs/Prisma enums reales.
