CREATE TABLE "venue_claims" (
	"id" text PRIMARY KEY NOT NULL,
	"venue_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"siret" text NOT NULL,
	"statement" text NOT NULL,
	"document_key" text NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "menu_items" ADD COLUMN "special_date" date;--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN "menu_item_id" text;--> statement-breakpoint
ALTER TABLE "venue_claims" ADD CONSTRAINT "venue_claims_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_claims" ADD CONSTRAINT "venue_claims_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "one_pending_claim" ON "venue_claims" USING btree ("user_id","venue_id") WHERE "venue_claims"."status"='PENDING';--> statement-breakpoint
CREATE INDEX "claims_status_idx" ON "venue_claims" USING btree ("status","created_at");--> statement-breakpoint
ALTER TABLE "photos" ADD CONSTRAINT "photos_menu_item_id_menu_items_id_fk" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "one_approved_owner" ON "venue_owners" USING btree ("venue_id") WHERE "venue_owners"."status"='APPROVED';--> statement-breakpoint
ALTER TABLE venue_claims ENABLE ROW LEVEL SECURITY;
