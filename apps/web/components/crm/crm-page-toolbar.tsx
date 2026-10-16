"use client";

import {
  COLA_LABEL,
  ESTADO_ATENCION_LABEL,
  TIPO_EVENTO_LABEL,
} from "@/components/crm/labels";
import type { ColaCrm, EstadoAtencion } from "@tres-cielos/shared";
import { COLA_CRM, ESTADO_ATENCION, TIPO_EVENTO } from "@tres-cielos/shared";
import { FormEvent, useState } from "react";

const EM_DASH = "\u2014";

type Props = {
  cola: string;
  onCola: (cola: string) => void;
  q: string;
  onQ: (value: string) => void;
  onSearch: (e: FormEvent) => void;
  estado: string;
  onEstado: (value: string) => void;
  tipoEvento: string;
  onTipoEvento: (value: string) => void;
  sinAsignar: boolean;
  onSinAsignar: (value: boolean) => void;
  total: number;
  loading: boolean;
};

export function CrmPageToolbar({
  cola,
  onCola,
  q,
  onQ,
  onSearch,
  estado,
  onEstado,
  tipoEvento,
  onTipoEvento,
  sinAsignar,
  onSinAsignar,
  total,
  loading,
}: Props) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const activeFilters =
    (estado ? 1 : 0) + (tipoEvento ? 1 : 0) + (sinAsignar ? 1 : 0);

  return (
    <section className="glass-strong relative overflow-hidden rounded-glass px-6 py-6 animate-rise md:px-8 md:py-7">
      <div
        className="pointer-events-none absolute -right-12 -top-16 h-40 w-40 rounded-full bg-teal/12 blur-3xl"
        aria-hidden
      />
      <div className="relative space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-teal">
              Operaciones
            </p>
            <h1 className="font-display text-3xl leading-tight text-ink md:text-[2.35rem]">
              CRM
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink/60">
              Cotizaci{"\u00f3"}n y visitas al jard{"\u00ed"}n: qui{"\u00e9"}n
              qued{"\u00f3"} sin cita o en qu{"\u00e9"} etapa se detuvo el flujo.
            </p>
          </div>
          <div className="rounded-2xl border border-white/70 bg-white/40 px-4 py-3 text-right shadow-sm">
            <p className="text-[10px] font-medium uppercase tracking-wider text-ink/45">
              En esta vista
            </p>
            <p className="font-display text-2xl leading-none text-ink tabular-nums">
              {loading ? EM_DASH : total}
            </p>
            <p className="mt-0.5 text-[11px] text-ink/50">
              {loading
                ? "Actualizando\u2026"
                : `cliente${total === 1 ? "" : "s"}`}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-[11px] font-medium uppercase tracking-wider text-ink/45">
            Cola
          </p>
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <ColaChip active={cola === ""} onClick={() => onCola("")}>
              Todos
            </ColaChip>
            {COLA_CRM.map((id) => (
              <ColaChip
                key={id}
                active={cola === id}
                onClick={() => onCola(id)}
              >
                {COLA_LABEL[id as ColaCrm]}
              </ColaChip>
            ))}
          </div>
        </div>

        <form onSubmit={onSearch} className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative min-w-0 flex-1">
              <input
                className="glass-input pr-24"
                placeholder={`Nombre, tel\u00e9fono, correo o wa_id\u2026`}
                value={q}
                onChange={(e) => onQ(e.target.value)}
                aria-label="Buscar clientes"
              />
              <button
                type="submit"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg bg-teal px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-teal-dark"
              >
                Buscar
              </button>
            </div>
            <button
              type="button"
              onClick={() => setFiltersOpen((v) => !v)}
              className="btn-ghost shrink-0 gap-2 px-4 py-2.5 text-xs"
              aria-expanded={filtersOpen}
            >
              Filtros
              {activeFilters > 0 ? (
                <span className="rounded-full bg-teal/15 px-1.5 py-0.5 text-[10px] font-semibold text-teal">
                  {activeFilters}
                </span>
              ) : null}
            </button>
          </div>

          {filtersOpen ? (
            <div className="grid gap-3 rounded-2xl border border-white/60 bg-white/30 p-4 sm:grid-cols-2 lg:grid-cols-4">
              <label className="text-[11px] font-medium uppercase tracking-wider text-ink/45">
                Rubro
                <select
                  className="glass-input mt-1.5 text-sm"
                  value={tipoEvento}
                  onChange={(e) => onTipoEvento(e.target.value)}
                >
                  <option value="">Todos</option>
                  {TIPO_EVENTO.map((t) => (
                    <option key={t} value={t}>
                      {TIPO_EVENTO_LABEL[t] ?? t}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-[11px] font-medium uppercase tracking-wider text-ink/45">
                Atenci{"\u00f3"}n
                <select
                  className="glass-input mt-1.5 text-sm"
                  value={estado}
                  onChange={(e) => onEstado(e.target.value)}
                >
                  <option value="">Todos</option>
                  {ESTADO_ATENCION.map((s) => (
                    <option key={s} value={s}>
                      {ESTADO_ATENCION_LABEL[s as EstadoAtencion]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-end gap-2 pb-2.5 text-sm text-ink/70 sm:col-span-2 lg:col-span-2">
                <input
                  type="checkbox"
                  className="rounded border-white/80 text-teal focus:ring-teal/30"
                  checked={sinAsignar}
                  onChange={(e) => onSinAsignar(e.target.checked)}
                />
                Solo sin asesor asignado
              </label>
            </div>
          ) : null}
        </form>
      </div>
    </section>
  );
}

function ColaChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs transition ${
        active
          ? "bg-white font-medium text-teal shadow-sm ring-1 ring-white/80"
          : "bg-white/25 text-ink/60 hover:bg-white/45 hover:text-ink/80"
      }`}
    >
      {children}
    </button>
  );
}
