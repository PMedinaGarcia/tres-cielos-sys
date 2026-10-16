"use client";

import { ApiError } from "@/lib/http";
import type { ConversacionResumenDto, HistorialItemDto } from "@tres-cielos/shared";
import { FormEvent, useState } from "react";

const VENTANA_MS = 24 * 60 * 60 * 1000;

type Props = {
  conv: ConversacionResumenDto | null;
  optOut: boolean;
  items: HistorialItemDto[];
  historialListo: boolean;
  userId?: string;
  sending: boolean;
  error: unknown;
  onSend: (texto: string) => void;
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
  const bloqueo = bloqueoDe({ conv, optOut, items, historialListo, userId });
  const botTieneControl = conv != null && conv.estadoBot !== "humano" && !bloqueo;

  function submit(e?: FormEvent) {
    e?.preventDefault();
    const texto = draft.trim();
    if (!texto || sending || bloqueo) return;
    setDraft("");
    onSend(texto);
  }

  return (
    <form onSubmit={submit} className="border-t border-white/50 px-3 py-2.5">
      <div className="flex items-end gap-2">
        <label className="sr-only" htmlFor="bandeja-draft">
          Respuesta
        </label>
        <textarea
          id="bandeja-draft"
          rows={2}
          value={draft}
          disabled={Boolean(bloqueo) || sending}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={bloqueo ? bloqueo : "Escribe tu respuesta…"}
          className="glass-input-sm max-h-28 min-h-[2.5rem] flex-1 resize-none disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={Boolean(bloqueo) || sending || !draft.trim()}
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
              : "Enter envía · Shift+Enter salto de línea"}
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
