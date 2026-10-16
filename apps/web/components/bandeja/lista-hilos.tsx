"use client";

import { PanelEdgeToggle } from "@/components/bandeja/panel-edge-toggle";
import {
  COLA_LABEL,
  ETAPA_COTIZACION_LABEL,
  displayName,
  formatRelativo,
} from "@/components/crm/labels";
import type { ClienteListItem, ColaCrm, EtapaCotizacion } from "@tres-cielos/shared";
import { COLA_CRM } from "@tres-cielos/shared";

type Props = {
  q: string;
  onQ: (value: string) => void;
  cola: string;
  onCola: (cola: string) => void;
  rows: ClienteListItem[];
  total: number;
  loading: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCollapseBandeja?: () => void;
};

export function ListaHilos({
  q,
  onQ,
  cola,
  onCola,
  rows,
  total,
  loading,
  selectedId,
  onSelect,
  onCollapseBandeja,
}: Props) {
  return (
    <section className="glass flex h-full min-h-0 flex-col overflow-hidden rounded-glass">
      <div className="space-y-2 border-b border-white/50 px-3 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-baseline gap-2">
            <h1 className="font-display text-lg leading-none text-ink">Bandeja</h1>
            <span className="text-[11px] text-ink/40">{loading ? "..." : total}</span>
          </div>
          {onCollapseBandeja ? (
            <div className="hidden shrink-0 lg:block">
              <PanelEdgeToggle
                side="left"
                expanded
                onToggle={onCollapseBandeja}
                label="Ocultar bandeja"
              />
            </div>
          ) : null}
        </div>
        <input
          className="glass-input-sm"
          placeholder={"Buscar nombre o tel\u00e9fono"}
          value={q}
          onChange={(e) => onQ(e.target.value)}
          aria-label="Buscar clientes"
        />
        <div className="flex gap-1 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <Chip active={cola === ""} onClick={() => onCola("")}>
            Todos
          </Chip>
          {COLA_CRM.map((id) => (
            <Chip key={id} active={cola === id} onClick={() => onCola(id)}>
              {COLA_LABEL[id as ColaCrm]}
            </Chip>
          ))}
        </div>
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto">
        {rows.length === 0 && !loading ? (
          <li className="px-3 py-8 text-center text-xs text-ink/45">
            No hay clientes en esta cola.
          </li>
        ) : (
          rows.map((row) => (
            <li key={row.id}>
              <HiloRow
                row={row}
                active={row.id === selectedId}
                onSelect={() => onSelect(row.id)}
              />
            </li>
          ))
        )}
        {!loading && total > rows.length ? (
          <li className="px-3 py-2 text-center text-[11px] text-ink/40">
            {"Mostrando "}
            {rows.length}
            {" de "}
            {total}
            {". Afina la b\u00fasqueda."}
          </li>
        ) : null}
      </ul>
    </section>
  );
}

function Chip({
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
      className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] ${
        active ? "bg-white font-medium text-teal shadow-sm" : "text-ink/55 hover:bg-white/50"
      }`}
    >
      {children}
    </button>
  );
}

function HiloRow({
  row,
  active,
  onSelect,
}: {
  row: ClienteListItem;
  active: boolean;
  onSelect: () => void;
}) {
  const nombre = displayName(row.nombre);
  const ultimo = row.ultimoMensaje;
  const sinLeer = ultimo?.autor === "prospecto" && ultimo.direccion === "entrante";
  const cuando = formatRelativo(ultimo?.creadoEn ?? row.ultimoContactoEn);
  const preview = ultimo
    ? `${ultimo.autor === "asesor" ? "T\u00fa: " : ultimo.autor === "bot" ? "Bot: " : ""}${ultimo.contenido}`
    : row.siguienteAccion;
  const etapa = row.etapaCotizacion
    ? (ETAPA_COTIZACION_LABEL[row.etapaCotizacion as EtapaCotizacion] ?? row.etapaCotizacion)
    : null;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={active ? "true" : undefined}
      className={`flex w-full items-start gap-2 px-3 py-2 text-left transition ${
        active ? "bg-white/80" : "hover:bg-white/40"
      }`}
    >
      <span className="relative mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal/10 text-[10px] font-semibold text-teal">
        {iniciales(nombre)}
        <span
          className={`absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full ring-2 ring-white ${puntoDe(row)}`}
          aria-hidden
        />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className={`truncate text-sm ${sinLeer ? "font-semibold text-ink" : "font-medium text-ink/90"}`}>
            {nombre}
          </span>
          <span className="shrink-0 text-[10px] text-ink/40">{cuando}</span>
        </span>
        <span className="mt-0.5 block truncate text-xs text-ink/55">{preview}</span>
        {etapa ? (
          <span className="mt-1 inline-flex rounded-full bg-white/70 px-1.5 py-0.5 text-[10px] text-teal">
            {etapa}
          </span>
        ) : null}
      </span>
    </button>
  );
}

function iniciales(nombre: string): string {
  const parts = nombre.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0 || nombre === "Sin nombre") return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
}

function puntoDe(row: ClienteListItem): string {
  if (row.estadoBot === "escalado" || row.estadoAtencion === "escalado") {
    return "bg-red-500";
  }
  if (row.estadoBot === "humano" || row.estadoAtencion === "en_atencion") {
    return "bg-teal";
  }
  if (row.estancado) return "bg-amber-400";
  return "bg-ink/20";
}
