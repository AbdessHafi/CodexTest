import { sql } from "drizzle-orm";
import {
  pgTable,
  pgEnum,
  text,
  integer,
  boolean,
  doublePrecision,
  timestamp,
  uuid,
  date,
  unique,
  index,
  check,
  customType,
  primaryKey,
  jsonb,
} from "drizzle-orm/pg-core";
const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());
const created = () =>
  timestamp("created_at", { withTimezone: true }).defaultNow().notNull();
const geo = customType<{ data: string }>({ dataType: () => "geography" });
export const role = pgEnum("role", ["CONSUMER", "OWNER", "ADMIN"]);
export const reviewStatus = pgEnum("review_status", [
  "PENDING",
  "PUBLISHED",
  "REJECTED",
]);
export const bookingStatus = pgEnum("booking_status", [
  "PENDING",
  "CONFIRMED",
  "CANCELLED",
  "COMPLETED",
  "NO_SHOW",
]);
export const users = pgTable("users", {
  id: uuid("id").primaryKey(),
  role: role("role").default("CONSUMER").notNull(),
  createdAt: created(),
});
export const venues = pgTable(
  "venues",
  {
    id: id(),
    slug: text("slug").unique().notNull(),
    name: text("name").notNull(),
    city: text("city").notNull(),
    neighborhood: text("neighborhood").notNull(),
    address: text("address").notNull(),
    latitude: doublePrecision("latitude").notNull(),
    longitude: doublePrecision("longitude").notNull(),
    location: geo("location"),
    type: text("type").notNull(),
    price: integer("price").notNull(),
    tags: text("tags").array().notNull(),
    description: text("description").notNull(),
    siret: text("siret").unique(),
    claimed: boolean("claimed").default(false).notNull(),
    source: text("source").default("DEMO").notNull(),
    sourceId: text("source_id").unique(),
    photo: integer("photo").default(0).notNull(),
    capacity: integer("capacity").default(20).notNull(),
    cancellationHours: integer("cancellation_hours").default(24).notNull(),
  },
  (t) => [
    index("venue_city_type_idx").on(t.city, t.type),
    index("venue_location_idx").using("gist", t.location),
    check("venue_price_range", sql`${t.price} between 1 and 3`),
    check(
      "venue_coords",
      sql`${t.latitude} between -90 and 90 and ${t.longitude} between -180 and 180`,
    ),
  ],
);
export const venueOwners = pgTable(
  "venue_owners",
  {
    id: id(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    venueId: text("venue_id")
      .references(() => venues.id, { onDelete: "cascade" })
      .notNull(),
    status: text("status").default("PENDING").notNull(),
  },
  (t) => [unique().on(t.userId, t.venueId)],
);
export const venueHours = pgTable(
  "venue_hours",
  {
    id: id(),
    venueId: text("venue_id")
      .references(() => venues.id, { onDelete: "cascade" })
      .notNull(),
    day: integer("day").notNull(),
    open: text("open").notNull(),
    close: text("close").notNull(),
  },
  (t) => [
    unique().on(t.venueId, t.day),
    check("hours_day", sql`${t.day} between 0 and 6`),
  ],
);
export const venueExceptions = pgTable(
  "venue_exceptions",
  {
    id: id(),
    venueId: text("venue_id")
      .references(() => venues.id, { onDelete: "cascade" })
      .notNull(),
    date: date("date").notNull(),
    closed: boolean("closed").default(true).notNull(),
    open: text("open"),
    close: text("close"),
  },
  (t) => [unique().on(t.venueId, t.date)],
);
export const menuItems = pgTable(
  "menu_items",
  {
    id: id(),
    venueId: text("venue_id")
      .references(() => venues.id, { onDelete: "cascade" })
      .notNull(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    price: integer("price").notNull(),
    tags: text("tags").array().default([]).notNull(),
  },
  (t) => [check("menu_price", sql`${t.price} >= 0`)],
);
export const photos = pgTable("photos", {
  id: id(),
  venueId: text("venue_id")
    .references(() => venues.id, { onDelete: "cascade" })
    .notNull(),
  key: text("key").notNull(),
  alt: text("alt").notNull(),
});
export const slots = pgTable(
  "slots",
  {
    id: id(),
    venueId: text("venue_id")
      .references(() => venues.id, { onDelete: "cascade" })
      .notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    capacity: integer("capacity").notNull(),
  },
  (t) => [
    unique().on(t.venueId, t.startsAt),
    check("slot_capacity", sql`${t.capacity}>0`),
  ],
);
export const bookings = pgTable(
  "bookings",
  {
    id: id(),
    userId: uuid("user_id")
      .references(() => users.id)
      .notNull(),
    venueId: text("venue_id")
      .references(() => venues.id)
      .notNull(),
    slotId: text("slot_id")
      .references(() => slots.id)
      .notNull(),
    partySize: integer("party_size").notNull(),
    status: bookingStatus("status").default("PENDING").notNull(),
    deposit: integer("deposit").default(0).notNull(),
    createdAt: created(),
  },
  (t) => [check("party_positive", sql`${t.partySize}>0`)],
);
export const reviews = pgTable(
  "reviews",
  {
    id: id(),
    userId: uuid("user_id")
      .references(() => users.id)
      .notNull(),
    venueId: text("venue_id")
      .references(() => venues.id, { onDelete: "cascade" })
      .notNull(),
    visitDate: date("visit_date").notNull(),
    bookingId: text("booking_id")
      .references(() => bookings.id)
      .unique(),
    coffee: integer("coffee").notNull(),
    food: integer("food").notNull(),
    service: integer("service").notNull(),
    ambiance: integer("ambiance").notNull(),
    value: integer("value").notNull(),
    text: text("text").notNull(),
    verified: boolean("verified").default(false).notNull(),
    status: reviewStatus("status").default("PENDING").notNull(),
    contentHash: text("content_hash"),
    abuseReason: text("abuse_reason"),
    createdAt: created(),
  },
  (t) => [
    index("review_moderation_idx").on(t.status, t.createdAt),
    unique().on(t.userId, t.venueId, t.visitDate),
    check(
      "review_ratings",
      sql`${t.coffee} between 1 and 5 and ${t.food} between 1 and 5 and ${t.service} between 1 and 5 and ${t.ambiance} between 1 and 5 and ${t.value} between 1 and 5`,
    ),
  ],
);
export const reviewReplies = pgTable("review_replies", {
  id: id(),
  reviewId: text("review_id")
    .references(() => reviews.id, { onDelete: "cascade" })
    .unique()
    .notNull(),
  authorId: uuid("author_id")
    .references(() => users.id)
    .notNull(),
  text: text("text").notNull(),
  createdAt: created(),
});
export const favorites = pgTable(
  "favorites",
  {
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    venueId: text("venue_id")
      .references(() => venues.id, { onDelete: "cascade" })
      .notNull(),
    listName: text("list_name").default("Mes adresses").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.venueId] })],
);
export const plans = pgTable("plans", {
  id: id(),
  name: text("name").unique().notNull(),
  monthlyPrice: integer("monthly_price").notNull(),
  perCoverFee: integer("per_cover_fee").default(0).notNull(),
  features: text("features").array().notNull(),
  stripePriceId: text("stripe_price_id").unique(),
});
export const subscriptions = pgTable("subscriptions", {
  id: id(),
  venueId: text("venue_id")
    .references(() => venues.id)
    .unique()
    .notNull(),
  planId: text("plan_id")
    .references(() => plans.id)
    .notNull(),
  stripeSubscriptionId: text("stripe_subscription_id").unique(),
  status: text("status").notNull(),
});
export const payments = pgTable("payments", {
  id: id(),
  venueId: text("venue_id")
    .references(() => venues.id)
    .notNull(),
  source: text("source").notNull(),
  amount: integer("amount").notNull(),
  currency: text("currency").default("eur").notNull(),
  stripeId: text("stripe_id").unique(),
  createdAt: created(),
});
export const invoices = pgTable("invoices", {
  id: id(),
  paymentId: text("payment_id")
    .references(() => payments.id)
    .notNull(),
  stripeInvoiceId: text("stripe_invoice_id").unique(),
});
export const reportFlags = pgTable(
  "report_flags",
  {
    id: id(),
    reporterId: uuid("reporter_id")
      .references(() => users.id)
      .notNull(),
    targetId: text("target_id").notNull(),
    reason: text("reason").notNull(),
    status: text("status").default("PENDING").notNull(),
    createdAt: created(),
  },
  (t) => [unique("reporter_review_unique").on(t.reporterId, t.targetId)],
);
export const auditLogs = pgTable("audit_logs", {
  id: id(),
  actorId: uuid("actor_id")
    .references(() => users.id)
    .notNull(),
  action: text("action").notNull(),
  targetId: text("target_id").notNull(),
  metadata: jsonb("metadata"),
  createdAt: created(),
});

export const reviewPhotos = pgTable("review_photos", {
  id: id(),
  reviewId: text("review_id")
    .references(() => reviews.id, { onDelete: "cascade" })
    .notNull(),
  objectKey: text("object_key").unique().notNull(),
  alt: text("alt").notNull(),
});
export const abuseBuckets = pgTable("abuse_buckets", {
  key: text("key").primaryKey(),
  window: timestamp("window", { withTimezone: true }).notNull(),
  count: integer("count").notNull(),
});
