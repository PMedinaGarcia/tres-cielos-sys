/**
 * Briefing comercial autorizado (K14, K06, K01, ficha Bodas 2027).
 * Editable: alargar o precisar aquí sin tocar el orquestador.
 */
import {
  SKU_PAQUETE_ESTANDAR,
  SKU_PAQUETE_PREMIUM,
  SKU_SOLO_RENTA,
} from "@tres-cielos/shared";
import type { CommercialFaqTopic } from "./commercial-faq.matcher";

export const COPY_VISITA =
  "Puedo registrar tu interés en visitar Tres Cielos Tequesquitengo. Los horarios de visita al venue los agenda un asesor; no los confirmo por este canal. Un ejecutivo te contacta para coordinar la cita.";

export const FAQ_CTA =
  "También puedes preguntarme por paquetes, precios o el detalle de cada uno.";

export const COPY_PAGO = `Pago y cotización (Paquete Bodas 2027):
• A la firma del contrato se requiere el 20% de anticipo.
• El saldo se liquida 30 días antes del evento.
• Los precios no incluyen el 16% de IVA ni tramitología.
• La cotización tiene vigencia de 30 días naturales; eso no es el plazo de liquidación.
• La cotización no representa apartado de fecha. Reservar es un paso posterior, con contrato y anticipo, a cargo del equipo comercial.
• Cualquier negociación con un proveedor o un ejecutivo de Tres Cielos solo vale si queda por escrito en la cotización o el contrato. El asistente no pacta excepciones.`;

export const COPY_HORARIO = `Horario del evento (plantilla Paquete Bodas 2027):
• Jardín del sábado: 11 horas de locación.
• Meseros y mezcladores: 10 horas de servicio continuo.
• El horario límite para finalizar el evento en plantilla es a las 2:00 a.m.
• Solo renta se cotiza por 11 horas de locación; si la plantilla habla de 10 horas desde cóctel, un ejecutivo unifica.
Los horarios de visita al venue los agenda un asesor; no los confirmo por este canal.`;

export const COPY_EXCLUSIONES = `Qué no incluye cada línea:
• Paquete Estándar: no incluye barra libre, plafón de diseño, sillas premium ni table styling. El banquete no es 100% res.
• Upgrade Premium: es el estándar más table styling, barra de servicio/DJ booth, barra libre nacional (tequila tradicional, ron Matusalem, vodka Stolichnaya, whisky etiqueta roja), sillas premium, plafón de diseño y menú 100% res.
• Solo renta: jardín y servicios de locación (limpieza, suite, valet). No incluye banquete, ceremonia, DJ ni planta de luz.
No se incluye material que no esté especificado en el documento de cotización. Add-ons van por upgrades del catálogo vigente o por un asesor.`;

export const COPY_OVERVIEW = `Políticas comerciales vigentes de Tres Cielos Tequesquitengo (Paquete Bodas 2027):

${COPY_PAGO}

${COPY_HORARIO}

${COPY_EXCLUSIONES}

Aforo: las tarifas publicadas son por tramos de 100, 150, 200, 250 y 300 invitados. No interpolo montos intermedios; otros tamaños los confirma un asesor.

La fecha mínima de contratación (con cuánta anticipación hay que reservar) no está publicada en el catálogo; un asesor te confirma ese plazo.`;

const FICHA_ESTANDAR = `El Paquete Estándar (Paquete Bodas 2027) es un evento de tres días en Tres Cielos Tequesquitengo.

Programa
• Viernes (cortesía): cóctel / rompehielos si hay 100% de hospedaje viernes y sábado. Aguas frescas e infusiones, cazuelas mexicanas, meseros, mezcladores (refrescos y hielo), mobiliario lounge y tres horas de servicio.
• Sábado (gran evento): jardín 11 h; suite nupcial; valet; planta 30 kW / 10 h; carpa fija (~600 m²); capilla consagrada; cóctel (lounge, canapés, coctelería tradicional, una cerveza por invitado); banquete de tres tiempos; café; pre-torna (esquites) y tornaboda (chilaquiles); 10 h de meseros y mezcladores; DJ, audio e iluminación; pista 6×6 m y templetes; coordinación de proveedores.
• Domingo (cortesía): parrillada para hospedados domingo a lunes, mínimo 20 adultos.

No incluye
Barra libre, plafón de diseño, sillas premium, table styling ni menú 100% res (eso es el Upgrade Premium). Los precios no incluyen IVA ni tramitología. No se incluye material no especificado.

Condiciones
Anticipo 20% a la firma; saldo 30 días antes del evento; cierre 02:00; la cotización no aparta fecha.`;

const FICHA_PREMIUM = `El Upgrade Premium (Paquete Bodas 2027) incluye todo el Paquete Estándar más:
• Table styling (copas, plato base y plaqué de color).
• Upgrade de barra de servicio y DJ booth.
• Barra libre nacional: tequila tradicional, ron Matusalem, vodka Stolichnaya, whisky etiqueta roja.
• Sillas premium y plafón de diseño.
• Menú 100% res.

El programa sigue siendo de tres días (viernes cortesía, sábado gran evento, domingo parrillada) con las mismas condiciones de hospedaje. Jardín 11 h el sábado, 10 h de meseros y mezcladores, cierre 02:00.

No incluye IVA ni tramitología. No se incluye material no especificado. Anticipo 20% a la firma; saldo 30 días antes; la cotización no aparta fecha.`;

const FICHA_RENTA = `Solo renta cubre jardín y servicios de locación (limpieza, suite, valet) por 11 horas. No incluye banquete, ceremonia, DJ ni planta de luz. No hay tarifa publicada en la ficha Bodas 2027; un asesor cotiza. Anticipo 20% si se contrata. Los precios de otras líneas no incluyen IVA.`;

const FICHAS: Record<string, string> = {
  [SKU_PAQUETE_ESTANDAR]: FICHA_ESTANDAR,
  [SKU_PAQUETE_PREMIUM]: FICHA_PREMIUM,
  [SKU_SOLO_RENTA]: FICHA_RENTA,
};

const CONTRASTE_PAQUETES =
  "El Estándar es el evento de tres días sin barra libre ni plafón. El Premium es ese mismo paquete más table styling, barra libre nacional, sillas premium, plafón y menú 100% res. Pregúntame qué incluye el estándar o el premium y te detallo cada uno.";

export function composeCommercialFaq(topic: Exclude<CommercialFaqTopic, "fecha_minima">): string {
  const body =
    topic === "horario"
      ? COPY_HORARIO
      : topic === "pago"
        ? COPY_PAGO
        : topic === "exclusiones"
          ? COPY_EXCLUSIONES
          : COPY_OVERVIEW;
  return `${body}\n\n${FAQ_CTA}`;
}

export function fichaPaquetePorSku(sku: string | null | undefined): string | null {
  if (!sku) return null;
  return FICHAS[sku] ?? null;
}

export function contrasteBuscarPaquetes(): string {
  return CONTRASTE_PAQUETES;
}
