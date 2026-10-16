"use client";

import { API_URL } from "@/lib/http";
import { useEffect, useRef } from "react";

export type PanelRealtimeEvent =
  | {
      type: "historial";
      clienteId: string;
      conversacionId: string;
      mensajeId?: string;
    }
  | { type: "bandeja"; clienteId?: string };

type Options = {
  clienteId?: string;
  enabled?: boolean;
  onEvent: (event: PanelRealtimeEvent) => void;
};

/**
 * SSE del panel con cookies de sesion (misma base que apiFetch).
 */
export function usePanelRealtime({
  clienteId,
  enabled = true,
  onEvent,
}: Options) {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!enabled) return;
    const qs = clienteId ? `?clienteId=${encodeURIComponent(clienteId)}` : "";
    const url = `${API_URL}/panel/eventos${qs}`;
    const source = new EventSource(url, { withCredentials: true });
    source.onmessage = (msg) => {
      try {
        const data = JSON.parse(msg.data) as PanelRealtimeEvent;
        onEventRef.current(data);
      } catch {
        /* ignore */
      }
    };
    source.onerror = () => {
      /* el navegador reintenta solo */
    };
    return () => source.close();
  }, [clienteId, enabled]);
}