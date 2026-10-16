"use client";

import { formatWhen } from "@/components/crm/labels";
import type { NotaClienteDto } from "@tres-cielos/shared";
import { FormEvent, useState } from "react";
import Link from "next/link";

type Props = {
  clienteId: string;
  notas: NotaClienteDto[];
  busy?: boolean;
  onAdd: (cuerpo: string) => Promise<void>;
};

export function NotasCompactas({ clienteId, notas, busy, onAdd }: Props) {
  const [cuerpo, setCuerpo] = useState("");
  const recientes = notas.slice(0, 3);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const texto = cuerpo.trim();
    if (!texto) return;
    await onAdd(texto);
    setCuerpo("");
  }

  return (
    <details className="group">
      <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-wide text-teal">
        Notas ({notas.length})
      </summary>
      <ul className="mt-2 space-y-1">
        {recientes.length === 0 ? (
          <li className="text-[11px] text-ink/40">Sin notas</li>
        ) : (
          recientes.map((nota) => (
            <li key={nota.id} className="rounded-lg bg-white/40 px-2 py-1.5 text-xs text-ink/80">
              <p className="whitespace-pre-wrap">{nota.cuerpo}</p>
              <p className="mt-0.5 text-[10px] text-ink/35">{formatWhen(nota.creadoEn)}</p>
            </li>
          ))
        )}
      </ul>
      <form onSubmit={(e) => void submit(e)} className="mt-2 space-y-1">
        <textarea
          className="glass-input-sm min-h-[3rem]"
          placeholder="Nota interna…"
          value={cuerpo}
          onChange={(e) => setCuerpo(e.target.value)}
        />
        <button type="submit" className="btn-ghost px-2.5 py-1 text-[11px]" disabled={busy || !cuerpo.trim()}>
          Añadir nota
        </button>
      </form>
      <Link href={`/crm/${clienteId}`} className="mt-2 inline-block text-[11px] text-teal">
        Expediente completo
      </Link>
    </details>
  );
}
