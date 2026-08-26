-- AlterTable
ALTER TABLE "documentos_fuente" ADD COLUMN "inventario_id" TEXT;

-- CreateIndex
CREATE INDEX "documentos_fuente_inventario_id_idx" ON "documentos_fuente"("inventario_id");
