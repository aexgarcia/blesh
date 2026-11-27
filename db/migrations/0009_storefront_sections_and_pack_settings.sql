CREATE TABLE "app"."pack_config" (
	"code" text PRIMARY KEY NOT NULL,
	"enabled" boolean NOT NULL,
	"policy" jsonb NOT NULL,
	"version" integer NOT NULL,
	"operation_key" uuid NOT NULL,
	"fingerprint" text NOT NULL,
	"updated_by" uuid NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pack_config_code_check" CHECK ("app"."pack_config"."code" = 'pack-boxy-essential'),
	CONSTRAINT "pack_config_version_check" CHECK ("app"."pack_config"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "app"."storefront_sections" (
	"key" text PRIMARY KEY NOT NULL,
	"data" jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"operation_key" uuid NOT NULL,
	"fingerprint" text NOT NULL,
	"updated_by" uuid NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "storefront_sections_key_check" CHECK ("app"."storefront_sections"."key" in ('pack', 'reels')),
	CONSTRAINT "storefront_sections_version_check" CHECK ("app"."storefront_sections"."version" > 0)
);
--> statement-breakpoint
REVOKE DELETE ON app.pack_config, app.storefront_sections FROM blesh_runtime;
