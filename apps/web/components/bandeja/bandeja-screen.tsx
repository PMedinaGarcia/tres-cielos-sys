"use client";

import { BriefForm } from "@/components/bandeja/brief-form";
import { Composer } from "@/components/bandeja/composer";
import { EtapaCompacta } from "@/components/bandeja/etapa-compacta";
import { Hilo } from "@/components/bandeja/hilo";
import { ListaHilos } from "@/components/bandeja/lista-hilos";
import { NotasCompactas } from "@/components/bandeja/notas-compactas";
import { PanelEdgeToggle, PanelRail } from "@/components/bandeja/panel-edge-toggle";
import { useBandejaPaneles } from "@/components/bandeja/use-bandeja-paneles";
import { useAuth } from "@/lib/auth-context";
import {
  actualizarBrief,
  devolverABot,
  enviarMensaje,
  tomarControl,
} from "@/lib/conversaciones-api";
import {
  addNotaCliente,
  getCliente,
  getClienteHistorial,
  listClientes,
  patchCliente,
  patchOportunidad,
} from "@/lib/crm-api";
import type { ActualizarOportunidadRequest, HistorialItemDto } from "@tres-cielos/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { usePanelRealtime } from "@/lib/use-panel-realtime";
import { useCallback, useEffect, useState, type CSSProperties } from "react";

export function BandejaScreen() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const clienteId = params.get("c") ?? "";
  const cola = params.get("cola") ?? "";
  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [datos, setDatos] = useState(false);
  const {
    hydrated,
    bandejaAbierta,
    datosAbierto,
    toggleBandeja,
    toggleDatos,
    setBandeja,
    setDatos: setDatosPanel,
  } = useBandejaPaneles();

  useEffect(() => {
    const timer = setTimeout(() => setQDebounced(q.trim()), 300);
    return () => clearTimeout(timer);
  }, [q]);

  function setParam(next: Record<string, string | null>) {
    const search = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(next)) {
      if (!value) search.delete(key);
      else search.set(key, value);
    }
    const qs = search.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const lista = useQuery({
    queryKey: ["bandeja", "clientes", cola, qDebounced],
    queryFn: () =>
      listClientes({
        q: qDebounced || undefined,
        cola: cola || undefined,
        page: 1,
        pageSize: 80,
      }),
    refetchInterval: false,
  });

  const detalle = useQuery({
    queryKey: ["bandeja", "cliente", clienteId],
    queryFn: () => getCliente(clienteId),
    enabled: Boolean(clienteId),
    refetchInterval: false,
  });

  const historial = useQuery({
    queryKey: ["bandeja", "historial", clienteId],
    queryFn: () => getClienteHistorial(clienteId, { recientes: true, pageSize: 80 }),
    enabled: Boolean(clienteId),
    refetchInterval: false,
  });

  const onRealtime = useCallback(
    (event: { type: string; clienteId?: string }) => {
      if (event.type === "bandeja") {
        void queryClient.invalidateQueries({ queryKey: ["bandeja", "clientes"] });
      }
      if (
        event.type === "historial" &&
        (!clienteId || event.clienteId === clienteId)
      ) {
        void queryClient.invalidateQueries({
          queryKey: ["bandeja", "historial", clienteId],
        });
        void queryClient.invalidateQueries({
          queryKey: ["bandeja", "cliente", clienteId],
        });
      }
    },
    [clienteId, queryClient],
  );

  usePanelRealtime({
    clienteId: clienteId || undefined,
    enabled: true,
    onEvent: onRealtime,
  });

  const cliente = detalle.data ?? null;
  const conv = cliente?.conversaciones[0] ?? null;
  const oportunidad = cliente?.oportunidades[0] ?? null;

  function refreshCliente() {
    return Promise.all([
      queryClient.invalidateQueries({ queryKey: ["bandeja", "cliente", clienteId] }),
      queryClient.invalidateQueries({ queryKey: ["bandeja", "historial", clienteId] }),
      queryClient.invalidateQueries({ queryKey: ["bandeja", "clientes"] }),
    ]);
  }

  const envio = useMutation({
    mutationFn: (input: { contenido?: string; adjuntos?: Array<{ uploadId: string }> }) => {
      if (!conv) throw new Error("SIN_HILO");
      return enviarMensaje(conv.id, input);
    },
    onMutate: async (input) => {
      const contenido = input.contenido?.trim() ?? "";
      await queryClient.cancelQueries({ queryKey: ["bandeja", "historial", clienteId] });
      const key = ["bandeja", "historial", clienteId] as const;
      const previo = queryClient.getQueryData<typeof historial.data>(key);
      const optimista: HistorialItemDto = {
        id: `opt:${crypto.randomUUID()}`,
        kind: "mensaje",
        tipo: "mensaje",
        actor: "asesor",
        canal: conv?.canal ?? "whatsapp",
        creadoEn: new Date().toISOString(),
        contenido,
        conversacionId: conv?.id ?? null,
        mensajeId: null,
        oportunidadId: null,
        vinculo: "propio",
        vinculoClienteId: null,
        direccion: "saliente",
        autorMensaje: "asesor",
        adjuntos: [],
      };
      queryClient.setQueryData(key, {
        data: [...(previo?.data ?? []), optimista],
        meta: previo?.meta ?? { page: 1, pageSize: 80, total: 1 },
      });
      return { previo };
    },
    onError: (_error, _contenido, ctx) => {
      if (ctx?.previo) {
        queryClient.setQueryData(["bandeja", "historial", clienteId], ctx.previo);
      }
    },
    onSettled: () => {
      void refreshCliente();
    },
  });

  const control = useMutation({
    mutationFn: async (accion: "tomar" | "devolver") => {
      if (!conv) return;
      if (accion === "tomar") await tomarControl(conv.id, "bandeja");
      else await devolverABot(conv.id, "asesor_libera");
    },
    onSettled: () => {
      void refreshCliente();
    },
  });

  const comercial = useMutation({
    mutationFn: (input: { id: string; body: ActualizarOportunidadRequest }) =>
      patchOportunidad(input.id, input.body),
    onSettled: () => {
      void refreshCliente();
    },
  });

  const ficha = useMutation({
    mutationFn: async (input: {
      brief: Parameters<typeof actualizarBrief>[1];
      correo: string | null;
      correoCambio: boolean;
    }) => {
      if (!conv) throw new Error("SIN_HILO");
      if (Object.keys(input.brief).length > 0) {
        await actualizarBrief(conv.id, input.brief);
      }
      if (input.correoCambio) {
        await patchCliente(clienteId, { correo: input.correo });
      }
    },
    onSettled: () => {
      void refreshCliente();
    },
  });

  const nota = useMutation({
    mutationFn: (cuerpo: string) => addNotaCliente(clienteId, { cuerpo }),
    onSettled: () => {
      void refreshCliente();
    },
  });

  const ocupado = control.isPending || comercial.isPending || ficha.isPending || nota.isPending;
  const abierto = Boolean(clienteId);

  const layoutStyle = hydrated
    ? ({
        "--bandeja-col": bandejaAbierta ? "20rem" : "2.5rem",
        "--datos-col": datosAbierto ? "22rem" : "2.5rem",
      } as CSSProperties)
    : undefined;

  const mostrarBandejaLista = bandejaAbierta;
  const mostrarBandejaRail = !bandejaAbierta;
  const mostrarDatosPanel = datosAbierto;
  const mostrarDatosRail = !datosAbierto;

  return (
    <div className="mx-auto flex h-[calc(100dvh-7.5rem)] max-w-[90rem] flex-col px-2 py-2 lg:h-[calc(100dvh-5.75rem)] lg:px-4 lg:py-3">
      {lista.error ? (
        <p className="mb-2 text-xs text-red-800">No se pudo cargar la bandeja.</p>
      ) : null}
      <div
        className="bandeja-layout bandeja-layout--datos"
        style={layoutStyle}
      >
        {mostrarBandejaRail ? (
          <div className={`hidden h-full min-h-0 lg:block ${abierto ? "" : ""}`}>
            <PanelRail
              side="left"
              label="Mostrar bandeja"
              onExpand={() => setBandeja(true)}
            />
          </div>
        ) : null}
        <div
          className={`h-full min-h-0 ${abierto ? "max-lg:hidden" : ""} ${
            !mostrarBandejaLista ? "lg:hidden" : ""
          }`}
        >
          <ListaHilos
            q={q}
            onQ={setQ}
            cola={cola}
            onCola={(next) => setParam({ cola: next || null })}
            rows={lista.data?.data ?? []}
            total={lista.data?.meta.total ?? 0}
            loading={lista.isLoading}
            selectedId={clienteId || null}
            onSelect={(id) => {
              setDatos(false);
              setParam({ c: id });
            }}
            onCollapseBandeja={toggleBandeja}
          />
        </div>
        <div className={`h-full min-h-0 ${abierto ? "" : "hidden lg:block"}`}>
          <Hilo
            cliente={cliente}
            items={historial.data?.data ?? []}
            loading={Boolean(clienteId) && historial.isLoading}
            userId={user?.id}
            busy={ocupado}
            onBack={() => setParam({ c: null })}
            onDatos={() => setDatos(true)}
            onTomar={() => control.mutate("tomar")}
            onDevolver={() => control.mutate("devolver")}
            composer={
              cliente ? (
                <Composer
                  conv={conv}
                  optOut={cliente.optOutMensajeria}
                  items={historial.data?.data ?? []}
                  historialListo={historial.isSuccess}
                  userId={user?.id}
                  sending={envio.isPending}
                  error={envio.error}
                  onSend={(payload) => envio.mutate(payload)}
                />
              ) : null
            }
          />
        </div>
        {mostrarDatosRail ? (
          <div className="hidden h-full min-h-0 xl:block">
            <PanelRail
              side="right"
              label="Mostrar ficha"
              onExpand={() => setDatosPanel(true)}
            />
          </div>
        ) : null}
        <aside
          className={`glass h-full min-h-0 flex-col overflow-y-auto rounded-glass px-3 py-3 ${
            datos
              ? "fixed inset-x-2 bottom-2 top-24 z-20 flex bg-[#f4fbfe] xl:static xl:inset-auto xl:z-auto xl:bg-transparent"
              : mostrarDatosPanel
                ? "hidden xl:flex"
                : "hidden"
          } ${datos ? "flex" : ""}`}
        >
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-medium text-ink xl:text-ink/60">
              {datos ? "Datos" : "Ficha"}
            </p>
            <div className="flex items-center gap-1">
              <div className="hidden xl:block">
                <PanelEdgeToggle
                  side="right"
                  expanded
                  onToggle={toggleDatos}
                  label="Ocultar ficha"
                />
              </div>
              <button
                type="button"
                className="text-xs text-teal xl:hidden"
                onClick={() => setDatos(false)}
              >
                Cerrar
              </button>
            </div>
          </div>
          {cliente && oportunidad ? (
            <div className="space-y-4">
              <EtapaCompacta
                key={oportunidad.id + oportunidad.etapa + oportunidad.visitaEstado}
                oportunidad={oportunidad}
                busy={ocupado}
                onPatch={(id, body) =>
                  comercial.mutateAsync({ id, body }).then(() => undefined)
                }
              />
              <BriefForm
                cliente={cliente}
                busy={ocupado}
                onSave={(input) => ficha.mutateAsync(input)}
              />
              {ficha.error ? (
                <p className="text-[11px] text-red-800">No se pudieron guardar los datos.</p>
              ) : null}
              <NotasCompactas
                clienteId={cliente.id}
                notas={cliente.notas}
                busy={ocupado}
                onAdd={(cuerpo) => nota.mutateAsync(cuerpo).then(() => undefined)}
              />
            </div>
          ) : (
            <p className="text-xs text-ink/40">
              {clienteId
                ? "Cargando datos\u2026"
                : "Los datos del brief aparecen al elegir un cliente."}
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
