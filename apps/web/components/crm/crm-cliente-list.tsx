"use client";

import {
  displayName,
  ESTADO_ATENCION_LABEL,
  ETAPA_COTIZACION_LABEL,
  formatRelativo,
  formatWhen,
  TIPO_EVENTO_LABEL,
  VISITA_LABEL,
} from "@/components/crm/labels";
import type {
  ClienteListItem,
  EstadoAtencion,
  EtapaCotizacion,
  VisitaEstado,
} from "@tres-cielos/shared";
import Link from "next/link";

const SEP = " \u00b7 ";
const EM_DASH = "\u2014";

type Props = {
  rows: ClienteListItem[];
  total: number;
  loading: boolean;
  error: string | null;
  onDelete: (id: string, nombre: string) => void;
};

export function CrmClienteList({
  rows,
  total,
  loading,
  error,
  onDelete,
}: Props) {
  return (
    <section className="glass overflow-hidden rounded-glass">
      <div className="flex items-center justify-between gap-3 border-b border-white/50 px-5 py-3 md:px-6">
        <p className="text-sm font-medium text-ink/80">Expedientes</p>
        <p className="text-[11px] text-ink/45">
          {loading
            ? "Cargando\u2026"
            : rows.length < total
              ? `${rows.length} de ${total}`
              : `${total} en total`}
        </p>
      </div>

      {error ? (
        <p className="border-b border-white/40 px-5 py-3 text-sm text-red-800 md:px-6">
          {error}
        </p>
      ) : null}

      <div className="hidden grid-cols-[minmax(0,1fr)_minmax(0,9.5rem)_minmax(0,7.5rem)_minmax(0,5.5rem)_minmax(0,6.5rem)] gap-4 border-b border-white/40 px-6 py-2 text-[10px] font-medium uppercase tracking-wider text-ink/40 xl:grid">
        <span>Cliente</span>
        <span>Etapa</span>
        <span>Atenci{"\u00f3"}n</span>
        <span className="text-right">Actividad</span>
        <span className="text-right">Acciones</span>
      </div>

      {rows.length === 0 && !loading ? (
        <p className="px-6 py-14 text-center text-sm leading-relaxed text-ink/55">
          No hay clientes en esta cola.
          <br />
          <span className="text-ink/45">
            Prueba otra cola o genera un expediente desde el chat sandbox.
          </span>
        </p>
      ) : (
        <ul className="divide-y divide-white/35">
          {rows.map((c) => (
            <ClienteRow key={c.id} cliente={c} onDelete={onDelete} />
          ))}
        </ul>
      )}

      {!loading && total > rows.length ? (
        <p className="border-t border-white/40 px-6 py-3 text-center text-[11px] text-ink/45">
          Mostrando los primeros {rows.length}. Usa b{"\u00fa"}squeda o filtros
          para acotar.
        </p>
      ) : null}
    </section>
  );
}

function ClienteRow({
  cliente: c,
  onDelete,
}: {
  cliente: ClienteListItem;
  onDelete: (id: string, nombre: string) => void;
}) {
  const nombre = displayName(c.nombre);
  const etapa = c.etapaCotizacion
    ? (ETAPA_COTIZACION_LABEL[c.etapaCotizacion as EtapaCotizacion] ??
      c.etapaCotizacion)
    : null;
  const visita =
    c.visitaEstado && c.visitaEstado !== "no_solicitada"
      ? VISITA_LABEL[c.visitaEstado as VisitaEstado]
      : null;
  const cuando = formatRelativo(c.ultimoContactoEn);
  const cuandoFull = formatWhen(c.ultimoContactoEn);

  const contacto = [c.telefono, c.correo, c.canalOrigen]
    .filter(Boolean)
    .join(SEP);

  const contexto = [
    c.tipoEvento ? TIPO_EVENTO_LABEL[c.tipoEvento] ?? c.tipoEvento : null,
    visita,
    c.rutaComercial ? c.rutaComercial.replace(/_/g, " ") : null,
  ].filter((x): x is string => Boolean(x));

  return (
    <li
      className={`group transition hover:bg-white/25 ${
        c.estancado ? "bg-amber-50/30" : ""
      }`}
    >
      <div className="flex flex-col gap-3 px-5 py-4 sm:gap-4 xl:grid xl:grid-cols-[minmax(0,1fr)_minmax(0,9.5rem)_minmax(0,7.5rem)_minmax(0,5.5rem)_minmax(0,6.5rem)] xl:items-center xl:gap-4 xl:px-6">
        <div className="min-w-0">
          <Link
            href={`/crm/${c.id}`}
            className="flex min-w-0 items-start gap-3 overflow-hidden"
          >
            <span className="relative mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-teal/15 to-white/80 text-xs font-semibold text-teal shadow-sm ring-1 ring-white/70">
              {iniciales(nombre)}
              <span
                className={`absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-white ${puntoDe(c)}`}
                aria-hidden
              />
            </span>
            <span className="min-w-0 flex-1 overflow-hidden">
              <span className="flex min-w-0 items-center gap-2">
                <span className="min-w-0 truncate text-sm font-semibold text-ink group-hover:text-teal">
                  {nombre}
                </span>
                {c.tieneDuplicado ? (
                  <AlertChip tone="amber">Duplicado</AlertChip>
                ) : null}
                {c.estancado ? (
                  <AlertChip tone="amber">Estancado</AlertChip>
                ) : null}
              </span>
              {contacto ? (
                <span className="mt-0.5 block truncate text-xs text-ink/50">
                  {contacto}
                </span>
              ) : null}
              {c.siguienteAccion ? (
                <span className="mt-1.5 line-clamp-2 text-xs leading-snug text-ink/70 xl:line-clamp-1">
                  {c.siguienteAccion}
                </span>
              ) : null}
              {contexto.length > 0 ? (
                <span className="mt-2 flex min-w-0 flex-wrap gap-1.5 xl:hidden">
                  {contexto.map((t) => (
                    <MetaChip key={t}>{t}</MetaChip>
                  ))}
                </span>
              ) : null}
            </span>
          </Link>
        </div>

        <div className="hidden min-w-0 xl:block">
          {etapa ? (
            <span className="inline-flex max-w-full rounded-full bg-white/65 px-2.5 py-1 text-[11px] font-medium text-teal ring-1 ring-white/80">
              <span className="truncate">{etapa}</span>
            </span>
          ) : (
            <span className="text-xs text-ink/35">{EM_DASH}</span>
          )}
          {contexto.length > 0 ? (
            <p className="mt-1 truncate text-[10px] text-ink/45">
              {contexto.join(SEP)}
            </p>
          ) : null}
        </div>

        <div className="hidden min-w-0 xl:block">
          <EstadoPill estado={c.estadoAtencion} />
        </div>

        <div className="flex min-w-0 items-center justify-between gap-3 xl:block xl:text-right">
          <time
            className="min-w-0 shrink truncate text-xs text-ink/45 tabular-nums"
            dateTime={c.ultimoContactoEn}
            title={cuandoFull}
          >
            {cuando || cuandoFull}
          </time>
          <span className="shrink-0 xl:hidden">
            <EstadoPill estado={c.estadoAtencion} />
          </span>
        </div>

        <div className="flex min-w-0 items-center gap-2 border-t border-white/30 pt-3 xl:border-0 xl:pt-0">
          {etapa ? (
            <span className="min-w-0 flex-1 truncate text-[11px] text-teal xl:hidden">
              {etapa}
            </span>
          ) : (
            <span className="min-w-0 flex-1 xl:hidden" aria-hidden />
          )}
          <div className="flex shrink-0 items-center justify-end gap-0.5">
            <Link
              href={`/bandeja?c=${c.id}`}
              className="shrink-0 rounded-xl px-2.5 py-1.5 text-xs font-medium text-teal transition hover:bg-white/60"
            >
              Responder
            </Link>
            <button
              type="button"
              className="shrink-0 rounded-xl px-2.5 py-1.5 text-xs text-red-800/90 transition hover:bg-red-50"
              onClick={() => onDelete(c.id, nombre)}
            >
              Eliminar
            </button>
          </div>
        </div>
      </div>
    </li>
  );
}

function AlertChip({
  children,
  tone,
}: {
  children: string;
  tone: "amber";
}) {
  const cls =
    tone === "amber"
      ? "bg-amber-100/90 text-amber-900 ring-amber-200/80"
      : "";
  return (
    <span
      className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ring-1 ${cls}`}
    >
      {children}
    </span>
  );
}

function MetaChip({ children }: { children: string }) {
  return (
    <span
      className="max-w-full truncate rounded-full bg-white/55 px-2 py-0.5 text-[10px] text-ink/55 ring-1 ring-white/70"
      title={children}
    >
      {children}
    </span>
  );
}

function EstadoPill({ estado }: { estado: EstadoAtencion }) {
  const label = ESTADO_ATENCION_LABEL[estado];
  const tone =
    estado === "escalado"
      ? "bg-red-50 text-red-800 ring-red-100"
      : estado === "en_atencion"
        ? "bg-teal text-white ring-teal/30 shadow-sm"
        : estado === "bot_activo"
          ? "bg-teal/10 text-teal ring-teal/15"
          : estado === "nuevo"
            ? "bg-white/70 text-ink/70 ring-white/80"
            : "bg-white/55 text-ink/55 ring-white/70";

  return (
    <span
      className={`inline-flex max-w-full rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ${tone}`}
    >
      <span className="truncate">{label}</span>
    </span>
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
  return "bg-ink/25";
}
