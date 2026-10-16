"use client";

import {
  ETAPA_COTIZACION_LABEL,
  ETAPA_COTIZACION_LABEL_COMPACT,
  ETAPA_LABEL,
  VISITA_LABEL,
  VISITA_LABEL_COMPACT,
  formatWhen,
} from "@/components/crm/labels";
import { pasoHecho, playbookDe } from "@/components/crm/oportunidad-panel";
import type {
  ActualizarOportunidadRequest,
  EtapaPipeline,
  MotivoPerdido,
  OportunidadResumenDto,
  VisitaEstado,
} from "@tres-cielos/shared";
import { ETAPA_PIPELINE, MOTIVO_PERDIDO, VISITA_ESTADO } from "@tres-cielos/shared";
import { useState } from "react";

const MOTIVO_LABEL: Record<MotivoPerdido, string> = {
  precio: "Precio",
  fecha: "Fecha",
  competencia: "Competencia",
  sin_respuesta: "Sin respuesta",
  otro: "Otro",
};

const fieldLabel =
  "block min-w-0 text-[10px] font-medium uppercase tracking-wide text-ink/40";
const fieldControl = "glass-input-sm mt-0.5 min-w-0 max-w-full";

type Props = {
  oportunidad: OportunidadResumenDto;
  busy?: boolean;
  onPatch: (id: string, body: ActualizarOportunidadRequest) => Promise<void>;
};

export function EtapaCompacta({ oportunidad, busy, onPatch }: Props) {
  const [visita, setVisita] = useState<VisitaEstado>(oportunidad.visitaEstado);
  const [visitaEn, setVisitaEn] = useState(aLocal(oportunidad.visitaAgendadaEn));
  const [motivo, setMotivo] = useState<MotivoPerdido | "">(
    (oportunidad.motivoPerdido as MotivoPerdido | null) ?? "",
  );
  const [pedirMotivo, setPedirMotivo] = useState(false);
  const playbook = playbookDe(oportunidad.tipoEvento);

  async function cambiarEtapa(etapa: EtapaPipeline) {
    if (etapa === oportunidad.etapa && etapa !== "perdido") return;
    if (etapa === "perdido") {
      setPedirMotivo(true);
      return;
    }
    setPedirMotivo(false);
    await onPatch(oportunidad.id, { etapa });
  }

  return (
    <section className="min-w-0 space-y-3">
      <div className="min-w-0 space-y-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-teal">
          Etapa comercial
        </h3>
        <ol className="space-y-1" aria-label="Progreso de cotización">
          {playbook.map((paso) => {
            const hecho = pasoHecho(paso, oportunidad.etapaCotizacion);
            const largo = ETAPA_COTIZACION_LABEL[paso];
            const corto = ETAPA_COTIZACION_LABEL_COMPACT[paso];
            return (
              <li
                key={paso}
                className={`flex min-w-0 items-center gap-2 text-[11px] leading-snug ${
                  hecho ? "text-teal" : "text-ink/40"
                }`}
                title={largo}
              >
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                    hecho ? "bg-teal" : "bg-ink/20"
                  }`}
                  aria-hidden
                />
                <span className="min-w-0 truncate">{corto}</span>
              </li>
            );
          })}
        </ol>
        <p
          className="line-clamp-3 break-words text-xs leading-snug text-ink/70"
          title={oportunidad.siguienteAccion}
        >
          Siguiente: {oportunidad.siguienteAccion}
        </p>
      </div>

      <label className={fieldLabel}>
        Pipeline
        <select
          className={fieldControl}
          value={oportunidad.etapa}
          disabled={busy}
          onChange={(e) => void cambiarEtapa(e.target.value as EtapaPipeline)}
        >
          {ETAPA_PIPELINE.map((etapa) => (
            <option key={etapa} value={etapa}>
              {ETAPA_LABEL[etapa] ?? etapa}
            </option>
          ))}
        </select>
      </label>

      {pedirMotivo ? (
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-end">
          <label className={`min-w-0 flex-1 ${fieldLabel}`}>
            Motivo
            <select
              className={fieldControl}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value as MotivoPerdido)}
            >
              <option value="">Elegir…</option>
              {MOTIVO_PERDIDO.map((id) => (
                <option key={id} value={id}>
                  {MOTIVO_LABEL[id]}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="btn-teal w-full shrink-0 px-2.5 py-1.5 text-[11px] sm:w-auto"
            disabled={busy || !motivo}
            onClick={() =>
              void onPatch(oportunidad.id, {
                etapa: "perdido",
                motivoPerdido: motivo || null,
              }).then(() => setPedirMotivo(false))
            }
          >
            Cerrar
          </button>
        </div>
      ) : null}

      <div className="min-w-0 space-y-2 rounded-xl border border-white/50 bg-white/25 p-2.5">
        <label className={fieldLabel}>
          Visita
          <select
            className={fieldControl}
            value={visita}
            disabled={busy}
            onChange={(e) => setVisita(e.target.value as VisitaEstado)}
            title={VISITA_LABEL[visita]}
          >
            {VISITA_ESTADO.map((id) => (
              <option key={id} value={id} title={VISITA_LABEL[id]}>
                {VISITA_LABEL_COMPACT[id]}
              </option>
            ))}
          </select>
        </label>
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
          <label className={`min-w-0 ${fieldLabel}`}>
            Fecha
            <input
              type="datetime-local"
              className={fieldControl}
              value={visitaEn}
              disabled={busy}
              onChange={(e) => setVisitaEn(e.target.value)}
            />
          </label>
          <button
            type="button"
            disabled={busy}
            className="btn-teal shrink-0 self-end whitespace-nowrap px-2.5 py-1.5 text-[11px]"
            onClick={() =>
              void onPatch(oportunidad.id, {
                visitaEstado: visita,
                visitaAgendadaEn: visitaEn ? new Date(visitaEn).toISOString() : undefined,
              })
            }
          >
            Agendar
          </button>
        </div>
      </div>

      {oportunidad.propuestaEnviadaEn ? (
        <p className="line-clamp-2 text-[11px] leading-snug text-ink/50">
          Propuesta enviada {formatWhen(oportunidad.propuestaEnviadaEn)}
        </p>
      ) : (
        <button
          type="button"
          disabled={busy}
          className="max-w-full text-left text-[11px] leading-snug text-teal underline-offset-2 hover:underline disabled:opacity-40"
          onClick={() => void onPatch(oportunidad.id, { marcarPropuestaEnviada: true })}
        >
          Marcar propuesta enviada
        </button>
      )}
    </section>
  );
}

function aLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
