-- Perfil canónico por cliente, paso presupuesto_fuera y seguimientos durables.

ALTER TYPE "PasoGuion" ADD VALUE 'presupuesto_fuera';

CREATE TYPE "TipoSeguimiento" AS ENUM ('nutricion_t24', 'nutricion_t7');

CREATE TABLE "memorias_cliente" (
    "id" TEXT NOT NULL,
    "cliente_id" TEXT NOT NULL,
    "campos" JSONB NOT NULL DEFAULT '{}',
    "paso_guion" "PasoGuion" NOT NULL DEFAULT 'saludo',
    "guion_version" TEXT,
    "ruta_comercial" "RutaComercial",
    "estado_bot" "EstadoBot" NOT NULL DEFAULT 'activo',
    "resumen" TEXT NOT NULL DEFAULT '',
    "resumen_actualizado_en" TIMESTAMP(3),
    "ultimo_turno_en" TIMESTAMP(3),
    "oportunidad_abierta_id" TEXT,
    "asesor_lock_id" TEXT,
    "sla_vence_en" TIMESTAMP(3),
    "cola" TEXT,
    "motivo_handoff" "MotivoHandoff",
    "escalado_en" TIMESTAMP(3),
    "ultima_ruta" "RutaOrquestador",
    "paquete_tentativo_id" TEXT,
    "pedido_cotizacion" BOOLEAN,
    "pedido_cotizacion_fuente" TEXT,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "memorias_cliente_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "memorias_cliente_cliente_id_key" ON "memorias_cliente"("cliente_id");
CREATE INDEX "memorias_cliente_estado_bot_idx" ON "memorias_cliente"("estado_bot");
CREATE INDEX "memorias_cliente_oportunidad_abierta_id_idx" ON "memorias_cliente"("oportunidad_abierta_id");

ALTER TABLE "memorias_cliente"
ADD CONSTRAINT "memorias_cliente_cliente_id_fkey"
FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "seguimientos_programados" (
    "id" TEXT NOT NULL,
    "cliente_id" TEXT NOT NULL,
    "oportunidad_id" TEXT,
    "conversacion_id" TEXT,
    "tipo" "TipoSeguimiento" NOT NULL,
    "dispara_en" TIMESTAMP(3) NOT NULL,
    "nombre" TEXT,
    "cancelado" BOOLEAN NOT NULL DEFAULT false,
    "disparado_en" TIMESTAMP(3),
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seguimientos_programados_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "seguimientos_programados_cliente_id_cancelado_idx"
ON "seguimientos_programados"("cliente_id", "cancelado");
CREATE INDEX "seguimientos_programados_dispara_en_cancelado_idx"
ON "seguimientos_programados"("dispara_en", "cancelado");

ALTER TABLE "seguimientos_programados"
ADD CONSTRAINT "seguimientos_programados_cliente_id_fkey"
FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: la conversación más reciente de cada cliente siembra el perfil.
INSERT INTO "memorias_cliente" (
    "id",
    "cliente_id",
    "campos",
    "paso_guion",
    "guion_version",
    "ruta_comercial",
    "estado_bot",
    "resumen",
    "resumen_actualizado_en",
    "ultimo_turno_en",
    "oportunidad_abierta_id",
    "asesor_lock_id",
    "sla_vence_en",
    "cola",
    "motivo_handoff",
    "escalado_en",
    "ultima_ruta",
    "paquete_tentativo_id",
    "creado_en",
    "actualizado_en"
)
SELECT
    'mem_' || c."cliente_id",
    c."cliente_id",
    COALESCE(c."campos_capturados", '{}'::jsonb),
    c."paso_guion",
    c."guion_version",
    c."ruta_comercial",
    c."estado_bot",
    '',
    CURRENT_TIMESTAMP,
    c."actualizado_en",
    CASE
        WHEN o."etapa" IN ('ganado', 'perdido') THEN NULL
        ELSE c."oportunidad_id"
    END,
    c."asesor_lock_id",
    c."sla_vence_en",
    c."cola",
    c."motivo_handoff",
    c."escalado_en",
    c."ultima_ruta",
    c."paquete_tentativo_id",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM (
    SELECT DISTINCT ON ("cliente_id") *
    FROM "conversaciones"
    ORDER BY "cliente_id", "actualizado_en" DESC
) c
LEFT JOIN "oportunidades" o ON o."id" = c."oportunidad_id";
