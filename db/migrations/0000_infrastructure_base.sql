CREATE SCHEMA "app";
--> statement-breakpoint
CREATE TABLE "app"."audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_type" text NOT NULL,
	"actor_id" text,
	"action" text NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" text,
	"changes" jsonb,
	"reason" text,
	"request_id" text,
	CONSTRAINT "audit_events_actor_type_check" CHECK ("app"."audit_events"."actor_type" in ('admin', 'system')),
	CONSTRAINT "audit_events_action_length_check" CHECK (char_length("app"."audit_events"."action") between 1 and 100)
);
--> statement-breakpoint
CREATE TABLE "app"."idempotency_records" (
	"scope" text NOT NULL,
	"key" text NOT NULL,
	"request_hash" text NOT NULL,
	"status" text NOT NULL,
	"resource_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "idempotency_records_scope_key_pk" PRIMARY KEY("scope","key"),
	CONSTRAINT "idempotency_records_status_check" CHECK ("app"."idempotency_records"."status" in ('in_progress', 'completed', 'failed')),
	CONSTRAINT "idempotency_records_key_length_check" CHECK (char_length("app"."idempotency_records"."key") between 8 and 200),
	CONSTRAINT "idempotency_records_completion_check" CHECK (("app"."idempotency_records"."status" = 'completed') = ("app"."idempotency_records"."completed_at" is not null))
);
--> statement-breakpoint
CREATE INDEX "audit_events_resource_idx" ON "app"."audit_events" USING btree ("resource_type","resource_id","occurred_at");--> statement-breakpoint
CREATE INDEX "audit_events_actor_idx" ON "app"."audit_events" USING btree ("actor_id","occurred_at");--> statement-breakpoint
CREATE INDEX "idempotency_records_expires_idx" ON "app"."idempotency_records" USING btree ("expires_at");