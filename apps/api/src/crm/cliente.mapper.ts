import type {
  Cliente,
  Conversacion,
  IdentificadorCliente,
  NotaCliente,
  Oportunidad,
} from "@prisma/client";
import type {
  ClienteDetail,
  ClienteListItem,
  InteraccionDto,
  OportunidadResumenDto,
  VinculoClienteDto,
} from "@tres-cielos/shared";
import {
  derivarInteligencia,
  perfilDesdeOportunidad,
} from "./inteligencia/playbook-evento";

type ClienteListRow = Cliente & {
  tags: Array<{ tag: { nombre: string } }>;
  oportunidades?: Oportunidad[];
};

type ClienteDetailRow = Cliente & {
  identificadores: IdentificadorCliente[];
  tags: Array<{ tag: { nombre: string } }>;
  notas: NotaCliente[];
  oportunidades: Oportunidad[];
  conversaciones: Conversacion[];
};

export function toClienteListItem(
  row: ClienteListRow,
  tieneDuplicado = false,
): ClienteListItem {
  const opp = row.oportunidades?.[0];
  const intel = intelDe(opp, row);
  return {
    id: row.id,
    nombre: row.nombre,
    telefono: row.telefono,
    correo: row.correo,
    estadoAtencion: row.estadoAtencion,
    asesorAsignadoId: row.asesorAsignadoId,
    canalOrigen: row.canalOrigen,
    fuenteAlta: row.fuenteAlta,
    tags: row.tags.map((t) => t.tag.nombre),
    primerContactoEn: row.primerContactoEn.toISOString(),
    ultimoContactoEn: row.ultimoContactoEn.toISOString(),
    optOutMensajeria: row.optOutMensajeria,
    tieneDuplicado,
    tipoEvento: opp?.tipoEvento ?? null,
    etapaCotizacion: opp ? intel.etapaCotizacion : null,
    visitaEstado: intel.visitaEstado,
    listoParaCotizar: opp?.listoParaCotizar ?? false,
    siguienteAccion: intel.siguienteAccion,
    estancado: intel.estancado,
    oportunidadId: opp?.id ?? null,
  };
}

export function toOportunidadResumen(
  o: Oportunidad,
  ctx: { ultimoContactoEn: Date; estadoAtencion: string; conv?: Conversacion },
): OportunidadResumenDto {
  const intel = intelDe(o, ctx, ctx.conv);
  return {
    id: o.id,
    etapa: o.etapa,
    tipoEvento: o.tipoEvento,
    calificacion: o.calificacion,
    listoParaCotizar: o.listoParaCotizar,
    asesorAsignadoId: o.asesorAsignadoId,
    fechaTentativa: o.fechaTentativa?.toISOString() ?? null,
    aforo: o.aforo,
    sede: o.sede,
    intencionVisita: o.intencionVisita,
    visitaEstado: o.visitaEstado,
    visitaAgendadaEn: o.visitaAgendadaEn?.toISOString() ?? null,
    visitaNotas: o.visitaNotas,
    propuestaEnviadaEn: o.propuestaEnviadaEn?.toISOString() ?? null,
    etapaCotizacion: intel.etapaCotizacion,
    paqueteTentativoId: o.paqueteTentativoId,
    motivoPerdido: o.motivoPerdido,
    siguienteAccion: intel.siguienteAccion,
    estancado: intel.estancado,
    briefJson: o.briefJson,
  };
}

export function toClienteDetail(
  row: ClienteDetailRow,
  extras: { tieneDuplicado?: boolean; vinculos?: VinculoClienteDto[] } = {},
): ClienteDetail {
  const convByOpp = new Map(
    row.conversaciones.map((c) => [c.oportunidadId, c] as const),
  );
  return {
    ...toClienteListItem(row, extras.tieneDuplicado ?? false),
    nombrePerfilCanal: row.nombrePerfilCanal,
    sedeInteresId: row.sedeInteresId,
    idioma: row.idioma,
    zonaHoraria: row.zonaHoraria,
    origenJson: row.origenJson,
    fusionadoEnClienteId: row.fusionadoEnClienteId,
    identificadores: row.identificadores.map((i) => ({
      id: i.id,
      tipo: i.tipo,
      valor: i.valor,
      valorNormalizado: i.valorNormalizado,
      creadoEn: i.creadoEn.toISOString(),
    })),
    notas: row.notas.map((n) => ({
      id: n.id,
      autorId: n.autorId,
      cuerpo: n.cuerpo,
      creadoEn: n.creadoEn.toISOString(),
    })),
    oportunidades: row.oportunidades.map((o) =>
      toOportunidadResumen(o, {
        ultimoContactoEn: row.ultimoContactoEn,
        estadoAtencion: row.estadoAtencion,
        conv: convByOpp.get(o.id),
      }),
    ),
    conversaciones: row.conversaciones.map((c) => ({
      id: c.id,
      canal: c.canal,
      externalThreadId: c.externalThreadId,
      estadoBot: c.estadoBot,
    })),
    vinculos: extras.vinculos ?? [],
    creadoEn: row.creadoEn.toISOString(),
    actualizadoEn: row.actualizadoEn.toISOString(),
  };
}

export function toInteraccionDto(row: {
  id: string;
  clienteId: string;
  oportunidadId: string | null;
  conversacionId: string | null;
  mensajeId: string | null;
  eventoOperativoId: string | null;
  tipo: InteraccionDto["tipo"];
  actor: InteraccionDto["actor"];
  canal: InteraccionDto["canal"];
  resumen: string;
  payload: unknown;
  creadoEn: Date;
}): InteraccionDto {
  return {
    id: row.id,
    clienteId: row.clienteId,
    oportunidadId: row.oportunidadId,
    conversacionId: row.conversacionId,
    mensajeId: row.mensajeId,
    eventoOperativoId: row.eventoOperativoId,
    tipo: row.tipo,
    actor: row.actor,
    canal: row.canal,
    resumen: row.resumen,
    payload: row.payload,
    creadoEn: row.creadoEn.toISOString(),
  };
}

function intelDe(
  opp: Oportunidad | undefined,
  ctx: { ultimoContactoEn: Date; estadoAtencion: string },
  conv?: Conversacion,
) {
  if (!opp) {
    return derivarInteligencia({
      tipoEvento: null,
      calificacion: "en_exploracion",
      listoParaCotizar: false,
      paqueteTentativoId: null,
      etapa: "nuevo_bot",
      propuestaEnviadaEn: null,
      visitaEstado: "no_solicitada",
      intencionVisita: false,
      perfilCompleto: false,
      ultimoContactoEn: ctx.ultimoContactoEn,
      estadoAtencion: ctx.estadoAtencion,
    });
  }
  return derivarInteligencia({
    tipoEvento: opp.tipoEvento,
    calificacion: opp.calificacion,
    listoParaCotizar: opp.listoParaCotizar,
    paqueteTentativoId: opp.paqueteTentativoId,
    etapa: opp.etapa,
    propuestaEnviadaEn: opp.propuestaEnviadaEn,
    visitaEstado: opp.visitaEstado,
    intencionVisita: opp.intencionVisita,
    motivoHandoff: conv?.motivoHandoff ?? null,
    ultimaRuta: conv?.ultimaRuta ?? null,
    pasoGuion: conv?.pasoGuion ?? null,
    perfilCompleto: perfilDesdeOportunidad({
      tipoEvento: opp.tipoEvento,
      fechaTentativa: opp.fechaTentativa,
      aforo: opp.aforo,
      sede: opp.sede,
    }),
    ultimoContactoEn: ctx.ultimoContactoEn,
    estadoAtencion: ctx.estadoAtencion,
  });
}
