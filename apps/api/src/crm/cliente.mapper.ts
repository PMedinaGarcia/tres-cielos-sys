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
  UltimoMensajeDto,
  VinculoClienteDto,
} from "@tres-cielos/shared";
import { labelFechaEventoBrief } from "../conversation/script/harvest-campos";
import { derivarResumenComercialBot } from "./inteligencia/estado-comercial-bot";
import {
  camposCapturadosDe,
  inteligenciaInputDe,
} from "./inteligencia/inteligencia-input";
import { derivarInteligencia } from "./inteligencia/playbook-evento";

type MensajePreview = {
  contenido: string;
  autor: UltimoMensajeDto["autor"];
  direccion: UltimoMensajeDto["direccion"];
  creadoEn: Date;
};

type ConversacionListRow = Conversacion & { mensajes?: MensajePreview[] };

type ClienteListRow = Cliente & {
  tags: Array<{ tag: { nombre: string } }>;
  oportunidades?: Oportunidad[];
  conversaciones?: ConversacionListRow[];
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
  const conv =
    row.conversaciones?.find((c) => opp && c.oportunidadId === opp.id) ??
    row.conversaciones?.[0];
  const intel = intelDe(opp, row, conv);
  const campos = camposCapturadosDe(conv?.camposCapturados);
  const resumenComercial = resumenDe(opp, row, conv, intel.etapaCotizacion);
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
    resumenComercial,
    estancado: intel.estancado,
    oportunidadId: opp?.id ?? null,
    encajeEconomico: conv?.encajeEconomico ?? campos.encajeEconomico ?? null,
    intencionNivel: campos.intencionNivel ?? null,
    rutaComercial: conv?.rutaComercial ?? campos.rutaComercial ?? null,
    conversacionId: conv?.id ?? null,
    estadoBot: conv?.estadoBot ?? null,
    asesorLockId: conv?.asesorLockId ?? null,
    ultimoMensaje: ultimoMensajeDe(conv),
  };
}

export function toOportunidadResumen(
  o: Oportunidad,
  ctx: { ultimoContactoEn: Date; estadoAtencion: string; conv?: Conversacion },
): OportunidadResumenDto {
  const intel = intelDe(o, ctx, ctx.conv);
  const resumenComercial = resumenDe(o, ctx, ctx.conv, intel.etapaCotizacion);
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
    resumenComercial,
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
    conversaciones: row.conversaciones.map((c) => {
      const campos = camposCapturadosDe(c.camposCapturados);
      return {
        id: c.id,
        canal: c.canal,
        externalThreadId: c.externalThreadId,
        estadoBot: c.estadoBot,
        encajeEconomico: c.encajeEconomico ?? campos.encajeEconomico ?? null,
        intencionNivel: campos.intencionNivel ?? null,
        rutaComercial: c.rutaComercial ?? campos.rutaComercial ?? null,
        asesorLockId: c.asesorLockId ?? null,
        slaVenceEn: c.slaVenceEn?.toISOString() ?? null,
        motivoHandoff: c.motivoHandoff ?? null,
        fechaEstado: campos.fechaEstado ?? null,
        fechaEvento: labelFechaEventoBrief(campos),
        rangoInversion: campos.rangoInversion ?? null,
        rangoPresupuestoFuera: campos.rangoPresupuestoFuera ?? null,
        pdfEnviado: Boolean(campos.pdfEnviado),
      };
    }),
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
  return derivarInteligencia(inteligenciaInputDe(fuenteDe(opp, ctx, conv)));
}

function resumenDe(
  opp: Oportunidad | undefined,
  ctx: { ultimoContactoEn: Date; estadoAtencion: string },
  conv: Conversacion | undefined,
  etapaCotizacion: ReturnType<typeof derivarInteligencia>["etapaCotizacion"],
) {
  if (!opp && !conv) return null;
  const fuente = fuenteDe(opp, ctx, conv);
  return derivarResumenComercialBot({
    etapa: fuente.etapa,
    etapaCotizacion,
    listoParaCotizar: fuente.listoParaCotizar,
    visitaEstado: fuente.visitaEstado,
    intencionVisita: fuente.intencionVisita,
    propuestaEnviadaEn: fuente.propuestaEnviadaEn,
    pasoGuion: fuente.pasoGuion,
    estadoBot: conv?.estadoBot ?? null,
    estadoAtencion: ctx.estadoAtencion,
    cola: conv?.cola ?? null,
    rutaComercial: conv?.rutaComercial ?? fuente.campos?.rutaComercial ?? null,
    encajeEconomico: conv?.encajeEconomico ?? fuente.campos?.encajeEconomico ?? null,
    fechaColumna: fuente.fechaTentativa,
    campos: fuente.campos ?? {},
  });
}

function fuenteDe(
  opp: Oportunidad | undefined,
  ctx: { ultimoContactoEn: Date; estadoAtencion: string },
  conv?: Conversacion,
) {
  const campos = camposCapturadosDe(conv?.camposCapturados);
  return {
    tipoEvento: opp?.tipoEvento ?? campos.tipoEvento ?? null,
    calificacion: opp?.calificacion ?? "en_exploracion",
    listoParaCotizar: opp?.listoParaCotizar ?? false,
    paqueteTentativoId: opp?.paqueteTentativoId ?? null,
    etapa: opp?.etapa ?? "nuevo_bot",
    propuestaEnviadaEn: opp?.propuestaEnviadaEn ?? null,
    visitaEstado: opp?.visitaEstado ?? "no_solicitada",
    intencionVisita: opp?.intencionVisita ?? Boolean(campos.intencionVisita),
    fechaTentativa: opp?.fechaTentativa ?? null,
    aforo: opp?.aforo ?? campos.aforo ?? null,
    sede: opp?.sede ?? campos.sedeNombre ?? null,
    campos,
    motivoHandoff: conv?.motivoHandoff ?? null,
    ultimaRuta: conv?.ultimaRuta ?? null,
    pasoGuion: conv?.pasoGuion ?? null,
    ultimoContactoEn: ctx.ultimoContactoEn,
    estadoAtencion: ctx.estadoAtencion,
  };
}

function ultimoMensajeDe(
  conv: ConversacionListRow | undefined,
): UltimoMensajeDto | null {
  const msg = conv?.mensajes?.[0];
  if (!msg) return null;
  return {
    contenido: previewMensaje(msg.contenido),
    autor: msg.autor,
    direccion: msg.direccion,
    creadoEn: msg.creadoEn.toISOString(),
  };
}

function previewMensaje(contenido: string): string {
  const t = contenido.replace(/\s+/g, " ").trim();
  return t.length <= 120 ? t : `${t.slice(0, 119)}…`;
}

