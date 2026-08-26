-- Cliente CRM: Lead → Cliente + identificadores, tags, notas, timeline, asignación.

CREATE TYPE "EstadoAtencion" AS ENUM ('nuevo', 'bot_activo', 'escalado', 'en_atencion', 'cerrado');
CREATE TYPE "FuenteAlta" AS ENUM ('bot', 'asesor', 'importacion');
CREATE TYPE "TipoIdentificadorCliente" AS ENUM ('telefono', 'wa_id', 'meta_psid', 'ig_scoped_id', 'email', 'sandbox_thread');
CREATE TYPE "TipoInteraccion" AS ENUM ('mensaje', 'nota', 'cambio_estado_atencion', 'cambio_etapa', 'handoff', 'toma_control', 'asignacion', 'plantilla', 'adjunto', 'accion_bot', 'edicion_ficha', 'posible_duplicado');
CREATE TYPE "MotivoPerdido" AS ENUM ('precio', 'fecha', 'competencia', 'sin_respuesta', 'otro');
CREATE TYPE "ReglaAsignacion" AS ENUM ('sede_disponibilidad_round_robin', 'cola_coordinador', 'manual');
CREATE TYPE "ActorAsignacion" AS ENUM ('sistema', 'coordinador', 'admin');

ALTER TABLE "leads" RENAME TO "clientes";
ALTER TABLE "clientes" RENAME CONSTRAINT "leads_pkey" TO "clientes_pkey";

ALTER INDEX "leads_telefono_idx" RENAME TO "clientes_telefono_idx";

ALTER TABLE "clientes"
  ADD COLUMN "nombre_perfil_canal" TEXT,
  ADD COLUMN "estado_atencion" "EstadoAtencion" NOT NULL DEFAULT 'nuevo',
  ADD COLUMN "asesor_asignado_id" TEXT,
  ADD COLUMN "canal_origen" "Canal",
  ADD COLUMN "fuente_alta" "FuenteAlta" NOT NULL DEFAULT 'bot',
  ADD COLUMN "origen_json" JSONB,
  ADD COLUMN "sede_interes_id" TEXT,
  ADD COLUMN "idioma" TEXT DEFAULT 'es',
  ADD COLUMN "zona_horaria" TEXT,
  ADD COLUMN "opt_out_mensajeria" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "fusionado_en_cliente_id" TEXT;

CREATE TABLE "identificadores_cliente" (
    "id" TEXT NOT NULL,
    "cliente_id" TEXT NOT NULL,
    "tipo" "TipoIdentificadorCliente" NOT NULL,
    "valor" TEXT NOT NULL,
    "valor_normalizado" TEXT NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "identificadores_cliente_pkey" PRIMARY KEY ("id")
);

INSERT INTO "identificadores_cliente" ("id", "cliente_id", "tipo", "valor", "valor_normalizado")
SELECT concat('idtel_', "id"), "id", 'telefono', "telefono", "telefono"
FROM "clientes"
WHERE "telefono" IS NOT NULL AND btrim("telefono") <> '';

INSERT INTO "identificadores_cliente" ("id", "cliente_id", "tipo", "valor", "valor_normalizado")
SELECT concat('idwa_', "id"), "id", 'wa_id', "wa_id", "wa_id"
FROM "clientes"
WHERE "wa_id" IS NOT NULL AND btrim("wa_id") <> ''
  AND NOT EXISTS (
    SELECT 1 FROM "identificadores_cliente" i
    WHERE i."tipo" = 'wa_id' AND i."valor_normalizado" = "clientes"."wa_id"
  );

INSERT INTO "identificadores_cliente" ("id", "cliente_id", "tipo", "valor", "valor_normalizado")
SELECT concat('idpsid_', "id"), "id", 'meta_psid', "meta_psid", "meta_psid"
FROM "clientes"
WHERE "meta_psid" IS NOT NULL AND btrim("meta_psid") <> '';

INSERT INTO "identificadores_cliente" ("id", "cliente_id", "tipo", "valor", "valor_normalizado")
SELECT concat('idmail_', "id"), "id", 'email', lower("correo"), lower("correo")
FROM "clientes"
WHERE "correo" IS NOT NULL AND btrim("correo") <> '';

DROP INDEX IF EXISTS "leads_wa_id_idx";
DROP INDEX IF EXISTS "leads_meta_psid_idx";

ALTER TABLE "clientes" DROP COLUMN "wa_id";
ALTER TABLE "clientes" DROP COLUMN "meta_psid";
ALTER TABLE "clientes" DROP COLUMN "sede_interes";

ALTER TABLE "oportunidades" DROP CONSTRAINT "oportunidades_lead_id_fkey";
DROP INDEX "oportunidades_lead_id_idx";
ALTER TABLE "oportunidades" RENAME COLUMN "lead_id" TO "cliente_id";
ALTER TABLE "oportunidades"
  ADD COLUMN "motivo_perdido" "MotivoPerdido",
  ADD COLUMN "asesor_asignado_id" TEXT;

ALTER TABLE "conversaciones" ADD COLUMN "cliente_id" TEXT;
UPDATE "conversaciones" AS c
SET "cliente_id" = o."cliente_id"
FROM "oportunidades" AS o
WHERE c."oportunidad_id" = o."id";
ALTER TABLE "conversaciones" ALTER COLUMN "cliente_id" SET NOT NULL;

ALTER TABLE "mensajes" ADD COLUMN "plantilla_utility_id" TEXT;

ALTER TABLE "eventos_operativos" ADD COLUMN "cliente_id" TEXT;
UPDATE "eventos_operativos" AS e
SET "cliente_id" = o."cliente_id"
FROM "oportunidades" AS o
WHERE e."oportunidad_id" = o."id" AND e."cliente_id" IS NULL;
UPDATE "eventos_operativos" AS e
SET "cliente_id" = c."cliente_id"
FROM "conversaciones" AS c
WHERE e."conversacion_id" = c."id" AND e."cliente_id" IS NULL;

CREATE TABLE "tags" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cliente_tags" (
    "cliente_id" TEXT NOT NULL,
    "tag_id" TEXT NOT NULL,
    CONSTRAINT "cliente_tags_pkey" PRIMARY KEY ("cliente_id","tag_id")
);

CREATE TABLE "notas_cliente" (
    "id" TEXT NOT NULL,
    "cliente_id" TEXT NOT NULL,
    "autor_id" TEXT NOT NULL,
    "cuerpo" TEXT NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notas_cliente_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "interacciones" (
    "id" TEXT NOT NULL,
    "cliente_id" TEXT NOT NULL,
    "oportunidad_id" TEXT,
    "conversacion_id" TEXT,
    "mensaje_id" TEXT,
    "evento_operativo_id" TEXT,
    "tipo" "TipoInteraccion" NOT NULL,
    "actor" "ActorOperativo" NOT NULL,
    "canal" "Canal",
    "resumen" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "interacciones_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "asignaciones" (
    "id" TEXT NOT NULL,
    "cliente_id" TEXT NOT NULL,
    "oportunidad_id" TEXT NOT NULL,
    "usuario_destino_id" TEXT NOT NULL,
    "actor" "ActorAsignacion" NOT NULL DEFAULT 'sistema',
    "actor_usuario_id" TEXT,
    "regla" "ReglaAsignacion" NOT NULL,
    "vigente" BOOLEAN NOT NULL DEFAULT true,
    "motivo" TEXT,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "asignaciones_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "adjuntos_mensaje" (
    "id" TEXT NOT NULL,
    "mensaje_id" TEXT NOT NULL,
    "asset_id" TEXT,
    "mime_type" TEXT NOT NULL,
    "nombre_original" TEXT,
    "storage_key" TEXT,
    "bytes" INTEGER,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "adjuntos_mensaje_pkey" PRIMARY KEY ("id")
);

-- FKs
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_asesor_asignado_id_fkey" FOREIGN KEY ("asesor_asignado_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_sede_interes_id_fkey" FOREIGN KEY ("sede_interes_id") REFERENCES "sedes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_fusionado_en_cliente_id_fkey" FOREIGN KEY ("fusionado_en_cliente_id") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "identificadores_cliente" ADD CONSTRAINT "identificadores_cliente_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "oportunidades" ADD CONSTRAINT "oportunidades_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "oportunidades" ADD CONSTRAINT "oportunidades_asesor_asignado_id_fkey" FOREIGN KEY ("asesor_asignado_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "conversaciones" ADD CONSTRAINT "conversaciones_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "eventos_operativos" ADD CONSTRAINT "eventos_operativos_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "tags" ADD CONSTRAINT "tags_nombre_key" UNIQUE ("nombre");

ALTER TABLE "cliente_tags" ADD CONSTRAINT "cliente_tags_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cliente_tags" ADD CONSTRAINT "cliente_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notas_cliente" ADD CONSTRAINT "notas_cliente_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notas_cliente" ADD CONSTRAINT "notas_cliente_autor_id_fkey" FOREIGN KEY ("autor_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "interacciones" ADD CONSTRAINT "interacciones_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "interacciones" ADD CONSTRAINT "interacciones_oportunidad_id_fkey" FOREIGN KEY ("oportunidad_id") REFERENCES "oportunidades"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "interacciones" ADD CONSTRAINT "interacciones_conversacion_id_fkey" FOREIGN KEY ("conversacion_id") REFERENCES "conversaciones"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "interacciones" ADD CONSTRAINT "interacciones_mensaje_id_fkey" FOREIGN KEY ("mensaje_id") REFERENCES "mensajes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "interacciones" ADD CONSTRAINT "interacciones_evento_operativo_id_fkey" FOREIGN KEY ("evento_operativo_id") REFERENCES "eventos_operativos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "asignaciones" ADD CONSTRAINT "asignaciones_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "asignaciones" ADD CONSTRAINT "asignaciones_oportunidad_id_fkey" FOREIGN KEY ("oportunidad_id") REFERENCES "oportunidades"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "asignaciones" ADD CONSTRAINT "asignaciones_usuario_destino_id_fkey" FOREIGN KEY ("usuario_destino_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "asignaciones" ADD CONSTRAINT "asignaciones_actor_usuario_id_fkey" FOREIGN KEY ("actor_usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "adjuntos_mensaje" ADD CONSTRAINT "adjuntos_mensaje_mensaje_id_fkey" FOREIGN KEY ("mensaje_id") REFERENCES "mensajes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "adjuntos_mensaje" ADD CONSTRAINT "adjuntos_mensaje_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Indexes
CREATE UNIQUE INDEX "identificadores_cliente_tipo_valor_normalizado_key" ON "identificadores_cliente"("tipo", "valor_normalizado");
CREATE INDEX "identificadores_cliente_cliente_id_idx" ON "identificadores_cliente"("cliente_id");
CREATE INDEX "clientes_correo_idx" ON "clientes"("correo");
CREATE INDEX "clientes_estado_atencion_idx" ON "clientes"("estado_atencion");
CREATE INDEX "clientes_asesor_asignado_id_idx" ON "clientes"("asesor_asignado_id");
CREATE INDEX "clientes_sede_interes_id_idx" ON "clientes"("sede_interes_id");
CREATE INDEX "oportunidades_cliente_id_idx" ON "oportunidades"("cliente_id");
CREATE INDEX "oportunidades_asesor_asignado_id_idx" ON "oportunidades"("asesor_asignado_id");
CREATE INDEX "conversaciones_cliente_id_idx" ON "conversaciones"("cliente_id");
CREATE INDEX "eventos_operativos_cliente_id_creado_en_idx" ON "eventos_operativos"("cliente_id", "creado_en");
CREATE INDEX "cliente_tags_tag_id_idx" ON "cliente_tags"("tag_id");
CREATE INDEX "notas_cliente_cliente_id_creado_en_idx" ON "notas_cliente"("cliente_id", "creado_en");
CREATE UNIQUE INDEX "interacciones_evento_operativo_id_key" ON "interacciones"("evento_operativo_id");
CREATE INDEX "interacciones_cliente_id_creado_en_idx" ON "interacciones"("cliente_id", "creado_en");
CREATE INDEX "interacciones_oportunidad_id_creado_en_idx" ON "interacciones"("oportunidad_id", "creado_en");
CREATE INDEX "asignaciones_oportunidad_id_vigente_idx" ON "asignaciones"("oportunidad_id", "vigente");
CREATE INDEX "asignaciones_cliente_id_idx" ON "asignaciones"("cliente_id");
CREATE INDEX "asignaciones_usuario_destino_id_idx" ON "asignaciones"("usuario_destino_id");
CREATE INDEX "adjuntos_mensaje_mensaje_id_idx" ON "adjuntos_mensaje"("mensaje_id");
CREATE INDEX "adjuntos_mensaje_asset_id_idx" ON "adjuntos_mensaje"("asset_id");
