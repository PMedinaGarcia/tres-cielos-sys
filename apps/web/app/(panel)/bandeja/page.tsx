"use client";

import { BriefCard } from "@/components/ops/brief-card";
import { GlassPanel } from "@/components/glass-panel";
import { devolverABot, listBandeja, tomarControl } from "@/lib/conversaciones-api";
import { ApiError } from "@/lib/http";
import type { BandejaItem } from "@tres-cielos/shared";
import { useCallback, useEffect, useState } from "react";

export default function BandejaPage() {
  const [cola, setCola] = useState<"comercial" | "atencion_general" | "">("");
  const [rows, setRows] = useState<BandejaItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const res = await listBandeja(cola || undefined);
    setRows(res.data);
  }, [cola]);

  useEffect(() => {
    void load().catch((e) =>
      setError(e instanceof ApiError ? e.message : "No se pudo cargar la bandeja"),
    );
  }, [load]);

  async function tomar(id: string) {
    setBusy(id);
    try {
      await tomarControl(id);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No se pudo tomar el hilo");
    } finally {
      setBusy(null);
    }
  }

  async function liberar(id: string) {
    setBusy(id);
    try {
      await devolverABot(id, "asesor_libera");
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No se pudo devolver el hilo");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-teal">Ops</p>
          <h1 className="font-display text-3xl text-ink">Bandeja</h1>
        </div>
        <div className="flex gap-2">
          {(["", "comercial", "atencion_general"] as const).map((c) => (
            <button
              key={c || "todas"}
              type="button"
              onClick={() => setCola(c)}
              className={`rounded-full px-3 py-1.5 text-sm ${
                cola === c
                  ? "bg-white font-medium text-teal shadow-sm"
                  : "text-ink/55 hover:bg-white/60"
              }`}
            >
              {c === "" ? "Todas" : c === "comercial" ? "Comercial" : "General"}
            </button>
          ))}
        </div>
      </div>
      {error ? <p className="text-sm text-red-800">{error}</p> : null}
      <div className="grid gap-4">
        {rows.length === 0 ? (
          <GlassPanel className="px-6 py-8 text-ink/50">
            No hay hilos en esta cola.
          </GlassPanel>
        ) : (
          rows.map((row) => (
            <GlassPanel key={row.id} className="px-6 py-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm text-ink/60">
                  <span className="font-medium text-ink">{row.cola ?? "sin cola"}</span>
                  {" · "}
                  {row.estadoBot}
                  {row.urgenciaSla ? ` · SLA ${row.urgenciaSla}` : ""}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busy === row.id}
                    onClick={() => void tomar(row.id)}
                    className="rounded-xl bg-teal px-3 py-1.5 text-sm text-white disabled:opacity-40"
                  >
                    Tomar control
                  </button>
                  <button
                    type="button"
                    disabled={busy === row.id}
                    onClick={() => void liberar(row.id)}
                    className="rounded-xl border border-ink/10 px-3 py-1.5 text-sm disabled:opacity-40"
                  >
                    Devolver a bot
                  </button>
                </div>
              </div>
              <BriefCard brief={row.brief} />
            </GlassPanel>
          ))
        )}
      </div>
    </div>
  );
}
