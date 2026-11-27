ALTER TABLE "app"."size_guides" ADD COLUMN "creation_key" uuid;--> statement-breakpoint
ALTER TABLE "app"."size_guides" ADD COLUMN "creation_fingerprint" text;--> statement-breakpoint
CREATE UNIQUE INDEX "size_guides_creation_key" ON "app"."size_guides" USING btree ("creation_key");