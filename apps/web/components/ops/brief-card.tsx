import type { BriefCardDto } from "@tres-cielos/shared";

export function BriefCard({ brief }: { brief: BriefCardDto }) {
  const rows: Array<[string, string]> = [
    ["Nombre", brief.nombre ?? "—"],
    ["Ocasión", brief.ocasion ?? "—"],
    ["Fecha", brief.fechaEstado ?? "—"],
    ["Aforo", brief.aforo != null ? String(brief.aforo) : "—"],
    ["Rango", brief.rango ?? "—"],
    ["Encaje", brief.encaje ?? "—"],
    ["Intención", brief.intencion ?? "—"],
    ["Ruta", brief.ruta ?? "—"],
    ["PDF enviado", brief.pdfEnviado ? "sí" : "no"],
  ];
  return (
    <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt className="text-[11px] uppercase tracking-wide text-ink/40">{k}</dt>
          <dd className="font-medium text-ink">{v}</dd>
        </div>
      ))}
      {brief.ultimaPregunta ? (
        <div className="col-span-2">
          <dt className="text-[11px] uppercase tracking-wide text-ink/40">
            Última pregunta
          </dt>
          <dd className="text-ink/80">{brief.ultimaPregunta}</dd>
        </div>
      ) : null}
    </dl>
  );
}
