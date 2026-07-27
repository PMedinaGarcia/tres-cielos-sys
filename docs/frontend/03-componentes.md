# Frontend — componentes, composición y patrones visuales

Inventario estructural de componentes del panel y convenciones de presentación (design system operativo). **No** hay storybook ni librería UI en el repo aún; lo siguiente es el contrato de composición alineado a [00-superficies.md](00-superficies.md) y al minimalismo de producto.

Referencias: [01-estructura.md](01-estructura.md), [02-routing-y-paginas.md](02-routing-y-paginas.md), [../producto/04-escenarios-rol-carga-telemetria.md](../producto/04-escenarios-rol-carga-telemetria.md) §5.

---

## 1. Principios de composición

1. **Una CTA primaria por viewport** en flujos de atención (bandeja asesor).
2. **Sin cards decorativas:** contenedores solo cuando aportan interacción o agrupación operativa (formulario, tabla, hilo).
3. **Privilegio visual estricto:** componentes de carga de equipo / telemetría bot no se montan en árbol del asesor (`RoleGate`).
4. **Densidad operativa** en coord/admin (tablas); **claridad de cola** en asesor (lista + hilo).
5. **Estados vacíos accionables** (copy de producto en [00-superficies.md](00-superficies.md) §6).

---

## 2. Capas de componentes

| Capa | Carpeta | Puede conocer dominio CRM | Ejemplo |
|---|---|---|---|
| Primitivos | `components/ui` | No | `Button`, `Input`, `Badge`, `Table` |
| Layout | `components/layout` | Solo rol/sesión | `AppShell`, `SideNav`, `RoleGate` |
| Features | `components/{superficie}` | Sí | `ThreadList`, `BriefPanel` |
| Páginas | `app/(panel)/.../page.tsx` | Orquestan features | Composición de ruta |

Regla: si un primitivo empieza a recibir props `listoParaCotizar`, muévelo a feature.

---

## 3. Design system estructural (tokens)

Sin marca visual cerrada en código. Tokens **propuestos** para un panel de operaciones (no landing):

### 3.1 CSS variables (alto nivel)

| Token | Rol |
|---|---|
| `--color-bg` / `--color-surface` / `--color-border` | Fondo de trabajo, paneles, divisores |
| `--color-text` / `--color-text-muted` | Jerarquía tipográfica |
| `--color-accent` | CTA primaria (una sola acción dominante) |
| `--color-danger` | Escalación / error / fuera de SLA |
| `--color-warning` | Dentro de ventana SLA / aviso de cupo |
| `--color-success` | Publicado / job listo / ganado |
| `--color-info` | Canal / tip informativo |
| `--space-*` | Escala 4/8/12/16/24/32 |
| `--radius-sm` / `--radius-md` | Radios contenidos (evitar pills masivos) |
| `--font-sans` / `--font-mono` | UI y IDs/SKU; **confirmar tipografías de marca Tres Cielos** (gap) |

Evitar como look por defecto: púrpura genérico SaaS, cream+terracotta “AI landing”, broadsheet denso, glow, dark mode forzado.

### 3.2 Tipografía

- Jerarquía corta: título de superficie → subtítulo operativo → cuerpo → meta (canal, hora).
- En bandeja, el nombre/preview del hilo manda sobre labels decorativos.
- Tipografías exactas y kit de marca: **por confirmar** con Tres Cielos / Medina (gap).

### 3.3 Badges semánticos (dominio)

| Badge | Significado |
|---|---|
| Escalado · dentro ventana | Urgente, dentro 15–30 min |
| Escalado · fuera ventana | Crítico SLA |
| `listo_para_cotizar` | Brief completo |
| Calificado | Obligatorios + intención |
| Sin asignar | Solo coord/admin |
| Bot / Humano | Quién controla el hilo |
| Canal FB / IG / WA | Origen |
| Precio desactualizado | Brief con catálogo stale |
| Job: cola / indexando / listo / error | Ingesta conocimiento |

Implementar como `Badge` + variante semántica; no inventar iconografía emoji.

---

## 4. Layout y navegación

| Componente | Responsabilidad |
|---|---|
| `AppShell` | Grid nav + main; responsive (nav colapsable en móvil) |
| `SideNav` | Ítems filtrados por rol ([02](02-routing-y-paginas.md) §7) |
| `TopBar` | Usuario, rol, sede activa (texto), logout, campana de alertas |
| `RoleGate` | Condicional `children` por `role` / capability; no sustituye middleware |
| `PageHeader` | Título de superficie + una línea de contexto + slot de acciones |
| `ForbiddenState` / `EmptyState` | 403 visual y vacíos de producto |

---

## 5. Features por superficie

### 5.1 Bandeja

| Componente | Rol |
|---|---|
| `ThreadList` | Lista ordenada por prioridad fija; filtros según rol |
| `ThreadListItem` | Preview, canal, badges, timestamp |
| `QueueSummary` | Solo asesor: `X urgentes · Y listos · Z abiertos` |
| `ThreadFilters` | Canal, estado, calificación, urgencia; `asesorId` solo coord/admin |
| `ThreadView` | Mensajes cronológicos (user / bot / asesor) |
| `EscalationBanner` | Motivo (`rerank_bajo`, `sin_catalogo`, …) + reloj SLA |
| `MessageComposer` | Responder como humano |
| `TakeControlButton` | CTA primaria cuando el bot aún controla |
| `BriefAside` | Ocasión / fecha / aforo / paquete — lateral mínimo |
| `OpenExpedienteLink` | Navegación al expediente |

Composición asesor: `ThreadList` + `ThreadView` + `BriefAside` + una CTA (`MessageComposer` **o** `TakeControlButton`).

### 5.2 Expediente

| Componente | Rol |
|---|---|
| `ExpedienteHeader` | Contacto, origen, etapa, asesor asignado |
| `BriefCotizacionForm` | Campos del brief + aviso `precio_catalogo_desactualizado` |
| `PerfiladoFields` | Campos editables según rol |
| `EtapaSelect` / `TipificarPerdido` | Pipeline humano |
| `Timeline` | Mensajes clave, etapas, asignaciones; eventos ops según rol |
| `ReassignControl` | Solo coord/admin |

### 5.3 Pipeline

| Componente | Rol |
|---|---|
| `PipelineBoard` o `PipelineList` | Por `EtapaPipeline` |
| `OportunidadCard` | Mínima: nombre, ocasión, fecha, aforo, asesor, canal, badge listo |

Sin métricas de conversión/campaña.

### 5.4 Asignación y carga

| Componente | Rol |
|---|---|
| `CargaAsesoresTable` | Métricas por asesor (abiertas, escaladas, listos, fuera SLA, disponibilidad) |
| `ColaSinAsignar` | Leads sin dueño / exploración |
| `ReglaEnrutadorBanner` | Texto claro de la regla vigente |
| `ReassignDialog` | Flujo de reasignación |
| `DisponibilidadToggle` | On/off si la regla lo usa |

### 5.5 Alertas

| Componente | Rol |
|---|---|
| `AlertFeed` | Nuevo / calificado / listo / escalación |
| `AlertItem` | Estado pendiente/leída/atendida + deep link |
| `SlaClock` | Visual 15–30 min |

### 5.6 Conocimiento / catálogo / cupo / admin / telemetría

| Superficie | Componentes clave |
|---|---|
| Conocimiento | `DocumentoTable`, `PublishActions`, `IngestJobStatus` (&lt; 60 s feedback) |
| Catálogo | `SkuTable`, `PaqueteDetail`, `ImportCatalogoForm`, `ImportHistory`, `ToolPreview` (admin) |
| Cupo | `CupoMeter`, `DesgloseCanal`, `UsoAgenticRag` |
| Admin | Forms/tables de usuarios, sedes, criterios, tipificaciones, params enrutador |
| Telemetría | `SedeOpsSummary`, `EventoOperativoTimeline`, `RegistroRecuperacionDetail`, `ConsultaCatalogoDetail` |

---

## 6. Primitivos UI mínimos (v1)

Necesarios para no bloquear features:

- `Button` (primary / secondary / danger / ghost)
- `Input`, `Textarea`, `Select`, `Checkbox`
- `Badge`
- `Table` (+ densidades)
- `Tabs` (si pipeline/expediente los usan)
- `Dialog` / `Sheet` (reasignar, import, tipificar)
- `Toast` / `InlineAlert`
- `Spinner` / `Skeleton` (listas)
- `Tooltip` (motivos de escalación, métricas)

No es obligatorio adoptar shadcn/ui; si se adopta, tematizar con los tokens §3 y no publicar el look default morado.

---

## 7. Patrones de presentación recurrentes

### 7.1 Lista + detalle

Bandeja y telemetría por hilo: selección en lista actualiza panel sin perder contexto de filtros.

### 7.2 Feedback de jobs

Publicar documento/catálogo: estado visible en línea (`en_cola` → `listo` / `error`) con objetivo &lt; 60 s. Error → mensaje actionable, no spinner infinito.

### 7.3 SLA visual

Dos umbrales: dentro de ventana (warning) vs fuera (danger). Misma semántica en alertas, bandeja y carga.

### 7.4 Formularios de dominio

Validación Zod compartida con enums de [../backend/05-dtos-y-tipos.md](../backend/05-dtos-y-tipos.md). Errores de campo en ES; 403 de API → toast, no marcar inputs.

### 7.5 Responsive

- Desktop: tres columnas en bandeja posibles.
- Móvil: lista → detalle a pantalla completa; brief como sheet. Capacitabilidad con ≤ 5 usuarios guiados (producto).

---

## 8. Qué no construir en v1

- Design system de marketing / landing.
- Charts complejos en carga o cupo (meter simple sí).
- Dashboard ejecutivo multi-KPI en home.
- Temas multi-marca o white-label.
- Librería de iconos ornamental sin función.

---

## 9. Criterio de cierre de este entregable

Quedan definidas capas de componentes, tokens estructurales, badges de dominio, inventario por superficie, primitivos mínimos y patrones (lista+detalle, jobs, SLA) alineados al minimalismo operativo — listos para implementar cuando exista el scaffold Next.js.
