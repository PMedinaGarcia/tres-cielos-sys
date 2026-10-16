"use client";

import type { HistorialItemDto, TipoInteraccion } from "@tres-cielos/shared";
import Link from "next/link";
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
];

type Props = {
  clienteId: string;
  items: HistorialItemDto[];
  total: number;
  tipo: string;
  onTipo: (tipo: string) => void;
  loading?: boolean;
};

export function HistorialFeed({
  clienteId,
  items,
  total,
  tipo,
  onTipo,
  loading,
}: Props) {
  return (
    <section className="glass flex min-h-0 flex-1 flex-col overflow-hidden rounded-glass">
      <header className="shrink-0 border-b border-white/50 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-base text-ink">Historial</h2>
            <p className="text-[11px] text-ink/45">
              {loading ? "Cargando…" : `${total} eventos · vinculado a bandeja`}
            </p>
          </div>
          <Link
            href={`/bandeja?c=${clienteId}`}
            className="rounded-lg border border-teal/25 px-3 py-1.5 text-[11px] font-medium text-teal transition hover:bg-teal/8"
          >
            Ver conversación
          </Link>
        </div>
        <div className="mt-3 flex gap-1 overflow-x-auto pb-0.5">
          {FILTROS.map((f) => (
            <button
              key={f.id || "all"}
              type="button"
              onClick={() => onTipo(f.id)}
              className={`shrink-0 rounded-full px-3 py-1 text-[11px] transition ${
                tipo === f.id
                  ? "bg-teal text-white"
                  : "bg-white/40 text-ink/65 hover:bg-white/60"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {loading ? (
          <p className="text-sm text-ink/50">Cargando historial…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-ink/55">Sin historial todavía.</p>
        ) : (
          <ol className="relative space-y-0 border-l-2 border-teal/15 pl-5">
            {items.map((item, i) => (
              <li key={item.id} className="animate-timeline pb-5 last:pb-0" style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}>
                <HistorialRow item={item} clienteId={clienteId} />
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}

function HistorialRow({
  item,
  clienteId,
}: {
  item: HistorialItemDto;
  clienteId: string;
}) {
  const linked = item.vinculo === "posible_duplicado";
  const isMsg = item.kind === "mensaje";
  const isRecontacto = item.tipo === "recontacto";
  const inbound = item.direccion === "entrante";
  const abreBandeja = isMsg || isRecontacto || item.tipo === "handoff";

  const dotClass = linked
    ? "bg-amber-400 ring-amber-200"
    : isRecontacto
      ? "bg-amber-500 ring-amber-200"
      : isMsg
        ? inbound
          ? "bg-white ring-teal/30"
          : "bg-teal ring-teal/30"
        : "bg-celeste ring-white/80";

  return (
    <article className="relative -ml-[1.625rem] pl-0">
      <span
        className={`absolute left-0 top-3 h-2.5 w-2.5 -translate-x-[calc(50%+1px)] rounded-full ring-4 ${dotClass}`}
        aria-hidden
      />
      <div
        className={`ml-2 rounded-2xl border px-3.5 py-3 text-sm ${
          linked
            ? "border-amber-400/35 bg-amber-50/45"
            : isRecontacto
              ? "border-amber-400/30 bg-gradient-to-br from-amber-50/80 to-white/50"
              : isMsg
                ? inbound
                  ? "border-white/60 bg-white/55"
                  : "border-teal/20 bg-teal/5"
                : "border-white/50 bg-white/35"
        }`}
      >
        <header className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-ink/50">
          <span className="font-semibold uppercase tracking-wide text-ink/70">
            {TIPO_HECHO_LABEL[item.tipo as TipoInteraccion] ?? item.tipo}
          </span>
          {isRecontacto ? (
            <span className="rounded-full bg-amber-200/80 px-2 py-0.5 text-[10px] font-medium text-amber-900">
              Re-contacto
            </span>
          ) : null}
          <span className="text-ink/40">{item.actor}</span>
          {item.canal ? <span className="text-ink/40">{item.canal}</span> : null}
          <span className="ml-auto text-ink/45">{formatWhen(item.creadoEn)}</span>
        </header>
        <p className="whitespace-pre-wrap break-words text-ink/90">{item.contenido}</p>
        {item.adjuntos.length > 0 ? (
          <ul className="mt-1.5 text-xs text-ink/55">
            {item.adjuntos.map((a, i) => (
              <li key={`${item.id}-adj-${i}`}>
                Adjunto: {a.nombreOriginal ?? a.mimeType}
              </li>
            ))}
          </ul>
        ) : null}
        <footer className="mt-2 flex flex-wrap items-center gap-2">
          {abreBandeja ? (
            <Link
              href={`/bandeja?c=${clienteId}`}
              className="text-[11px] font-medium text-teal hover:underline"
            >
              Ir a bandeja {"\u2192"}
            </Link>
          ) : null}
          {linked ? (
            <span className="text-[11px] text-amber-800">
              Expediente vinculado
              {item.vinculoClienteId ? ` · ${item.vinculoClienteId.slice(0, 8)}…` : ""}
            </span>
          ) : null}
        </footer>
      </div>
    </article>
  );
}
