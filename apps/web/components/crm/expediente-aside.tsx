"use client";

import { EtapaCompacta } from "@/components/bandeja/etapa-compacta";
import { FichaPanel } from "@/components/crm/ficha-panel";
import type {
  ActualizarOportunidadRequest,
  ClienteDetail,
} from "@tres-cielos/shared";
import { useState } from "react";

type Tab = "comercial" | "ficha";

type Props = {
  cliente: ClienteDetail;
  busy?: boolean;
  error?: string | null;
  onSaveFicha: (input: { nombre?: string; correo?: string | null }) => Promise<void>;
  onAddNota: (cuerpo: string) => Promise<void>;
  onSaveTags: (tags: string[]) => Promise<void>;
  onPatchOportunidad: (
    oportunidadId: string,
    body: ActualizarOportunidadRequest,
  ) => Promise<void>;
};

export function ExpedienteAside({
  cliente,
  busy,
  error,
  onSaveFicha,
  onAddNota,
  onSaveTags,
  onPatchOportunidad,
}: Props) {
  const [tab, setTab] = useState<Tab>("comercial");
  const oportunidad = cliente.oportunidades[0];

  return (
    <aside className="glass flex h-full min-h-0 flex-col overflow-hidden rounded-glass">
      <div className="flex border-b border-white/50 p-1">
        {(
          [
            { id: "comercial" as const, label: "Comercial" },
            { id: "ficha" as const, label: "Ficha" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex-1 rounded-xl py-2 text-xs font-medium transition ${
              tab === t.id
                ? "bg-white/70 text-teal shadow-sm"
                : "text-ink/55 hover:bg-white/30"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {tab === "comercial" ? (
          oportunidad ? (
            <EtapaCompacta
              key={`${oportunidad.id}-${oportunidad.etapa}-${oportunidad.visitaEstado}`}
              oportunidad={oportunidad}
              busy={busy}
              onPatch={onPatchOportunidad}
            />
          ) : (
            <p className="text-sm text-ink/50">
              {"Sin oportunidad comercial a\u00fan."}
            </p>
          )
        ) : (
          <FichaPanel
            key={`${cliente.id}-${cliente.actualizadoEn}`}
            cliente={cliente}
            busy={busy}
            error={error}
            onSaveFicha={onSaveFicha}
            onAddNota={onAddNota}
            onSaveTags={onSaveTags}
          />
        )}
      </div>
    </aside>
  );
}
