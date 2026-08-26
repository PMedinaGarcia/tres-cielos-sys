---
id: K13-UPGRADES
inventario: K13
tipo: modulo
linea: shared
sede: tequesquitengo
edicion: "2026-07"
vigente_desde: 2026-07-01
vigente_hasta: null
reemplaza: null
estado: publicado
sin_montos: true
sku_refs: [EVT-J1-PREMIUM, EVT-J1-TC, RENTA-J1]
fuente: plantillas-anexo-b-julio-2026
titulo: Upgrades y add-ons estacionales
---

# Upgrades y temporada baja

**Upgrade Premium** no es un add-on vacío: es el SKU `EVT-J1-PREMIUM` (table styling, barra/DJ booth, barra libre, sillas premium, plafón, menú 100% res).

**Temporada baja (junio a septiembre):** hay beneficios especiales con un descuento mínimo publicado en el catálogo. El bot puede decir que existe la promo; el **monto exacto** lo cierra un asesor.

Otros extras (otra marca de barra, más floral, planta de luz en renta, aforo fuera de tramo): ejecutivo, por escrito.

Procedimiento si entra un add-on nuevo de temporada:

1. No se edita la lista base del SKU estándar.
2. Fila en `catalog/promociones.yaml` con ventana.
3. Viñeta aquí **sin montos**.
4. Al vencer: archivar la promoción.
