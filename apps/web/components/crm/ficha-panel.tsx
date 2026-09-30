"use client";

import type { ClienteDetail } from "@tres-cielos/shared";
import { FormEvent, useState } from "react";
import { ESTADO_ATENCION_LABEL, formatWhen } from "./labels";

type Props = {
  cliente: ClienteDetail;
  busy?: boolean;
  error?: string | null;
  onSaveFicha: (input: { nombre?: string; correo?: string | null }) => Promise<void>;
  onAddNota: (cuerpo: string) => Promise<void>;
  onSaveTags: (tags: string[]) => Promise<void>;
};

export function FichaPanel({
  cliente,
  busy,
  error,
  onSaveFicha,
  onAddNota,
  onSaveTags,
}: Props) {
  const [nombre, setNombre] = useState(cliente.nombre ?? "");
  const [correo, setCorreo] = useState(cliente.correo ?? "");
  const [nota, setNota] = useState("");
  const [tagDraft, setTagDraft] = useState(cliente.tags.join(", "));

  async function saveFicha(e: FormEvent) {
    e.preventDefault();
    await onSaveFicha({
      nombre: nombre.trim() || undefined,
      correo: correo.trim() ? correo.trim() : null,
    });
  }

  async function saveNota(e: FormEvent) {
    e.preventDefault();
    const cuerpo = nota.trim();
    if (!cuerpo) return;
    await onAddNota(cuerpo);
    setNota("");
  }

  async function saveTags(e: FormEvent) {
    e.preventDefault();
    const tags = tagDraft
      .split(/[,#]/)
      .map((t) => t.trim())
      .filter(Boolean);
    await onSaveTags(tags);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-white/70 px-3 py-1 text-xs text-teal">
          {ESTADO_ATENCION_LABEL[cliente.estadoAtencion]}
        </span>
        {cliente.conversaciones[0]?.encajeEconomico ? (
          <span className="rounded-full bg-teal/15 px-3 py-1 text-xs text-teal">
            Encaje {cliente.conversaciones[0].encajeEconomico.replace(/_/g, " ")}
          </span>
        ) : null}
        {cliente.conversaciones[0]?.intencionNivel ? (
          <span className="rounded-full bg-white/70 px-3 py-1 text-xs text-ink/60">
            Intención {cliente.conversaciones[0].intencionNivel}
          </span>
        ) : null}
        {cliente.conversaciones[0]?.rutaComercial ? (
          <span className="rounded-full bg-white/70 px-3 py-1 text-xs text-ink/60">
            {cliente.conversaciones[0].rutaComercial.replace(/_/g, " ")}
          </span>
        ) : null}
        {cliente.tieneDuplicado ? (
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs text-amber-800">
            Posible duplicado
          </span>
        ) : null}
        <span className="text-xs text-ink/45">
          Último contacto {formatWhen(cliente.ultimoContactoEn)}
        </span>
      </div>

      {error ? <p className="text-sm text-red-800">{error}</p> : null}

      <form onSubmit={(e) => void saveFicha(e)} className="space-y-3">
        <label className="block text-xs uppercase tracking-wide text-ink/50">
          Nombre
          <input
            className="glass-input mt-1"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
          />
        </label>
        <label className="block text-xs uppercase tracking-wide text-ink/50">
          Correo
          <input
            className="glass-input mt-1"
            type="email"
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
          />
        </label>
        <p className="text-sm text-ink/70">
          Teléfono: <strong>{cliente.telefono ?? "—"}</strong>
        </p>
        <button type="submit" className="btn-teal" disabled={busy}>
          Guardar ficha
        </button>
      </form>

      <section>
        <h3 className="font-display text-sm text-teal">Identificadores</h3>
        <ul className="mt-2 space-y-1 text-xs text-ink/70">
          {cliente.identificadores.length === 0 ? (
            <li>Ninguno</li>
          ) : (
            cliente.identificadores.map((i) => (
              <li key={i.id}>
                <span className="uppercase text-ink/45">{i.tipo}</span> {i.valor}
              </li>
            ))
          )}
        </ul>
      </section>

      {cliente.vinculos.length > 0 ? (
        <section>
          <h3 className="font-display text-sm text-teal">Expedientes vinculados</h3>
          <ul className="mt-2 space-y-1 text-xs text-ink/70">
            {cliente.vinculos.map((v) => (
              <li key={v.clienteId}>
                {v.relacion === "canonico" ? "Canónico" : "Duplicado"}:{" "}
                {v.nombre ?? v.telefono ?? v.clienteId.slice(0, 8)}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <form onSubmit={(e) => void saveTags(e)} className="space-y-2">
        <label className="block text-xs uppercase tracking-wide text-ink/50">
          Tags (separados por coma)
          <input
            className="glass-input mt-1"
            value={tagDraft}
            onChange={(e) => setTagDraft(e.target.value)}
          />
        </label>
        <button type="submit" className="btn-ghost" disabled={busy}>
          Guardar tags
        </button>
      </form>

      <section className="space-y-2">
        <h3 className="font-display text-sm text-teal">Notas</h3>
        <ul className="space-y-2 text-sm text-ink/80">
          {cliente.notas.length === 0 ? (
            <li className="text-ink/45">Sin notas</li>
          ) : (
            cliente.notas.map((n) => (
              <li key={n.id} className="rounded-xl bg-white/40 px-3 py-2">
                <p>{n.cuerpo}</p>
                <p className="mt-1 text-[11px] text-ink/40">
                  {formatWhen(n.creadoEn)}
                </p>
              </li>
            ))
          )}
        </ul>
        <form onSubmit={(e) => void saveNota(e)} className="space-y-2">
          <textarea
            className="glass-input min-h-[72px]"
            placeholder="Agregar nota…"
            value={nota}
            onChange={(e) => setNota(e.target.value)}
          />
          <button type="submit" className="btn-ghost" disabled={busy || !nota.trim()}>
            Añadir nota
          </button>
        </form>
      </section>
    </div>
  );
}
