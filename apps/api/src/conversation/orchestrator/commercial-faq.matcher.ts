import { resolvePaqueteSkuAlias } from "@tres-cielos/shared";
import { normalizeProspectText } from "../text-normalize";
import { isLocationQuery } from "./location-intent";
import { isIntencionVisita } from "./visit-intent";

export type CommercialFaqTopic =
  | "overview"
  | "horario"
  | "pago"
  | "exclusiones"
  | "ubicacion"
  | "fecha_minima"
  | "hospedaje"
  | "distancia";

const VENUE_RE =
  /\b(estacionamiento|dress code|pirotecnia)\b/;

const FECHA_MINIMA_RE =
  /\b(fecha minima|minima de contratacion|contratacion minima|antelacion|con cuanto tiempo (hay que |para )?(reserv\w*|contrat\w*|apart\w*)|cuanto tiempo (de anticipacion |antes )?(hay que )?(reserv\w*|contrat\w*))\b/;

const HORARIO_RE =
  /\b(horarios?|orarios?|cierre|0?2:00|02:00|2\s*a\.?m\.?|11 horas?)\b/;

const PAGO_RE =
  /\b(pago|pagos|anticipo|iva|liquid|vigencia|tramitolog)\b/;

const EXCLUSIONES_RE =
  /\b(exclusiones?|exlcusiones?|no incluye|que no (trae|tiene|incluye))\b/;

const POLITICAS_RE =
  /\b(politicas?|politcas?|polticas?|condiciones|condicion|normas?|reglamento)\b/;

export function matchCommercialFaqTopic(
  texto: string,
): CommercialFaqTopic | null {
  const n = normalizeProspectText(texto);
  if (!n) return null;

  if (FECHA_MINIMA_RE.test(n)) return "fecha_minima";
  if (/\b(hospedaje|hotel|villas?|habitaciones)\b/.test(n)) return "hospedaje";
  if (/\b(lejos|distancia|traslado|90 min|cdmx)\b/.test(n) && isLocationQuery(texto)) {
    return "distancia";
  }
  if (isPackageDetailQuery(texto)) return null;
  if (isLocationQuery(texto)) return "ubicacion";
  if (VENUE_RE.test(n)) return null;

  if (EXCLUSIONES_RE.test(n)) return "exclusiones";
  if (PAGO_RE.test(n)) return "pago";
  if (HORARIO_RE.test(n)) return "horario";
  if (POLITICAS_RE.test(n)) return "overview";

  return null;
}

/**
 * “qué tiene / incluye / trae el estándar” y equivalentes mal escritos.
 */
export function isPackageDetailQuery(texto: string): boolean {
  const n = normalizeProspectText(texto);
  if (!n) return false;

  const sku = resolvePaqueteSkuAlias(texto);
  const noIncluye = /\bno incluye\b|\bque no (trae|tiene|incluye)\b/.test(n);
  if (noIncluye) return Boolean(sku);

  const asksNamed =
    /\b(incluye|inclusiones|que trae|que tiene|detalle|ficha|de que consta|que viene|contenido)\b/.test(
      n,
    ) || (/\btiene\b/.test(n) && Boolean(sku));

  if (!asksNamed) return false;
  if (sku) return true;

  return (
    /\b(incluye|inclusiones|que trae|que tiene|detalle|ficha|de que consta)\b/.test(
      n,
    ) && !/\bpaquetes tienen\b/.test(n)
  );
}

/** En nutrición: “Quiero conocer” pide la ficha del piso, no una visita. */
export function isPedidoFichaMasEconomico(texto: string): boolean {
  const n = normalizeProspectText(texto);
  if (!n) return false;
  if (isIntencionVisita(texto)) return false;
  return (
    /\bquiero conocer\b/.test(n) ||
    /\bver (el )?(paquete|estandar|premium)\b/.test(n) ||
    /\bmas (barato|economico)\b/.test(n)
  );
}
