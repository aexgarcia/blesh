CREATE TABLE "app"."customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"phone_normalized" text NOT NULL,
	"email" text,
	"status" text DEFAULT 'active' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"creation_key" uuid,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "customers_status_check" CHECK ("app"."customers"."status" in ('active', 'archived')),
	CONSTRAINT "customers_name_length_check" CHECK (char_length("app"."customers"."name") between 2 and 120),
	CONSTRAINT "customers_phone_format_check" CHECK ("app"."customers"."phone_normalized" ~ '^\+[1-9][0-9]{7,14}$'),
	CONSTRAINT "customers_email_length_check" CHECK ("app"."customers"."email" is null or char_length("app"."customers"."email") between 3 and 254),
	CONSTRAINT "customers_archived_consistency_check" CHECK (("app"."customers"."status" = 'archived') = ("app"."customers"."archived_at" is not null))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "customers_creation_key_key" ON "app"."customers" USING btree ("creation_key");--> statement-breakpoint
CREATE INDEX "customers_phone_idx" ON "app"."customers" USING btree ("phone_normalized");--> statement-breakpoint
CREATE INDEX "customers_name_idx" ON "app"."customers" USING btree (lower("name"));--> statement-breakpoint
CREATE INDEX "customers_status_updated_idx" ON "app"."customers" USING btree ("status","updated_at");--> statement-breakpoint
-- Las fichas no se borran: archivar conserva pedidos e historia (solo owner, auditado).
REVOKE DELETE ON "app"."customers" FROM blesh_runtime;
