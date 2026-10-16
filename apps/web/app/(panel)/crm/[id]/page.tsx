"use client";

import { BriefHero } from "@/components/crm/brief-hero";
import { ConfirmDeleteDialog } from "@/components/crm/confirm-delete";
import { ExpedienteAside } from "@/components/crm/expediente-aside";
import { HistorialFeed } from "@/components/crm/historial-feed";
import { displayName, ESTADO_ATENCION_LABEL } from "@/components/crm/labels";
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
        <div className="glass rounded-glass px-8 py-8">
          <p className="text-red-800">{error}</p>
          <Link href="/crm" className="mt-3 inline-block text-sm text-teal">
            Volver al CRM
          </Link>
        </div>
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
    <div className="mx-auto flex h-[calc(100dvh-7.5rem)] max-w-[90rem] flex-col px-3 py-3 lg:h-[calc(100dvh-5.75rem)] lg:px-5 lg:py-4">
      <header className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-3 animate-rise">
        <div className="min-w-0">
          <Link
            href="/crm"
            className="text-[11px] font-medium uppercase tracking-wide text-teal"
          >
            ← CRM
          </Link>
          <div className="mt-0.5 flex flex-wrap items-center gap-2">
            <h1 className="font-display text-2xl text-ink md:text-3xl">
              {displayName(cliente.nombre)}
            </h1>
            <span className="rounded-full bg-white/60 px-2.5 py-0.5 text-[11px] text-ink/70">
              {ESTADO_ATENCION_LABEL[cliente.estadoAtencion]}
            </span>
            {cliente.tieneDuplicado ? (
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] text-amber-800">
                Posible duplicado
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 text-xs text-ink/50">
            {cliente.telefono ?? "Sin teléfono"}
            {cliente.correo ? ` · ${cliente.correo}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/bandeja?c=${cliente.id}`}
            className="btn-teal !py-2 !text-sm"
          >
            Responder en bandeja
          </Link>
          <button
            type="button"
            className="rounded-xl border border-red-200/80 bg-white/30 px-4 py-2 text-sm text-red-800 transition hover:bg-red-50 disabled:opacity-40"
            disabled={busy || deleting}
            onClick={() => {
              setDeleteError(null);
              setConfirmOpen(true);
            }}
          >
            Eliminar
          </button>
        </div>
      </header>

      {error ? (
        <p className="mb-2 shrink-0 text-sm text-red-800">{error}</p>
      ) : null}

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_19rem] xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-h-0 flex-col gap-3">
          <BriefHero cliente={cliente} />
          <HistorialFeed
            clienteId={cliente.id}
            items={historial}
            total={total}
            tipo={tipo}
            onTipo={setTipo}
            loading={histLoading}
          />
        </div>
        <ExpedienteAside
          cliente={cliente}
          busy={busy}
          error={error}
          onSaveFicha={(input) =>
            wrap(() => patchCliente(id, input).then(() => undefined))
          }
          onAddNota={(cuerpo) =>
            wrap(() => addNotaCliente(id, { cuerpo }).then(() => undefined))
          }
          onSaveTags={(tags) =>
            wrap(() => replaceTagsCliente(id, { tags }).then(() => undefined))
          }
          onPatchOportunidad={(oportunidadId, body) =>
            wrap(() => patchOportunidad(oportunidadId, body).then(() => undefined))
          }
        />
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
