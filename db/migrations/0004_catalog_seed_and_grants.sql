-- Historial de stock inmutable para el rol runtime (las tablas nuevas heredan los
-- privilegios por defecto; aquí se restringen).
REVOKE UPDATE, DELETE ON "app"."stock_movements" FROM blesh_runtime;
--> statement-breakpoint
REVOKE DELETE ON "app"."inventory_balances" FROM blesh_runtime;
--> statement-breakpoint
REVOKE DELETE ON "app"."media_assets" FROM blesh_runtime;
--> statement-breakpoint
-- Catálogo de referencia: solo lectura en runtime (cambios por migración versionada).
REVOKE INSERT, UPDATE, DELETE ON "app"."categories", "app"."size_guides", "app"."size_guide_rows" FROM blesh_runtime;
--> statement-breakpoint
-- Categorías iniciales (prototipo de la marca). Idempotente; no renombrar slugs publicados sin revisar SEO.
INSERT INTO "app"."categories" ("slug", "name", "description", "position") VALUES
  ('manga-larga', 'Manga larga', 'Longsleeves de la colección.', 1),
  ('basicos', 'Básicos 300 GSM', 'Básicos premium de algodón 300 GSM.', 2),
  ('boxy-essential', 'Boxy essential', 'Polos de corte boxy para el día a día.', 3),
  ('zip-hoodies', 'Zip hoodies', 'Casacas con capucha y cierre.', 4)
ON CONFLICT ("slug") DO NOTHING;
--> statement-breakpoint
INSERT INTO "app"."size_guides" ("code", "name", "version") VALUES ('premium', 'Guía premium (largo × ancho)', 1)
ON CONFLICT ("code") DO NOTHING;
--> statement-breakpoint
INSERT INTO "app"."size_guide_rows" ("guide_id", "size_code", "length_cm", "width_cm", "position")
SELECT g.id, r.size_code, r.length_cm, r.width_cm, r.position
FROM "app"."size_guides" g
CROSS JOIN (VALUES ('S', 68.0, 60.0, 1), ('M', 70.0, 62.0, 2), ('L', 72.0, 64.0, 3)) AS r(size_code, length_cm, width_cm, position)
WHERE g.code = 'premium'
ON CONFLICT ("guide_id", "size_code") DO NOTHING;
