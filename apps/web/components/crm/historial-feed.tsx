"use client";

import type { HistorialItemDto, TipoInteraccion } from "@tres-cielos/shared";
import { formatWhen, TIPO_HECHO_LABEL } from "./labels";

const FILTROS: Array<{ id: string; label: string }> = [
  { id: "", label: "Todo" },
  { id: "mensaje", label: "Mensajes" },
  { id: "recontacto", label: "Recontacto" },
  { id: "nota", label: "Notas" },
  { id: "handoff", label: "Handoff" },
  { id: "intencion_cotizar", label: "Cotizar" },
  { id: "cambio_visita", label: "Visita" },
  { id: "propuesta_enviada", label: "Propuesta" },
  { id: "posible_duplicado", label: "Duplicados" },
];

type Props = {
  items: HistorialItemDto[];
  total: number;
  tipo: string;
  onTipo: (tipo: string) => void;
  loading?: boolean;
};

export function HistorialFeed({ items, total, tipo, onTipo, loading }: Props) {
  return (
    <div className="flex min-h-0 flex-col gap-3">
      <div className="flex flex-wrap gap-1">
        {FILTROS.map((f) => (
          <button
            key={f.id || "all"}
            type="button"
            onClick={() => onTipo(f.id)}
            className={`rounded-full px-3 py-1 text-xs transition ${
              tipo === f.id
                ? "bg-white/80 text-teal"
                : "bg-white/30 text-ink/70 hover:bg-white/50"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-ink/50">{total} hechos en el expediente</p>
      {loading ? (
        <p className="text-sm text-ink/50">Cargando historial…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-ink/55">Sin historial todavía.</p>
      ) : (
        <ol className="space-y-2">
          {items.map((item) => (
            <li key={item.id}>
              <HistorialRow item={item} />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function HistorialRow({ item }: { item: HistorialItemDto }) {
  const linked = item.vinculo === "posible_duplicado";
  const isMsg = item.kind === "mensaje";
  const inbound = item.direccion === "entrante";
  return (
    <article
      className={`rounded-2xl border px-3.5 py-3 text-sm ${
        linked
          ? "border-amber-400/40 bg-amber-50/50"
          : isMsg
            ? inbound
              ? "border-white/60 bg-white/55"
              : "border-teal/20 bg-teal/5"
            : "border-white/50 bg-white/35"
      }`}
    >
      <header className="mb-1 flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-wide text-ink/50">
        <span>{TIPO_HECHO_LABEL[item.tipo as TipoInteraccion] ?? item.tipo}</span>
        <span>{item.actor}</span>
        {item.canal ? <span>{item.canal}</span> : null}
        <span className="ml-auto normal-case tracking-normal">
          {formatWhen(item.creadoEn)}
        </span>
      </header>
      <p className="whitespace-pre-wrap break-words text-ink/90">{item.contenido}</p>
      {item.adjuntos.length > 0 ? (
        <ul className="mt-1 text-xs text-ink/55">
          {item.adjuntos.map((a, i) => (
            <li key={`${item.id}-adj-${i}`}>
              Adjunto: {a.nombreOriginal ?? a.mimeType}
            </li>
          ))}
        </ul>
      ) : null}
      {linked ? (
        <p className="mt-2 text-xs text-amber-800">
          Historial de otro expediente vinculado
          {item.vinculoClienteId ? ` (${item.vinculoClienteId.slice(0, 8)}…)` : ""}.
        </p>
      ) : null}
    </article>
  );
}
