-- Reparto: política por sede, carga, cola de coordinador y un solo dueño vigente.

ALTER TYPE "ReglaAsignacion" ADD VALUE IF NOT EXISTS 'menor_carga_sede';

CREATE TYPE "EstrategiaAsignacion" AS ENUM ('menor_carga');
CREATE TYPE "DisparadorAsignacion" AS ENUM ('calificado', 'handoff', 'recontacto', 'sla', 'manual', 'drenado', 'exploracion');
CREATE TYPE "EstadoColaAsignacion" AS ENUM ('esperando', 'asignada', 'cancelada');
CREATE TYPE "MotivoColaAsignacion" AS ENUM ('sin_disponibles', 'todos_en_tope', 'en_exploracion', 'dueno_inactivo');

ALTER TABLE "usuario_sedes"
  ADD COLUMN "peso" DECIMAL(4,2) NOT NULL DEFAULT 1,
  ADD COLUMN "recibe_asignacion" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "tope_abiertas_override" INTEGER,
  ADD COLUMN "tope_sin_contactar_override" INTEGER,
  ADD COLUMN "ultimo_asignado_en" TIMESTAMP(3);

ALTER TABLE "oportunidades"
  ADD COLUMN "primer_contacto_humano_en" TIMESTAMP(3);

CREATE INDEX "oportunidades_asesor_asignado_id_etapa_idx"
  ON "oportunidades" ("asesor_asignado_id", "etapa");

CREATE INDEX "oportunidades_sin_contactar_idx"
  ON "oportunidades" ("asesor_asignado_id")
  WHERE "primer_contacto_humano_en" IS NULL;

ALTER TABLE "asignaciones"
  ADD COLUMN "usuario_origen_id" TEXT,
  ADD COLUMN "explicacion" JSONB;

ALTER TABLE "asignaciones"
  ADD CONSTRAINT "asignaciones_usuario_origen_id_fkey"
  FOREIGN KEY ("usuario_origen_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "asignaciones_usuario_origen_id_idx" ON "asignaciones" ("usuario_origen_id");

WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY oportunidad_id ORDER BY creado_en DESC, id DESC
  ) AS rn
  FROM asignaciones
  WHERE vigente
)
UPDATE asignaciones SET vigente = false
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

CREATE UNIQUE INDEX "asignaciones_una_vigente"
  ON "asignaciones" ("oportunidad_id")
  WHERE vigente;

CREATE TABLE "politicas_asignacion" (
  "id" TEXT NOT NULL,
  "sede_id" TEXT NOT NULL,
  "estrategia" "EstrategiaAsignacion" NOT NULL DEFAULT 'menor_carga',
  "tope_sin_contactar" INTEGER NOT NULL DEFAULT 8,
  "tope_abiertas" INTEGER NOT NULL DEFAULT 40,
  "tope_nuevos_dia" INTEGER,
  "sla_minutos" INTEGER NOT NULL DEFAULT 30,
  "sla_reasignar" BOOLEAN NOT NULL DEFAULT false,
  "preferir_especialidad" BOOLEAN NOT NULL DEFAULT false,
  "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actualizado_en" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "politicas_asignacion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "politicas_asignacion_sede_id_key" ON "politicas_asignacion"("sede_id");

ALTER TABLE "politicas_asignacion"
  ADD CONSTRAINT "politicas_asignacion_sede_id_fkey"
  FOREIGN KEY ("sede_id") REFERENCES "sedes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "politicas_asignacion" (
  "id", "sede_id", "estrategia", "tope_sin_contactar", "tope_abiertas",
  "sla_minutos", "sla_reasignar", "preferir_especialidad", "creado_en", "actualizado_en"
)
SELECT
  'pol_' || s.id, s.id, 'menor_carga', 8, 40, 30, false, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "sedes" s
WHERE NOT EXISTS (
  SELECT 1 FROM "politicas_asignacion" p WHERE p.sede_id = s.id
);

CREATE TABLE "horarios_asesor" (
  "id" TEXT NOT NULL,
  "usuario_id" TEXT NOT NULL,
  "sede_id" TEXT NOT NULL,
  "dia_semana" INTEGER NOT NULL,
  "inicio_minutos" INTEGER NOT NULL,
  "fin_minutos" INTEGER NOT NULL,
  CONSTRAINT "horarios_asesor_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "horarios_asesor_usuario_id_sede_id_idx" ON "horarios_asesor"("usuario_id", "sede_id");

ALTER TABLE "horarios_asesor"
  ADD CONSTRAINT "horarios_asesor_usuario_id_fkey"
  FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "horarios_asesor"
  ADD CONSTRAINT "horarios_asesor_sede_id_fkey"
  FOREIGN KEY ("sede_id") REFERENCES "sedes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "asesor_especialidades" (
  "usuario_id" TEXT NOT NULL,
  "tipo_evento" "TipoEvento" NOT NULL,
  CONSTRAINT "asesor_especialidades_pkey" PRIMARY KEY ("usuario_id", "tipo_evento")
);

ALTER TABLE "asesor_especialidades"
  ADD CONSTRAINT "asesor_especialidades_usuario_id_fkey"
  FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "cola_asignacion" (
  "id" TEXT NOT NULL,
  "oportunidad_id" TEXT NOT NULL,
  "sede_id" TEXT NOT NULL,
  "disparador" "DisparadorAsignacion" NOT NULL,
  "estado" "EstadoColaAsignacion" NOT NULL DEFAULT 'esperando',
  "motivo" "MotivoColaAsignacion" NOT NULL,
  "detalle" JSONB,
  "intentos" INTEGER NOT NULL DEFAULT 0,
  "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actualizado_en" TIMESTAMP(3) NOT NULL,
  "asignada_en" TIMESTAMP(3),
  CONSTRAINT "cola_asignacion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "cola_asignacion_sede_id_estado_idx" ON "cola_asignacion"("sede_id", "estado");
CREATE INDEX "cola_asignacion_oportunidad_id_idx" ON "cola_asignacion"("oportunidad_id");

CREATE UNIQUE INDEX "cola_asignacion_una_espera"
  ON "cola_asignacion" ("oportunidad_id")
  WHERE estado = 'esperando';

ALTER TABLE "cola_asignacion"
  ADD CONSTRAINT "cola_asignacion_oportunidad_id_fkey"
  FOREIGN KEY ("oportunidad_id") REFERENCES "oportunidades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "cola_asignacion"
  ADD CONSTRAINT "cola_asignacion_sede_id_fkey"
  FOREIGN KEY ("sede_id") REFERENCES "sedes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
