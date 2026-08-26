# Criterios de éxito de cotización — Eventos sociales

Define qué debe lograr el bot + CRM **antes** de que el asesor emita la cotización formal. El envío del PDF/propuesta comercial permanece en el humano; el sistema maximiza precisión del brief y cero alucinación de precios.

Ramo: **venta de eventos sociales** (boda, XV años, corporativo, social, otro).

Referencias: [01-diseno-estrategico.md](01-diseno-estrategico.md), [../database/02-catalogo-paquetes.md](../database/02-catalogo-paquetes.md), [../backend/02-orquestador-agentico.md](../backend/02-orquestador-agentico.md).

## 1. Objetivo de negocio

Un prospecto que pregunta por un evento social debe salir del bot con:

1. Expediente con datos de perfilado verificables.
2. **Brief de cotización** usable por el asesor sin re-preguntar lo ya dicho.
3. Montos y paquetes **solo** si existen filas vigentes en el catálogo; si no, handoff claro.

## 2. Estado `listo_para_cotizar`

Una oportunidad pasa a **listo_para_cotizar** cuando el bot o el asesor tienen, con evidencia en el expediente, **todos** los campos de la tabla siguiente.

| Campo | Criterio de calidad | Fuente |
|---|---|---|
| Tipo de evento | Uno de: boda, XV, corporativo, social, otro | Guion |
| Fecha tentativa | Fecha o rango; flag `fecha_flexible` si aplica | Guion |
| Aforo | Número o rango; coherente con `aforo_min`/`aforo_max` de sede/paquete | Guion + catálogo |
| Sede de interés | Tres Cielos Tequesquitengo (autosignada en guion) | Guion |
| Paquete / nivel tentativo | Al menos un `Paquete` publicado sugerido **o** marca explícita `a_medida` | Tool Prisma |
| Presupuesto orientativo | Rango capturado **o** valor `no_definido` explícito | Guion |
| Datos de contacto | Nombre + canal de respuesta verificable | Guion / canal |
| Restricciones | Outdoor/indoor, horario, menores, etc. **si** el lead las mencionó (pueden quedar vacías) | Conversación |

### Relación con calificación

| Estado | Significado |
|---|---|
| `en_exploracion` | Faltan obligatorios de calificación |
| `calificado` | Obligatorios de calificación + intención |
| `listo_para_cotizar` | Calificado **y** brief completo (§2); puede coincidir en el mismo momento |

`listo_para_cotizar` no sustituye la etapa de pipeline «Propuesta / cotización» (esa la marca el asesor al enviar la propuesta formal).

## 3. Brief de cotización (contenido del expediente)

El panel muestra un bloque consolidado para el asesor:

```
Tipo de evento / Fecha / Aforo / Sede
Paquete sugerido (SKU + nombre) o «a medida»
Precio de catálogo vigente (monto o rango) + unidad + vigencia
Inclusiones clave (top N del paquete)
Presupuesto declarado por el lead (o no definido)
Restricciones / notas
Fuentes: RegistroConsultaCatalogo y/o RegistroRecuperacion
Conversación / canal / timestamp de última actualización del brief
```

Reglas:

- El brief se actualiza cuando el bot captura un campo o cuando una tool de catálogo devuelve filas.
- Si el precio del catálogo cambia y se republica, el brief del lead **abierto** muestra “precio de catálogo actualizado; verificar antes de enviar” (no reescribe en silencio propuestas ya enviadas por el asesor).

## 4. Criterios de éxito medibles

### 4.1 UAT (umbrales de aceptación)

| ID | Métrica | Umbral | Evidencia |
|---|---|---|---|
| C1 | Cobertura de captura | ≥ **80%** de hilos de prueba con obligatorios de calificación antes de escalar o al calificar | Muestra UAT documentada |
| C2 | Completitud de brief | ≥ **70%** de leads calificados en UAT alcanzan `listo_para_cotizar` sin re-captura humana de los mismos campos | Expedientes de prueba |
| C3 | Precisión de precio | **0** respuestas con monto no proveniente de `PaquetePrecio` vigente | Revisión de transcripts + `RegistroConsultaCatalogo` |
| C4 | Frescura documental | Tras publicar documento o precio, la **siguiente** pregunta del bot refleja la versión nueva en **&lt; 60 s** | Caso UAT fechado |
| C5 | Handoff por baja confianza | Rerank &lt; **0.85** o tool sin fila → escalación + alerta SLA 15–30 min; **sin** inventar | Logs + panel de alertas |
| C6 | Trazabilidad | 100% de respuestas informativas/precios con `RegistroRecuperacion` o `RegistroConsultaCatalogo` | Auditoría admin |
| C7 | Coherencia aforo–paquete | Bot no recomienda paquete cuyo `aforo_max` &lt; aforo del lead (o advierte y ofrece alternativa / handoff) | Casos de prueba tipados |

### 4.2 Operación post go-live (monitoreo)

- Tasa de escalación por “sin conocimiento / sin catálogo” vs total de hilos (tendencia semanal).
- % de briefs con paquete sugerido vs `a_medida`.
- Incidentes de precio incorrecto reportados por asesores (meta: 0 críticos por periodo).

## 5. Flujo de éxito por tipo de evento (ramo)

Patrón común; el guion adapta copy, no la estructura de datos.

```
Saludo → tipo de evento
      → fecha tentativa (+ flex)
      → aforo
      → sede (o sede activa fija)
      → (opcional) presupuesto
      → pregunta de paquete / “qué incluye”
            ↓
      Tool buscar_paquetes / obtener_precio / listar_inclusiones
            ↓
      ¿Filas vigentes? ──no──► safe reply + handoff
            │ sí
            ▼
      Respuesta con SKU + precio de catálogo + inclusiones
      Actualizar brief → evaluar listo_para_cotizar
      Si intención de cotizar y brief completo → calificado + listo_para_cotizar
```

### Matriz rápida por ocasión

| Ocasión | Énfasis de captura | Riesgo típico |
|---|---|---|
| Boda | Fecha, aforo alto, paquete completo, restricciones de horario | Pedir “precio exacto cerrado” sin vigencia |
| XV | Aforo, temática/paquete, fecha fin de semana | Confundir inclusiones entre paquetes |
| Corporativo | Fecha, aforo, formato (coffee/comida), facturación (humano) | Inventar disponibilidad de salón |
| Social | Aforo, paquete básico vs premium | Mezclar rangos de sedes distintas |

## 6. Qué cuenta como fallo (anti-éxito)

- Mencionar un precio que no está en `PaquetePrecio` publicado y vigente.
- Mezclar inclusiones de dos SKUs en una sola respuesta.
- Usar documento archivado o versión anterior tras republicación (&gt; 60 s sin reflejar cambio = defecto).
- Afirmar disponibilidad de fecha concreta sin proceso humano autorizado.
- Llegar a “Propuesta / cotización” en pipeline sin brief usable (asesor debe re-preguntar todo).

## 7. Fuera del éxito del bot

- Cerrar precio final negociado, descuentos especiales no catalogados.
- Emitir/enviar PDF de **cotización**, contrato, anticipo o factura.
- Comprometer fechas bloqueadas en un calendario de operaciones (salvo que exista integración futura explícita).

**Excepción — ficha comercial estática:** al informar la sede única, el bot **sí** envía el PDF *Tres Cielos Paquete Bodas 2027* (`waContent.document`, `GET /public/guion/paquete-bodas-2027.pdf`). No es una cotización ni un contrato generado; es la ficha de paquetes del venue. Los montos vinculantes siguen saliendo solo del catálogo Prisma.

## 8. Criterio de cierre de este entregable

Quedan definidos `listo_para_cotizar`, el brief de cotización, métricas C1–C7 y el patrón de flujo para eventos sociales, alineados al catálogo Prisma y al orquestador Agentic RAG.
