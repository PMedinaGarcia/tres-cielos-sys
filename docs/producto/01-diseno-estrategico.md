# Diseño estratégico — Embudo, calificación y sedes

Documento de cierre conceptual (Etapa 1). Fuente: propuesta Event Master System · Tres Cielos.

## 1. Objetivo comercial

Convertir el primer contacto de campañas digitales (Meta Ads → Facebook, Instagram, WhatsApp) en un expediente comercial listo para el asesor — idealmente en estado **listo para cotizar** — con respuesta automática en segundos/minutos y trazabilidad para retomar en **15–30 minutos** cuando el bot escale a humano.

El bot opera con **Agentic RAG**: datos duros (paquetes, precios) vía catálogo Prisma; FAQ y políticas vía recuperación documental híbrida con rerank; handoff ante baja confianza. Detalle: [../backend/02-orquestador-agentico.md](../backend/02-orquestador-agentico.md) y [03-criterios-exito-cotizacion.md](03-criterios-exito-cotizacion.md).

## 2. Embudo cerrado (mapa origen → asesor)

```
Captación (Meta Ads: FB / IG / WA)
        ↓
Chatbot del canal (orquestador agentico)
        ↓
Perfilado + FAQ (guion) + catálogo / RAG avanzado
        ↓
Calificación: «calificado» | «en exploración»
  (+ flag listo_para_cotizar cuando el brief está completo)
        ↓
Alta / actualización automática en CRM (expediente + conversación)
        ↓
Motor de asignación (sede activa + regla comercial)
        ↓
Asesor comercial (bandeja + notificación + brief de cotización)
        ↓
Pipeline comercial (etapas humanas hasta cierre / perdido)
```

### Canales en go-live

| Canal | Rol en el embudo | Incluido |
|---|---|---|
| Facebook Messenger | Primer contacto + perfilado | Sí |
| Instagram DM | Primer contacto + perfilado | Sí |
| WhatsApp Business (Twilio) | Primer contacto + perfilado + plantillas utility | Sí |
| Widget web / Google Ads / SMS masivo | — | No (add-on) |

### Momentos de decisión del embudo

1. **Entrada:** mensaje o formulario vinculado llega al bot.
2. **FAQ vs captura vs datos duros:** pregunta informativa narrativa → RAG; precio/paquete → tools de catálogo; avance de interés → preguntas de perfilado.
3. **Calificación:** con datos mínimos obligatorios → «calificado»; con interés pero datos incompletos → «en exploración».
4. **Listo para cotizar:** cuando el brief de cotización está completo (ver [03-criterios-exito-cotizacion.md](03-criterios-exito-cotizacion.md)).
5. **Escalación:** bot no resuelve, rerank bajo, catálogo sin fila vigente, o lead pide humano → pausa bot, notifica, ventana 15–30 min.
6. **Asignación:** lead entra a cola de la sede activa según el enrutador preciso (sede + disponibilidad + round-robin); detalle de carga, bandeja por rol y telemetría en [04-escenarios-rol-carga-telemetria.md](04-escenarios-rol-carga-telemetria.md).
7. **Cierre de ciclo bot:** el asesor toma control; el historial, el brief y los eventos operativos quedan en el expediente.

## 3. Datos mínimos a capturar

### 3.1 Campos obligatorios (lead «calificado»)

| Campo | Descripción de negocio | Notas |
|---|---|---|
| Nombre de contacto | Cómo se presenta el prospecto | Obligatorio para alta usable |
| Canal de origen | Facebook, Instagram o WhatsApp | Automático por integración |
| Identificador de canal | ID Meta / número WA | Interno; no lo ve el prospecto |
| Ocasión / tipo de evento | Boda, XV, corporativo, social, otro | Catálogo acordado con Tres Cielos |
| Fecha tentativa | Día o mes/año si aún no hay día exacto | Validar formato razonable |
| Número de invitados (aforo) | Cantidad estimada | Rango numérico básico; coherente con capacidad de sede |
| Sede de interés | Jardín activo (y opción «por definir» si aplica) | En go-live: un solo jardín operativo |

### 3.2 Campos opcionales (enriquecen; no bloquean calificación si faltan)

| Campo | Descripción |
|---|---|
| Presupuesto orientativo | Rango capturado o «no definido» explícito |
| Paquete / nivel tentativo | SKU del catálogo sugerido por tools, o «a medida» |
| Teléfono de contacto | Si el canal no es WhatsApp o se pide refuerzo |
| Correo | Opcional para seguimiento humano |
| Restricciones del evento | Outdoor/indoor, horario, menores, etc. si el lead las mencionó |
| Notas libres del bot / asesor | Observaciones no estructuradas |
| Fuente de campaña | Etiqueta o UTM si Meta la aporta |

### 3.3 Datos de sistema (no preguntados al lead)

- Timestamp de primer contacto y de última interacción.
- Estado del bot: activo / escalado / tomado por humano.
- Asesor asignado y historial de reasignaciones.
- Flag `listo_para_cotizar` y snapshot del brief.
- Marca de consumo de cupo de mensajería / Agentic RAG (recuperaciones + tools + generación).

## 4. Criterios de calificación

### Lead calificado

Se marca **calificado** cuando existen **todos** los campos obligatorios de §3.1 y el prospecto mostró intención de cotizar o reservar (respuesta afirmativa explícita o equivalente en el guion aprobado).

Efectos:

- Expediente listo en CRM con etapa inicial de pipeline.
- Disparo de asignación automática (algoritmo en [04-escenarios-rol-carga-telemetria.md](04-escenarios-rol-carga-telemetria.md) §3).
- Notificación a asesor / coordinador («lead calificado»).

### Lead en exploración

Se marca **en exploración** cuando:

- Hay conversación activa pero faltan uno o más obligatorios; o
- El lead solo pregunta FAQ / precios generales sin avanzar a captura completa; o
- Declara interés vago («solo estoy viendo»).

Efectos:

- Expediente parcial en CRM (alta temprana recomendada al primer dato útil).
- Sin asignación agresiva obligatoria; puede quedar en cola de coordinación o asignarse según regla «exploración» si se pacta.
- El bot puede seguir perfilando hasta completar obligatorios o escalar.

### Escalación a humano (independiente de calificación)

Ocurre cuando:

- El lead lo solicita.
- El bot no puede resolver con guion, catálogo ni conocimiento autorizado (incluyendo umbral de rerank &lt; 0.85).
- Hay objeción sensible (precio no vigente en catálogo, fechas bloqueadas, quejas).

Efectos: notificación prioritaria + SLA comercial de contacto **15–30 minutos**.

## 5. Pipeline comercial inicial (etapas humanas)

Etapas base acordables en kick-off (ajustables en Etapa 1 con Tres Cielos):

1. **Nuevo / bot** — recién capturado, bot activo.
2. **Calificado** — datos mínimos completos; asignado o por asignar.
3. **Contactado** — asesor ya habló en ventana recomendada.
4. **Propuesta / cotización** — se envió información comercial formal (humano; el bot prepara el brief).
5. **Negociación** — ajustes de fecha, paquete o sede.
6. **Ganado** — evento reservado / cerrado.
7. **Perdido** — con motivo tipificado simple (precio, fecha, competencia, sin respuesta, otro).

## 6. Modelo de sedes (una activa, segunda por change order)

### Principio

El modelo de datos y las reglas **contemplan más de una sede**. En operación hay **una sola sede activa: Tres Cielos Tequesquitengo**. Una segunda sede se activa con change order (CRM, reglas, WA/cupo/membresía adicionales).

### Reglas de go-live (sede única)

| Tema | Decisión |
|---|---|
| Sede operativa | Tres Cielos Tequesquitengo (`sede-tequesquitengo`, slug catálogo `tequesquitengo`) |
| Segunda sede | Preparada en el modelo; no asignable hasta change order |
| Asignación | Solo asesores de la sede activa |
| Cupo mensajería | 1,000 unidades/mes de la membresía de la sede activa |
| Pregunta «sede de interés» | **Autosasignación:** al capturar aforo el bot informa la sede, envía la ficha PDF Paquete Bodas 2027 y pasa a intención de cotizar. No se pide confirmar otra ubicación. |

### Al activar segunda sede (futuro)

- Misma lógica de embudo y calificación.
- Pertenencia de leads, conversaciones, asignación y cupo por sede.
- Membresía y cupo adicionales según propuesta comercial.

## 7. Decisiones cerradas para implementación posterior

1. Embudo único Meta + WhatsApp → orquestador agentico → CRM → asignación → asesor.
2. Calificación binaria operativa: **calificado** vs **en exploración**, más flag de escalación y flag `listo_para_cotizar`.
3. Obligatorios: nombre, canal, ocasión, fecha tentativa, aforo, sede de interés.
4. Precios y paquetes: **catálogo Prisma** como fuente de verdad; documentos narrativos no sustituyen montos.
5. Go-live con **una sede activa** (Tres Cielos Tequesquitengo); segunda sede preparada pero no operativa.
6. Ventana humana post-escalación: **15–30 minutos** (responsabilidad de adopción del cliente).
7. Conocimiento dinámico: publicación invalida e reindexa de inmediato (SLA &lt; 60 s).
8. Panel por rol: asesor solo su bandeja; coordinador/admin ven carga multi-asesor; telemetría operativa bot+humano obligatoria ([04-escenarios-rol-carga-telemetria.md](04-escenarios-rol-carga-telemetria.md)).

## 8. Pendientes de validación con Tres Cielos (copy, no arquitectura)

- Catálogo exacto de ocasiones / tipos de evento.
- SKUs, inclusiones y precios vigentes del catálogo de paquetes.
- Textos de guion, tono y plantillas WhatsApp utility.
- Nombre comercial de la sede activa: **Tres Cielos Tequesquitengo** (cerrado).
- Etapas finales del pipeline si requieren renombrar las propuestas en §5.
