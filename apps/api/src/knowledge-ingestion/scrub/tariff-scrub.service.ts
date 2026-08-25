import { Injectable } from "@nestjs/common";

export interface ScrubResult {
  textoLimpio: string;
  noRecuperablePrecio: boolean;
  montosDetectados: string[];
  senales: string[];
}

const MONETARY_TOKEN =
  /(\$\s?\d[\d.,]*|\d[\d.,]*\s?(?:mxn|usd|pesos?)|precio|anticipo|costo|tarifa|paquete desde)/gi;

const COLUMN_HINT =
  /\b(precio|anticipo|costo|tarifa|monto|total)\b/i;

/**
 * Gate de tarifas → flag `no_recuperable_precio` (D-MED-10 / T-MED-OCR).
 * Nunca inventa montos; solo detecta y limpia/marca.
 */
@Injectable()
export class TariffScrubService {
  scrub(texto: string): ScrubResult {
    const senales: string[] = [];
    const montosDetectados: string[] = [];
    const matches = texto.match(MONETARY_TOKEN) ?? [];
    for (const m of matches) {
      const t = m.trim();
      if (/[\$\d]/.test(t) || /mxn|usd|pesos?/i.test(t)) {
        if (!montosDetectados.includes(t)) montosDetectados.push(t);
      }
      if (!senales.includes(t.toLowerCase())) senales.push(t.toLowerCase());
    }
    if (COLUMN_HINT.test(texto)) senales.push("columna_precio");

    const noRecuperablePrecio =
      montosDetectados.length > 0 ||
      senales.some((s) =>
        /precio|anticipo|tarifa|costo|paquete desde|columna_precio|\$|mxn|usd/.test(
          s,
        ),
      );

    // Preferencia producto: excluir montos del texto indexable; conservar prosa.
    let textoLimpio = texto;
    if (noRecuperablePrecio) {
      textoLimpio = texto
        .replace(/\$\s?\d[\d.,]*/g, "[MONTO_OMITIDO]")
        .replace(/\d[\d.,]*\s?(?:MXN|USD|pesos?)/gi, "[MONTO_OMITIDO]");
    }

    return {
      textoLimpio: textoLimpio.trim(),
      noRecuperablePrecio,
      montosDetectados,
      senales,
    };
  }

  /**
   * Extrae solo cifras monetarias crudas (para asserts de 0 montos en consumo).
   */
  extractRawAmounts(texto: string): string[] {
    const out: string[] = [];
    const re = /\$\s?\d[\d.,]*|\d[\d.,]*\s?(?:MXN|USD)/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(texto)) !== null) out.push(m[0]);
    return out;
  }
}
