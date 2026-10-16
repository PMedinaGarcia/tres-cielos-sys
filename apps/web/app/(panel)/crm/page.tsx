"use client";

import { CrmClienteList } from "@/components/crm/crm-cliente-list";
import { CrmPageToolbar } from "@/components/crm/crm-page-toolbar";
import { ConfirmDeleteDialog } from "@/components/crm/confirm-delete";
import { deleteCliente, listClientes } from "@/lib/crm-api";
import { ApiError } from "@/lib/http";
import { FormEvent, useEffect, useState } from "react";

export default function CrmPage() {
  const [q, setQ] = useState("");
  const [qApplied, setQApplied] = useState("");
  const [estado, setEstado] = useState("");
  const [cola, setCola] = useState("");
  const [tipoEvento, setTipoEvento] = useState("");
  const [sinAsignar, setSinAsignar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Awaited<ReturnType<typeof listClientes>>["data"]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<{ id: string; nombre: string } | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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

  async function confirmDelete() {
    if (!pending) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteCliente(pending.id);
      setPending(null);
      await load();
    } catch (e) {
      setDeleteError(
        e instanceof ApiError ? e.message : "No se pudo eliminar el registro",
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-6 py-10">
      <CrmPageToolbar
        cola={cola}
        onCola={setCola}
        q={q}
        onQ={setQ}
        onSearch={onSearch}
        estado={estado}
        onEstado={setEstado}
        tipoEvento={tipoEvento}
        onTipoEvento={setTipoEvento}
        sinAsignar={sinAsignar}
        onSinAsignar={setSinAsignar}
        total={total}
        loading={loading}
      />

      <CrmClienteList
        rows={rows}
        total={total}
        loading={loading}
        error={error}
        onDelete={(id, nombre) => {
          setDeleteError(null);
          setPending({ id, nombre });
        }}
      />

      <ConfirmDeleteDialog
        open={pending != null}
        title="Eliminar registro"
        description={
          pending
            ? `Se borra la ficha de ${pending.nombre}, sus hilos y el historial. El próximo contacto del mismo número o canal creará un expediente nuevo.`
            : ""
        }
        busy={deleting}
        error={deleteError}
        onCancel={() => {
          if (!deleting) {
            setPending(null);
            setDeleteError(null);
          }
        }}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}
