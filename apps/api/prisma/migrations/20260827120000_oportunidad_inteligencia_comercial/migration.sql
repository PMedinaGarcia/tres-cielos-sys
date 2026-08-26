-- Inteligencia comercial: riel de visita + snapshot de cotización.

CREATE TYPE "VisitaEstado" AS ENUM (
  'no_solicitada',
  'solicitada',
  'agendada',
  'realizada',
  'cancelada',
  'no_asistio'
);

CREATE TYPE "EtapaCotizacion" AS ENUM (
  'perfilando',
  'explorando',
  'listo_para_cotizar',
  'sin_tarifa',
  'propuesta_enviada',
  'negociacion',
  'ganado',
  'perdido'
);

ALTER TYPE "TipoInteraccion" ADD VALUE 'cambio_visita';
ALTER TYPE "TipoInteraccion" ADD VALUE 'propuesta_enviada';

ALTER TABLE "oportunidades"
  ADD COLUMN "intencion_visita" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "visita_estado" "VisitaEstado" NOT NULL DEFAULT 'no_solicitada',
  ADD COLUMN "visita_agendada_en" TIMESTAMP(3),
  ADD COLUMN "visita_notas" TEXT,
  ADD COLUMN "propuesta_enviada_en" TIMESTAMP(3),
  ADD COLUMN "etapa_cotizacion" "EtapaCotizacion" NOT NULL DEFAULT 'perfilando';

CREATE INDEX "oportunidades_visita_estado_idx" ON "oportunidades"("visita_estado");
CREATE INDEX "oportunidades_etapa_cotizacion_idx" ON "oportunidades"("etapa_cotizacion");
