"use client";

import { GlassPanel } from "@/components/glass-panel";
import {
  COLA_LABEL,
  displayName,
  ESTADO_ATENCION_LABEL,
  ETAPA_COTIZACION_LABEL,
  formatWhen,
  TIPO_EVENTO_LABEL,
  VISITA_LABEL,
} from "@/components/crm/labels";
import { listClientes } from "@/lib/crm-api";
import { ApiError } from "@/lib/http";
import type { ColaCrm, EstadoAtencion, EtapaCotizacion, VisitaEstado } from "@tres-cielos/shared";
import { COLA_CRM, ESTADO_ATENCION, TIPO_EVENTO } from "@tres-cielos/shared";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

export default function CrmPage() {
  const [q, setQ] = useState("");
  const [qApplied, setQApplied] = useState("");
  const [estado, setEstado] = useState<string>("");
  const [cola, setCola] = useState<string>("");
  const [tipoEvento, setTipoEvento] = useState<string>("");
  const [sinAsignar, setSinAsignar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Awaited<ReturnType<typeof listClientes>>["data"]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  async function load(nextQ = qApplied) {
    setError(null);
    setLoading(true);
    try {
      const res = await listClientes({
        q: nextQ || undefined,
        estadoAtencion: estado || undefined,
        cola: cola || undefined,
        tipoEvento: tipoEvento || undefined,
        sinAsignar: sinAsignar || undefined,
        page: 1,
        pageSize: 40,
      });
      setRows(res.data);
      setTotal(res.meta.total);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No se pudo cargar el CRM");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado, sinAsignar, qApplied, cola, tipoEvento]);

  function onSearch(e: FormEvent) {
    e.preventDefault();
    setQApplied(q.trim());
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-6 py-10">
      <GlassPanel className="space-y-4 px-8 py-8">
        <div>
          <h1 className="font-display text-3xl text-ink md:text-4xl">CRM</h1>
          <p className="mt-1 max-w-2xl text-ink/70">
            Colas de cotización y visita al jardín. Quién pidió cita y no se
            agendó, o en qué etapa de cotización se quedó.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setCola("")}
            className={`rounded-full px-3 py-1 text-xs transition ${
              cola === ""
                ? "bg-white/80 text-teal"
                : "bg-white/30 text-ink/70 hover:bg-white/50"
            }`}
          >
            Todos
          </button>
          {COLA_CRM.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setCola(id)}
              className={`rounded-full px-3 py-1 text-xs transition ${
                cola === id
                  ? "bg-white/80 text-teal"
                  : "bg-white/30 text-ink/70 hover:bg-white/50"
              }`}
            >
              {COLA_LABEL[id as ColaCrm]}
            </button>
          ))}
        </div>
        <form onSubmit={onSearch} className="flex flex-wrap items-end gap-3">
          <label className="min-w-[12rem] flex-1 text-xs uppercase tracking-wide text-ink/50">
            Buscar
            <input
              className="glass-input mt-1"
              placeholder="Nombre, teléfono, correo, wa_id…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </label>
          <label className="text-xs uppercase tracking-wide text-ink/50">
            Rubro
            <select
              className="glass-input mt-1"
              value={tipoEvento}
              onChange={(e) => setTipoEvento(e.target.value)}
            >
              <option value="">Todos</option>
              {TIPO_EVENTO.map((t) => (
                <option key={t} value={t}>
                  {TIPO_EVENTO_LABEL[t] ?? t}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs uppercase tracking-wide text-ink/50">
            Atención
            <select
              className="glass-input mt-1"
              value={estado}
              onChange={(e) => setEstado(e.target.value)}
            >
              <option value="">Todos</option>
              {ESTADO_ATENCION.map((s) => (
                <option key={s} value={s}>
                  {ESTADO_ATENCION_LABEL[s as EstadoAtencion]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 pb-2 text-sm text-ink/70">
            <input
              type="checkbox"
              checked={sinAsignar}
              onChange={(e) => setSinAsignar(e.target.checked)}
            />
            Sin asignar
          </label>
          <button type="submit" className="btn-teal">
            Buscar
          </button>
        </form>
      </GlassPanel>

      <GlassPanel className="px-8 py-6">
        {error ? <p className="mb-3 text-sm text-red-800">{error}</p> : null}
        <p className="mb-3 text-xs text-ink/45">
          {loading ? "Cargando…" : `${total} cliente${total === 1 ? "" : "s"}`}
        </p>
        {rows.length === 0 && !loading ? (
          <p className="text-sm text-ink/60">
            No hay clientes en esta cola. Habla con el bot en Chat sandbox para
            generar un expediente.
          </p>
        ) : (
          <ul className="divide-y divide-white/40">
            {rows.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/crm/${c.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 py-3 transition hover:text-teal"
                >
                  <div>
                    <p className="font-medium">{displayName(c.nombre)}</p>
                    <p className="text-xs text-ink/55">
                      {c.telefono ?? "sin teléfono"}
                      {c.correo ? ` · ${c.correo}` : ""}
                      {c.canalOrigen ? ` · ${c.canalOrigen}` : ""}
                    </p>
                    {c.siguienteAccion ? (
                      <p className="mt-1 text-xs text-ink/70">{c.siguienteAccion}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {c.tieneDuplicado ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800">
                        Duplicado
                      </span>
                    ) : null}
                    {c.tipoEvento ? (
                      <span className="rounded-full bg-white/70 px-2 py-0.5 text-ink/70">
                        {TIPO_EVENTO_LABEL[c.tipoEvento] ?? c.tipoEvento}
                      </span>
                    ) : null}
                    {c.etapaCotizacion ? (
                      <span className="rounded-full bg-white/70 px-2 py-0.5 text-teal">
                        {ETAPA_COTIZACION_LABEL[c.etapaCotizacion as EtapaCotizacion] ??
                          c.etapaCotizacion}
                      </span>
                    ) : null}
                    {c.visitaEstado && c.visitaEstado !== "no_solicitada" ? (
                      <span className="rounded-full bg-teal/15 px-2 py-0.5 text-teal">
                        {VISITA_LABEL[c.visitaEstado as VisitaEstado]}
                      </span>
                    ) : null}
                    <span className="rounded-full bg-white/70 px-2 py-0.5 text-ink/55">
                      {ESTADO_ATENCION_LABEL[c.estadoAtencion]}
                    </span>
                    {c.estancado ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800">
                        Estancado
                      </span>
                    ) : null}
                    <span className="text-ink/40">
                      {formatWhen(c.ultimoContactoEn)}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </GlassPanel>
    </div>
  );
}
