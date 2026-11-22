-- Borrar un usuario deja las notas y el historial de asignación,
-- pero suelta la referencia obligatoria que impedía el DELETE.

ALTER TABLE "notas_cliente" DROP CONSTRAINT "notas_cliente_autor_id_fkey";
ALTER TABLE "notas_cliente" ALTER COLUMN "autor_id" DROP NOT NULL;
ALTER TABLE "notas_cliente"
  ADD CONSTRAINT "notas_cliente_autor_id_fkey"
  FOREIGN KEY ("autor_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "asignaciones" DROP CONSTRAINT "asignaciones_usuario_destino_id_fkey";
ALTER TABLE "asignaciones" ALTER COLUMN "usuario_destino_id" DROP NOT NULL;
ALTER TABLE "asignaciones"
  ADD CONSTRAINT "asignaciones_usuario_destino_id_fkey"
  FOREIGN KEY ("usuario_destino_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
