# Fases de entrega y criterio de go-live

Alineación de las Etapas 1–9 de la propuesta comercial con los entregables de este repositorio. Plazo orientativo: **6 a 8 semanas** desde kick-off, sujeto a accesos y aprobaciones del cliente.

Arquitectura de bot de producto: **Agentic RAG** + catálogo de paquetes Prisma. Ver [../README.md](../README.md).

## 1. Vista integrada por etapa

| Etapa | Entregable comercial | Qué queda cerrado / construible | Docs de referencia |
|---|---|---|---|
| 1 | Diseño estratégico y embudo | Embudo, campos mínimos, calificación, un jardín activo, pipeline, brief de cotización | [01-diseno-estrategico.md](01-diseno-estrategico.md), [03-criterios-exito-cotizacion.md](03-criterios-exito-cotizacion.md) |
| 2 | Chatbot Meta (FB/IG) | Guion + orquestador (tools / RAG / handoff) | [../backend/01-dominios.md](../backend/01-dominios.md), [../backend/02-orquestador-agentico.md](../backend/02-orquestador-agentico.md) |
| 3 | Perfilado y calificación | Preguntas, validaciones, calificado / exploración / listo_para_cotizar | [01-diseno-estrategico.md](01-diseno-estrategico.md) §3–4, [03-criterios-exito-cotizacion.md](03-criterios-exito-cotizacion.md) |
| 4 | CRM e integración | Alta automática, expediente + brief, etapas, historial | [../database/01-modelo-conceptual.md](../database/01-modelo-conceptual.md), [../frontend/00-superficies.md](../frontend/00-superficies.md) §3.2–3.3 |
| 5 | Asignación inteligente | Enrutador sede/disponibilidad/round-robin; carga multi-asesor; reasignación | [04-escenarios-rol-carga-telemetria.md](04-escenarios-rol-carga-telemetria.md), [../backend/01-dominios.md](../backend/01-dominios.md) §6, [../frontend/00-superficies.md](../frontend/00-superficies.md) §3.4 |
| 6 | Notificaciones | Alertas panel y/o email: nuevo, calificado, escalación; telemetría de atención humana | [../backend/01-dominios.md](../backend/01-dominios.md) §7, [04-escenarios-rol-carga-telemetria.md](04-escenarios-rol-carga-telemetria.md) §7, [../frontend/00-superficies.md](../frontend/00-superficies.md) §3.5 |
| 7 | UAT | Casos documentados, frescura, catálogo, checklist | §3 de este documento |
| 8 | Capacitación | Hasta 8 h, guía breve, ≤5 usuarios/sesión | §4 de este documento |
| 9 | WhatsApp Business (Twilio) | Mismo cerebro agentico, plantillas utility, bandeja | [../backend/01-dominios.md](../backend/01-dominios.md) §2–3, [../frontend/00-superficies.md](../frontend/00-superficies.md) §3.1 |

### Paralelo transversal (no es etapa numerada del PDF)

**Agentic RAG + catálogo:** inventariar documentos K01–K10 (K05 = narrativa de apoyo; montos en catálogo), cargar/publicar con reindex &lt; 60 s, importar paquetes/precios a Prisma, validar hybrid search + rerank + tools — [../backend/03-rag-avanzado.md](../backend/03-rag-avanzado.md), [../backend/04-ingesta-conocimiento.md](../backend/04-ingesta-conocimiento.md), [../database/02-catalogo-paquetes.md](../database/02-catalogo-paquetes.md).

## 2. Dependencias entre etapas

```
1 Diseño ──► 2 Meta + 3 Perfilado ──► 4 CRM ──► 5 Asignación ──► 6 Notificaciones
                    │                      │
                    └─ Conocimiento + Catálogo ─┘
                                      ↓
                               7 UAT ──► 8 Capacitación
                                      ↓
                               9 WhatsApp (puede solaparse tras 4–6 estables)
                                      ↓
                                  Go-live Jardín 1
```

Notas:

- WhatsApp (9) reutiliza calificación, CRM, asignación y notificaciones; no redefine el embudo.
- Capacitación (8) requiere panel usable (bandeja, expediente, alertas, brief) aunque Meta y WA ya estén en UAT.
- Segundo jardín: **fuera** de esta secuencia de go-live; entra por change order.

## 3. Checklist de UAT (Etapa 7)

### 3.1 Captación y bot Meta

- [ ] Mensaje de prueba FB genera conversación en bandeja.
- [ ] Mensaje de prueba IG genera conversación en bandeja.
- [ ] Guion de perfilado captura obligatorios.
- [ ] FAQ cubierta por documentos publicados responde con cita de fuente.
- [ ] Pregunta sin conocimiento / rerank &lt; 0.85 → respuesta segura o escalación.
- [ ] Solicitud de humano → estado escalado + notificación.

### 3.2 Calificación, brief y CRM

- [ ] Lead con obligatorios incompletos = `en_exploracion`.
- [ ] Lead con obligatorios + intención = `calificado`.
- [ ] Brief alcanza `listo_para_cotizar` cuando aplica (métricas C1–C2).
- [ ] Expediente muestra datos alineados al chat + brief de cotización.
- [ ] Cambio de etapa en panel se refleja en pipeline.

### 3.3 Catálogo y precios

- [ ] Pregunta de precio usa `PaquetePrecio` vigente (0 montos inventados).
- [ ] Paquete fuera de aforo no se recomienda sin advertencia / alternativa.
- [ ] Import Excel de catálogo deja auditoría `ImportacionCatalogo`.
- [ ] Existe `RegistroConsultaCatalogo` auditable.

### 3.4 Asignación, panel por rol y notificaciones

- [ ] Calificado se asigna según regla documentada (sede + disponibilidad + round-robin).
- [ ] Reasignación manual (coordinador) queda en historial.
- [ ] Alertas de nuevo / calificado / escalación visibles.
- [ ] Email transaccional funciona si está en el acuerdo de canal de alerta.
- [ ] **F1** Asesor no lista hilos de otro asesor (RBAC UI + API).
- [ ] **F2** Coordinador ve carga de todos los asesores del jardín activo en una sola vista.
- [ ] **F3** Tras calificar, el hilo aparece en bandeja del asignado en ≤ 5 s.
- [ ] **F4** Escalación destaca SLA; a los 30 min sin atención → “fuera de ventana”.
- [ ] **F5** Primer viewport asesor cumple checklist de minimalismo (cola + hilo + CTA).
- [ ] **F6** Reasignación actualiza dueño, historial y bandejas origen/destino.
- [ ] **F7** Admin abre telemetría de un mensaje bot (ruta/tools/RAG) y de un turno humano (latencia / toma de control).

Detalle de criterios F1–F7: [04-escenarios-rol-carga-telemetria.md](04-escenarios-rol-carga-telemetria.md) §6.

### 3.5 WhatsApp

- [ ] Webhook recibe y responde en el mismo cerebro agentico.
- [ ] Conversación WA visible en bandeja unificada.
- [ ] Plantilla utility de arranque aprobada y usable fuera de ventana (caso de prueba controlado).
- [ ] Consumo de cupo se refleja en vista de uso (al menos a nivel de contador interno validable).

### 3.6 Conocimiento dinámico (frescura)

- [ ] Publicar cambio en ficha de sede cambia la respuesta del bot en **&lt; 60 s**.
- [ ] Publicar cambio de precio en catálogo se refleja en la siguiente respuesta de precio.
- [ ] Documento archivado deja de recuperarse de inmediato.
- [ ] Existe al menos un `RegistroRecuperacion` auditable.
- [ ] Caso “cambio de copy y de precio el mismo día” pasa UAT.

### 3.7 Sede

- [ ] Solo Jardín 1 opera asignación y cupo.
- [ ] Jardín 2 no recibe leads operativos.

## 4. Capacitación (Etapa 8) — guion mínimo

Temas a cubrir en la guía breve:

1. Entrar al panel y entender alertas.
2. Atender bandeja: tomar control, responder, abrir expediente y brief de cotización.
3. Completar datos y mover etapas del pipeline.
4. Qué hacer en escalación (ventana 15–30 min).
5. Qué **no** hacer: no prometer precios fuera del catálogo publicado; reportar errores del bot al admin.
6. (Coordinadores) Reasignar, monitorear cola y vista de carga.
7. (Admins) Publicar conocimiento, importar/actualizar catálogo, monitorear cupo, frescura y telemetría operativa.

## 5. Criterio de go-live (primer jardín)

Go-live **solo cuando** se cumplan **todos** estos puntos:

| # | Criterio | Evidencia |
|---|---|---|
| G1 | Flujos conversacionales aprobados por Tres Cielos | Acta / correo de aprobación de guiones Meta (+ WA si ya en alcance del mismo corte) |
| G2 | UAT firmado | Checklist §3 completado y firmado por responsable de aprobaciones del cliente |
| G3 | CRM recibiendo leads | Pruebas reales o controladas con expedientes creados desde canales |
| G4 | Asignación operando | Al menos un lead calificado asignado por regla + una reasignación manual verificada; F2 y F6 en verde |
| G5 | Notificaciones operativas | Escalación y calificado generan alerta usable por el equipo; F4 en verde |
| G6 | Capacitación inicial impartida | Sesión(es) dentro del cupo de 8 h; material de referencia entregado |
| G7 | Jardín 1 activo / Jardín 2 no operativo | Configuración de sede validada |
| G8 | Conocimiento mínimo publicado | K01, K02, K04, K08, K09 publicados; K05 narrativo opcional; **catálogo de paquetes con al menos un SKU/precio vigente** (u omisiones explícitas firmadas) |
| G9 | Frescura validada | Caso UAT de republicación &lt; 60 s firmado |
| G10 | Criterios de cotización | Métricas C3 y C5 de [03-criterios-exito-cotizacion.md](03-criterios-exito-cotizacion.md) en verde en UAT |
| G11 | Panel por rol y telemetría | F1, F5 y F7 de [04-escenarios-rol-carga-telemetria.md](04-escenarios-rol-carga-telemetria.md) en verde en UAT |

Tras go-live: membresía según propuesta (inicio a los 15 días o fecha pactada); excedentes y add-ons fuera de este criterio.

## 6. Responsabilidades del cliente que bloquean el plazo

Sin estos insumos, el reloj de 6–8 semanas se detiene o desliza:

- Responsable único de aprobaciones.
- Accesos Meta Business / páginas FB–IG.
- Cuenta Twilio y WhatsApp Business vinculado; aprobación de plantillas.
- Textos, políticas conversacionales y **catálogo de paquetes/precios** (Excel o carga en panel).
- Usuarios CRM del equipo y compromiso de contacto en 15–30 min post-escalación.

## 7. Fuera del go-live (recordatorio explícito)

Widget web, Google Ads, SMS/email masivo, drips post-contacto, scoring ML, **BI comercial / reportes marketing / dashboards ejecutivos de conversión**, segundo jardín activo, agente autónomo multi-día, marketing masivo WA, emisión automática de PDF de cotización.

**Incluido** (no confundir con lo anterior): telemetría operativa bot+humano, vista de carga multi-asesor y criterios F1–F7 — ver [04-escenarios-rol-carga-telemetria.md](04-escenarios-rol-carga-telemetria.md) §7.4.

## 8. Criterio de cierre de este entregable

Etapas 1–9 mapeadas a documentos por dominio, dependencias claras, checklist UAT (incluye frescura y catálogo) y definición binaria de go-live del primer jardín.
