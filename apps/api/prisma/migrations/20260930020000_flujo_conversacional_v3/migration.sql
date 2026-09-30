-- Flujo conversacional v3: lock de asesor, SLA, cola y versión de guion.

ALTER TABLE "conversaciones"
  ADD COLUMN "guion_version" TEXT,
  ADD COLUMN "asesor_lock_id" TEXT,
  ADD COLUMN "sla_vence_en" TIMESTAMP(3),
  ADD COLUMN "cola" TEXT;

CREATE INDEX "conversaciones_cola_idx" ON "conversaciones"("cola");
CREATE INDEX "conversaciones_asesor_lock_id_idx" ON "conversaciones"("asesor_lock_id");
