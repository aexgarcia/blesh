CREATE TABLE "app"."order_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"event" text NOT NULL,
	"actor_id" uuid,
	"revision" integer,
	"reason" text,
	"data" jsonb,
	"operation_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."order_items" (
	"order_id" uuid NOT NULL,
	"revision" integer NOT NULL,
	"variant_id" uuid NOT NULL,
	"sku" text NOT NULL,
	"product_title" text NOT NULL,
	"color_label" text NOT NULL,
	"size_code" text NOT NULL,
	"unit_price_minor" integer NOT NULL,
	"quantity" integer NOT NULL,
	"line_total_minor" integer NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "order_items_order_id_revision_variant_id_pk" PRIMARY KEY("order_id","revision","variant_id"),
	CONSTRAINT "order_items_amounts_check" CHECK ("app"."order_items"."quantity" > 0 and "app"."order_items"."unit_price_minor" > 0 and "app"."order_items"."line_total_minor" = "app"."order_items"."unit_price_minor" * "app"."order_items"."quantity")
);
--> statement-breakpoint
CREATE TABLE "app"."order_revisions" (
	"order_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"subtotal_minor" integer NOT NULL,
	"discount_minor" integer DEFAULT 0 NOT NULL,
	"shipping_minor" integer DEFAULT 0 NOT NULL,
	"total_minor" integer NOT NULL,
	"delivery_mode" text NOT NULL,
	"delivery_address" text,
	"delivery_note" text,
	"payment_mode" text,
	"required_deposit_minor" integer DEFAULT 0 NOT NULL,
	"collection_responsible" text DEFAULT 'company' NOT NULL,
	"note" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "order_revisions_order_id_number_pk" PRIMARY KEY("order_id","number"),
	CONSTRAINT "order_revisions_totals_check" CHECK ("app"."order_revisions"."discount_minor" >= 0 and "app"."order_revisions"."discount_minor" <= "app"."order_revisions"."subtotal_minor" and "app"."order_revisions"."shipping_minor" >= 0 and "app"."order_revisions"."total_minor" = "app"."order_revisions"."subtotal_minor" - "app"."order_revisions"."discount_minor" + "app"."order_revisions"."shipping_minor"),
	CONSTRAINT "order_revisions_delivery_check" CHECK ("app"."order_revisions"."delivery_mode" in ('pickup', 'shipping', 'undecided')),
	CONSTRAINT "order_revisions_payment_mode_check" CHECK ("app"."order_revisions"."payment_mode" is null or "app"."order_revisions"."payment_mode" in ('prepaid', 'deposit_on_delivery', 'cash_on_delivery')),
	CONSTRAINT "order_revisions_responsible_check" CHECK ("app"."order_revisions"."collection_responsible" in ('company', 'carrier')),
	CONSTRAINT "order_revisions_deposit_check" CHECK ("app"."order_revisions"."required_deposit_minor" >= 0 and "app"."order_revisions"."required_deposit_minor" <= "app"."order_revisions"."total_minor")
);
--> statement-breakpoint
CREATE TABLE "app"."orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"source" text NOT NULL,
	"status" text DEFAULT 'requested' NOT NULL,
	"fulfillment_status" text DEFAULT 'unarranged' NOT NULL,
	"collection_status" text DEFAULT 'unpaid' NOT NULL,
	"refund_status" text DEFAULT 'none' NOT NULL,
	"customer_id" uuid,
	"customer_name" text NOT NULL,
	"customer_phone" text NOT NULL,
	"delivery_preference" text DEFAULT 'undecided' NOT NULL,
	"current_revision" integer DEFAULT 1 NOT NULL,
	"accepted_revision" integer,
	"accepted_at" timestamp with time zone,
	"accepted_by" uuid,
	"accepted_note" text,
	"total_minor" integer NOT NULL,
	"paid_minor" integer DEFAULT 0 NOT NULL,
	"reported_minor" integer DEFAULT 0 NOT NULL,
	"refunded_minor" integer DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'PEN' NOT NULL,
	"follow_up_at" timestamp with time zone,
	"carrier" text,
	"tracking_code" text,
	"cancel_reason" text,
	"creation_key" uuid,
	"creation_fingerprint" text,
	"created_by" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmed_at" timestamp with time zone,
	"dispatched_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	CONSTRAINT "orders_reference_check" CHECK ("app"."orders"."reference" ~ '^BL-[0-9A-Z]{6}$'),
	CONSTRAINT "orders_source_check" CHECK ("app"."orders"."source" in ('web', 'whatsapp', 'presential')),
	CONSTRAINT "orders_status_check" CHECK ("app"."orders"."status" in ('requested', 'confirmed', 'completed', 'cancelled')),
	CONSTRAINT "orders_fulfillment_check" CHECK ("app"."orders"."fulfillment_status" in ('unarranged', 'arranged', 'preparing', 'ready', 'dispatched', 'delivered', 'cancelled')),
	CONSTRAINT "orders_collection_check" CHECK ("app"."orders"."collection_status" in ('unpaid', 'partially_paid', 'paid')),
	CONSTRAINT "orders_refund_check" CHECK ("app"."orders"."refund_status" in ('none', 'pending', 'partially_refunded', 'refunded')),
	CONSTRAINT "orders_delivery_preference_check" CHECK ("app"."orders"."delivery_preference" in ('pickup', 'shipping', 'undecided')),
	CONSTRAINT "orders_amounts_check" CHECK ("app"."orders"."total_minor" >= 0 and "app"."orders"."paid_minor" >= 0 and "app"."orders"."reported_minor" >= 0 and "app"."orders"."refunded_minor" >= 0 and "app"."orders"."refunded_minor" <= "app"."orders"."paid_minor"),
	CONSTRAINT "orders_confirmed_customer_check" CHECK ("app"."orders"."status" = 'requested' or ("app"."orders"."status" = 'cancelled' and "app"."orders"."confirmed_at" is null) or "app"."orders"."customer_id" is not null),
	CONSTRAINT "orders_completed_check" CHECK ("app"."orders"."status" <> 'completed' or ("app"."orders"."fulfillment_status" = 'delivered' and "app"."orders"."paid_minor" >= "app"."orders"."total_minor")),
	CONSTRAINT "orders_accepted_check" CHECK ("app"."orders"."accepted_revision" is null or "app"."orders"."accepted_revision" <= "app"."orders"."current_revision")
);
--> statement-breakpoint
CREATE TABLE "app"."payment_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"status" text NOT NULL,
	"method" text NOT NULL,
	"amount_minor" integer NOT NULL,
	"reference" text,
	"note" text,
	"received_at" timestamp with time zone NOT NULL,
	"obligation_id" uuid,
	"operation_key" text NOT NULL,
	"recorded_by" uuid NOT NULL,
	"verified_by" uuid,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_records_kind_check" CHECK ("app"."payment_records"."kind" in ('payment', 'refund')),
	CONSTRAINT "payment_records_status_check" CHECK ("app"."payment_records"."status" in ('verified', 'reported')),
	CONSTRAINT "payment_records_method_check" CHECK ("app"."payment_records"."method" in ('yape', 'plin', 'transfer', 'cash', 'other')),
	CONSTRAINT "payment_records_amount_check" CHECK ("app"."payment_records"."amount_minor" > 0),
	CONSTRAINT "payment_records_verified_check" CHECK (("app"."payment_records"."status" = 'verified') = ("app"."payment_records"."verified_by" is not null and "app"."payment_records"."verified_at" is not null)),
	CONSTRAINT "payment_records_refund_check" CHECK ("app"."payment_records"."kind" <> 'refund' or ("app"."payment_records"."status" = 'verified' and "app"."payment_records"."obligation_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "app"."refund_obligations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"origin" text NOT NULL,
	"reason" text NOT NULL,
	"authorized_minor" integer NOT NULL,
	"refunded_minor" integer DEFAULT 0 NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "refund_obligations_origin_check" CHECK ("app"."refund_obligations"."origin" in ('cancellation', 'overpayment', 'late_payment', 'return')),
	CONSTRAINT "refund_obligations_amounts_check" CHECK ("app"."refund_obligations"."authorized_minor" > 0 and "app"."refund_obligations"."refunded_minor" >= 0 and "app"."refund_obligations"."refunded_minor" <= "app"."refund_obligations"."authorized_minor")
);
--> statement-breakpoint
CREATE TABLE "app"."return_receipt_items" (
	"receipt_id" uuid NOT NULL,
	"variant_id" uuid NOT NULL,
	"received" integer NOT NULL,
	"restocked" integer NOT NULL,
	CONSTRAINT "return_receipt_items_receipt_id_variant_id_pk" PRIMARY KEY("receipt_id","variant_id"),
	CONSTRAINT "return_receipt_items_check" CHECK ("app"."return_receipt_items"."received" > 0 and "app"."return_receipt_items"."restocked" >= 0 and "app"."return_receipt_items"."restocked" <= "app"."return_receipt_items"."received")
);
--> statement-breakpoint
CREATE TABLE "app"."return_receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"operation_key" text NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."stock_reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"variant_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"consumed_at" timestamp with time zone,
	"released_at" timestamp with time zone,
	CONSTRAINT "stock_reservations_quantity_check" CHECK ("app"."stock_reservations"."quantity" > 0),
	CONSTRAINT "stock_reservations_status_check" CHECK ("app"."stock_reservations"."status" in ('active', 'consumed', 'released')),
	CONSTRAINT "stock_reservations_dates_check" CHECK (("app"."stock_reservations"."status" = 'consumed') = ("app"."stock_reservations"."consumed_at" is not null) and ("app"."stock_reservations"."status" = 'released') = ("app"."stock_reservations"."released_at" is not null))
);
--> statement-breakpoint
ALTER TABLE "app"."order_events" ADD CONSTRAINT "order_events_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "app"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."order_items" ADD CONSTRAINT "order_items_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "app"."product_variants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."order_items" ADD CONSTRAINT "order_items_revision_fk" FOREIGN KEY ("order_id","revision") REFERENCES "app"."order_revisions"("order_id","number") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."order_revisions" ADD CONSTRAINT "order_revisions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "app"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."orders" ADD CONSTRAINT "orders_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "app"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."payment_records" ADD CONSTRAINT "payment_records_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "app"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."payment_records" ADD CONSTRAINT "payment_records_obligation_id_refund_obligations_id_fk" FOREIGN KEY ("obligation_id") REFERENCES "app"."refund_obligations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."refund_obligations" ADD CONSTRAINT "refund_obligations_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "app"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."return_receipt_items" ADD CONSTRAINT "return_receipt_items_receipt_id_return_receipts_id_fk" FOREIGN KEY ("receipt_id") REFERENCES "app"."return_receipts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."return_receipts" ADD CONSTRAINT "return_receipts_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "app"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."stock_reservations" ADD CONSTRAINT "stock_reservations_variant_id_inventory_balances_variant_id_fk" FOREIGN KEY ("variant_id") REFERENCES "app"."inventory_balances"("variant_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "order_events_operation_key" ON "app"."order_events" USING btree ("operation_key");--> statement-breakpoint
CREATE INDEX "order_events_order_idx" ON "app"."order_events" USING btree ("order_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_reference_key" ON "app"."orders" USING btree ("reference");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_creation_key_key" ON "app"."orders" USING btree ("creation_key");--> statement-breakpoint
CREATE INDEX "orders_status_created_idx" ON "app"."orders" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "orders_customer_idx" ON "app"."orders" USING btree ("customer_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_records_operation_key" ON "app"."payment_records" USING btree ("operation_key");--> statement-breakpoint
CREATE INDEX "payment_records_order_idx" ON "app"."payment_records" USING btree ("order_id","created_at");--> statement-breakpoint
CREATE INDEX "refund_obligations_order_idx" ON "app"."refund_obligations" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "return_receipts_operation_key" ON "app"."return_receipts" USING btree ("operation_key");--> statement-breakpoint
CREATE INDEX "return_receipts_order_idx" ON "app"."return_receipts" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "stock_reservations_order_variant_key" ON "app"."stock_reservations" USING btree ("order_id","variant_id");--> statement-breakpoint
CREATE INDEX "stock_reservations_variant_active_idx" ON "app"."stock_reservations" USING btree ("variant_id") WHERE "app"."stock_reservations"."status" = 'active';--> statement-breakpoint
-- Historia de ventas inmutable para el rol runtime: revisiones, líneas, eventos y recepciones
-- solo se insertan; pedidos, cobros, obligaciones y reservas nunca se borran.
REVOKE UPDATE, DELETE ON "app"."order_revisions", "app"."order_items", "app"."order_events", "app"."return_receipts", "app"."return_receipt_items" FROM blesh_runtime;
--> statement-breakpoint
REVOKE DELETE ON "app"."orders", "app"."payment_records", "app"."refund_obligations", "app"."stock_reservations" FROM blesh_runtime;
