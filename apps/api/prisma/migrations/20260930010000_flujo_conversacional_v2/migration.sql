-- Flujo conversacional v2: valores nuevos de PasoGuion + scoring comercial.

ALTER TYPE "PasoGuion" ADD VALUE 'nombre_fecha';
ALTER TYPE "PasoGuion" ADD VALUE 'aforo_inversion';
ALTER TYPE "PasoGuion" ADD VALUE 'aclaracion_piso';
ALTER TYPE "PasoGuion" ADD VALUE 'accion';

CREATE TYPE "EncajeEconomico" AS ENUM (
  'confirmado',
  'probable',
  'no_confirmado',
  'no'
);

CREATE TYPE "RutaComercial" AS ENUM (
  'handoff',
  'atencion_general',
  'seguimiento',
  'nutricion',
  'cierre'
);

ALTER TABLE "conversaciones"
  ADD COLUMN "encaje_economico" "EncajeEconomico",
  ADD COLUMN "ruta_comercial" "RutaComercial";

CREATE INDEX "conversaciones_encaje_economico_idx" ON "conversaciones"("encaje_economico");
CREATE INDEX "conversaciones_ruta_comercial_idx" ON "conversaciones"("ruta_comercial");
