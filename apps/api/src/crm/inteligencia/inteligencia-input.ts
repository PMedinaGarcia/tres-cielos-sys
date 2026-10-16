import { isPerfilListo } from "../../conversation/script/harvest-campos";
import type { CamposCapturados } from "../../conversation/types";
import {
  perfilDesdeOportunidad,
  type InteligenciaInput,
} from "./playbook-evento";

export type InteligenciaFuente = {
  tipoEvento: string | null;
  calificacion: string;
  listoParaCotizar: boolean;
  paqueteTentativoId: string | null;
  etapa: string;
  propuestaEnviadaEn: Date | string | null;
  visitaEstado: string;
  intencionVisita: boolean;
  fechaTentativa?: Date | string | null;
  aforo?: number | null;
  sede?: string | null;
  campos?: CamposCapturados | null;
  motivoHandoff?: string | null;
  ultimaRuta?: string | null;
  pasoGuion?: string | null;
  pedidoCotizacion?: boolean | null;
  ultimoContactoEn: Date | string;
  estadoAtencion?: string | null;
};

/** Misma lectura de perfil y de pedido de cotizar en persistencia y en el panel. */
export function inteligenciaInputDe(fuente: InteligenciaFuente): InteligenciaInput {
  const campos = fuente.campos ?? {};
  const pedidoExplicito = fuente.pedidoCotizacion;
  const pedido =
    pedidoExplicito ??
    (campos.intencionCotizar === true
      ? true
      : campos.intencionCotizar === false
        ? false
        : null);
  return {
    tipoEvento: fuente.tipoEvento,
    calificacion: fuente.calificacion,
    listoParaCotizar: fuente.listoParaCotizar,
    paqueteTentativoId: fuente.paqueteTentativoId,
    etapa: fuente.etapa,
    propuestaEnviadaEn: fuente.propuestaEnviadaEn,
    visitaEstado: fuente.visitaEstado,
    intencionVisita: fuente.intencionVisita,
    motivoHandoff: fuente.motivoHandoff ?? null,
    ultimaRuta: fuente.ultimaRuta ?? null,
    pasoGuion: fuente.pasoGuion ?? null,
    perfilCompleto:
      isPerfilListo(campos) ||
      perfilDesdeOportunidad({
        tipoEvento: fuente.tipoEvento,
        fechaTentativa: fuente.fechaTentativa ?? null,
        aforo: fuente.aforo ?? null,
        sede: fuente.sede ?? null,
      }),
    intencionCotizar: campos.intencionCotizar ?? null,
    pedidoCotizacion: pedido,
    ultimoContactoEn: fuente.ultimoContactoEn,
    estadoAtencion: fuente.estadoAtencion ?? null,
  };
}

export function camposCapturadosDe(json: unknown): CamposCapturados {
  if (!json || typeof json !== "object" || Array.isArray(json)) return {};
  return json as CamposCapturados;
}
