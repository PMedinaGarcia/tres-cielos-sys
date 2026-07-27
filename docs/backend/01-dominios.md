# Backend — comportamientos por dominio

El backend (NestJS) es el centro operativo. Aquí se detalla **qué debe hacer** cada dominio de negocio, sin endpoints ni firmas de código. La inteligencia conversacional de producto es **Agentic RAG** (orquestador + tools de catálogo + RAG avanzado + handoff), no un agente libre multi-día.

Detalle técnico: [02-orquestador-agentico.md](02-orquestador-agentico.md), [03-rag-avanzado.md](03-rag-avanzado.md), [04-ingesta-conocimiento.md](04-ingesta-conocimiento.md).

## 1. Identidad y acceso

**Responsabilidad:** saber quién opera el panel y qué puede ver o cambiar.

Comportamientos:

- Autenticar usuarios del equipo Tres Cielos / Medina.
- Aplicar roles: asesor, coordinador, admin.
- Filtrar por sede: en go-live, casi todo ocurre en el jardín activo; el modelo ya soporta multi-sede.
- Permitir reasignación solo a roles autorizados (coordinador / admin).
- Registrar actor en cambios sensibles (etapa, asignación, publicación de documentos, publicación de catálogo).

## 2. Canales

**Responsabilidad:** unificar Facebook, Instagram y WhatsApp como entradas/salidas del mismo cerebro.

Comportamientos:

- Recibir mensajes entrantes de Meta (Messenger / Instagram) y Twilio WhatsApp.
- Enviar respuestas salientes por el mismo canal de origen del hilo.
- Asociar el mensaje a una conversación existente o crear una nueva ligada a lead/oportunidad.
- Distinguir mensajes de usuario, bot y asesor.
- Contabilizar unidades de mensajería según reglas de cupo (Anexo comercial).
- Soportar plantillas utility de WhatsApp fuera de ventana de servicio (metadatos + envío cuando el flujo lo requiera).
- No incorporar widget web, Google Ads, SMS masivo ni email marketing en v1.

### Unificación

Un prospecto que escribe por IG y luego por WA puede generar hilos distintos; el dominio de canales no fusiona identidades de forma agresiva sin regla clara. Preferencia v1: **un hilo por canal + oportunidad**, con posibilidad de vincular al mismo lead si el identificador o el asesor lo confirma.

## 3. Conversación / bot (orquestador agentico)

**Responsabilidad:** ejecutar el guion aprobado, resolver datos duros con tools de catálogo, responder FAQ con RAG avanzado y escalar a humano con criterios estrictos.

Comportamientos:

- Saludar y conducir el flujo de precalificación (ocasión, fecha, aforo, presupuesto, sede).
- Enrutar cada mensaje: guion | catálogo (Prisma) | RAG documental | handoff | safe reply.
- Responder preguntas de precio/paquete **solo** con filas vigentes del catálogo.
- Responder FAQ/políticas solo con fragmentos publicados que pasen rerank ≥ 0.85, con cita de fuente.
- No inventar precios, disponibilidad ni políticas.
- Detectar pedido de humano, baja confianza o imposibilidad de resolver → marcar conversación `escalado`, pausar bot.
- Permitir que un asesor “tome control”: estado `humano`; el bot deja de responder ese hilo.
- Mantener el mismo tono y lógica de precalificación en Meta y WhatsApp.
- Actualizar brief de cotización y evaluar `listo_para_cotizar`.
- Uso de IA: **Agentic RAG acotado** (tools + hybrid + rerank + LLM estricto). Fuera de alcance: agente autónomo multi-día, drips, negociación libre de descuentos.

### Orden de respuesta del bot (regla conceptual)

1. ¿Es turno de pregunta de perfilado del guion? → avanzar captura (sin RAG).
2. ¿Es solicitud humana / conflicto / queja? → escalar.
3. ¿Es dato duro (precio, paquete, inclusiones, reglas de paquete)? → tools Prisma.
4. ¿Es pregunta informativa narrativa? → pipeline RAG avanzado.
5. ¿Confianza insuficiente o sin filas/fragmentos? → safe reply + handoff.

## 4. Calificación

**Responsabilidad:** decidir `calificado` vs `en_exploracion` según [../producto/01-diseno-estrategico.md](../producto/01-diseno-estrategico.md), y el flag `listo_para_cotizar` según [../producto/03-criterios-exito-cotizacion.md](../producto/03-criterios-exito-cotizacion.md).

Comportamientos:

- Validar presencia de campos obligatorios (nombre, ocasión, fecha tentativa, aforo, sede de interés, canal).
- Aplicar validaciones básicas de formato/rango (aforo numérico, fecha razonable).
- Al completar obligatorios + intención: marcar `calificado` y disparar eventos a CRM, asignación y notificaciones.
- Si el brief está completo: marcar `listo_para_cotizar`.
- Si hay interés parcial: mantener `en_exploracion` y expediente parcial.
- Recalcular calificación si el asesor completa datos faltantes en el panel.

## 5. CRM / oportunidades

**Responsabilidad:** expediente comercial vivo ligado al chat.

Comportamientos:

- Alta automática de lead y oportunidad al primer contacto útil (o al calificar, según regla de Etapa 1; preferencia: alta temprana con datos parciales).
- Actualizar campos de perfilado a medida que el bot o el asesor capturan información.
- Mantener brief de cotización y bandera de precio de catálogo desactualizado.
- Mover etapas de pipeline según acciones humanas (contactado, propuesta, negociación, ganado, perdido).
- Exponer historial de mensajes y de cambios de etapa/asignación en el expediente.
- Respetar propiedad de datos del cliente (base para export futuro).
- No implementar scoring predictivo ni reactivación masiva de fríos en v1.

## 6. Asignación

**Responsabilidad:** repartir oportunidades al equipo correcto con un enrutador preciso y trazable.

Comportamientos:

- Al calificar, asignar automáticamente según el algoritmo go-live.
- En escalación: si ya hay dueño vigente, priorizarlo; si no, misma regla.
- `en_exploracion`: sin asignación agresiva; visible en cola de coordinación.
- Criterios go-live cerrados: **sede** → **disponibilidad** → **round-robin**.
- En go-live: solo asesores del jardín activo.
- Registrar cada asignación en historial (regla + actor + timestamp).
- Emitir `EventoOperativo` de asignación / reasignación.
- Permitir reasignación manual desde panel (coordinador/admin; asesor solo si se pacta).
- No dejar lead calificado sin dueño: si no hay asesores disponibles, cola de coordinador + notificación.
- Exponer métricas de carga por asesor (abiertas, escaladas pendientes, listos sin propuesta, fuera de SLA, disponibilidad) para la superficie de carga.

Detalle de producto: [../producto/04-escenarios-rol-carga-telemetria.md](../producto/04-escenarios-rol-carga-telemetria.md) §3–4.

### Algoritmo go-live (cerrado)

1. Filtrar asesores activos de la sede de interés (o sede activa).
2. Filtrar por disponibilidad (si el flag está en uso).
3. Elegir por round-robin entre candidatos.
4. Si lista vacía → cola de coordinador + notificación.

## 7. Notificaciones

**Responsabilidad:** avisar “qué hacer ahora”.

Comportamientos:

- Emitir alerta de **lead nuevo**, **lead calificado**, **listo para cotizar** (si se habilita) y **escalación a humano**.
- Entregar en **panel** y, cuando se acuerde, **email transaccional** al asesor/coordinador.
- En escalaciones, destacar ventana de contacto 15–30 min.
- Marcar notificaciones como leídas / atendidas.
- No incluir SMS masivo ni push de app móvil en v1.

## 8. Conocimiento agentico y catálogo

**Responsabilidad:** recuperar el pasaje autorizado correcto **o** la fila de catálogo exacta; nunca improvisar montos.

Comportamientos:

- Indexar solo documentos en estado `publicado` (versión vigente).
- Filtrar por sede cuando el documento no sea global.
- Ejecutar hybrid search + rerank; alimentar LLM solo con top fragmentos ≥ 0.85.
- Exponer tools de catálogo (`buscar_paquetes`, `obtener_precio_paquete`, etc.).
- Registrar `RegistroRecuperacion` y `RegistroConsultaCatalogo`.
- Si la confianza es insuficiente o no hay fila vigente: no alucinar; derivar a respuesta segura o escalación.
- Al publicar/archivar documentos o precios: invalidar versión anterior de inmediato (ver ingesta).
- Consumir cupo de Agentic RAG y reportarlo al dominio de cupo.

## 9. Cupo y uso

**Responsabilidad:** respetar la membresía (1,000 unidades/mes + uso de Agentic RAG).

Comportamientos:

- Incrementar contadores por mensaje contabilizable (Meta, WhatsApp, email transaccional).
- Registrar uso de embeddings, rerank, generación y tools asociadas a respuesta.
- Exponer consumo vs tope para vista gerencial y reporte mensual.
- No bloquear necesariamente el canal al llegar al tope sin política comercial explícita; como mínimo, alertar a admin/Medina para gestión de excedente.
- Separar cupo por sede cuando exista segundo jardín activo.

## 10. Auditoría y telemetría operativa

**Responsabilidad:** explicar en UAT y soporte “qué pasó” en el bot y en el agente humano, con detalle suficiente para carga, SLA y calidad.

Comportamientos:

- Registrar cambios de etapa, calificación, asignación, toma de control humano, publicación de documentos y publicación de catálogo.
- Persistir **EventoOperativo** por decisión/mensaje del bot y por acción humana relevante (ver [../producto/04-escenarios-rol-carga-telemetria.md](../producto/04-escenarios-rol-carga-telemetria.md) §7).
- Bot: ruta, tools + latencia, rerank, IDs fragmento/SKU, cupo, motivo handoff, paso de guion, resultado de calificación / `listo_para_cotizar`.
- Humano: alerta vista/atendida, toma de control, primer mensaje post-escalación (latencia vs SLA 15–30 min), edición de expediente, cambio de etapa, reasignación, devolución a bot si aplica.
- Conservar timeline suficiente para capacitación, telemetría operativa del panel y diagnóstico de incidentes P2/P3 de membresía.
- No sustituye un SIEM ni guardia 24/7 (fuera de alcance).

## 11. Integraciones como actores

| Actor | El backend espera de él | El backend le entrega |
|---|---|---|
| Meta | Mensajes FB/IG, eventos de entrada | Respuestas del bot/asesor |
| Twilio WhatsApp | Webhooks de mensaje / estado | Mensajes y plantillas utility |
| Email transaccional | Acuse de envío | Alertas a asesores |
| Proveedor de embeddings / LLM | Vectores y generación anclada | Texto a enviar al lead (vía canal) |
| Proveedor de rerank (Cohere Rerank) | Scores 0–1 sobre candidatos | Decisión de top-k / handoff |
| Worker de ingesta | Job de chunk/embed/FTS | Fragmentos activos versionados |

## 12. Criterio de cierre de este entregable

Cada dominio tiene comportamientos observables alineados a las etapas 2–6 y 9, con Agentic RAG acotado (tools + RAG + handoff), enrutador preciso, telemetría bot+humano (`EventoOperativo`) y límites claros de v1 (sin drips, sin canales extra, sin agente multi-día autónomo).
