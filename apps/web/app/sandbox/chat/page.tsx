"use client";

import { useMutation } from "@tanstack/react-query";
import { REASONING_LEVELS, type ReasoningStep } from "@tres-cielos/shared";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { postSandboxInbound, type SandboxTurnData } from "../../../lib/api";

const THREAD_KEY = "tc-sandbox-thread";

type ChatLine = {
  id: string;
  role: "user" | "bot";
  text: string;
  at: string;
  turn?: SandboxTurnData;
};

function newId(): string {
  return crypto.randomUUID();
}

export default function SandboxChatPage() {
  const [threadId, setThreadId] = useState("sandbox-web");
  const [lines, setLines] = useState<ChatLine[]>([]);
  const [draft, setDraft] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
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
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [lines]);

  const selected = useMemo(
    () => lines.find((l) => l.id === selectedId) ?? [...lines].reverse().find((l) => l.role === "bot"),
    [lines, selectedId],
  );

  const mutation = useMutation({
    mutationFn: async (texto: string) => {
      const externalMessageId = newId();
      return postSandboxInbound({ texto, threadId, externalMessageId });
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
        },
      ]);
      setSelectedId(botId);
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const texto = draft.trim();
    if (!texto || mutation.isPending) return;
    setDraft("");
    setLines((prev) => [
      ...prev,
      {
        id: newId(),
        role: "user",
        text: texto,
        at: new Date().toISOString(),
      },
    ]);
    mutation.mutate(texto);
  }

  function resetThread() {
    const id = `sandbox-web-${newId().slice(0, 8)}`;
    sessionStorage.setItem(THREAD_KEY, id);
    setThreadId(id);
    setLines([]);
    setSelectedId(null);
  }

  return (
    <div className="mx-auto grid min-h-[calc(100vh-5.75rem)] max-w-6xl grid-cols-1 lg:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)]">
      <section className="flex min-h-[28rem] flex-col border-moss/15 lg:border-r">
        <div className="flex items-end justify-between gap-4 px-6 pt-8 pb-4">
          <div>
            <h1 className="font-display text-3xl text-moss md:text-4xl">
              Chat sandbox
            </h1>
            <p className="mt-1 max-w-md text-sm text-ink/70">
              Prueba el mismo pipeline que Twilio. El razonamiento es documentación interna.
            </p>
          </div>
          <button
            type="button"
            onClick={resetThread}
            className="text-xs text-ink/60 underline decoration-moss/40 hover:text-moss"
          >
            Nuevo hilo
          </button>
        </div>

        <div ref={scroller} className="flex-1 space-y-3 overflow-y-auto px-6 py-4">
          {lines.length === 0 && (
            <p className="animate-rise text-sm text-ink/55">
              Escribe un saludo, una pregunta de horarios o un pedido de precio.
            </p>
          )}
          {lines.map((line, i) => (
            <button
              key={line.id}
              type="button"
              onClick={() => line.turn && setSelectedId(line.id)}
              className={`animate-rise block w-full max-w-[36rem] text-left ${
                line.role === "user" ? "ml-auto" : ""
              }`}
              style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
            >
              <span className="text-[11px] uppercase tracking-wide text-ink/45">
                {line.role === "user" ? "Tú" : "Bot"}
                {line.turn?.ruta ? ` · ${line.turn.ruta}` : ""}
              </span>
              <p
                className={`mt-0.5 whitespace-pre-wrap text-[15px] leading-relaxed ${
                  line.role === "user" ? "text-moss" : "text-ink/90"
                } ${selectedId === line.id ? "underline decoration-leaf/50" : ""}`}
              >
                {line.text}
              </p>
            </button>
          ))}
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

        <form
          onSubmit={onSubmit}
          className="border-t border-moss/15 px-6 py-4"
        >
          <label className="sr-only" htmlFor="sandbox-draft">
            Mensaje
          </label>
          <div className="flex gap-3">
            <input
              id="sandbox-draft"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Escribe como si fueras el prospecto…"
              className="min-w-0 flex-1 border-0 border-b border-moss/30 bg-transparent py-2 text-[15px] outline-none placeholder:text-ink/35 focus:border-leaf"
              autoComplete="off"
            />
            <button
              type="submit"
              disabled={mutation.isPending || !draft.trim()}
              className="text-sm text-moss underline decoration-leaf/60 disabled:opacity-40"
            >
              Enviar
            </button>
          </div>
        </form>
      </section>

      <aside className="flex min-h-[24rem] flex-col px-6 py-8">
        <h2 className="font-display text-xl text-moss">Razonamiento</h2>
        <p className="mt-1 text-sm text-ink/65">
          Niveles de decisión de este turno. No se envía al canal.
        </p>
        {selected?.turn ? (
          <TurnMeta turn={selected.turn} />
        ) : (
          <p className="mt-6 text-sm text-ink/50">
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
                className="animate-timeline border-l border-moss/25 pl-3"
                style={{ animationDelay: `${i * 45}ms` }}
              >
                <p className="text-[11px] uppercase tracking-wider text-moss/80">
                  {level.replaceAll("_", " ")}
                </p>
                {step ? (
                  <StepDetail step={step} />
                ) : (
                  <p className="text-sm text-ink/40">N/A</p>
                )}
              </li>
            );
          })}
        </ol>
      </aside>
    </div>
  );
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
          {step.kind === "cupo" && step.detail.hardQuota
            ? " · cupo duro"
            : ""}
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
