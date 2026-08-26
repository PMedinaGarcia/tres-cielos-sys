"use client";

import { useMutation } from "@tanstack/react-query";
import {
  HABLAR_ASESOR_PAYLOAD,
  HABLAR_ASESOR_TEXTO,
  HABLAR_ASESOR_TITLE,
  REASONING_LEVELS,
  type ReasoningStep,
  type WaButton,
  type WaContent,
} from "@tres-cielos/shared";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { postSandboxInbound, type SandboxTurnData } from "@/lib/api";

const THREAD_KEY = "tc-sandbox-thread";

type ChatLine = {
  id: string;
  role: "user" | "bot";
  text: string;
  at: string;
  turn?: SandboxTurnData;
  waContent?: WaContent | null;
};

function newId(): string {
  return crypto.randomUUID();
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function SandboxChatPage() {
  const [threadId, setThreadId] = useState("sandbox-web");
  const [lines, setLines] = useState<ChatLine[]>([]);
  const [draft, setDraft] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [listOpenId, setListOpenId] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem(THREAD_KEY);
    if (stored) setThreadId(stored);
    else {
      const id = `sandbox-web-${newId().slice(0, 8)}`;
      sessionStorage.setItem(THREAD_KEY, id);
      setThreadId(id);
    }
  }, []);

  useEffect(() => {
    scroller.current?.scrollTo({
      top: scroller.current.scrollHeight,
      behavior: "smooth",
    });
  }, [lines, listOpenId]);

  const selected = useMemo(
    () =>
      lines.find((l) => l.id === selectedId) ??
      [...lines].reverse().find((l) => l.role === "bot"),
    [lines, selectedId],
  );

  const lastBot = useMemo(
    () => [...lines].reverse().find((l) => l.role === "bot"),
    [lines],
  );

  const lastLine = lines[lines.length - 1];
  const botActivo =
    !lastBot?.turn ||
    (lastBot.turn.estadoBot === "activo" &&
      !lastBot.turn.silencio &&
      lastBot.turn.ruta !== "handoff");
  const enrutado =
    lastBot?.turn?.ruta === "handoff" ||
    lastBot?.turn?.estadoBot === "escalado" ||
    lastBot?.turn?.estadoBot === "humano";

  const mutation = useMutation({
    mutationFn: async (input: { texto: string; buttonPayload?: string }) => {
      const externalMessageId = newId();
      return postSandboxInbound({
        texto: input.texto,
        threadId,
        externalMessageId,
        buttonPayload: input.buttonPayload,
      });
    },
    onSuccess: (data) => {
      if (data.duplicate) {
        const botId = newId();
        setLines((prev) => [
          ...prev,
          {
            id: botId,
            role: "bot",
            text: "(mensaje duplicado — sin nuevo turno)",
            at: new Date().toISOString(),
            turn: data,
          },
        ]);
        setSelectedId(botId);
        return;
      }
      const botId = newId();
      setLines((prev) => [
        ...prev,
        {
          id: botId,
          role: "bot",
          text: data.silencio
            ? "(silencio — el bot no responde)"
            : data.textoRespuesta,
          at: new Date().toISOString(),
          turn: data,
          waContent: data.waContent,
        },
      ]);
      setSelectedId(botId);
      setListOpenId(data.waContent?.kind === "list-picker" ? botId : null);
    },
  });

  function send(texto: string, buttonPayload?: string) {
    const trimmed = texto.trim();
    if (!trimmed || mutation.isPending) return;
    setDraft("");
    setListOpenId(null);
    setLines((prev) => [
      ...prev,
      {
        id: newId(),
        role: "user",
        text: trimmed,
        at: new Date().toISOString(),
      },
    ]);
    mutation.mutate({ texto: trimmed, buttonPayload });
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    send(draft);
  }

  function onTap(button: WaButton) {
    send(button.title, button.id);
  }

  function resetThread() {
    const id = `sandbox-web-${newId().slice(0, 8)}`;
    sessionStorage.setItem(THREAD_KEY, id);
    setThreadId(id);
    setLines([]);
    setSelectedId(null);
    setListOpenId(null);
  }

  return (
    <div className="mx-auto grid min-h-[calc(100vh-5.75rem)] max-w-6xl grid-cols-1 lg:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)]">
      <section className="glass m-4 flex min-h-[28rem] flex-col rounded-glass lg:mr-2">
        <div className="flex items-end justify-between gap-4 px-6 pt-8 pb-4">
          <div>
            <h1 className="font-display text-3xl text-ink md:text-4xl">
              Chat sandbox
            </h1>
            <p className="mt-1 max-w-md text-sm text-ink/65">
              Prueba el mismo pipeline que Twilio. El razonamiento es
              documentación interna.
            </p>
          </div>
          <button
            type="button"
            onClick={resetThread}
            className="text-xs text-ink/55 underline decoration-teal/40 hover:text-teal"
          >
            Nuevo hilo
          </button>
        </div>

        {enrutado && (
          <div className="mx-6 mb-2 rounded-xl border border-teal/25 bg-white/50 px-3 py-2 text-sm text-teal">
            Enrutado a asesor
            {lastBot?.turn?.motivoHandoff
              ? ` · ${lastBot.turn.motivoHandoff}`
              : ""}
            . El bot no responde más en este hilo.
          </div>
        )}

        <div ref={scroller} className="flex-1 space-y-3 overflow-y-auto px-6 py-4">
          {lines.length === 0 && (
            <p className="animate-rise text-sm text-ink/50">
              Escribe un saludo, una pregunta de horarios o un pedido de precio.
            </p>
          )}
          {lines.map((line, i) => {
            const interactive =
              line.role === "bot" &&
              lastLine?.id === line.id &&
              botActivo &&
              !mutation.isPending;
            return (
              <div
                key={line.id}
                className={`animate-rise flex w-full ${
                  line.role === "user" ? "justify-end" : "justify-start"
                }`}
                style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
              >
                <div className="w-full max-w-[36rem]">
                  <div
                    role={line.turn ? "button" : undefined}
                    tabIndex={line.turn ? 0 : undefined}
                    onClick={() => line.turn && setSelectedId(line.id)}
                    onKeyDown={(e) => {
                      if (!line.turn) return;
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedId(line.id);
                      }
                    }}
                    className="block w-full text-left"
                  >
                    <span className="text-[11px] uppercase tracking-wide text-ink/40">
                      {line.role === "user" ? "Tú" : "Bot"}
                      {line.turn?.ruta ? ` · ${line.turn.ruta}` : ""}
                      <span className="ml-2 normal-case tracking-normal text-ink/35">
                        {formatTime(line.at)}
                      </span>
                    </span>
                    <p
                      className={`mt-1 whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-[15px] leading-relaxed ${
                        line.role === "user"
                          ? "rounded-br-md bg-teal text-white"
                          : "rounded-bl-md border border-white/60 bg-white/55 text-ink/90"
                      } ${selectedId === line.id ? "ring-1 ring-teal/50" : ""}`}
                    >
                      {line.text}
                    </p>
                    {line.role === "bot" && line.waContent?.document && (
                      <a
                        href={line.waContent.document.url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-flex items-center gap-2 rounded-full border border-teal/30 bg-white/40 px-3 py-1.5 text-xs text-teal hover:border-teal"
                      >
                        PDF · {line.waContent.document.filename}
                      </a>
                    )}
                    {line.role === "bot" && line.waContent && (
                      <span className="mt-1 inline-block text-[10px] uppercase tracking-wider text-ink/40">
                        {line.waContent.templateId} · {line.waContent.kind}
                      </span>
                    )}
                  </div>
                  {line.role === "bot" && line.waContent && (
                    <WaInteractive
                      content={line.waContent}
                      enabled={interactive}
                      listOpen={
                        listOpenId === line.id ||
                        (interactive && line.waContent.kind === "list-picker")
                      }
                      onToggleList={() =>
                        setListOpenId((cur) =>
                          cur === line.id ? null : line.id,
                        )
                      }
                      onTap={onTap}
                    />
                  )}
                </div>
              </div>
            );
          })}
          {mutation.isPending && (
            <p className="animate-rise text-sm text-ink/50">Pensando…</p>
          )}
          {mutation.isError && (
            <p className="text-sm text-red-800">
              {mutation.error instanceof Error
                ? mutation.error.message
                : "Error al llamar al API"}
            </p>
          )}
        </div>

        <form onSubmit={onSubmit} className="border-t border-white/50 px-6 py-4">
          <div className="mb-3">
            <button
              type="button"
              disabled={mutation.isPending || !botActivo}
              onClick={() => send(HABLAR_ASESOR_TEXTO, HABLAR_ASESOR_PAYLOAD)}
              className="rounded-full border border-teal/30 bg-white/40 px-3 py-1.5 text-xs text-teal hover:border-teal disabled:opacity-40"
            >
              {HABLAR_ASESOR_TITLE}
            </button>
          </div>
          <label className="sr-only" htmlFor="sandbox-draft">
            Mensaje
          </label>
          <div className="flex gap-3">
            <input
              id="sandbox-draft"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Escribe como si fueras el prospecto…"
              className="min-w-0 flex-1 rounded-xl border border-white/70 bg-white/50 px-3 py-2 text-[15px] outline-none placeholder:text-ink/35 focus:border-teal/50 focus:ring-2 focus:ring-teal/20"
              autoComplete="off"
            />
            <button
              type="submit"
              disabled={mutation.isPending || !draft.trim()}
              className="btn-teal"
            >
              Enviar
            </button>
          </div>
        </form>
      </section>

      <aside className="glass m-4 flex min-h-[24rem] flex-col rounded-glass px-6 py-8 lg:ml-2">
        <h2 className="font-display text-xl text-ink">Razonamiento</h2>
        <p className="mt-1 text-sm text-ink/60">
          Niveles de decisión de este turno. No se envía al canal.
        </p>
        {selected?.turn ? (
          <TurnMeta turn={selected.turn} />
        ) : (
          <p className="mt-6 text-sm text-ink/45">
            Envía un mensaje para ver intent, ruta, gates, tools y RAG.
          </p>
        )}
        <ol className="mt-6 flex-1 space-y-4 overflow-y-auto pb-8">
          {REASONING_LEVELS.map((level, i) => {
            const step = selected?.turn?.reasoningTrace?.steps.find(
              (s) => s.level === level,
            );
            return (
              <li
                key={level}
                className="animate-timeline border-l border-celeste pl-3"
                style={{ animationDelay: `${i * 45}ms` }}
              >
                <p className="text-[11px] uppercase tracking-wider text-teal/80">
                  {level.replaceAll("_", " ")}
                </p>
                {step ? (
                  <StepDetail step={step} />
                ) : (
                  <p className="text-sm text-ink/35">N/A</p>
                )}
              </li>
            );
          })}
        </ol>
      </aside>
    </div>
  );
}

function WaInteractive({
  content,
  enabled,
  listOpen,
  onToggleList,
  onTap,
}: {
  content: WaContent;
  enabled: boolean;
  listOpen: boolean;
  onToggleList: () => void;
  onTap: (button: WaButton) => void;
}) {
  if (content.kind === "quick-reply" && content.buttons?.length) {
    const buttons = enabled
      ? content.buttons.filter((btn) => btn.id !== HABLAR_ASESOR_PAYLOAD)
      : content.buttons;
    if (buttons.length === 0) return null;
    return (
      <div className="mt-2 flex flex-wrap gap-2">
        {buttons.map((btn) => (
          <button
            key={btn.id}
            type="button"
            disabled={!enabled}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onTap(btn);
            }}
            className="rounded-full border border-teal/30 bg-white/40 px-3 py-1.5 text-xs text-teal hover:border-teal disabled:cursor-default disabled:opacity-40"
          >
            {btn.title}
          </button>
        ))}
      </div>
    );
  }

  if (content.kind === "list-picker" && content.list) {
    const items = content.list.items;
    const open = enabled || listOpen;
    return (
      <div
        className="mt-2 w-full min-w-[16rem]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!enabled) onToggleList();
          }}
          className="flex w-full items-center justify-between rounded-t-lg border border-white/60 bg-white/70 px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-teal"
          aria-expanded={open}
        >
          <span>{content.list.button}</span>
          <span className="text-[10px] font-normal normal-case tracking-normal text-ink/45">
            {enabled
              ? "Elige una opción"
              : open
                ? "Ocultar"
                : `${items.length} opciones`}
          </span>
        </button>
        {open && (
          <ul className="overflow-hidden rounded-b-lg border border-t-0 border-white/60 bg-white/45">
            {items.map((item) => (
              <li key={item.id} className="border-t border-white/40 first:border-t-0">
                <button
                  type="button"
                  disabled={!enabled}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onTap({ id: item.id, title: item.title });
                  }}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm text-ink hover:bg-celeste/40 disabled:cursor-default disabled:opacity-50 disabled:hover:bg-transparent"
                >
                  <span className="flex flex-col">
                    <span>{item.title}</span>
                    {item.description && (
                      <span className="text-xs text-ink/50">{item.description}</span>
                    )}
                  </span>
                  {enabled && <span className="text-ink/30">›</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return null;
}

function TurnMeta({ turn }: { turn: SandboxTurnData }) {
  return (
    <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-ink/80">
      <dt className="text-ink/50">Ruta</dt>
      <dd>{turn.ruta}</dd>
      <dt className="text-ink/50">Estado</dt>
      <dd>{turn.estadoBot}</dd>
      <dt className="text-ink/50">Guion</dt>
      <dd>{turn.pasoGuion ?? "—"}</dd>
      <dt className="text-ink/50">Handoff</dt>
      <dd>{turn.motivoHandoff ?? "—"}</dd>
      {turn.waContent && (
        <>
          <dt className="text-ink/50">Plantilla</dt>
          <dd>{turn.waContent.templateId}</dd>
        </>
      )}
    </dl>
  );
}

function StepDetail({ step }: { step: ReasoningStep }) {
  switch (step.level) {
    case "preflight":
      return (
        <p className="text-sm">
          {step.kind}
          {step.kind === "estado_bot" && step.detail.estadoBot
            ? ` · ${String(step.detail.estadoBot)}`
            : ""}
          {step.kind === "cupo" && step.detail.hardQuota ? " · cupo duro" : ""}
        </p>
      );
    case "intent":
      return <p className="text-sm">{step.value}</p>;
    case "routing":
      return (
        <p className="text-sm">
          {step.decision.kind}
          {step.decision.motivo ? ` · ${step.decision.motivo}` : ""}
        </p>
      );
    case "gate_precio":
      return (
        <p className="text-sm">
          {step.action}
          {step.rama ? ` (${step.rama})` : ""}
        </p>
      );
    case "guion":
      return (
        <p className="text-sm">
          {step.pasoFrom} → {step.pasoTo}
          {step.camposDelta?.length ? ` · ${step.camposDelta.join(", ")}` : ""}
        </p>
      );
    case "catalog_tools":
      return (
        <p className="text-sm">
          {step.tools.map((t) => t.nombre).join(", ") || "sin tools"}
          {step.antiHallucination ? ` · ${step.antiHallucination}` : ""}
        </p>
      );
    case "rag":
      return (
        <p className="text-sm">
          umbral {step.umbral} · scores{" "}
          {step.scoresRerank.map((s) => s.toFixed(2)).join(", ") || "—"}
          {step.fragmentoIds.length
            ? ` · ${step.fragmentoIds.length} fragmentos`
            : ""}
        </p>
      );
    case "handoff":
      return <p className="text-sm">{step.motivo}</p>;
    case "outcome":
      return (
        <p className="text-sm">
          {step.ruta} · {step.estadoBot}
        </p>
      );
    default:
      return <p className="text-sm">—</p>;
  }
}
