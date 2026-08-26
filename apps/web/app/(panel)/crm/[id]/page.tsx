"use client";

import { FichaPanel } from "@/components/crm/ficha-panel";
import { HistorialFeed } from "@/components/crm/historial-feed";
import { OportunidadPanel } from "@/components/crm/oportunidad-panel";
import { displayName } from "@/components/crm/labels";
import { GlassPanel } from "@/components/glass-panel";
import {
  addNotaCliente,
  getCliente,
  getClienteHistorial,
  patchCliente,
  patchOportunidad,
  replaceTagsCliente,
} from "@/lib/crm-api";
import { ApiError } from "@/lib/http";
import type { ClienteDetail, HistorialItemDto } from "@tres-cielos/shared";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

export default function CrmExpedientePage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [cliente, setCliente] = useState<ClienteDetail | null>(null);
  const [historial, setHistorial] = useState<HistorialItemDto[]>([]);
  const [total, setTotal] = useState(0);
  const [tipo, setTipo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [histLoading, setHistLoading] = useState(true);

  const loadCliente = useCallback(async () => {
    const data = await getCliente(id);
    setCliente(data);
  }, [id]);

  const loadHistorial = useCallback(async () => {
    setHistLoading(true);
    try {
      const res = await getClienteHistorial(id, {
        page: 1,
        pageSize: 200,
        tipo: tipo || undefined,
      });
      setHistorial(res.data);
      setTotal(res.meta.total);
    } finally {
      setHistLoading(false);
    }
  }, [id, tipo]);

  useEffect(() => {
    setError(null);
    void loadCliente().catch((e) =>
      setError(e instanceof ApiError ? e.message : "No se pudo cargar el cliente"),
    );
  }, [loadCliente]);

  useEffect(() => {
    void loadHistorial().catch((e) =>
      setError(e instanceof ApiError ? e.message : "No se pudo cargar el historial"),
    );
  }, [loadHistorial]);

  async function wrap(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await loadCliente();
      await loadHistorial();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No se pudo guardar");
    } finally {
      setBusy(false);
    }
  }

  if (!cliente && error) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-10">
        <GlassPanel className="px-8 py-8">
          <p className="text-red-800">{error}</p>
          <Link href="/crm" className="mt-3 inline-block text-sm text-teal">
            Volver al CRM
          </Link>
        </GlassPanel>
      </div>
    );
  }

  if (!cliente) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-10">
        <p className="text-ink/50">Cargando expediente…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/crm" className="text-xs uppercase tracking-wide text-teal">
            ← CRM
          </Link>
          <h1 className="font-display text-3xl text-ink">
            {displayName(cliente.nombre)}
          </h1>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <GlassPanel className="px-6 py-6">
          <h2 className="mb-4 font-display text-lg text-teal">Ficha</h2>
          <FichaPanel
            key={`${cliente.id}-${cliente.actualizadoEn}`}
            cliente={cliente}
            busy={busy}
            error={error}
            onSaveFicha={(input) => wrap(() => patchCliente(id, input).then(() => undefined))}
            onAddNota={(cuerpo) =>
              wrap(() => addNotaCliente(id, { cuerpo }).then(() => undefined))
            }
            onSaveTags={(tags) =>
              wrap(() => replaceTagsCliente(id, { tags }).then(() => undefined))
            }
          />
        </GlassPanel>
        <GlassPanel className="px-6 py-6">
          <h2 className="mb-4 font-display text-lg text-teal">Comercial</h2>
          <OportunidadPanel
            cliente={cliente}
            busy={busy}
            onPatch={(oportunidadId, body) =>
              wrap(() => patchOportunidad(oportunidadId, body).then(() => undefined))
            }
          />
        </GlassPanel>
        <GlassPanel className="px-6 py-6">
          <h2 className="mb-4 font-display text-lg text-teal">Historial</h2>
          <HistorialFeed
            items={historial}
            total={total}
            tipo={tipo}
            onTipo={setTipo}
            loading={histLoading}
          />
        </GlassPanel>
      </div>
    </div>
  );
}
