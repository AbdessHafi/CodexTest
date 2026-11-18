CREATE TABLE "mail_outbox" (
	"id" text PRIMARY KEY NOT NULL,
	"recipient" text NOT NULL,
	"subject" text NOT NULL,
	"text" text NOT NULL,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "venue_analytics" (
	"venue_id" text NOT NULL,
	"day" date NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	"phone" integer DEFAULT 0 NOT NULL,
	"website" integer DEFAULT 0 NOT NULL,
	"directions" integer DEFAULT 0 NOT NULL,
	"favorites" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "venue_analytics_venue_id_day_pk" PRIMARY KEY("venue_id","day")
);
--> statement-breakpoint
DROP INDEX "one_pending_claim";--> statement-breakpoint
ALTER TABLE "venue_claims" ALTER COLUMN "document_key" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "menu_items" ADD COLUMN "special_end_date" date;--> statement-breakpoint
ALTER TABLE "menu_items" ADD COLUMN "featured_start" date;--> statement-breakpoint
ALTER TABLE "menu_items" ADD COLUMN "featured_end" date;--> statement-breakpoint
ALTER TABLE "menu_items" ADD COLUMN "category" text DEFAULT 'À la carte' NOT NULL;--> statement-breakpoint
ALTER TABLE "menu_items" ADD COLUMN "position" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "menu_items" ADD COLUMN "allergens" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "menu_items" ADD COLUMN "available" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN "position" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN "cover" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "venue_claims" ADD COLUMN "document_type" text;--> statement-breakpoint
ALTER TABLE "venue_claims" ADD COLUMN "business_email" text NOT NULL;--> statement-breakpoint
ALTER TABLE "venue_claims" ADD COLUMN "phone" text NOT NULL;--> statement-breakpoint
ALTER TABLE "venue_claims" ADD COLUMN "applicant_role" text NOT NULL;--> statement-breakpoint
ALTER TABLE "venue_claims" ADD COLUMN "code_hash" text;--> statement-breakpoint
ALTER TABLE "venue_claims" ADD COLUMN "code_expires" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "venue_claims" ADD COLUMN "code_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "venue_claims" ADD COLUMN "email_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "email" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "phone" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "website" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "instagram" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "facebook" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "types" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "venue_analytics" ADD CONSTRAINT "venue_analytics_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "one_pending_claim" ON "venue_claims" USING btree ("venue_id") WHERE "venue_claims"."status"='PENDING';--> statement-breakpoint
ALTER TABLE mail_outbox ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE venue_analytics ENABLE ROW LEVEL SECURITY;
