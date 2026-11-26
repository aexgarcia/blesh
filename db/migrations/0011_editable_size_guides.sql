ALTER TABLE "app"."size_guides" ADD COLUMN "last_operation_key" uuid;--> statement-breakpoint
ALTER TABLE "app"."size_guides" ADD COLUMN "last_fingerprint" text;--> statement-breakpoint
CREATE UNIQUE INDEX "size_guides_operation_key" ON "app"."size_guides" USING btree ("last_operation_key");
--> statement-breakpoint
REVOKE DELETE ON app.size_guides FROM blesh_runtime;
