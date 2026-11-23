CREATE TABLE "app"."categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"position" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."inventory_balances" (
	"variant_id" uuid PRIMARY KEY NOT NULL,
	"on_hand" integer DEFAULT 0 NOT NULL,
	"reserved" integer DEFAULT 0 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inventory_balances_on_hand_check" CHECK ("app"."inventory_balances"."on_hand" >= 0),
	CONSTRAINT "inventory_balances_reserved_check" CHECK ("app"."inventory_balances"."reserved" >= 0 and "app"."inventory_balances"."reserved" <= "app"."inventory_balances"."on_hand")
);
--> statement-breakpoint
CREATE TABLE "app"."media_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"object_key" text NOT NULL,
	"mime" text NOT NULL,
	"bytes" bigint NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"status" text DEFAULT 'ready' NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_assets_mime_check" CHECK ("app"."media_assets"."mime" in ('image/webp')),
	CONSTRAINT "media_assets_status_check" CHECK ("app"."media_assets"."status" in ('ready', 'rejected')),
	CONSTRAINT "media_assets_dimensions_check" CHECK ("app"."media_assets"."width" > 0 and "app"."media_assets"."height" > 0 and "app"."media_assets"."bytes" > 0)
);
--> statement-breakpoint
CREATE TABLE "app"."product_colors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"color_code" text NOT NULL,
	"label" text NOT NULL,
	"slug" text NOT NULL,
	"swatch_hex" text,
	"active" boolean DEFAULT true NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	CONSTRAINT "product_colors_id_product_key" UNIQUE("id","product_id"),
	CONSTRAINT "product_colors_product_code_key" UNIQUE("product_id","color_code"),
	CONSTRAINT "product_colors_product_slug_key" UNIQUE("product_id","slug"),
	CONSTRAINT "product_colors_label_check" CHECK (char_length("app"."product_colors"."label") between 1 and 40),
	CONSTRAINT "product_colors_slug_check" CHECK ("app"."product_colors"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
	CONSTRAINT "product_colors_code_check" CHECK ("app"."product_colors"."color_code" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
	CONSTRAINT "product_colors_swatch_check" CHECK ("app"."product_colors"."swatch_hex" is null or "app"."product_colors"."swatch_hex" ~ '^#[0-9a-f]{6}$'),
	CONSTRAINT "product_colors_primary_active_check" CHECK (not "app"."product_colors"."is_primary" or "app"."product_colors"."active")
);
--> statement-breakpoint
CREATE TABLE "app"."product_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"color_id" uuid,
	"media_id" uuid NOT NULL,
	"alt" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"is_cover" boolean DEFAULT false NOT NULL,
	CONSTRAINT "product_images_alt_check" CHECK (char_length("app"."product_images"."alt") between 1 and 200)
);
--> statement-breakpoint
CREATE TABLE "app"."product_variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"color_id" uuid NOT NULL,
	"sku" text NOT NULL,
	"size_code" text NOT NULL,
	"price_minor" integer NOT NULL,
	"compare_at_minor" integer,
	"currency" text DEFAULT 'PEN' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "product_variants_color_size_key" UNIQUE("color_id","size_code"),
	CONSTRAINT "product_variants_sku_check" CHECK ("app"."product_variants"."sku" ~ '^[A-Z0-9][A-Z0-9-]{1,38}[A-Z0-9]$'),
	CONSTRAINT "product_variants_price_check" CHECK ("app"."product_variants"."price_minor" > 0 and "app"."product_variants"."price_minor" <= 10000000),
	CONSTRAINT "product_variants_compare_check" CHECK ("app"."product_variants"."compare_at_minor" is null or ("app"."product_variants"."compare_at_minor" > "app"."product_variants"."price_minor" and "app"."product_variants"."compare_at_minor" <= 10000000)),
	CONSTRAINT "product_variants_currency_check" CHECK ("app"."product_variants"."currency" = 'PEN')
);
--> statement-breakpoint
CREATE TABLE "app"."products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"short_description" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"category_id" uuid,
	"size_guide_id" uuid,
	"status" text DEFAULT 'draft' NOT NULL,
	"seo_title" text,
	"seo_description" text,
	"published_at" timestamp with time zone,
	"first_published_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_status_check" CHECK ("app"."products"."status" in ('draft', 'published', 'archived')),
	CONSTRAINT "products_title_check" CHECK (char_length("app"."products"."title") between 1 and 160),
	CONSTRAINT "products_short_description_check" CHECK (char_length("app"."products"."short_description") <= 300),
	CONSTRAINT "products_description_check" CHECK (char_length("app"."products"."description") <= 5000),
	CONSTRAINT "products_slug_check" CHECK ("app"."products"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
	CONSTRAINT "products_published_check" CHECK ("app"."products"."status" <> 'published' or ("app"."products"."published_at" is not null and "app"."products"."category_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "app"."size_guide_rows" (
	"guide_id" uuid NOT NULL,
	"size_code" text NOT NULL,
	"length_cm" numeric(5, 1) NOT NULL,
	"width_cm" numeric(5, 1) NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "size_guide_rows_guide_size_key" UNIQUE("guide_id","size_code")
);
--> statement-breakpoint
CREATE TABLE "app"."size_guides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."stock_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"variant_id" uuid NOT NULL,
	"delta_on_hand" integer NOT NULL,
	"delta_reserved" integer DEFAULT 0 NOT NULL,
	"on_hand_after" integer NOT NULL,
	"reserved_after" integer NOT NULL,
	"reason" text NOT NULL,
	"note" text,
	"order_id" uuid,
	"operation_key" text NOT NULL,
	"actor_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stock_movements_nonzero_check" CHECK ("app"."stock_movements"."delta_on_hand" <> 0 or "app"."stock_movements"."delta_reserved" <> 0),
	CONSTRAINT "stock_movements_reason_check" CHECK ("app"."stock_movements"."reason" in ('initial_count', 'restock', 'count_correction', 'damage', 'loss', 'other', 'reservation', 'release', 'consumption', 'return_inspected')),
	CONSTRAINT "stock_movements_note_check" CHECK ("app"."stock_movements"."note" is null or char_length("app"."stock_movements"."note") <= 300)
);
--> statement-breakpoint
ALTER TABLE "app"."inventory_balances" ADD CONSTRAINT "inventory_balances_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "app"."product_variants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."product_colors" ADD CONSTRAINT "product_colors_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "app"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."product_images" ADD CONSTRAINT "product_images_media_id_media_assets_id_fk" FOREIGN KEY ("media_id") REFERENCES "app"."media_assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."product_images" ADD CONSTRAINT "product_images_color_fk" FOREIGN KEY ("color_id","product_id") REFERENCES "app"."product_colors"("id","product_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."product_images" ADD CONSTRAINT "product_images_product_fk" FOREIGN KEY ("product_id") REFERENCES "app"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."product_variants" ADD CONSTRAINT "product_variants_color_fk" FOREIGN KEY ("color_id","product_id") REFERENCES "app"."product_colors"("id","product_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."products" ADD CONSTRAINT "products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "app"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."products" ADD CONSTRAINT "products_size_guide_id_size_guides_id_fk" FOREIGN KEY ("size_guide_id") REFERENCES "app"."size_guides"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."size_guide_rows" ADD CONSTRAINT "size_guide_rows_guide_id_size_guides_id_fk" FOREIGN KEY ("guide_id") REFERENCES "app"."size_guides"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."stock_movements" ADD CONSTRAINT "stock_movements_variant_id_inventory_balances_variant_id_fk" FOREIGN KEY ("variant_id") REFERENCES "app"."inventory_balances"("variant_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "categories_slug_key" ON "app"."categories" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "media_assets_object_key_key" ON "app"."media_assets" USING btree ("object_key");--> statement-breakpoint
CREATE UNIQUE INDEX "product_colors_one_primary_idx" ON "app"."product_colors" USING btree ("product_id") WHERE "app"."product_colors"."is_primary";--> statement-breakpoint
CREATE UNIQUE INDEX "product_images_media_key" ON "app"."product_images" USING btree ("media_id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_images_one_cover_idx" ON "app"."product_images" USING btree ("product_id",coalesce("color_id", '00000000-0000-0000-0000-000000000000'::uuid)) WHERE "app"."product_images"."is_cover";--> statement-breakpoint
CREATE INDEX "product_images_product_idx" ON "app"."product_images" USING btree ("product_id","color_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "product_variants_sku_key" ON "app"."product_variants" USING btree ("sku");--> statement-breakpoint
CREATE INDEX "product_variants_product_idx" ON "app"."product_variants" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "products_slug_key" ON "app"."products" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "products_listing_idx" ON "app"."products" USING btree ("status","category_id","published_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "size_guides_code_key" ON "app"."size_guides" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "stock_movements_operation_key" ON "app"."stock_movements" USING btree ("operation_key");--> statement-breakpoint
CREATE INDEX "stock_movements_variant_idx" ON "app"."stock_movements" USING btree ("variant_id","created_at");