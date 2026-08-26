-- Identidad operativa: Jardín 1 → Tres Cielos Tequesquitengo.
-- SKUs EVT-J1-* / RENTA-J1 se conservan.

INSERT INTO "sedes" (
  "id",
  "organizacion_id",
  "nombre",
  "activa",
  "zona_horaria",
  "creado_en",
  "actualizado_en"
)
SELECT
  'sede-tequesquitengo',
  "organizacion_id",
  'Tres Cielos Tequesquitengo',
  "activa",
  "zona_horaria",
  "creado_en",
  CURRENT_TIMESTAMP
FROM "sedes"
WHERE "id" = 'sede-jardin-1'
ON CONFLICT ("id") DO UPDATE SET
  "nombre" = EXCLUDED."nombre",
  "activa" = EXCLUDED."activa",
  "actualizado_en" = CURRENT_TIMESTAMP;

UPDATE "usuario_sedes"
SET "sede_id" = 'sede-tequesquitengo'
WHERE "sede_id" = 'sede-jardin-1';

UPDATE "assets"
SET "sede_id" = 'sede-tequesquitengo'
WHERE "sede_id" = 'sede-jardin-1';

UPDATE "fragmentos_vectoriales"
SET "sede_id" = 'sede-tequesquitengo'
WHERE "sede_id" = 'sede-jardin-1';

DELETE FROM "sedes" WHERE "id" = 'sede-jardin-1';
