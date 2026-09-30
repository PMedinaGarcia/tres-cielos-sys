"use client";

import { BriefCard } from "@/components/ops/brief-card";
import { ConfirmDeleteDialog } from "@/components/crm/confirm-delete";
import { FichaPanel } from "@/components/crm/ficha-panel";
import { HistorialFeed } from "@/components/crm/historial-feed";
import { OportunidadPanel } from "@/components/crm/oportunidad-panel";
import { displayName } from "@/components/crm/labels";
import { GlassPanel } from "@/components/glass-panel";
import {
  addNotaCliente,
  deleteCliente,
  getCliente,
  getClienteHistorial,
  patchCliente,
  patchOportunidad,
  replaceTagsCliente,
} from "@/lib/crm-api";
import { ApiError } from "@/lib/http";
import type { ClienteDetail, HistorialItemDto } from "@tres-cielos/shared";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

export default function CrmExpedientePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;
  const [cliente, setCliente] = useState<ClienteDetail | null>(null);
  const [historial, setHistorial] = useState<HistorialItemDto[]>([]);
  const [total, setTotal] = useState(0);
  const [tipo, setTipo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [histLoading, setHistLoading] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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

  async function confirmDelete() {
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteCliente(id);
      router.push("/crm");
    } catch (e) {
      setDeleteError(
        e instanceof ApiError ? e.message : "No se pudo eliminar el registro",
      );
    } finally {
      setDeleting(false);
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
        <button
          type="button"
          className="rounded-xl border border-red-200 bg-white/40 px-4 py-2 text-sm text-red-800 transition hover:bg-red-50 disabled:opacity-40"
          disabled={busy || deleting}
          onClick={() => {
            setDeleteError(null);
            setConfirmOpen(true);
          }}
        >
          Eliminar registro
        </button>
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
          <h2 className="mb-4 font-display text-lg text-teal">Brief</h2>
          <BriefCard
            brief={{
              nombre: cliente.nombre,
              ocasion: cliente.tipoEvento,
              fechaEstado: null,
              aforo: cliente.oportunidades[0]?.aforo ?? null,
              rango: null,
              encaje: cliente.conversaciones[0]?.encajeEconomico ?? null,
              intencion: cliente.conversaciones[0]?.intencionNivel ?? null,
              ruta: cliente.conversaciones[0]?.rutaComercial ?? null,
              ultimaPregunta: null,
              pdfEnviado: false,
            }}
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
      <ConfirmDeleteDialog
        open={confirmOpen}
        title="Eliminar registro"
        description={`Se borra la ficha de ${displayName(cliente.nombre)}, sus hilos y el historial. El próximo contacto del mismo número o canal creará un expediente nuevo.`}
        busy={deleting}
        error={deleteError}
        onCancel={() => {
          if (!deleting) {
            setConfirmOpen(false);
            setDeleteError(null);
          }
        }}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}
