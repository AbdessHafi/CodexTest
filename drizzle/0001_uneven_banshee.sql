CREATE TABLE "abuse_buckets" (
	"key" text PRIMARY KEY NOT NULL,
	"window" timestamp with time zone NOT NULL,
	"count" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review_photos" (
	"id" text PRIMARY KEY NOT NULL,
	"review_id" text NOT NULL,
	"object_key" text NOT NULL,
	"alt" text NOT NULL,
	CONSTRAINT "review_photos_object_key_unique" UNIQUE("object_key")
);
--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "content_hash" text;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "abuse_reason" text;--> statement-breakpoint
ALTER TABLE "review_photos" ADD CONSTRAINT "review_photos_review_id_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "review_moderation_idx" ON "reviews" USING btree ("status","created_at");--> statement-breakpoint
ALTER TABLE "report_flags" ADD CONSTRAINT "reporter_review_unique" UNIQUE("reporter_id","target_id");--> statement-breakpoint
ALTER TABLE review_photos ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE abuse_buckets ENABLE ROW LEVEL SECURITY;
