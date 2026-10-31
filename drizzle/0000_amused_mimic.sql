CREATE EXTENSION IF NOT EXISTS postgis;
--> statement-breakpoint
CREATE TYPE "public"."booking_status" AS ENUM('PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW');--> statement-breakpoint
CREATE TYPE "public"."review_status" AS ENUM('PENDING', 'PUBLISHED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('CONSUMER', 'OWNER', 'ADMIN');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"actor_id" uuid NOT NULL,
	"action" text NOT NULL,
	"target_id" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"venue_id" text NOT NULL,
	"slot_id" text NOT NULL,
	"party_size" integer NOT NULL,
	"status" "booking_status" DEFAULT 'PENDING' NOT NULL,
	"deposit" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "party_positive" CHECK ("bookings"."party_size">0)
);
--> statement-breakpoint
CREATE TABLE "favorites" (
	"user_id" uuid NOT NULL,
	"venue_id" text NOT NULL,
	"list_name" text DEFAULT 'Mes adresses' NOT NULL,
	CONSTRAINT "favorites_user_id_venue_id_pk" PRIMARY KEY("user_id","venue_id")
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" text PRIMARY KEY NOT NULL,
	"payment_id" text NOT NULL,
	"stripe_invoice_id" text,
	CONSTRAINT "invoices_stripe_invoice_id_unique" UNIQUE("stripe_invoice_id")
);
--> statement-breakpoint
CREATE TABLE "menu_items" (
	"id" text PRIMARY KEY NOT NULL,
	"venue_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"price" integer NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	CONSTRAINT "menu_price" CHECK ("menu_items"."price" >= 0)
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" text PRIMARY KEY NOT NULL,
	"venue_id" text NOT NULL,
	"source" text NOT NULL,
	"amount" integer NOT NULL,
	"currency" text DEFAULT 'eur' NOT NULL,
	"stripe_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_stripe_id_unique" UNIQUE("stripe_id")
);
--> statement-breakpoint
CREATE TABLE "photos" (
	"id" text PRIMARY KEY NOT NULL,
	"venue_id" text NOT NULL,
	"key" text NOT NULL,
	"alt" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"monthly_price" integer NOT NULL,
	"per_cover_fee" integer DEFAULT 0 NOT NULL,
	"features" text[] NOT NULL,
	"stripe_price_id" text,
	CONSTRAINT "plans_name_unique" UNIQUE("name"),
	CONSTRAINT "plans_stripe_price_id_unique" UNIQUE("stripe_price_id")
);
--> statement-breakpoint
CREATE TABLE "report_flags" (
	"id" text PRIMARY KEY NOT NULL,
	"reporter_id" uuid NOT NULL,
	"target_id" text NOT NULL,
	"reason" text NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review_replies" (
	"id" text PRIMARY KEY NOT NULL,
	"review_id" text NOT NULL,
	"author_id" uuid NOT NULL,
	"text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "review_replies_review_id_unique" UNIQUE("review_id")
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"venue_id" text NOT NULL,
	"visit_date" date NOT NULL,
	"booking_id" text,
	"coffee" integer NOT NULL,
	"food" integer NOT NULL,
	"service" integer NOT NULL,
	"ambiance" integer NOT NULL,
	"value" integer NOT NULL,
	"text" text NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"status" "review_status" DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reviews_booking_id_unique" UNIQUE("booking_id"),
	CONSTRAINT "reviews_user_id_venue_id_visit_date_unique" UNIQUE("user_id","venue_id","visit_date"),
	CONSTRAINT "review_ratings" CHECK ("reviews"."coffee" between 1 and 5 and "reviews"."food" between 1 and 5 and "reviews"."service" between 1 and 5 and "reviews"."ambiance" between 1 and 5 and "reviews"."value" between 1 and 5)
);
--> statement-breakpoint
CREATE TABLE "slots" (
	"id" text PRIMARY KEY NOT NULL,
	"venue_id" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"capacity" integer NOT NULL,
	CONSTRAINT "slots_venue_id_starts_at_unique" UNIQUE("venue_id","starts_at"),
	CONSTRAINT "slot_capacity" CHECK ("slots"."capacity">0)
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"venue_id" text NOT NULL,
	"plan_id" text NOT NULL,
	"stripe_subscription_id" text,
	"status" text NOT NULL,
	CONSTRAINT "subscriptions_venue_id_unique" UNIQUE("venue_id"),
	CONSTRAINT "subscriptions_stripe_subscription_id_unique" UNIQUE("stripe_subscription_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"role" "role" DEFAULT 'CONSUMER' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "venue_exceptions" (
	"id" text PRIMARY KEY NOT NULL,
	"venue_id" text NOT NULL,
	"date" date NOT NULL,
	"closed" boolean DEFAULT true NOT NULL,
	"open" text,
	"close" text,
	CONSTRAINT "venue_exceptions_venue_id_date_unique" UNIQUE("venue_id","date")
);
--> statement-breakpoint
CREATE TABLE "venue_hours" (
	"id" text PRIMARY KEY NOT NULL,
	"venue_id" text NOT NULL,
	"day" integer NOT NULL,
	"open" text NOT NULL,
	"close" text NOT NULL,
	CONSTRAINT "venue_hours_venue_id_day_unique" UNIQUE("venue_id","day"),
	CONSTRAINT "hours_day" CHECK ("venue_hours"."day" between 0 and 6)
);
--> statement-breakpoint
CREATE TABLE "venue_owners" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"venue_id" text NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	CONSTRAINT "venue_owners_user_id_venue_id_unique" UNIQUE("user_id","venue_id")
);
--> statement-breakpoint
CREATE TABLE "venues" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"city" text NOT NULL,
	"neighborhood" text NOT NULL,
	"address" text NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"location" geography(Point,4326),
	"type" text NOT NULL,
	"price" integer NOT NULL,
	"tags" text[] NOT NULL,
	"description" text NOT NULL,
	"siret" text,
	"claimed" boolean DEFAULT false NOT NULL,
	"source" text DEFAULT 'DEMO' NOT NULL,
	"source_id" text,
	"photo" integer DEFAULT 0 NOT NULL,
	"capacity" integer DEFAULT 20 NOT NULL,
	"cancellation_hours" integer DEFAULT 24 NOT NULL,
	CONSTRAINT "venues_slug_unique" UNIQUE("slug"),
	CONSTRAINT "venues_siret_unique" UNIQUE("siret"),
	CONSTRAINT "venues_source_id_unique" UNIQUE("source_id"),
	CONSTRAINT "venue_price_range" CHECK ("venues"."price" between 1 and 3),
	CONSTRAINT "venue_coords" CHECK ("venues"."latitude" between -90 and 90 and "venues"."longitude" between -180 and 180)
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_slot_id_slots_id_fk" FOREIGN KEY ("slot_id") REFERENCES "public"."slots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photos" ADD CONSTRAINT "photos_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_flags" ADD CONSTRAINT "report_flags_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_replies" ADD CONSTRAINT "review_replies_review_id_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_replies" ADD CONSTRAINT "review_replies_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slots" ADD CONSTRAINT "slots_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_exceptions" ADD CONSTRAINT "venue_exceptions_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_hours" ADD CONSTRAINT "venue_hours_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_owners" ADD CONSTRAINT "venue_owners_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_owners" ADD CONSTRAINT "venue_owners_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "venue_city_type_idx" ON "venues" USING btree ("city","type");--> statement-breakpoint
CREATE INDEX "venue_location_idx" ON "venues" USING gist ("location");
--> statement-breakpoint
CREATE FUNCTION sync_venue_location() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.location := ST_SetSRID(ST_MakePoint(NEW.longitude,NEW.latitude),4326)::geography; RETURN NEW; END; $$;
--> statement-breakpoint
CREATE TRIGGER venue_location_sync BEFORE INSERT OR UPDATE OF latitude, longitude ON venues FOR EACH ROW EXECUTE FUNCTION sync_venue_location();
--> statement-breakpoint
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "bookings" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "favorites" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "invoices" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "menu_items" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "photos" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "plans" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "report_flags" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "review_replies" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "reviews" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "slots" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "subscriptions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "venue_exceptions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "venue_hours" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "venue_owners" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "venues" ENABLE ROW LEVEL SECURITY;
