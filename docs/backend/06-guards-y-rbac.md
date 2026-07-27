# Backend — Guards, RBAC y estructura de acceso

Contrato de **autorización** del panel Event Master / Tres Cielos para NestJS (API) y su espejo en Next.js (middleware / gate de rutas).

**Estado del repo:** no existe aún código NestJS (`AuthGuard`, decorators, JWT, CASL) ni middleware Next.js de auth. Este documento define el **contrato esperado** alineado a producto, superficies y modelo de datos. Al implementar, la API es la fuente de verdad; la UI solo oculta controles (defense in depth).

Referencias:

- [../producto/04-escenarios-rol-carga-telemetria.md](../producto/04-escenarios-rol-carga-telemetria.md) — escenarios por rol, enrutador, F1–F7
- [../frontend/00-superficies.md](../frontend/00-superficies.md) §4 — matriz de acceso UI
- [01-dominios.md](01-dominios.md) §1 Identidad y acceso, §6 Asignación
- [../database/01-modelo-conceptual.md](../database/01-modelo-conceptual.md) — `Usuario`, roles, sedes, `Asignacion`
- [../infrastructure/01-stack-y-entornos.md](../infrastructure/01-stack-y-entornos.md) §7 — panel autenticado + RBAC

---

## 1. Principios de seguridad de acceso

1. **RBAC + scope:** el rol decide *qué acciones* existen; la sede y la asignación vigente deciden *sobre qué filas*.
2. **Mínimo privilegio:** el asesor nunca ve carga de equipo ni telemetría operativa del bot.
3. **Filtrado en query, no solo en UI:** listados deben aplicar `WHERE` de ownership/sede antes de paginar (criterio **F1**).
4. **Actor auditable:** toda mutación sensible registra `userId` + rol en `EventoOperativo` / historial.
5. **Go-live:** una sede activa (jardín); el modelo ya soporta `sedeIds[]` multi-sede.
6. **Webhooks ≠ panel:** Meta/Twilio se autentican por firma, no por JWT de usuario.

---

## 2. Roles y capabilities

Roles de producto (`Usuario.rol`): `asesor` | `coordinador` | `admin`.

Flags de cuenta relevantes: `activo`, `disponible` (enrutador), pertenencia a una o más sedes.

### 2.1 Asesor

| Capability | Permitido | Denegado |
|---|---|---|
| Bandeja / pipeline / alertas | Solo hilos/oportunidades con **asignación vigente a sí** | Cola de otros asesores, “sin asignar”, filtros por asesor |
| Expediente | Ver/editar perfilado, brief, etapa, tipificar perdido en **asignados** | Expedientes de la sede no asignados a sí |
| Responder / tomar control | En conversaciones de asignados | Hilos ajenos |
| Resumen ligero de cola | Conteos propios (`urgentes · listos · abiertos`) | Métricas de equipo |
| Asignación / carga | — | Toda la superficie |
| Reasignar | **No** en v1 (salvo pacto kick-off explícito) | Reasignación manual |
| Conocimiento / catálogo | — | Lectura ops, publicación, import |
| Cupo / uso | — | Vista gerencial |
| Admin (usuarios, roles, enrutador) | — | Todo |
| Telemetría operativa | Timeline mínimo del expediente según política de producto (sin drill-down ops) | Resumen sede, drill-down tools/RAG/scores |
| Disponibilidad on/off | — | Coord/admin en superficie de carga (producto §2 / superficies) |

### 2.2 Coordinador

| Capability | Permitido | Denegado |
|---|---|---|
| Scope de datos | Toda la **sede** (jardín) a la que pertenece | Sedes fuera de `sedeIds` |
| Bandeja equipo | Filtrar por asesor / sin asignar / exploración pendiente | — |
| Expedientes sede | Ver/editar | — |
| Asignación / carga | Ver métricas multi-asesor, cola sin dueño, reasignar | — |
| Disponibilidad de asesores | Marcar on/off si la regla del enrutador la usa | — |
| Alertas | Alertas de la sede | — |
| Usuarios / roles | Lectura limitada | Alta/baja/cambio de rol (admin) |
| Conocimiento | No publicar; borradores solo si Tres Cielos lo pacta | Publicar / archivar vigente |
| Catálogo | Lectura | CRUD, import, publicar precios |
| Cupo / uso | Lectura | Configurar topes comerciales |
| Reglas de asignación | Lectura del parámetro vigente | Cambiar algoritmo / parámetros |
| Telemetría | Lectura limitada de sede + drill-down de hilo **según pacto**; preferida en go-live para vigilar SLA | Mutar configuración de telemetría |

### 2.3 Admin (Tres Cielos / Medina)

Todo lo del coordinador, más:

| Capability | Permitido |
|---|---|
| Administración ligera | Usuarios, roles, sedes, criterios de calificación, tipificaciones, parámetros del enrutador |
| Conocimiento | Cargar, publicar, archivar; dispara ingesta |
| Catálogo | CRUD, import Excel/CSV, publicar/archivar paquete/precio |
| Cupo | Ver consumo vs tope; alertas a Medina |
| Telemetría operativa | Resumen sede + timeline + drill-down a `RegistroRecuperacion` / `RegistroConsultaCatalogo` / latencias |

---

## 3. Guards conceptuales (NestJS)

Implementación prevista: guards `CanActivate` + decorators. **No** se asume CASL en v1; si se introduce después, debe expresar la misma matriz.

Orden típico en un endpoint de panel:

```
AuthGuard → RolesGuard → SedeScopeGuard → OwnershipGuard (si aplica) → handler
```

Las reglas de **Availability / Assignment** viven en el dominio de asignación (servicio), no solo como guard HTTP.

### 3.1 `AuthGuard`

**Responsabilidad:** exigir sesión/JWT válida de usuario de panel.

- Extrae bearer (o cookie httpOnly, según implementación) y valida firma / expiración.
- Carga identidad mínima en `request.user` (ver §5).
- Rechaza usuarios `activo = false` aunque el token no haya expirado.
- **No** aplica a webhooks de canal ni a workers internos (usan otros mecanismos).

**Falla:** `401 Unauthorized`.

### 3.2 `RolesGuard`

**Responsabilidad:** permitir solo roles declarados en el handler.

- Decorator propuesto: `@Roles('asesor' | 'coordinador' | 'admin')`.
- Comparación exacta contra `request.user.role`.
- Jerarquía implícita de producto: `admin` ⊇ capabilities de `coordinador` en endpoints que listen ambos; **no** inferir automáticamente “admin pasa todo” sin listarlo (preferible listar roles explícitos para auditar).

**Falla:** `403 Forbidden` (autenticado pero sin rol).

### 3.3 `SedeScopeGuard`

**Responsabilidad:** acotar operaciones a sedes del usuario.

- Lee `sedeId` del path/query/body o lo deriva del recurso (`Oportunidad.sede`, `Conversacion.sede`).
- Verifica `sedeId ∈ request.user.sedeIds`.
- En go-live (una sede activa): casi todas las queries ya filtran por esa sede; el guard evita cross-sede accidental al activar el 2.º jardín.
- Coordinador/admin multi-sede: pueden operar en cualquiera de sus `sedeIds`; no en otras.

**Falla:** `403` si la sede no pertenece; `404` opcional si se prefiere no filtrar existencia (política: preferir **404** en GET de recurso ajeno para no filtrar IDs — ver §6).

### 3.4 `OwnershipGuard` (solo asignados)

**Responsabilidad:** para rol `asesor`, exigir asignación vigente.

- Aplica a: leer/escribir conversación, mensaje saliente humano, expediente, cambio de etapa, alerta de hilo asignado, tomar control.
- Condición: existe `Asignacion` con `vigente = true` y `usuarioId = request.user.userId` sobre la oportunidad del recurso.
- **No** aplica a `coordinador` / `admin` (ellos usan scope de sede).
- Excepción futura: si kick-off pacta reasignación por asesor, ese endpoint concreto se abre con RolesGuard, no relajando Ownership en el resto.

**Falla:** `403` (o `404` en GET — misma política de §6).

### 3.5 Availability / Assignment rules (dominio, no solo HTTP)

Reglas del motor de asignación ([01-dominios.md](01-dominios.md) §6; producto §3). Se ejecutan en servicios, invocadas por jobs/orquestador o por endpoints de reasignación:

| Regla | Comportamiento |
|---|---|
| Sede | Solo asesores **activos** de la sede de interés / jardín activo |
| Disponibilidad | Si el flag está en uso: `disponible = true` |
| Round-robin | Elegir entre candidatos; persistir cursor/regla en historial |
| Cola coordinador | Si no hay candidatos → visible sin dueño + notificación prioritaria |
| Escalación con dueño | Priorizar asignación vigente existente |
| `en_exploracion` | Sin asignación agresiva; cola de coordinación |
| Reasignación manual | Solo `coordinador` \| `admin`; nueva `Asignacion` con regla `manual`, actor = usuario, anterior → `sustituida` |
| Calificado sin dueño | Invariante: no quedar invisible — dueño o cola coordinador |

Endpoints de panel relacionados deben pasar `RolesGuard` (`coordinador`, `admin`) + `SedeScopeGuard` antes de invocar el servicio.

### 3.6 Decorators y metadata sugeridos

| Decorator | Uso |
|---|---|
| `@Roles(...roles)` | Metadata para `RolesGuard` |
| `@Public()` | Opt-out de `AuthGuard` (health, webhooks con firma propia) |
| `@RequireOwnership()` | Activa `OwnershipGuard` en recursos de oportunidad/conversación |
| `@SedeFrom('param' \| 'query' \| 'body' \| 'resource')` | Indica origen del `sedeId` para `SedeScopeGuard` |

### 3.7 Frontend (Next.js) — espejo, no autoridad

- Middleware / layout de sesión: redirige a login si no hay sesión (**equivalente AuthGuard**).
- Gate de rutas por rol: oculta `/asignacion`, `/conocimiento`, `/catalogo`, `/cupo`, `/admin`, `/telemetria` según matriz UI.
- **Nunca** confiar solo en ocultar menú: cada fetch al API sigue pasando por guards NestJS (F1).

---

## 4. Matriz recurso × acción × rol

Leyenda: **S** = sí · **N** = no · **P** = parcial / condicionado · **L** = solo lectura.

| Recurso / acción | Asesor | Coordinador | Admin |
|---|---|---|---|
| **Bandeja** listar propios | S | S | S |
| **Bandeja** listar equipo / sede / sin asignar | N | S | S |
| **Bandeja** responder mensaje | P (asignados) | S (sede) | S |
| **Bandeja** tomar control | P (asignados) | S | S |
| **Expediente** ver / editar asignado | S | S | S |
| **Expediente** ver todos los de la sede | N | S | S |
| **Expediente** brief de cotización | S | S | S |
| **Expediente** cambiar etapa / tipificar perdido | P (asignados) | S | S |
| **Pipeline** listar | P (asignados) | S (sede) | S |
| **Carga / asignación** ver métricas | N | S | S |
| **Reasignación** manual | N* | S | S |
| **Disponibilidad** on/off (carga) | N | S | S |
| **Alertas** propias / de asignados | S | S | S |
| **Alertas** de sede | N | S | S |
| **Catálogo** lectura ops | N | L | S |
| **Catálogo** publicar / import | N | N | S |
| **Conocimiento** publicar | N | N** | S |
| **Cupo / uso** ver | N | S | S |
| **Admin** usuarios/roles/sedes/enrutador | N | L (limitada) | S |
| **Telemetría** resumen sede | N | L** | S |
| **Telemetría** drill-down por mensaje | N | P (pacto) | S |

\* Salvo pacto explícito en kick-off.  
\*\* Coordinador: borradores de conocimiento solo si Tres Cielos lo pide; telemetría de sede en lectura preferida en go-live para SLA.

Alineación UI: [../frontend/00-superficies.md](../frontend/00-superficies.md) §4.

---

## 5. Filtrado de queries (scope de datos)

La autorización de listados **no** es “traer todo y filtrar en memoria”. Cada repositorio/servicio aplica predicados según rol.

### 5.1 Predicados canónicos

| Rol | Predicado base (oportunidad / conversación / alerta) |
|---|---|
| **Asesor** | `asignacion_vigente.usuarioId = :userId` **y** `sedeId IN (:sedeIds)` |
| **Coordinador** | `sedeId IN (:sedeIds)` |
| **Admin** | `sedeId IN (:sedeIds)` (mismo scope org; admin Medina suele tener todas las sedes de la org) |

Complementos frecuentes:

| Contexto | Filtro adicional |
|---|---|
| Bandeja asesor | Excluir hilos de otros; sin filtro `asesorId` libre |
| Bandeja coord/admin | Opcional: `asesorId`, `sin_asignar`, `en_exploracion`, fuera de SLA |
| Pipeline asesor | Solo oportunidades con dueño = yo |
| Carga | Agregaciones `GROUP BY asesor` dentro de sede; **403** si lo pide un asesor |
| Conocimiento por sede | Documentos `global` ∪ `sede IN sedeIds` (escritura solo admin) |
| Catálogo | Lectura coord/admin por sede; mutación admin |
| Telemetría | Admin: sede completa; coord: según pacto; asesor: N en superficie ops |

### 5.2 Invariantes API (F1 UAT)

1. Con token de asesor A, `GET` bandeja **nunca** incluye hilos cuya asignación vigente es B.
2. Acceso directo por ID (`GET /oportunidades/:id`) de un no-asignado → **403** o **404** (política única en toda la API).
3. Query params engañosos (`?asesorId=otro`) en rol asesor → **ignorados** o **403**; no amplían el scope.
4. Tras reasignación (F6): el origen deja de listar el hilo; el destino lo ve; historial `Asignacion` inmutable.

### 5.3 Política 403 vs 404 en recursos singulares

**Recomendación de producto:** en GET/PATCH de oportunidad, conversación o mensaje:

- Si el usuario no tiene scope (rol/sede/ownership) → responder **404 Not Found** con mensaje genérico (no revelar existencia).
- Si está autenticado, el recurso es de su sede, pero la **acción** no está permitida (p. ej. asesor intenta `POST /reasignaciones`) → **403 Forbidden** con mensaje de producto (§6).

Listados siempre devuelven subconjunto autorizado (200 + array posiblemente vacío), nunca 403 solo por “cola vacía”.

---

## 6. Claims / JWT o sesión esperada

Tras login exitoso, la API (y la sesión del panel) deben exponer al menos:

```ts
type PanelAuthContext = {
  userId: string;           // Usuario.id
  email: string;
  name: string;
  role: 'asesor' | 'coordinador' | 'admin';
  sedeIds: string[];        // sedes a las que pertenece
  orgId: string;            // Organizacion
  flags: {
    activo: boolean;
    disponible: boolean;    // enrutador; puede refrescarse sin re-login
  };
  // opcionales de sesión
  sessionId?: string;
  iat?: number;
  exp?: number;
};
```

Notas de implementación:

- **Fuente de verdad de `disponible` y `activo`:** base de datos en cada request sensible (o cache corto); no confiar solo en claims stale para el enrutador.
- **Refresh:** al cambiar rol o sedes, invalidar sesiones o forzar re-emisión de token.
- **Workers / bot:** no usan este JWT; actúan como actor `bot` \| `sistema` en `EventoOperativo`.
- Cookie httpOnly + CSRF, o Bearer en header: decisión de infra; el shape del contexto es el contrato.

---

## 7. Errores HTTP y mensajes de producto

| Código | Cuándo | Mensaje orientativo (ES) |
|---|---|---|
| **401** | Sin token, token inválido/expirado, usuario inactivo al validar | `No autenticado. Inicia sesión de nuevo.` |
| **403** | Rol insuficiente (p. ej. asesor → carga, telemetría, publicar catálogo) | `No tienes permiso para esta acción.` |
| **403** | Reasignación por rol no autorizado | `Solo un coordinador o administrador puede reasignar.` |
| **403** | Intento de ampliar scope vía query | `No puedes consultar la cola de otro asesor.` |
| **404** | Recurso fuera de ownership/sede (política anti-enumeración) | `No encontramos ese expediente.` / `No encontramos esa conversación.` |
| **409** | Conflicto de negocio (p. ej. reasignar oportunidad ya cerrada, si se define) | Mensaje de dominio específico |
| **422** | Validación de body | Errores de campo; no es RBAC |

Registro: en 403/401 de mutaciones sensibles, loggear `userId`, ruta y razón (`role` \| `sede` \| `ownership`) sin PII del lead en claro si no hace falta.

La UI debe mapear 401 → login; 403 → toast/banner con el mensaje; no mostrar stack traces.

---

## 8. Relación con superficies frontend y F1–F7

| Superficie UI | Guards / reglas API | Criterio UAT |
|---|---|---|
| Bandeja (asesor) | Auth + Roles + Ownership en detalle; query solo míos | **F1**, **F5** |
| Bandeja (coord/admin) | Auth + Roles + SedeScope; filtros equipo | **F2**, **F3** |
| Expediente / pipeline | Ownership (asesor) / SedeScope (coord/admin) | **F1**, brief en UAT cotización |
| Asignación y carga | Roles `coordinador`\|`admin` + SedeScope; Assignment rules | **F2**, **F6** |
| Alertas | Ownership o sede según rol; SLA visual es UI | **F4** |
| Admin / conocimiento / catálogo / cupo | Roles `admin` (+ lectura coord donde aplique) | Publicación &lt; 60 s (ops) |
| Telemetría operativa | Roles `admin` (+ coord limitado) | **F7** |
| Aparición post-calificación | No es guard; evento + realtime/refresh | **F3** (≤ 5 s) |

Criterios F1–F7: [../producto/04-escenarios-rol-carga-telemetria.md](../producto/04-escenarios-rol-carga-telemetria.md) §6.

---

## 9. Checklist de implementación (NestJS)

- [ ] Módulo `Auth`: login, emisión/validación JWT o sesión, `AuthGuard` global con `@Public()`.
- [ ] `RolesGuard` + `@Roles()`.
- [ ] `SedeScopeGuard` + resolución de sede desde recurso.
- [ ] `OwnershipGuard` + helper `assertAsignacionVigente(userId, oportunidadId)`.
- [ ] Capas de listado con predicados §5 (reutilizar en bandeja, pipeline, alertas).
- [ ] Endpoints de reasignación y carga restringidos; emiten `Asignacion` + `EventoOperativo`.
- [ ] Tests: dos asesores (F1); reasignación origen/destino (F6); admin telemetría (F7); asesor 403 en `/carga` y `/telemetria`.
- [ ] Next.js: middleware de sesión + route gates alineados a la matriz §4 de superficies.

---

## 10. Criterio de cierre de este entregable

Quedan definidos roles con capabilities explícitas, guards conceptuales NestJS (Auth, Roles, SedeScope, Ownership) y reglas de Assignment/Availability, la matriz recurso×acción×rol, el filtrado de queries (F1), el shape de claims, errores 401/403/404 de producto y el mapeo a superficies F1–F7 — listos para implementar sin ambigüedad de privilegio.
