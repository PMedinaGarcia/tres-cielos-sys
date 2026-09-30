-- Remapeo de pasos v1 → v2 (los valores nuevos ya existen en el tipo).

UPDATE "conversaciones"
SET "paso_guion" = 'nombre_fecha'
WHERE "paso_guion" IN ('saludo', 'nombre', 'ocasion', 'fecha');

UPDATE "conversaciones"
SET "paso_guion" = 'aforo_inversion'
WHERE "paso_guion" IN ('aforo', 'sede');

UPDATE "conversaciones"
SET "paso_guion" = 'accion'
WHERE "paso_guion" IN ('presupuesto', 'intencion');
