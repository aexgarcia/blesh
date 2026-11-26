ALTER TABLE "app"."storefront_sections" DROP CONSTRAINT "storefront_sections_key_check";--> statement-breakpoint
ALTER TABLE "app"."categories" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."categories" ADD COLUMN "creation_key" uuid;--> statement-breakpoint
ALTER TABLE "app"."categories" ADD COLUMN "creation_fingerprint" text;--> statement-breakpoint
ALTER TABLE "app"."categories" ADD COLUMN "last_operation_key" uuid;--> statement-breakpoint
ALTER TABLE "app"."categories" ADD COLUMN "last_fingerprint" text;--> statement-breakpoint
CREATE UNIQUE INDEX "categories_creation_key" ON "app"."categories" USING btree ("creation_key");--> statement-breakpoint
CREATE UNIQUE INDEX "categories_operation_key" ON "app"."categories" USING btree ("last_operation_key");--> statement-breakpoint
ALTER TABLE "app"."storefront_sections" ADD CONSTRAINT "storefront_sections_key_check" CHECK ("app"."storefront_sections"."key" in ('hero', 'collections', 'pack', 'reels'));
--> statement-breakpoint
GRANT INSERT, UPDATE ON app.categories TO blesh_runtime;
