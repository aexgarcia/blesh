CREATE TABLE "app"."admin_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auth_subject" uuid NOT NULL,
	"email" text NOT NULL,
	"display_name" text NOT NULL,
	"role" text NOT NULL,
	"status" text NOT NULL,
	"invited_by" uuid,
	"invited_at" timestamp with time zone DEFAULT now() NOT NULL,
	"activated_at" timestamp with time zone,
	"disabled_at" timestamp with time zone,
	"sessions_revoked_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_memberships_role_check" CHECK ("app"."admin_memberships"."role" in ('owner', 'operator')),
	CONSTRAINT "admin_memberships_status_check" CHECK ("app"."admin_memberships"."status" in ('invited', 'active', 'disabled')),
	CONSTRAINT "admin_memberships_email_check" CHECK ("app"."admin_memberships"."email" = lower("app"."admin_memberships"."email") and position('@' in "app"."admin_memberships"."email") > 1),
	CONSTRAINT "admin_memberships_name_check" CHECK (char_length("app"."admin_memberships"."display_name") between 1 and 80),
	CONSTRAINT "admin_memberships_activated_check" CHECK ("app"."admin_memberships"."status" <> 'active' or "app"."admin_memberships"."activated_at" is not null)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "admin_memberships_auth_subject_key" ON "app"."admin_memberships" USING btree ("auth_subject");--> statement-breakpoint
CREATE UNIQUE INDEX "admin_memberships_email_key" ON "app"."admin_memberships" USING btree ("email");--> statement-breakpoint
CREATE INDEX "admin_memberships_role_status_idx" ON "app"."admin_memberships" USING btree ("role","status");