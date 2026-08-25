-- Fase A: cerebro conversacional + pgvector + FTS
-- Extiende catálogo sandbox existente (no dropea Paquete*).

CREATE EXTENSION IF NOT EXISTS vector;

-- Enums cerebro
CREATE TYPE "Canal" AS ENUM ('facebook', 'instagram', 'whatsapp', 'sandbox');
CREATE TYPE "EstadoBot" AS ENUM ('activo', 'escalado', 'humano');
CREATE TYPE "RutaOrquestador" AS ENUM ('guion', 'catalogo', 'rag', 'handoff', 'safe');
CREATE TYPE "AutorMensaje" AS ENUM ('prospecto', 'bot', 'asesor');
CREATE TYPE "DireccionMensaje" AS ENUM ('entrante', 'saliente');
CREATE TYPE "ActorOperativo" AS ENUM ('bot', 'asesor', 'coordinador', 'admin', 'sistema');
CREATE TYPE "PasoGuion" AS ENUM ('saludo', 'nombre', 'ocasion', 'fecha', 'aforo', 'sede', 'presupuesto', 'intencion', 'faq_libre');
CREATE TYPE "CalificacionOportunidad" AS ENUM ('en_exploracion', 'calificado');
CREATE TYPE "EtapaPipeline" AS ENUM ('nuevo_bot', 'calificado', 'contactado', 'propuesta', 'negociacion', 'ganado', 'perdido');
CREATE TYPE "MotivoHandoff" AS ENUM (
  'solicitud_usuario',
  'rerank_bajo',
  'sin_catalogo',
  'sin_cita_rag',
  'conflicto',
  'queja',
  'descuento_fuera_catalogo',
  'sede_no_cubierta',
  'ambiguedad',
  'adjunto_no_soportado',
  'material_ocr_tarifas',
  'proveedor_ia',
  'cupo_ia',
  'otro'
);
CREATE TYPE "TipoMaterial" AS ENUM ('pdf', 'docx', 'xlsx', 'csv', 'imagen', 'video');
CREATE TYPE "PipelineEstado" AS ENUM ('pendiente', 'procesando', 'listo', 'parcial', 'error');
CREATE TYPE "OrigenDerivacion" AS ENUM ('texto_nativo', 'vision', 'whisper', 'xls_narrativo');
CREATE TYPE "PropositoAsset" AS ENUM ('conocimiento', 'import_catalogo', 'adjunto_canal');
CREATE TYPE "TipoDocumentoFuente" AS ENUM ('faq', 'ficha_sede', 'politica', 'tipos_evento', 'safe_reply', 'otro');

-- CRM mínimo
CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "nombre" TEXT,
    "telefono" TEXT,
    "correo" TEXT,
    "meta_psid" TEXT,
    "wa_id" TEXT,
    "sede_interes" TEXT,
    "primer_contacto_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultimo_contacto_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "oportunidades" (
    "id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "tipo_evento" "TipoEvento",
    "fecha_tentativa" TIMESTAMP(3),
    "fecha_flexible" BOOLEAN NOT NULL DEFAULT false,
    "aforo" INTEGER,
    "presupuesto_nota" TEXT,
    "paquete_tentativo_id" TEXT,
    "a_medida" BOOLEAN NOT NULL DEFAULT false,
    "calificacion" "CalificacionOportunidad" NOT NULL DEFAULT 'en_exploracion',
    "listo_para_cotizar" BOOLEAN NOT NULL DEFAULT false,
    "etapa" "EtapaPipeline" NOT NULL DEFAULT 'nuevo_bot',
    "canal_origen" "Canal",
    "sede" TEXT,
    "brief_json" JSONB,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "oportunidades_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "conversaciones" (
    "id" TEXT NOT NULL,
    "oportunidad_id" TEXT NOT NULL,
    "canal" "Canal" NOT NULL,
    "external_thread_id" TEXT,
    "estado_bot" "EstadoBot" NOT NULL DEFAULT 'activo',
    "paso_guion" "PasoGuion" NOT NULL DEFAULT 'saludo',
    "campos_capturados" JSONB,
    "paquete_tentativo_id" TEXT,
    "ultima_ruta" "RutaOrquestador",
    "motivo_handoff" "MotivoHandoff",
    "escalado_en" TIMESTAMP(3),
    "sede" TEXT,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "conversaciones_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "mensajes" (
    "id" TEXT NOT NULL,
    "conversacion_id" TEXT NOT NULL,
    "direccion" "DireccionMensaje" NOT NULL,
    "autor" "AutorMensaje" NOT NULL,
    "canal" "Canal" NOT NULL,
    "contenido" TEXT NOT NULL,
    "external_message_id" TEXT,
    "ruta" "RutaOrquestador",
    "consume_cupo" BOOLEAN NOT NULL DEFAULT false,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "mensajes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "eventos_operativos" (
    "id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "actor" "ActorOperativo" NOT NULL,
    "payload" JSONB NOT NULL,
    "oportunidad_id" TEXT,
    "conversacion_id" TEXT,
    "mensaje_id" TEXT,
    "sede" TEXT,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "eventos_operativos_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "assets" (
    "id" TEXT NOT NULL,
    "proposito" "PropositoAsset" NOT NULL,
    "tipo_material" "TipoMaterial" NOT NULL,
    "mime_type" TEXT NOT NULL,
    "nombre_original" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "storage_bucket" TEXT NOT NULL,
    "checksum" TEXT,
    "bytes" INTEGER NOT NULL,
    "duracion_sec" INTEGER,
    "ancho_px" INTEGER,
    "alto_px" INTEGER,
    "pipeline_estado" "PipelineEstado" NOT NULL DEFAULT 'pendiente',
    "pipeline_error_code" TEXT,
    "pipeline_error_detalle" TEXT,
    "pipeline_progreso_pct" INTEGER,
    "sede_id" TEXT,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "documentos_fuente" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "tipo" "TipoDocumentoFuente" NOT NULL,
    "sede" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "estado" "EstadoPublicacion" NOT NULL DEFAULT 'borrador',
    "publicado_en" TIMESTAMP(3),
    "nombre_archivo_cita" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,
    "tipo_material" "TipoMaterial" NOT NULL,
    "pipeline_estado" "PipelineEstado" NOT NULL DEFAULT 'pendiente',
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "documentos_fuente_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "fragmentos_vectoriales" (
    "id" TEXT NOT NULL,
    "documento_fuente_id" TEXT NOT NULL,
    "documento_version" INTEGER NOT NULL,
    "texto" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "embedding" vector(1536),
    "tsv" tsvector,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "origen_derivacion" "OrigenDerivacion" NOT NULL,
    "no_recuperable_precio" BOOLEAN NOT NULL DEFAULT false,
    "tipo_material" "TipoMaterial",
    "page_or_slide" INTEGER,
    "t_start_ms" INTEGER,
    "t_end_ms" INTEGER,
    "sede_id" TEXT,
    "tipo_documento" "TipoDocumentoFuente",
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "fragmentos_vectoriales_pkey" PRIMARY KEY ("id")
);

-- FKs
ALTER TABLE "oportunidades" ADD CONSTRAINT "oportunidades_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "oportunidades" ADD CONSTRAINT "oportunidades_paquete_tentativo_id_fkey" FOREIGN KEY ("paquete_tentativo_id") REFERENCES "paquetes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "conversaciones" ADD CONSTRAINT "conversaciones_oportunidad_id_fkey" FOREIGN KEY ("oportunidad_id") REFERENCES "oportunidades"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mensajes" ADD CONSTRAINT "mensajes_conversacion_id_fkey" FOREIGN KEY ("conversacion_id") REFERENCES "conversaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "eventos_operativos" ADD CONSTRAINT "eventos_operativos_oportunidad_id_fkey" FOREIGN KEY ("oportunidad_id") REFERENCES "oportunidades"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "eventos_operativos" ADD CONSTRAINT "eventos_operativos_conversacion_id_fkey" FOREIGN KEY ("conversacion_id") REFERENCES "conversaciones"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "eventos_operativos" ADD CONSTRAINT "eventos_operativos_mensaje_id_fkey" FOREIGN KEY ("mensaje_id") REFERENCES "mensajes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "documentos_fuente" ADD CONSTRAINT "documentos_fuente_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "fragmentos_vectoriales" ADD CONSTRAINT "fragmentos_vectoriales_documento_fuente_id_fkey" FOREIGN KEY ("documento_fuente_id") REFERENCES "documentos_fuente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Uniques / indexes
CREATE UNIQUE INDEX "conversaciones_canal_external_thread_id_key" ON "conversaciones"("canal", "external_thread_id");
CREATE UNIQUE INDEX "mensajes_canal_external_message_id_key" ON "mensajes"("canal", "external_message_id");
CREATE UNIQUE INDEX "assets_storage_bucket_storage_key_key" ON "assets"("storage_bucket", "storage_key");
CREATE UNIQUE INDEX "documentos_fuente_asset_id_key" ON "documentos_fuente"("asset_id");

CREATE INDEX "leads_telefono_idx" ON "leads"("telefono");
CREATE INDEX "leads_wa_id_idx" ON "leads"("wa_id");
CREATE INDEX "leads_meta_psid_idx" ON "leads"("meta_psid");
CREATE INDEX "oportunidades_lead_id_idx" ON "oportunidades"("lead_id");
CREATE INDEX "oportunidades_etapa_idx" ON "oportunidades"("etapa");
CREATE INDEX "conversaciones_oportunidad_id_idx" ON "conversaciones"("oportunidad_id");
CREATE INDEX "conversaciones_estado_bot_idx" ON "conversaciones"("estado_bot");
CREATE INDEX "mensajes_conversacion_id_creado_en_idx" ON "mensajes"("conversacion_id", "creado_en");
CREATE INDEX "eventos_operativos_oportunidad_id_creado_en_idx" ON "eventos_operativos"("oportunidad_id", "creado_en");
CREATE INDEX "eventos_operativos_conversacion_id_creado_en_idx" ON "eventos_operativos"("conversacion_id", "creado_en");
CREATE INDEX "eventos_operativos_actor_creado_en_idx" ON "eventos_operativos"("actor", "creado_en");
CREATE INDEX "assets_proposito_pipeline_estado_idx" ON "assets"("proposito", "pipeline_estado");
CREATE INDEX "documentos_fuente_estado_pipeline_estado_idx" ON "documentos_fuente"("estado", "pipeline_estado");
CREATE INDEX "documentos_fuente_sede_idx" ON "documentos_fuente"("sede");
CREATE INDEX "fragmentos_vectoriales_documento_fuente_id_documento_version_orden_idx" ON "fragmentos_vectoriales"("documento_fuente_id", "documento_version", "orden");
CREATE INDEX "fragmentos_vectoriales_activo_sede_id_idx" ON "fragmentos_vectoriales"("activo", "sede_id");
CREATE INDEX "fragmentos_vectoriales_origen_derivacion_idx" ON "fragmentos_vectoriales"("origen_derivacion");

-- pgvector HNSW (cosine) + FTS GIN
CREATE INDEX "fragmentos_vectoriales_embedding_hnsw_idx"
  ON "fragmentos_vectoriales"
  USING hnsw ("embedding" vector_cosine_ops);

CREATE INDEX "fragmentos_vectoriales_tsv_gin_idx"
  ON "fragmentos_vectoriales"
  USING gin ("tsv");

-- Mantener tsvector en español al insert/update de texto
CREATE OR REPLACE FUNCTION fragmentos_vectoriales_tsv_trigger() RETURNS trigger AS $$
BEGIN
  NEW.tsv := to_tsvector('spanish', coalesce(NEW.texto, ''));
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER fragmentos_vectoriales_tsv_update
  BEFORE INSERT OR UPDATE OF texto ON "fragmentos_vectoriales"
  FOR EACH ROW EXECUTE FUNCTION fragmentos_vectoriales_tsv_trigger();
