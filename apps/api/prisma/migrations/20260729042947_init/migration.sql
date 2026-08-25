-- CreateEnum
CREATE TYPE "TipoEvento" AS ENUM ('boda', 'xv', 'corporativo', 'social', 'otro', 'multi');

-- CreateEnum
CREATE TYPE "EstadoPublicacion" AS ENUM ('borrador', 'publicado', 'archivado');

-- CreateEnum
CREATE TYPE "CategoriaInclusion" AS ENUM ('catering', 'mobiliario', 'audio', 'decoracion', 'personal', 'otro');

-- CreateEnum
CREATE TYPE "UnidadPrecio" AS ENUM ('evento', 'persona', 'otro');

-- CreateEnum
CREATE TYPE "TipoRegla" AS ENUM ('solo_fin_semana', 'no_feriados', 'anticipo_minimo', 'horario', 'otro');

-- CreateEnum
CREATE TYPE "ResultadoImportacion" AS ENUM ('exito', 'parcial', 'fallo');

-- CreateTable
CREATE TABLE "paquetes" (
    "id" TEXT NOT NULL,
    "codigo_sku" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo_evento" "TipoEvento" NOT NULL,
    "sede" TEXT,
    "aforo_min" INTEGER NOT NULL,
    "aforo_max" INTEGER NOT NULL,
    "descripcion_corta" TEXT,
    "estado" "EstadoPublicacion" NOT NULL DEFAULT 'publicado',
    "version" INTEGER NOT NULL DEFAULT 1,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "paquetes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paquete_precios" (
    "id" TEXT NOT NULL,
    "paquete_id" TEXT NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'MXN',
    "monto" DOUBLE PRECISION,
    "rango_min" DOUBLE PRECISION,
    "rango_max" DOUBLE PRECISION,
    "unidad" "UnidadPrecio" NOT NULL DEFAULT 'evento',
    "vigente_desde" TIMESTAMP(3) NOT NULL,
    "vigente_hasta" TIMESTAMP(3),
    "condiciones" TEXT,
    "estado" "EstadoPublicacion" NOT NULL DEFAULT 'publicado',

    CONSTRAINT "paquete_precios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paquete_inclusiones" (
    "id" TEXT NOT NULL,
    "paquete_id" TEXT NOT NULL,
    "categoria" "CategoriaInclusion" NOT NULL,
    "nombre" TEXT NOT NULL,
    "cantidad" DOUBLE PRECISION,
    "unidad" TEXT,
    "obligatoria" BOOLEAN NOT NULL DEFAULT true,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "paquete_inclusiones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paquete_reglas" (
    "id" TEXT NOT NULL,
    "paquete_id" TEXT NOT NULL,
    "tipo" "TipoRegla" NOT NULL,
    "parametros" JSONB,
    "mensaje_prospecto" TEXT,

    CONSTRAINT "paquete_reglas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "importaciones_catalogo" (
    "id" TEXT NOT NULL,
    "actor" TEXT NOT NULL DEFAULT 'sandbox',
    "archivo" TEXT NOT NULL,
    "iniciado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "terminado_en" TIMESTAMP(3),
    "filas_ok" INTEGER NOT NULL DEFAULT 0,
    "filas_error" INTEGER NOT NULL DEFAULT 0,
    "detalle_errores" JSONB,
    "resultado" "ResultadoImportacion" NOT NULL DEFAULT 'exito',

    CONSTRAINT "importaciones_catalogo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "paquetes_codigo_sku_key" ON "paquetes"("codigo_sku");

-- CreateIndex
CREATE INDEX "paquete_precios_paquete_id_idx" ON "paquete_precios"("paquete_id");

-- CreateIndex
CREATE INDEX "paquete_inclusiones_paquete_id_idx" ON "paquete_inclusiones"("paquete_id");

-- CreateIndex
CREATE INDEX "paquete_reglas_paquete_id_idx" ON "paquete_reglas"("paquete_id");

-- AddForeignKey
ALTER TABLE "paquete_precios" ADD CONSTRAINT "paquete_precios_paquete_id_fkey" FOREIGN KEY ("paquete_id") REFERENCES "paquetes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paquete_inclusiones" ADD CONSTRAINT "paquete_inclusiones_paquete_id_fkey" FOREIGN KEY ("paquete_id") REFERENCES "paquetes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paquete_reglas" ADD CONSTRAINT "paquete_reglas_paquete_id_fkey" FOREIGN KEY ("paquete_id") REFERENCES "paquetes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
