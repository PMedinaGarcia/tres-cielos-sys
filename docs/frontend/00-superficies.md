# Frontend — superficies y perfiles

El frontend (Next.js) es la superficie de trabajo del equipo comercial y de operación. No es un sitio de marketing. Este documento define **qué pantallas existen** y **quién ve qué**.

Arquitectura: [01-estructura.md](01-estructura.md) · Rutas: [02-routing-y-paginas.md](02-routing-y-paginas.md) · Componentes: [03-componentes.md](03-componentes.md) · Datos: [04-estado-y-datos.md](04-estado-y-datos.md) · API: [05-api-y-hooks.md](05-api-y-hooks.md) · Auth: [06-auth-y-config.md](06-auth-y-config.md) · Tipos: [07-tipos.md](07-tipos.md).

El bot de producto es Agentic RAG; el panel debe permitir **publicación dinámica** de conocimiento y **gestión del catálogo de paquetes**, además del brief de cotización en el expediente.

Producto de roles, carga y telemetría: [../producto/04-escenarios-rol-carga-telemetria.md](../producto/04-escenarios-rol-carga-telemetria.md).

## 1. Principios de experiencia

- Una sola verdad: lo que se ve en bandeja y en expediente es el mismo lead.
- Priorizar “qué hacer ahora” (escalaciones, calificados sin contactar, listos para cotizar) sobre analítica avanzada.
- **Una composición por rol:** asesor = atender; coordinador/admin = equilibrar y auditar.
- **Minimalismo operativo:** una cola, una prioridad, una CTA primaria en la bandeja del asesor. Sin cards decorativas ni stats de equipo.
- **Privilegio visual estricto:** el asesor no mira carga del equipo ni telemetría del bot; coordinador/admin sí.
- En go-live, una sede activa: no saturar la UI con multi-sede incompleto.
- Capacitabilidad: usable en sesión de hasta 5 usuarios con guía breve.
- Publicar conocimiento/catálogo debe sentirse inmediato (feedback de job &lt; 60 s).
- Telemetría operativa (bot + humano) es superficie de operación, no BI comercial.

## 2. Mapa de superficies

| # | Superficie | Propósito único |
|---|---|---|
| 1 | Bandeja de conversaciones | Atender hilos y tomar control del bot |
| 2 | Expediente / oportunidad | Ver y editar ficha comercial + timeline + brief de cotización |
| 3 | Pipeline | Ver oportunidades por etapa |
| 4 | Asignación y carga | Carga multi-asesor, cola sin dueño, reasignar |
| 5 | Centro de alertas | Lead nuevo, calificado, listo para cotizar, escalación |
| 6 | Administración ligera | Usuarios, roles, sedes, criterios, enrutador |
| 7 | Conocimiento | Documentos narrativos que alimentan el RAG |
| 8 | Catálogo de paquetes | SKUs, precios, inclusiones, import Excel |
| 9 | Uso y cupo | Consumo vs tope mensual |
| 10 | Telemetría operativa | Timeline bot+humano, resumen sede, drill-down |

Navegación conceptual:

- **Asesor:** Alertas propias y Bandeja como únicas entradas diarias; Expediente/Pipeline solo de asignados.
- **Coordinador:** Carga + Alertas de sede + Bandeja equipo.
- **Admin:** Carga + Telemetría + ops (Conocimiento / Catálogo / Cupo / Admin).

## 3. Detalle por superficie

### 3.1 Bandeja de conversaciones

Muestra:

- Lista de hilos (Meta FB/IG y WhatsApp) con preview, canal, sede, estado bot/humano.
- Indicadores: escalado (dentro / fuera de ventana 15–30 min), calificado, listo_para_cotizar, sin asignar (solo coord/admin), pendiente de contacto.
- **Asesor:** scope fijo “solo míos” + resumen ligero propio (`X urgentes · Y listos · Z abiertos`).
- **Coordinador/admin:** pueden filtrar por asesor / equipo / sin asignar.
- Panel del hilo: mensajes en orden, datos capturados en vivo (ocasión, fecha, aforo, etc.).
- Motivo de escalación cuando aplique (`rerank_bajo`, `sin_catalogo`, etc.).
- Acciones: responder como humano, tomar control, devolver a bot solo si política lo permite (v1: opcional; default = humano mantiene control), abrir expediente.

**Orden de prioridad fijo (asesor):**

1. Escalación (dentro / fuera de ventana).
2. `listo_para_cotizar`.
3. Calificado sin contactar.
4. Resto asignado.

**Viewport asesor (minimalismo):** cola + hilo + brief lateral mínimo (ocasión / fecha / aforo / paquete) + una CTA primaria. Sin telemetría de rutas del bot ni carga del equipo.

Filtros: canal, estado, calificación, urgencia SLA; asesor solo en roles autorizados.

### 3.2 Expediente del lead / oportunidad

Muestra:

- Identidad del contacto y origen.
- Campos de perfilado (editables según rol).
- Calificación, flag `listo_para_cotizar` y etapa de pipeline.
- **Brief de cotización:** tipo evento, fecha, aforo, sede, paquete/SKU o a medida, precio de catálogo al momento, inclusiones clave, presupuesto del lead, restricciones, fuentes; aviso si `precio_catalogo_desactualizado`.
- Asesor asignado y botón/flujo de reasignación (si permiso).
- Timeline: mensajes clave, cambios de etapa, asignaciones; recuperaciones RAG, consultas de catálogo y **eventos operativos** (visible al menos para admin; coordinador según política).

Acciones: guardar datos, cambiar etapa, tipificar perdido, ir al hilo.

### 3.3 Pipeline comercial

Muestra:

- Columnas o lista por etapa (nuevo/bot → … → ganado/perdido).
- Tarjeta mínima por oportunidad: nombre, ocasión, fecha, aforo, asesor, canal, badge listo_para_cotizar.
- Filtros: sede (cuando aplique), asesor, canal, calificación.
- **Asesor:** solo oportunidades asignadas a sí.
- **Coordinador/admin:** sede completa.

Acciones: abrir expediente; cambio rápido de etapa si se habilita.

No es BI de conversión ni reporting de campaña (excluido).

### 3.4 Asignación y carga

Superficie de **carga completa** multi-asesor (coordinador/admin). El asesor **no** tiene esta pantalla.

Muestra:

- Lista densa de asesores del jardín activo con métricas:
  - Abiertas asignadas (excluye ganado/perdido).
  - Escaladas pendientes de primer contacto humano.
  - `listo_para_cotizar` sin etapa propuesta.
  - Fuera de ventana SLA (&gt; 30 min).
  - Disponibilidad on/off.
- Regla vigente en lenguaje claro (“Round-robin por sede, solo disponibles”).
- Cola sin asignar / exploración pendiente.

Acciones: reasignar, marcar disponibilidad (si se usa en la regla).

Sin gráficos complejos en v1.

### 3.5 Centro de alertas

Muestra:

- Feed de notificaciones: nuevo, calificado, listo_para_cotizar, escalación.
- Estado: pendiente / leída / atendida.
- Destacado visual de escalaciones dentro o fuera de ventana 15–30 min.
- **Asesor:** solo alertas propias o de hilos asignados.
- **Coordinador/admin:** alertas de la sede.

Acciones: marcar atendida, ir al hilo o expediente.

### 3.6 Administración ligera

Muestra / edita:

- Usuarios y roles.
- Sedes (activar/desactivar jardín — activación comercial del 2.º jardín sigue siendo change order).
- Criterios de calificación visibles (campos obligatorios).
- Tipificaciones de perdido.
- Parámetros del enrutador documentados (sede, disponibilidad, round-robin).

### 3.7 Conocimiento (documentos RAG)

Muestra:

- Biblioteca de documentos fuente (FAQ, sedes, políticas, safe replies, apoyo narrativo).
- Estado: borrador / publicado / archivado.
- Versión, `publicado_en`, alcance global o por sede.
- Estado del job de ingesta (en cola / indexando / listo / error) con objetivo &lt; 60 s.

Acciones: cargar/actualizar contenido autorizado, publicar, archivar. Al publicar, feedback claro de “vigente para el bot”. No requiere que el asesor edite “código” del bot.

### 3.8 Catálogo de paquetes

Muestra:

- Lista de SKUs con estado, sede, tipo de evento, aforo, versión.
- Detalle: inclusiones tipadas, precios con vigencia, reglas.
- Historial de `ImportacionCatalogo` (filas OK/error).

Acciones (admin): CRUD, import Excel/CSV, publicar/archivar paquete o precio, ver preview de lo que devolverían las tools.

### 3.9 Uso y cupo

Muestra:

- Unidades consumidas vs 1,000 del periodo.
- Desglose simple por canal (Meta / WhatsApp / email) si está disponible.
- Indicador de uso de Agentic RAG (recuperaciones / generación / tools).
- Aviso de aproximación a tope.

Sin facturación automática de excedentes en el panel (eso es proceso comercial Medina).

### 3.10 Telemetría operativa

Superficie **admin** (coordinador: lectura limitada o drill-down de hilo según pacto; asesor: no).

Muestra:

- Timeline por hilo: eventos bot y humano intercalados (`EventoOperativo`).
- Resumen sede: tasa de handoff, rutas más usadas (`guion` / `catalogo` / `rag` / `handoff` / `safe`), % briefs `listo_para_cotizar`, cumplimiento SLA humano, carga por asesor.
- Drill-down a `RegistroRecuperacion`, `RegistroConsultaCatalogo` y detalle de latencias (tools, primer reply humano post-escalación).

Propósito: auditar cómo trabaja el bot y cómo trabaja el agente. No es dashboard ejecutivo de marketing.

## 4. Matriz de acceso por perfil

| Superficie / acción | Asesor | Coordinador | Admin Tres Cielos / Medina |
|---|---|---|---|
| Ver bandeja (propios) | Sí | Sí | Sí |
| Ver bandeja (equipo / sede) | No | Sí | Sí |
| Resumen ligero de cola propia | Sí | Sí | Sí |
| Responder / tomar control | Sí (asignados) | Sí | Sí |
| Ver / editar expediente asignado | Sí | Sí | Sí |
| Ver brief de cotización | Sí | Sí | Sí |
| Ver todos los expedientes de la sede | No | Sí | Sí |
| Cambiar etapa pipeline | Sí (asignados) | Sí | Sí |
| Ver Asignación y carga | No | Sí | Sí |
| Reasignar | No* | Sí | Sí |
| Gestionar usuarios / roles | No | Lectura limitada | Sí |
| Publicar documentos de conocimiento | No | No** | Sí |
| Gestionar catálogo de paquetes | No | Lectura | Sí |
| Ver cupo / uso | No | Sí | Sí |
| Configurar reglas de asignación | No | Lectura | Sí |
| Ver telemetría operativa (resumen sede) | No | Lectura limitada** | Sí |
| Drill-down telemetría por mensaje | No | Según pacto | Sí |

\* Salvo pacto explícito en kick-off.  
\*\* Coordinador puede proponer borradores solo si Tres Cielos lo pide; publicación queda en admin/Medina. Lectura de telemetría de sede para coordinador es preferida en go-live para vigilar SLA.

## 5. Flujos de usuario críticos (día a día)

### Asesor — lead calificado / listo para cotizar

1. Recibe alerta “lead calificado” o “listo para cotizar”.
2. Abre bandeja (prioridad automática) o expediente y revisa el **brief**.
3. Contacta en 15–30 min (si venía de bot o escalación).
4. Emite cotización formal humana; actualiza etapa a “propuesta / cotización”.

### Asesor — escalación

1. Alerta prioritaria de escalación (con motivo y reloj SLA).
2. Toma control del hilo.
3. Resuelve duda; completa datos si faltan.
4. Marca alerta atendida.

### Coordinador — desbalance

1. Entra a Asignación y carga.
2. Ve cola sin dueño, sobrecarga o fuera de SLA.
3. Reasigna.
4. Verifica alertas pendientes del equipo y bandejas origen/destino.

### Admin — telemetría y calidad

1. Abre Telemetría operativa o timeline del hilo.
2. Inspecciona ruta del bot, tools/RAG y latencia humana post-handoff.
3. Corrige catálogo/conocimiento si hay fallo de precisión o frescura.

### Admin — conocimiento dinámico

1. Recibe copy aprobado de Tres Cielos.
2. Carga/actualiza documento.
3. Publica → espera estado “listo” (&lt; 60 s) → el bot ya recupera el contenido nuevo.
4. Archiva versiones obsoletas.

### Admin — catálogo / precio del día

1. Importa Excel o edita precio de un SKU.
2. Publica precio/paquete.
3. Verifica en preview de tool o pregunta de prueba en staging.
4. Briefs abiertos muestran aviso de precio desactualizado si aplica.

## 6. Estados vacíos y adopción

- Bandeja vacía: mensaje claro (“Sin conversaciones; los leads de campañas aparecerán aquí”).
- Sin asignación: CTA hacia coordinador (visible en carga).
- Documento en borrador: el bot no lo usa hasta publicar.
- Job de ingesta en error: aviso actionable al admin.
- Cupo alto: aviso no punitivo + contacto con Medina.
- Sin eventos de telemetría en hilo nuevo: empty state (“Aún no hay decisiones del bot en este hilo”).

## 7. Criterios de éxito UI

UAT medible F1–F7 en [../producto/04-escenarios-rol-carga-telemetria.md](../producto/04-escenarios-rol-carga-telemetria.md) §6 (aislamiento RBAC, carga multi-asesor, latencia de aparición ≤ 5 s, SLA visual, minimalismo, reasignación, telemetría).

## 8. Criterio de cierre de este entregable

Quedan definidas las 10 superficies (incluye carga multi-asesor y telemetría operativa), la matriz por perfil, el minimalismo de bandeja y los flujos diarios alineados a Agentic RAG, enrutador preciso y telemetría bot+humano.

