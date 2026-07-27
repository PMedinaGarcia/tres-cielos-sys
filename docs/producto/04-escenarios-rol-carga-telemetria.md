# Escenarios por rol, carga y telemetría operativa

Documento de producto que cierra **quién ve qué**, cómo el **enrutador** reparte trabajo, la **UX minimalista** de bandeja/carga y la **telemetría obligatoria** del bot y del agente humano.

Referencias: [01-diseno-estrategico.md](01-diseno-estrategico.md), [03-criterios-exito-cotizacion.md](03-criterios-exito-cotizacion.md), [../frontend/00-superficies.md](../frontend/00-superficies.md), [../backend/01-dominios.md](../backend/01-dominios.md) §6 y §10.

## 1. Principios de producto UI

- **Una composición por rol:** el primer viewport del asesor es **atender**; el del coordinador/admin es **equilibrar y auditar**.
- **Minimalismo operativo:** una cola, una prioridad, una acción principal. Sin cards decorativas ni analítica en la bandeja del asesor.
- **Separación estricta de privilegio visual:** el asesor no mira al equipo; el coordinador/admin sí.
- **Qué hacer ahora > explorar:** escalaciones, calificados sin contactar y listos para cotizar mandan sobre vistas secundarias.
- **Telemetría operativa ≠ BI:** el panel registra y muestra operación bot/humano y carga; no es reporting comercial ni marketing analytics.

## 2. Escenario técnico por rol

| Rol | Entrada diaria | Superficies visibles | Qué no ve | Trabajo principal |
|---|---|---|---|---|
| **Asesor** | Alertas propias → Bandeja propia | Bandeja (solo míos), Expediente asignado, Alertas propias, Pipeline solo de asignados | Carga del equipo, telemetría bot, conocimiento/catálogo/cupo, reglas de asignación | Responder, tomar control, completar brief, mover etapa |
| **Coordinador** | Carga + alertas de sede | Todo lo del asesor + bandeja equipo + Asignación/carga + cupo (lectura) | Publicar conocimiento/catálogo (salvo pacto) | Reasignar, equilibrar, vigilar SLA 15–30 min |
| **Admin** | Carga + telemetría + ops | Todo + Admin + Conocimiento + Catálogo + Cupo + **Telemetría operativa** | — | Configurar enrutador, auditar bot/humano, frescura, cupo |

### 2.1 Asesor — escenario técnico

**Estados de hilo que opera:** `escalado`, `humano`, y hilos `activo` solo en lectura contextual del historial bot (no responde mientras el bot controla, salvo tomar control).

**Filtros permitidos:** canal, estado bot/humano, calificación, `listo_para_cotizar`, urgencia SLA. Scope fijo: **solo asignados a mí**.

**Acciones:** responder como humano, tomar control, abrir expediente/brief, editar campos de perfilado del asignado, cambiar etapa, marcar alerta atendida.

**Qué hacer ahora (orden):**

1. Escalaciones propias (dentro / fuera de ventana 15–30 min).
2. `listo_para_cotizar` sin propuesta enviada.
3. Calificados sin contactar.
4. Resto de abiertos asignados.

**Resumen ligero propio (única analítica del asesor):** `X urgentes · Y listos · Z abiertos` — solo conteos de *su* cola.

### 2.2 Coordinador — escenario técnico

**Scope:** jardín activo completo.

**Filtros adicionales:** asesor, sin asignar, exploración pendiente, fuera de SLA.

**Acciones extra:** reasignar, marcar disponibilidad de asesores (si la regla la usa), ver cupo en lectura.

**Qué hacer ahora:**

1. Cola sin asignar / sin dueño tras calificación o escalación.
2. Asesores fuera de ventana SLA.
3. Desbalance de carga (ver §4).
4. Alertas de sede pendientes.

### 2.3 Admin — escenario técnico

Todo lo del coordinador, más:

- Configurar / documentar parámetros del enrutador (sede, disponibilidad, round-robin).
- Publicar conocimiento y catálogo.
- Abrir **Telemetría operativa** por hilo y resumen de sede (§7).
- Monitorear cupo y frescura (&lt; 60 s).

## 3. Enrutador preciso

Algoritmo go-live (cerrado):

1. Filtrar asesores **activos** de la sede de interés (o sede activa).
2. Filtrar `disponible = true` (si el flag está en uso).
3. Elegir por **round-robin** entre candidatos.
4. Si la lista queda vacía → **cola de coordinador** + notificación prioritaria.

### 3.1 Momentos de disparo

| Evento | Comportamiento |
|---|---|
| Oportunidad pasa a `calificado` | Asignación automática por el algoritmo |
| Escalación a humano | Si ya hay dueño vigente → priorizar al mismo; si no → misma regla |
| `en_exploracion` | **Sin** asignación agresiva; visible en cola de coordinación |
| Reasignación manual | Solo coordinador/admin; historial `Asignacion` con regla `manual` |

### 3.2 Invariantes

- Lead **calificado** no queda sin dueño ni sin cola de coordinador visible.
- Toda asignación (auto o manual) deja registro: regla, actor, timestamp, vigente/sustituida.
- Go-live: solo asesores del jardín activo.

## 4. Vista de carga (coordinador / admin)

Métricas por asesor (operativas, no BI):

| Métrica | Definición |
|---|---|
| Abiertas asignadas | Oportunidades no `ganado` / no `perdido` con dueño vigente |
| Escaladas pendientes | `estado_bot = escalado` sin primer mensaje humano post-escalación |
| Listos sin propuesta | `listo_para_cotizar` y etapa aún no en «Propuesta / cotización» |
| Fuera de ventana SLA | Escalación &gt; 30 min sin contacto humano / alerta no atendida |
| Disponibilidad | Flag on/off para el enrutador |

**UI:** lista densa de asesores + columna de métricas + cola sin asignar + regla vigente en lenguaje claro (“Round-robin por sede, solo disponibles”) + acción **Reasignar**. Sin gráficos complejos en v1.

## 5. Bandeja del asesor — minimalismo y uso

### 5.1 Orden de prioridad fijo en lista

1. Escalación (badge dentro / fuera de ventana 15–30 min).
2. `listo_para_cotizar`.
3. Calificado sin contactar.
4. Resto asignado.

### 5.2 Viewport

- Columna de hilos: preview, canal, badge de estado.
- Panel del hilo: mensajes + CTA única (**Responder** o **Tomar control**).
- Lateral mínimo del brief: ocasión / fecha / aforo / paquete (o «a medida»).
- Sin tarjetas decorativas, sin stats de equipo, sin telemetría de rutas del bot.

### 5.3 Checklist de minimalismo (F5)

En el primer viewport del asesor solo deben coexistir:

1. Resumen ligero propio (`X · Y · Z`).
2. Una cola priorizada.
3. Un hilo abierto (o empty state claro).
4. Una CTA primaria de atención.

## 6. Criterios de éxito de frontend (UAT UI)

| ID | Criterio | Umbral / evidencia |
|---|---|---|
| **F1** | Asesor no lista hilos de otro asesor | RBAC UI + API; prueba con dos usuarios |
| **F2** | Coordinador ve carga de todos los asesores del jardín activo en una sola vista | Pantalla Asignación/carga con métricas §4 |
| **F3** | Tras calificar, el hilo aparece en bandeja del asignado | ≤ **5 s** (realtime o refresh corto); sin recarga manual destructiva |
| **F4** | Escalación destaca SLA; a los 30 min sin atención → “fuera de ventana” | Badge / estado visual verificable en UAT |
| **F5** | Primer viewport asesor cumple checklist §5.3 | Revisión UX en capacitación / UAT |
| **F6** | Reasignación actualiza dueño, historial y bandejas origen/destino | Caso UAT con dos asesores |
| **F7** | Admin abre telemetría de un mensaje bot y de un turno humano | Ruta/tools/RAG/scores + latencia a primer reply / toma de control |

## 7. Telemetría obsesiva (bot + agente)

Telemetría **operativa obligatoria**: un evento por decisión/mensaje del bot y un evento por acción humana relevante. Alimenta la superficie **Telemetría operativa** (admin) y el timeline del expediente (detalle según rol).

### 7.1 Eventos bot (por mensaje saliente o decisión)

| Campo / dato | Uso |
|---|---|
| `ruta` | `guion` \| `catalogo` \| `rag` \| `handoff` \| `safe` |
| Tools llamadas + latencia | Auditoría de catálogo |
| Scores de rerank | Si hubo RAG |
| IDs de fragmentos o filas SKU | Trazabilidad |
| Tokens / unidades de cupo | Cupo Agentic RAG / mensajería |
| Motivo de handoff | `rerank_bajo`, `sin_catalogo`, `solicitud_usuario`, etc. |
| `paso_guion` | Estado de captura |
| Resultado calificación / `listo_para_cotizar` | Embudo |

Persistencia: `EventoOperativo` (actor `bot`) + vínculos a `RegistroRecuperacion` / `RegistroConsultaCatalogo` cuando aplique.

### 7.2 Eventos agente humano (por acción)

| Evento | Dato clave |
|---|---|
| Asignación recibida | Destinatario, regla, timestamp |
| Alerta vista / atendida | Tipo, latencia desde emisión |
| Toma de control | Timestamp; `estado_bot → humano` |
| Primer mensaje humano post-escalación | Latencia vs SLA 15–30 min |
| Edición de campos del expediente | Campos tocados |
| Cambio de etapa | De → a |
| Reasignación | Actor, origen, destino |
| Devolución a bot | Solo si política v1 lo permite |

Persistencia: `EventoOperativo` (actor `asesor` \| `coordinador` \| `admin` \| `sistema`).

### 7.3 Superficie admin — Telemetría operativa

- **Timeline por hilo:** eventos bot y humano intercalados.
- **Resumen sede:** tasa de handoff, rutas más usadas, % briefs `listo_para_cotizar`, cumplimiento SLA humano, carga por asesor.
- **Drill-down:** a `RegistroRecuperacion`, `RegistroConsultaCatalogo`, `EventoOperativo`.

### 7.4 Incluido vs excluido

| Incluido (producto) | Excluido |
|---|---|
| Telemetría operativa bot + humano | BI comercial / marketing analytics |
| Vista de carga multi-asesor | Scoring predictivo / ML |
| Cumplimiento SLA 15–30 min | Reportes de campaña Meta |
| Drill-down por hilo y mensaje | Dashboards ejecutivos de conversión multi-periodo |

## 8. Flujos de referencia

```
MensajeLead → Orquestador → EventoOperativo(bot)
                    ↓
         calificado | escalado
                    ↓
              MotorAsignacion
           ↙                 ↘
  BandejaAsesor          VistaCargaAdmin
           ↓
  EventoOperativo(humano) → TelemetriaOperativa
```

### Asesor — día típico

1. Ve resumen `urgentes · listos · abiertos`.
2. Abre el primer hilo priorizado.
3. Revisa brief mínimo → responde / toma control.
4. Actualiza etapa; marca alerta atendida.

### Coordinador — desbalance

1. Abre Asignación/carga.
2. Identifica cola sin dueño o asesor sobrecargado / fuera de SLA.
3. Reasigna; verifica bandejas origen/destino (F6).

### Admin — calidad bot + humano

1. Abre Telemetría operativa o timeline del hilo.
2. Verifica ruta, scores/tools y latencia humana post-handoff.
3. Si hay alucinación o stale: corrige catálogo/conocimiento y valida frescura.

## 9. Criterio de cierre de este entregable

Quedan cerrados los escenarios por rol, el enrutador go-live, la vista de carga, el minimalismo de bandeja, los criterios F1–F7 y el contrato de telemetría bot+humano, alineados a frontend, dominios de asignación/auditoría y modelo `EventoOperativo`.
