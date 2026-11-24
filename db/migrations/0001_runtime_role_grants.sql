-- Rol de grupo para la conexión runtime. Los privilegios se conceden solo a este rol;
-- cada entorno concede su membresía a su usuario runtime (p. ej. GRANT blesh_runtime TO blesh_app).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'blesh_runtime') THEN
    CREATE ROLE blesh_runtime NOLOGIN;
  END IF;
END
$$;
--> statement-breakpoint
REVOKE ALL ON SCHEMA "app" FROM PUBLIC;
--> statement-breakpoint
GRANT USAGE ON SCHEMA "app" TO blesh_runtime;
--> statement-breakpoint
-- Tablas futuras creadas por el rol de migración: lectura/escritura por defecto.
-- Las tablas con reglas más estrictas (p. ej. solo inserción) las restringen en su migración.
ALTER DEFAULT PRIVILEGES IN SCHEMA "app" GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO blesh_runtime;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA "app" GRANT USAGE, SELECT ON SEQUENCES TO blesh_runtime;
--> statement-breakpoint
-- Auditoría: solo inserción y lectura; el runtime no puede reescribir historia.
GRANT SELECT, INSERT ON "app"."audit_events" TO blesh_runtime;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "app"."idempotency_records" TO blesh_runtime;
