"use client";

import {
  FECHA_ESTADO_LABEL,
  RANGO_INVERSION_LABEL,
  RANGO_PRESUPUESTO_FUERA_LABEL,
  TIPO_EVENTO_LABEL,
  presupuestoBriefSelectValue,
} from "@/components/crm/labels";
import type {
  ActualizarBriefRequest,
  ClienteDetail,
  FechaEstado,
  RangoInversion,
  RangoPresupuestoFuera,
  TipoEventoCrm,
} from "@tres-cielos/shared";
import {
  FECHA_ESTADO,
  RANGO_INVERSION,
  RANGO_PRESUPUESTO_FUERA,
  TIPO_EVENTO,
} from "@tres-cielos/shared";
import { FormEvent, useEffect, useState, type ReactNode } from "react";

type Draft = {
  nombre: string;
  correo: string;
  tipoEvento: string;
  fecha: string;
  fechaEstado: string;
  aforo: string;
  rango: string;
};

type Props = {
  cliente: ClienteDetail;
  busy?: boolean;
  onSave: (input: {
    brief: ActualizarBriefRequest;
    correo: string | null;
    correoCambio: boolean;
  }) => Promise<void>;
};

export function BriefForm({ cliente, busy, onSave }: Props) {
  const saved = draftDe(cliente);
  const [draft, setDraft] = useState(saved);
  const [base, setBase] = useState(saved);

  useEffect(() => {
    const next = draftDe(cliente);
    setDraft((cur) => (igual(cur, base) ? next : cur));
    setBase(next);
    // base is the last snapshot applied from the server.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cliente.id, cliente.actualizadoEn]);

  const dirty = !igual(draft, base);
  const conv = cliente.conversaciones[0];

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((cur) => ({ ...cur, [key]: value }));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!dirty) return;
    const brief: ActualizarBriefRequest = {};
    if (draft.nombre !== base.nombre) brief.nombre = draft.nombre.trim() || null;
    if (draft.tipoEvento !== base.tipoEvento) {
      brief.tipoEvento = (draft.tipoEvento || null) as TipoEventoCrm | null;
    }
    if (draft.fecha !== base.fecha) brief.fechaTentativa = draft.fecha || null;
    if (draft.fechaEstado !== base.fechaEstado) {
      brief.fechaEstado = (draft.fechaEstado || null) as FechaEstado | null;
    }
    if (draft.aforo !== base.aforo) {
      brief.aforo = draft.aforo.trim() ? Number(draft.aforo) : null;
    }
    if (draft.rango !== base.rango) {
      const parsed = parsePresupuestoSelect(draft.rango);
      brief.rangoInversion = parsed.rangoInversion;
      brief.rangoPresupuestoFuera = parsed.rangoPresupuestoFuera;
    }
    await onSave({
      brief,
      correo: draft.correo.trim() ? draft.correo.trim() : null,
      correoCambio: draft.correo !== base.correo,
    });
    setBase(draft);
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="space-y-2">
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-teal">
        Datos del brief
      </h3>
      <div className="grid grid-cols-2 gap-1.5">
        <Field label="Nombre">
          <input className="glass-input-sm" value={draft.nombre} onChange={(e) => set("nombre", e.target.value)} />
        </Field>
        <Field label="Correo">
          <input className="glass-input-sm" type="email" value={draft.correo} onChange={(e) => set("correo", e.target.value)} />
        </Field>
        <Field label="Ocasión">
          <select className="glass-input-sm" value={draft.tipoEvento} onChange={(e) => set("tipoEvento", e.target.value)}>
            <option value="">Sin definir</option>
            {TIPO_EVENTO.map((id) => (
              <option key={id} value={id}>
                {TIPO_EVENTO_LABEL[id] ?? id}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Fecha">
          <input className="glass-input-sm" type="date" value={draft.fecha} onChange={(e) => set("fecha", e.target.value)} />
        </Field>
        <Field label="Estado de la fecha">
          <select className="glass-input-sm" value={draft.fechaEstado} onChange={(e) => set("fechaEstado", e.target.value)}>
            <option value="">Sin definir</option>
            {FECHA_ESTADO.map((id) => (
              <option key={id} value={id}>
                {FECHA_ESTADO_LABEL[id]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Aforo">
          <input className="glass-input-sm" inputMode="numeric" value={draft.aforo} onChange={(e) => set("aforo", e.target.value.replace(/[^\d]/g, ""))} />
        </Field>
        <Field label="Presupuesto" wide>
          <select className="glass-input-sm" value={draft.rango} onChange={(e) => set("rango", e.target.value)}>
            <option value="">Sin definir</option>
            {RANGO_PRESUPUESTO_FUERA.map((id) => (
              <option key={id} value={`pf:${id}`}>
                {RANGO_PRESUPUESTO_FUERA_LABEL[id]}
              </option>
            ))}
            {RANGO_INVERSION.map((id) => (
              <option key={id} value={`inv:${id}`}>
                {RANGO_INVERSION_LABEL[id]}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <p className="flex flex-wrap gap-1 text-[10px] text-ink/45">
        <Meta label="Encaje" value={conv?.encajeEconomico} />
        <Meta label="Intención" value={conv?.intencionNivel} />
        <Meta label="Ruta" value={conv?.rutaComercial} />
        <Meta label="PDF" value={conv?.pdfEnviado ? "enviado" : "no"} />
      </p>
      <button type="submit" className="btn-teal px-3 py-1.5 text-xs" disabled={!dirty || busy}>
        Guardar datos
      </button>
    </form>
  );
}

function Field({
  label,
  wide,
  children,
}: {
  label: string;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <label className={`text-[10px] uppercase tracking-wide text-ink/40 ${wide ? "col-span-2" : ""}`}>
      {label}
      <span className="mt-0.5 block normal-case tracking-normal">{children}</span>
    </label>
  );
}

function Meta({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <span className="rounded-full bg-white/50 px-1.5 py-0.5">
      {label}: {value ? value.replaceAll("_", " ") : "—"}
    </span>
  );
}

function draftDe(cliente: ClienteDetail): Draft {
  const conv = cliente.conversaciones[0];
  const opp = cliente.oportunidades[0];
  return {
    nombre: cliente.nombre ?? "",
    correo: cliente.correo ?? "",
    tipoEvento: opp?.tipoEvento ?? "",
    fecha: opp?.fechaTentativa?.slice(0, 10) ?? "",
    fechaEstado: conv?.fechaEstado ?? "",
    aforo: opp?.aforo != null ? String(opp.aforo) : "",
    rango: conv ? presupuestoBriefSelectValue(conv) : "",
  };
}

function parsePresupuestoSelect(value: string): {
  rangoInversion: RangoInversion | null;
  rangoPresupuestoFuera: RangoPresupuestoFuera | null;
} {
  if (!value) {
    return { rangoInversion: null, rangoPresupuestoFuera: null };
  }
  if (value.startsWith("pf:")) {
    return {
      rangoInversion: null,
      rangoPresupuestoFuera: value.slice(3) as RangoPresupuestoFuera,
    };
  }
  if (value.startsWith("inv:")) {
    return {
      rangoInversion: value.slice(4) as RangoInversion,
      rangoPresupuestoFuera: null,
    };
  }
  return {
    rangoInversion: value as RangoInversion,
    rangoPresupuestoFuera: null,
  };
}

function igual(a: Draft, b: Draft): boolean {
  return (Object.keys(a) as Array<keyof Draft>).every((key) => a[key] === b[key]);
}
