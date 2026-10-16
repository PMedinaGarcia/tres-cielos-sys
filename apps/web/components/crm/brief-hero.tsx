"use client";

import {
  TIPO_EVENTO_LABEL,
  formatWhen,
  labelPresupuestoBrief,
} from "@/components/crm/labels";
import type { ClienteDetail } from "@tres-cielos/shared";
import Link from "next/link";

type Props = {
  cliente: ClienteDetail;
};

const EM_DASH = "\u2014";

export function BriefHero({ cliente }: Props) {
  const conv = cliente.conversaciones[0];
  const opp = cliente.oportunidades[0];
  const ocasion = cliente.tipoEvento
    ? TIPO_EVENTO_LABEL[cliente.tipoEvento] ?? cliente.tipoEvento
    : null;
  const fecha = conv?.fechaEvento ?? opp?.fechaTentativa ?? null;
  const rango = conv ? labelPresupuestoBrief(conv) : null;

  const metrics = [
    { label: "Ocasi\u00f3n", value: ocasion ?? EM_DASH, accent: true },
    { label: "Fecha del evento", value: fecha ?? EM_DASH },
    { label: "Aforo", value: opp?.aforo != null ? String(opp.aforo) : EM_DASH },
    { label: "Inversi\u00f3n", value: rango ?? EM_DASH },
  ];

  const signals = [
    conv?.encajeEconomico
      ? { k: "Encaje", v: conv.encajeEconomico.replace(/_/g, " ") }
      : null,
    conv?.intencionNivel
      ? { k: "Intenci\u00f3n", v: conv.intencionNivel }
      : null,
    conv?.rutaComercial
      ? { k: "Ruta", v: conv.rutaComercial.replace(/_/g, " ") }
      : null,
    conv?.pdfEnviado ? { k: "Propuesta", v: "PDF enviado" } : null,
  ].filter(Boolean) as Array<{ k: string; v: string }>;

  return (
    <section className="glass-strong relative overflow-hidden rounded-glass px-5 py-5 animate-rise">
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-teal/15 blur-2xl"
        aria-hidden
      />
      <div className="relative flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-teal">
            Brief del cliente
          </p>
          <p className="mt-1 text-xs text-ink/50">
            {"\u00daltimo contacto"} {formatWhen(cliente.ultimoContactoEn)}
          </p>
        </div>
        <Link
          href={`/bandeja?c=${cliente.id}`}
          className="shrink-0 rounded-full bg-teal px-4 py-2 text-xs font-medium text-white shadow-glass transition hover:bg-teal-dark"
        >
          Abrir en bandeja
        </Link>
      </div>

      <dl className="relative mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {metrics.map((m) => (
          <div
            key={m.label}
            className={`rounded-2xl border px-3 py-3 ${
              m.accent
                ? "border-teal/25 bg-teal/8"
                : "border-white/60 bg-white/35"
            }`}
          >
            <dt className="text-[10px] font-medium uppercase tracking-wide text-ink/45">
              {m.label}
            </dt>
            <dd
              className={`mt-1 font-display text-lg leading-tight ${
                m.accent ? "text-teal" : "text-ink"
              }`}
            >
              {m.value}
            </dd>
          </div>
        ))}
      </dl>

      {signals.length > 0 ? (
        <ul className="relative mt-4 flex flex-wrap gap-2">
          {signals.map((s) => (
            <li
              key={s.k}
              className="rounded-full border border-white/70 bg-white/50 px-3 py-1 text-xs text-ink/80"
            >
              <span className="text-ink/45">{s.k}</span> {s.v}
            </li>
          ))}
        </ul>
      ) : (
        <p className="relative mt-4 text-sm text-ink/45">
          {"El bot a\u00fan no captur\u00f3 se\u00f1ales comerciales. Revisa el hilo en bandeja."}
        </p>
      )}
    </section>
  );
}
