CREATE TABLE "app"."rate_limit_counters" (
	"bucket" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"hits" integer DEFAULT 1 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "rate_limit_counters_bucket_window_start_pk" PRIMARY KEY("bucket","window_start"),
	CONSTRAINT "rate_limit_counters_hits_check" CHECK ("app"."rate_limit_counters"."hits" > 0),
	CONSTRAINT "rate_limit_counters_bucket_check" CHECK (char_length("app"."rate_limit_counters"."bucket") between 8 and 200)
);
--> statement-breakpoint
CREATE INDEX "rate_limit_counters_expires_idx" ON "app"."rate_limit_counters" USING btree ("expires_at");--> statement-breakpoint
-- Contadores efímeros del límite de tasa de la tienda: el runtime los crea, incrementa y purga.
-- Coincide con los privilegios por defecto; se declara explícito por claridad.
GRANT SELECT, INSERT, UPDATE, DELETE ON "app"."rate_limit_counters" TO blesh_runtime;
