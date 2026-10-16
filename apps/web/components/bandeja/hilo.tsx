"use client";

import {
  TIPO_HECHO_LABEL,
  displayName,
  formatWhen,
} from "@/components/crm/labels";
import type {
  ClienteDetail,
  ConversacionResumenDto,
  HistorialItemDto,
  TipoInteraccion,
} from "@tres-cielos/shared";
import type { ReactNode } from "react";
import { useEffect, useRef } from "react";

const HECHOS = new Set<string>([
  "toma_control",
  "handoff",
  "cambio_etapa",
  "cambio_visita",
  "propuesta_enviada",
  "brief_actualizado",
  "cambio_estado_atencion",
]);

type Props = {
  cliente: ClienteDetail | null;
  items: HistorialItemDto[];
  loading: boolean;
  userId?: string;
  onBack: () => void;
  onDatos: () => void;
  onTomar: () => void;
  onDevolver: () => void;
  busy: boolean;
  composer: ReactNode;
};

export function Hilo({
  cliente,
  items,
  loading,
  userId,
  onBack,
  onDatos,
  onTomar,
  onDevolver,
  busy,
  composer,
}: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  const conv = cliente?.conversaciones[0] ?? null;

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [items, cliente?.id]);

  if (!cliente) {
    return (
      <section className="glass flex h-full min-h-0 flex-col items-center justify-center rounded-glass px-6 text-center text-sm text-ink/45">
        {loading ? "Cargando hilo…" : "Elige un cliente para ver el hilo y responder."}
      </section>
    );
  }

  const estado = estadoDe(conv, userId);
  const visible = items.filter(
    (item) => item.kind === "mensaje" || HECHOS.has(item.tipo),
  );
  const puedeTomar = conv != null && conv.estadoBot !== "humano" && !ajeno(conv, userId);
  const puedeDevolver =
    conv != null && conv.estadoBot === "humano" && !ajeno(conv, userId);

  return (
    <section className="glass flex h-full min-h-0 flex-col overflow-hidden rounded-glass">
      <header className="flex items-start gap-2 border-b border-white/50 px-3 py-2.5">
        <button
          type="button"
          onClick={onBack}
          className="mt-0.5 rounded-lg px-2 py-1 text-xs text-teal lg:hidden"
        >
          ?
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-display text-lg leading-tight text-ink">
            {displayName(cliente.nombre)}
          </h2>
          <p className="truncate text-[11px] text-ink/50">
            {cliente.telefono ?? "sin teléfono"}
            {conv?.canal ? ` · ${conv.canal}` : ""}
          </p>
          <p className={`mt-1 text-[11px] ${estado.clase}`}>{estado.label}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <button
            type="button"
            onClick={onDatos}
            className="rounded-lg px-2 py-1 text-[11px] text-teal xl:hidden"
          >
            Datos
          </button>
          {puedeTomar ? (
            <button
              type="button"
              disabled={busy}
              onClick={onTomar}
              className="rounded-lg border border-teal/30 px-2 py-1 text-[11px] text-teal disabled:opacity-40"
            >
              Silenciar bot
            </button>
          ) : null}
          {puedeDevolver ? (
            <button
              type="button"
              disabled={busy}
              onClick={onDevolver}
              className="rounded-lg px-2 py-1 text-[11px] text-ink/50 disabled:opacity-40"
            >
              Devolver al bot
            </button>
          ) : null}
        </div>
      </header>
      <div ref={scroller} className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-3">
        {loading && visible.length === 0 ? (
          <p className="text-xs text-ink/40">Cargando hilo…</p>
        ) : null}
        {!loading && visible.length === 0 ? (
          <p className="text-xs text-ink/40">Todavía no hay mensajes.</p>
        ) : null}
        {visible.map((item) =>
          item.kind === "mensaje" ? (
            <Burbuja key={item.id} item={item} />
          ) : (
            <p key={item.id} className="py-0.5 text-center text-[11px] text-ink/40">
              {TIPO_HECHO_LABEL[item.tipo as TipoInteraccion] ?? item.tipo}
              {item.contenido ? ` · ${item.contenido}` : ""}
            </p>
          ),
        )}
      </div>
      {composer}
    </section>
  );
}

function Burbuja({ item }: { item: HistorialItemDto }) {
  const asesor = item.autorMensaje === "asesor" || item.actor === "asesor";
  const bot = !asesor && (item.autorMensaje === "bot" || item.actor === "bot");
  const propia = asesor || bot;
  const quien = asesor ? "Tú" : bot ? "Bot" : "Cliente";
  return (
    <div className={`flex ${propia ? "justify-end" : "justify-start"}`}>
      <div className="max-w-[85%]">
        <p className={`mb-0.5 text-[10px] text-ink/35 ${propia ? "text-right" : ""}`}>
          {quien}
          <span className="ml-1">{formatWhen(item.creadoEn)}</span>
        </p>
        <p
          className={`whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm leading-snug ${
            asesor
              ? "rounded-br-md bg-teal text-white"
              : bot
                ? "rounded-br-md border border-white/70 bg-white/35 text-ink/75"
                : "rounded-bl-md border border-white/70 bg-white/80 text-ink"
          }`}
        >
          {item.contenido}
        </p>
      </div>
    </div>
  );
}

function ajeno(conv: ConversacionResumenDto, userId?: string): boolean {
  return Boolean(conv.asesorLockId && userId && conv.asesorLockId !== userId);
}

function estadoDe(
  conv: ConversacionResumenDto | null,
  userId?: string,
): { label: string; clase: string } {
  if (!conv) return { label: "Sin hilo", clase: "text-ink/40" };
  if (ajeno(conv, userId)) {
    return { label: "Otro asesor", clase: "text-amber-800" };
  }
  if (conv.estadoBot === "humano") {
    return {
      label: conv.asesorLockId === userId ? "En atención · tú" : "En atención",
      clase: "text-teal",
    };
  }
  if (conv.estadoBot === "escalado") {
    const partes = ["Escalado"];
    if (conv.motivoHandoff) partes.push(conv.motivoHandoff.replaceAll("_", " "));
    const sla = slaDe(conv.slaVenceEn);
    if (sla) partes.push(sla);
    return { label: partes.join(" · "), clase: "text-red-800" };
  }
  return { label: "Bot activo", clase: "text-ink/45" };
}

function slaDe(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (Number.isNaN(ms)) return null;
  if (ms <= 0) return "fuera de ventana";
  const min = Math.max(1, Math.round(ms / 60_000));
  return `${min} min`;
}
