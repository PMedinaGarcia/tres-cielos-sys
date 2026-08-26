"use client";

import type {
  ActualizarOportunidadRequest,
  ClienteDetail,
  EtapaCotizacion,
  OportunidadResumenDto,
  VisitaEstado,
} from "@tres-cielos/shared";
import {
  ETAPA_COTIZACION_LABEL,
  ETAPA_LABEL,
  formatWhen,
  TIPO_EVENTO_LABEL,
  VISITA_LABEL,
} from "./labels";
import { FormEvent, useState } from "react";

const PLAYBOOK_BODA: EtapaCotizacion[] = [
  "perfilando",
  "explorando",
  "listo_para_cotizar",
  "propuesta_enviada",
];
const PLAYBOOK_SIN_TARIFA: EtapaCotizacion[] = [
  "perfilando",
  "sin_tarifa",
  "propuesta_enviada",
];

const VISITA_ACCIONES: Array<{ id: VisitaEstado; label: string }> = [
  { id: "agendada", label: "Marcar agendada" },
  { id: "realizada", label: "Realizada" },
  { id: "cancelada", label: "Cancelar" },
  { id: "no_asistio", label: "No asistió" },
];

function playbookDe(tipo: string | null): EtapaCotizacion[] {
  return tipo === "boda" ? PLAYBOOK_BODA : PLAYBOOK_SIN_TARIFA;
}

function pasoHecho(paso: EtapaCotizacion, actual: EtapaCotizacion): boolean {
  const order: EtapaCotizacion[] = [
    "perfilando",
    "explorando",
    "sin_tarifa",
    "listo_para_cotizar",
    "propuesta_enviada",
    "negociacion",
    "ganado",
    "perdido",
  ];
  return order.indexOf(paso) <= order.indexOf(actual);
}

function skuFromBrief(brief: unknown): string | null {
  if (!brief || typeof brief !== "object") return null;
  const paquete = (brief as { paquete?: { paqueteId?: string } }).paquete;
  return paquete?.paqueteId ?? null;
}

type Props = {
  cliente: ClienteDetail;
  busy?: boolean;
  onPatch: (oportunidadId: string, body: ActualizarOportunidadRequest) => Promise<void>;
};

export function OportunidadPanel({ cliente, busy, onPatch }: Props) {
  if (cliente.oportunidades.length === 0) {
    return <p className="text-sm text-ink/55">Sin oportunidades todavía.</p>;
  }
  return (
    <ul className="space-y-4">
      {cliente.oportunidades.map((o) => (
        <OportunidadCard
          key={o.id}
          o={o}
          busy={busy}
          onPatch={onPatch}
        />
      ))}
      <li className="text-xs text-ink/45">
        {cliente.conversaciones.length} hilo
        {cliente.conversaciones.length === 1 ? "" : "s"}
        {cliente.conversaciones.map((c) => (
          <span key={c.id} className="ml-2">
            {c.canal}
            {c.estadoBot ? ` · ${c.estadoBot}` : ""}
          </span>
        ))}
      </li>
    </ul>
  );
}

function OportunidadCard({
  o,
  busy,
  onPatch,
}: {
  o: OportunidadResumenDto;
  busy?: boolean;
  onPatch: Props["onPatch"];
}) {
  const [visitaEn, setVisitaEn] = useState("");
  const playbook = playbookDe(o.tipoEvento);
  const sku = o.paqueteTentativoId ?? skuFromBrief(o.briefJson);

  async function onVisita(e: FormEvent, estado: VisitaEstado) {
    e.preventDefault();
    await onPatch(o.id, {
      visitaEstado: estado,
      visitaAgendadaEn: visitaEn ? new Date(visitaEn).toISOString() : undefined,
    });
  }

  return (
    <li className="rounded-2xl border border-white/60 bg-white/40 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-display text-teal">
          {ETAPA_COTIZACION_LABEL[o.etapaCotizacion] ?? o.etapaCotizacion}
        </span>
        {o.listoParaCotizar ? (
          <span className="rounded-full bg-teal/15 px-2 py-0.5 text-[11px] text-teal">
            Listo para cotizar
          </span>
        ) : null}
        <span className="text-[11px] text-ink/45">
          Pipeline: {ETAPA_LABEL[o.etapa] ?? o.etapa}
        </span>
      </div>
      <p className="mt-1 text-xs text-ink/70">{o.siguienteAccion}</p>
      <ol className="mt-3 space-y-1 text-xs">
        {playbook.map((paso) => (
          <li key={paso} className="flex items-center gap-2 text-ink/70">
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                pasoHecho(paso, o.etapaCotizacion) ? "bg-teal" : "bg-ink/20"
              }`}
            />
            {ETAPA_COTIZACION_LABEL[paso]}
          </li>
        ))}
        <li className="flex items-center gap-2 text-ink/70">
          <span
            className={`inline-block h-2 w-2 rounded-full ${
              o.visitaEstado !== "no_solicitada" ? "bg-teal" : "bg-ink/20"
            }`}
          />
          Visita: {VISITA_LABEL[o.visitaEstado]}
        </li>
      </ol>
      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-ink/70">
        <div>
          <dt className="uppercase tracking-wide text-ink/40">Evento</dt>
          <dd>{TIPO_EVENTO_LABEL[o.tipoEvento ?? ""] ?? o.tipoEvento ?? "—"}</dd>
        </div>
        <div>
          <dt className="uppercase tracking-wide text-ink/40">Aforo</dt>
          <dd>{o.aforo ?? "—"}</dd>
        </div>
        <div>
          <dt className="uppercase tracking-wide text-ink/40">Fecha</dt>
          <dd>{o.fechaTentativa ? formatWhen(o.fechaTentativa) : "—"}</dd>
        </div>
        <div>
          <dt className="uppercase tracking-wide text-ink/40">Sede</dt>
          <dd>{o.sede ?? "—"}</dd>
        </div>
        <div>
          <dt className="uppercase tracking-wide text-ink/40">Calificación</dt>
          <dd>{o.calificacion}</dd>
        </div>
        <div>
          <dt className="uppercase tracking-wide text-ink/40">SKU</dt>
          <dd>{sku ?? "—"}</dd>
        </div>
      </dl>
      {o.visitaAgendadaEn ? (
        <p className="mt-2 text-xs text-ink/60">
          Cita: {formatWhen(o.visitaAgendadaEn)}
        </p>
      ) : null}

      <form className="mt-3 space-y-2 border-t border-white/50 pt-3">
        <label className="block text-[11px] uppercase tracking-wide text-ink/40">
          Fecha de visita
          <input
            type="datetime-local"
            className="glass-input mt-1"
            value={visitaEn}
            onChange={(e) => setVisitaEn(e.target.value)}
          />
        </label>
        <div className="flex flex-wrap gap-2">
          {VISITA_ACCIONES.map((a) => (
            <button
              key={a.id}
              type="button"
              disabled={busy}
              onClick={(e) => void onVisita(e, a.id)}
              className="rounded-full bg-white/70 px-3 py-1 text-[11px] text-teal disabled:opacity-50"
            >
              {a.label}
            </button>
          ))}
        </div>
        {!o.propuestaEnviadaEn ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void onPatch(o.id, { marcarPropuestaEnviada: true })}
            className="btn-teal mt-1 text-xs"
          >
            Marcar propuesta enviada
          </button>
        ) : (
          <p className="text-xs text-ink/55">
            Propuesta enviada {formatWhen(o.propuestaEnviadaEn)}
          </p>
        )}
      </form>
    </li>
  );
}
