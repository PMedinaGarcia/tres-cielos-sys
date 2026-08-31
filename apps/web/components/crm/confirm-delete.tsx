"use client";

import { useEffect } from "react";

type Props = {
  open: boolean;
  title: string;
  description: string;
  busy?: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ConfirmDeleteDialog({
  open,
  title,
  description,
  busy,
  error,
  onCancel,
  onConfirm,
}: Props) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/35 p-4"
      role="presentation"
      onClick={() => {
        if (!busy) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="crm-delete-title"
        className="glass-strong w-full max-w-md rounded-glass px-6 py-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="crm-delete-title" className="font-display text-xl text-ink">
          {title}
        </h2>
        <p className="mt-2 text-sm text-ink/70">{description}</p>
        {error ? <p className="mt-3 text-sm text-red-800">{error}</p> : null}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            className="btn-ghost"
            disabled={busy}
            onClick={onCancel}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-xl bg-red-800 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-red-900 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? "Eliminando…" : "Eliminar"}
          </button>
        </div>
      </div>
    </div>
  );
}
