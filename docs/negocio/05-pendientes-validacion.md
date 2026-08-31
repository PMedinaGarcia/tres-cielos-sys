# Pendientes de validación con Tres Cielos

Hechos **no** inferidos. Relacionado con [../producto/01-diseno-estrategico.md](../producto/01-diseno-estrategico.md) §8.

## 1. Tarifas — estado

| Ítem | Estado |
|---|---|
| Paquete estándar y Premium 2027 por tramos 100–300 | **Cerrado** en [06-tarifas-bodas-2027.md](06-tarifas-bodas-2027.md) y `precios.yaml` (`publicado`) |
| Placeholder $2,280 de plantilla | Archivado |
| Solo renta | Sigue sin tarifa; hay PDF *Renta-Venue-Tres-Cielos-2027* aún no transcrito |
| Descuento temporada baja “desde $30,000” | Piso publicado; **monto exacto** → asesor |
| Aforos 120, 180, etc. | No interpolar; asesor |

## 2. Aforo y tipo de evento

- Paquete bodas: min 100 / max 300, solo tramos publicados.
- `tipo_evento: boda` en `EVT-J1-TC` y `EVT-J1-PREMIUM`. Otras ocasiones no heredan esas tarifas.
- Capacidad física del recinto (más allá de 300): pendiente.
- Nombre comercial de sede: **Tres Cielos Tequesquitengo** (cerrado).

## 3. Horarios (parcialmente resuelto)

Ficha 2027: jardín **11 h** el sábado + **10 h** de meseros y mezcladores. Plantilla: cierre **02:00**. Ya no se trata como choque silencioso de “paquetes sin 11 h”. Solo renta: 11 h de jardín + carpa de cocina, sin programa de 3 días.

## 4. Sede y marca

- Nombre comercial de la sede activa: **Tres Cielos Tequesquitengo**. Identificadores: `sedeId=sede-tequesquitengo`, slug catálogo `tequesquitengo`. SKUs `EVT-J1-*` / `RENTA-J1` se conservan.
- Dirección y cómo llegar (alto nivel): **cerrados**. Lago de Teques Lote 36, 4ª sección, CP 62915, Tequesquitengo, Jojutla, Morelos. Referencia vial: Bajada 6 hasta el fondo. Orilla del lago de Tequesquitengo, a unos 90 minutos de la CDMX.
- Horarios de visita detallados y GPS / pin de Maps o Waze: no publicados.
- “Cuernavaca” = prueba de menú, no dirección del jardín. La oficina de informes en CDMX no es la locación.

## 5. Hospedaje

- Ocupación mínima de plantilla: 2 / 8 / 10 (habitación / villas / Villa Sol).
- Ficha 2027: viernes cortesía si 100% hospedaje vie+sáb; domingo parrillada si hospedados domingo–lunes y ≥ 20 adultos.
- Umbrales $209,800 y $30,000 pp: siguen en promociones; PDF *Hospedaje Novios 2027* aún no transcrito.

## 6. Stock y proveedores

Sillas/vajilla sujetas a stock. Negociación solo por escrito.

## 7. Barra y cóctel

- Cóctel: una cerveza por invitado; sin alcohol extra en estándar.
- Barra libre solo Premium; vodka **Stolichnaya** en ficha 2027.

## 8. Qué falta

1. Tarifa oficial de `RENTA-J1` (PDF renta 2027).
2. Ficha K02: GPS, horarios de visita detallados y restricciones (pirotecnia, dress code).
3. Transcripción de *Hospedaje Novios 2027*.
4. Tabla de descuento exacto de temporada baja (hoy solo piso).
5. Regla de aforos intermedios si Tres Cielos no quiere siempre handoff.
6. Copy K04 para XV/corporativo/social.
7. No sustituir `golden-snapshot.json` ni `knowledge-fixtures.ts` (sandbox de tests).
