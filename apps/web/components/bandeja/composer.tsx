"use client";

import { subirArchivoBandeja } from "@/lib/bandeja-adjuntos";
import { ApiError } from "@/lib/http";
import type { ConversacionResumenDto, HistorialItemDto } from "@tres-cielos/shared";
import { BANDEJA_ADJUNTO_MAX_BYTES } from "@tres-cielos/shared";
import { FormEvent, useRef, useState } from "react";

const VENTANA_MS = 24 * 60 * 60 * 1000;

export type EnvioBandejaPayload = {
  contenido?: string;
  adjuntos?: Array<{ uploadId: string }>;
};

type Props = {
  conv: ConversacionResumenDto | null;
  optOut: boolean;
  items: HistorialItemDto[];
  historialListo: boolean;
  userId?: string;
  sending: boolean;
  error: unknown;
  onSend: (payload: EnvioBandejaPayload) => void;
};

type Pendiente = {
  file: File;
  estado: "listo" | "subiendo" | "error";
  uploadId?: string;
  progreso?: number;
  error?: string;
};

export function Composer({
  conv,
  optOut,
  items,
  historialListo,
  userId,
  sending,
  error,
  onSend,
}: Props) {
  const [draft, setDraft] = useState("");
  const [pendientes, setPendientes] = useState<Pendiente[]>([]);
  const [subiendo, setSubiendo] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const bloqueo = bloqueoDe({ conv, optOut, items, historialListo, userId });
  const botTieneControl = conv != null && conv.estadoBot !== "humano" && !bloqueo;
  const ocupado = sending || subiendo;

  function agregarArchivos(files: FileList | null) {
    if (!files?.length || bloqueo) return;
    const next: Pendiente[] = [];
    for (const file of Array.from(files)) {
      if (file.size > BANDEJA_ADJUNTO_MAX_BYTES) {
        next.push({
          file,
          estado: "error",
          error: "Supera 25 GB por archivo.",
        });
        continue;
      }
      next.push({ file, estado: "listo" });
    }
    setPendientes((prev) => [...prev, ...next]);
  }

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    const texto = draft.trim();
    const listos = pendientes.filter((p) => p.estado === "listo");
    if ((!texto && listos.length === 0) || ocupado || bloqueo || !conv) return;

    setSubiendo(true);
    const adjuntos: Array<{ uploadId: string }> = [];
    try {
      for (const p of listos) {
        setPendientes((prev) =>
          prev.map((x) =>
            x.file === p.file ? { ...x, estado: "subiendo", progreso: 0 } : x,
          ),
        );
        const res = await subirArchivoBandeja(conv.id, p.file, (pct) => {
          setPendientes((prev) =>
            prev.map((x) => (x.file === p.file ? { ...x, progreso: pct } : x)),
          );
        });
        adjuntos.push({ uploadId: res.uploadId });
        setPendientes((prev) =>
          prev.map((x) =>
            x.file === p.file
              ? { ...x, estado: "listo", uploadId: res.uploadId, progreso: 100 }
              : x,
          ),
        );
      }
      setDraft("");
      setPendientes([]);
      onSend({
        contenido: texto || undefined,
        adjuntos: adjuntos.length > 0 ? adjuntos : undefined,
      });
    } catch {
      setPendientes((prev) =>
        prev.map((x) =>
          x.estado === "subiendo"
            ? { ...x, estado: "error", error: "No se pudo subir el archivo." }
            : x,
        ),
      );
    } finally {
      setSubiendo(false);
    }
  }

  const puedeEnviar =
    !bloqueo &&
    !ocupado &&
    (draft.trim().length > 0 ||
      pendientes.some((p) => p.estado === "listo"));

  return (
    <form onSubmit={submit} className="border-t border-white/50 px-3 py-2.5">
      {pendientes.length > 0 ? (
        <ul className="mb-2 space-y-1">
          {pendientes.map((p, i) => (
            <li
              key={`${p.file.name}-${i}`}
              className="flex items-center gap-2 rounded-lg bg-white/40 px-2 py-1 text-[11px] text-ink/70"
            >
              <span className="min-w-0 flex-1 truncate">{p.file.name}</span>
              {p.estado === "subiendo" ? (
                <span>{p.progreso ?? 0}%</span>
              ) : null}
              {p.estado === "error" ? (
                <span className="text-red-800">{p.error ?? "Error"}</span>
              ) : null}
              {p.estado === "listo" ? (
                <button
                  type="button"
                  className="text-teal"
                  onClick={() =>
                    setPendientes((prev) => prev.filter((_, j) => j !== i))
                  }
                >
                  Quitar
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex items-end gap-2">
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          multiple
          accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip"
          onChange={(e) => {
            agregarArchivos(e.target.files);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          disabled={Boolean(bloqueo) || ocupado}
          onClick={() => inputRef.current?.click()}
          className="rounded-lg border border-white/60 px-2 py-2 text-xs text-ink/55 disabled:opacity-40"
          title="Adjuntar archivo"
          aria-label="Adjuntar archivo"
        >
          📎
        </button>
        <label className="sr-only" htmlFor="bandeja-draft">
          Respuesta
        </label>
        <textarea
          id="bandeja-draft"
          rows={2}
          value={draft}
          disabled={Boolean(bloqueo) || ocupado}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void submit();
            }
          }}
          placeholder={bloqueo ? bloqueo : "Escribe tu respuesta…"}
          className="glass-input-sm max-h-28 min-h-[2.5rem] flex-1 resize-none disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={!puedeEnviar}
          className="btn-teal px-3 py-2 text-xs"
        >
          Enviar
        </button>
      </div>
      <p className={`mt-1 text-[11px] ${error ? "text-red-800" : "text-ink/40"}`}>
        {error
          ? textoError(error)
          : bloqueo
            ? bloqueo
            : botTieneControl
              ? "Al enviar tomas el control."
              : "Enter envía · Shift+Enter salto · hasta 25 GB por archivo"}
      </p>
    </form>
  );
}

export function bloqueoDe(input: {
  conv: ConversacionResumenDto | null;
  optOut: boolean;
  items: HistorialItemDto[];
  historialListo: boolean;
  userId?: string;
}): string | null {
  if (!input.conv) return "Este cliente no tiene un hilo para responder.";
  if (
    input.conv.asesorLockId &&
    input.userId &&
    input.conv.asesorLockId !== input.userId
  ) {
    return "Otro asesor ya tomó este hilo.";
  }
  if (input.optOut) return "Este cliente pidió no recibir mensajes.";
  if (
    input.historialListo &&
    ventanaCerrada(input.conv, input.items)
  ) {
    return "Pasaron más de 24 h. WhatsApp no acepta texto libre.";
  }
  return null;
}

function ventanaCerrada(
  conv: ConversacionResumenDto,
  items: HistorialItemDto[],
): boolean {
  if (esSandbox(conv)) return false;
  if (conv.canal !== "whatsapp") return false;
  const inbound = [...items]
    .reverse()
    .find((item) => item.kind === "mensaje" && item.direccion === "entrante");
  if (!inbound) return true;
  return Date.now() - new Date(inbound.creadoEn).getTime() > VENTANA_MS;
}

function esSandbox(conv: ConversacionResumenDto): boolean {
  if (conv.canal === "sandbox") return true;
  return (conv.externalThreadId ?? "").toLowerCase().startsWith("sandbox");
}

function textoError(error: unknown): string {
  const code = codigoDe(error);
  if (code === "OWNERSHIP_CONFLICT") return "Otro asesor ya tomó este hilo.";
  if (code === "OPT_OUT") return "Este cliente pidió no recibir mensajes.";
  if (code === "VENTANA_CERRADA") {
    return "Pasaron más de 24 h. WhatsApp no acepta texto libre.";
  }
  if (code === "ENVIO_FALLIDO") return "No se pudo enviar el mensaje.";
  if (error instanceof ApiError) return "No se pudo enviar el mensaje.";
  return "No se pudo enviar el mensaje.";
}

function codigoDe(error: unknown): string | null {
  if (!(error instanceof ApiError)) return null;
  try {
    const body = JSON.parse(error.message) as { error?: { code?: string } };
    return body.error?.code ?? null;
  } catch {
    return null;
  }
}
