"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "bandeja-paneles-v1";

type PanelesState = {
  bandeja: boolean;
  datos: boolean;
};

const DEFAULT: PanelesState = { bandeja: true, datos: true };

function readStored(): PanelesState {
  if (typeof window === "undefined") return DEFAULT;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT;
    const parsed = JSON.parse(raw) as Partial<PanelesState>;
    return {
      bandeja: parsed.bandeja !== false,
      datos: parsed.datos !== false,
    };
  } catch {
    return DEFAULT;
  }
}

export function useBandejaPaneles() {
  const [bandejaAbierta, setBandejaAbierta] = useState(true);
  const [datosAbierto, setDatosAbierto] = useState(true);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = readStored();
    setBandejaAbierta(stored.bandeja);
    setDatosAbierto(stored.datos);
    setHydrated(true);
  }, []);

  const persist = useCallback((next: PanelesState) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore quota */
    }
  }, []);

  const toggleBandeja = useCallback(() => {
    setBandejaAbierta((prev) => {
      const next = !prev;
      persist({ bandeja: next, datos: datosAbierto });
      return next;
    });
  }, [datosAbierto, persist]);

  const toggleDatos = useCallback(() => {
    setDatosAbierto((prev) => {
      const next = !prev;
      persist({ bandeja: bandejaAbierta, datos: next });
      return next;
    });
  }, [bandejaAbierta, persist]);

  const setBandeja = useCallback(
    (open: boolean) => {
      setBandejaAbierta(open);
      persist({ bandeja: open, datos: datosAbierto });
    },
    [datosAbierto, persist],
  );

  const setDatos = useCallback(
    (open: boolean) => {
      setDatosAbierto(open);
      persist({ bandeja: bandejaAbierta, datos: open });
    },
    [bandejaAbierta, persist],
  );

  return {
    hydrated,
    bandejaAbierta,
    datosAbierto,
    toggleBandeja,
    toggleDatos,
    setBandeja,
    setDatos,
  };
}
