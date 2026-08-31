# Universo comercial Tres Cielos

Qué ofrece el venue, a qué líneas corresponde y qué queda fuera del bot. Inclusiones: plantillas Anexo B Julio 2026 + ficha **Paquete Bodas 2027**. Tarifas de paquete: [06-tarifas-bodas-2027.md](06-tarifas-bodas-2027.md).

## 1. Qué es Tres Cielos (hechos de plantilla)

Venue tipo **jardín** para eventos sociales. Las cotizaciones de paquete y de renta describen:

- Renta del jardín: estacionamiento, baños, áreas comunes.
- Capilla techada y consagrada (paquetes Premium y TC).
- Carpa fija (~600 m²) en paquetes de bodas; en solo renta, carpa de cocina.
- Explanada (plafón de diseño de olas: solo Premium).
- Pista de baile 6×6 m y templetes.
- Suite nupcial (habitación queen, dos noches) en las tres líneas.
- Hospedaje satélite: habitaciones, villas y Villa Sol, con ocupación mínima de adultos (ver cortesías, no tarifas aquí).
- Prueba de menú **en Cuernavaca** (paquetes con banquete).

El nombre comercial de la sede operativa es **Tres Cielos Tequesquitengo**. Dirección: Lago de Teques Lote 36, 4ª sección, CP 62915, Tequesquitengo, Jojutla, Morelos (Bajada 6 hasta el fondo). A orilla del lago de Tequesquitengo, a unos 90 minutos de la CDMX. El aforo físico del recinto más allá de los tramos de paquete **no** está publicado. Horarios de visita y GPS: no se afirman desde este corpus.

## 2. Tres líneas comerciales

La ficha **Paquete Bodas 2027** publica dos tiers de boda. Solo renta no trae tarifa en esa ficha.

| Línea | SKU | Qué es | Cómo se cotiza |
|---|---|---|---|
| Paquete estándar (Paquete TC / Paquete Bodas) | `EVT-J1-TC` | Evento de 3 días; base sin barra libre ni plafón | Precio por invitado en tramos 100/150/200/250/300, vigencia 2027 |
| Upgrade Premium | `EVT-J1-PREMIUM` | Estándar + table styling, barra/DJ booth, barra libre, sillas premium, plafón, menú 100% res | Igual, tramos propios más altos |
| Solo renta | `RENTA-J1` | Locación + limpieza + suite + valet; **sin** banquete, ceremonia, DJ ni planta de luz | Sin tarifa publicada (plantilla en 0) |

`tipo_evento`: `boda` en los dos paquetes 2027; `multi` en renta. Otras ocasiones no usan esas tarifas sin asesor.

Detalle de inclusiones y deltas: [03-matriz-lineas.md](03-matriz-lineas.md).

## 3. Anatomía de una cotización (Anexo B)

Todas las plantillas comparten el mismo esqueleto:

1. Encabezado de cliente: novia, novio, mail, celular, tipo de evento, fecha de evento, fecha de cotización, no. de personas, ejecutivo.
2. Título interno: `ANEXO B CONTRATO`. Premium etiqueta además `PAQUETE PREMIUM`. TC y renta no traen esa etiqueta en celdas (el nombre de línea sale del archivo).
3. Tabla `CONCEPTO` / `DESCRIPCION` agrupada por bloques (locación, ceremonia, cóctel, mobiliario, banquete, DJ, montaje, planner, upgrade).
4. `COSTO P/PERSONA` y `TOTAL` (fórmula pp × personas).
5. Notas de **cortesía de hospedaje** (misma prosa en las tres).
6. **Condiciones comerciales** (idénticas en las tres).
7. Bloque **UPGRADE** vacío: gancho de add-ons estacionales, no un paquete distinto.

El bot no emite este Anexo B. Prepara brief; el ejecutivo cotiza. Ver [../producto/03-criterios-exito-cotizacion.md](../producto/03-criterios-exito-cotizacion.md).

## 4. Qué vive en catálogo vs qué vive en K

| Dato | Capa | Por qué |
|---|---|---|
| Precio por persona / renta | Catálogo (`precios.yaml`) | Nunca RAG |
| Anticipo 20%, IVA 16%, 30 días de cotización | Catálogo (reglas) + prosa K14 sin repetir como “el precio es” | El porcentaje es dato duro; el tono es política |
| Presupuestos florales incluidos | Catálogo (inclusiones/precios auxiliares) | Hay pesos en la plantilla |
| Umbrales de hospedaje y montos tarifa 2027 | Catálogo (`promociones.yaml`) | Condicionales + pesos |
| Ratio mesero 1/10, lounge 30%, pista 6×6, 10 h / 11 h | Catálogo (inclusiones + reglas) | Medible |
| Copy de capilla, cóctel, tornaboda, “diseño exclusivo” | K (módulos) | Narrativa |
| Lista de refrescos / marcas de barra | K + inclusión tipada | Marca es inclusión; no es tarifa |

## 5. Qué no vende (o no confirma) el bot

- Descuentos no catalogados → handoff `descuento_fuera_catalogo`.
- Apartado de fecha (la cotización **no** aparta; lo dice K14).
- Contratos, Anexos B rellenos, negociación con proveedor.
- Material no especificado en el documento de cotización.
- Planta de luz en solo renta (exclusión explícita).
- Alcohol en cóctel más allá de una cerveza por invitado (paquetes); barra libre solo Premium y solo las marcas listadas.
- Proteína en tornaboda (chilaquiles **sin** proteína).
- Disponibilidad de stock de sillas/vajilla (sujeto a stock).
- Tarifas de hospedaje como cotización de hotel: son condición de cortesía, no un SKU de cuarto que el bot cierre.

## 6. Relación con sedes del producto

El modelo de producto contempla más de una sede y go-live de una sola ([../producto/01-diseno-estrategico.md](../producto/01-diseno-estrategico.md) §6). Este corpus etiqueta `sede: tequesquitengo` de forma operativa. No hay evidencia en las Excel de un segundo jardín.
