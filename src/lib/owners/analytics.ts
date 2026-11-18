import { db } from "@/lib/db";
import { venueAnalytics, venues, favorites, reviews } from "@/db/schema";
import { sql, eq, and, gte } from "drizzle-orm";
import { parisDate } from "@/lib/reviews/policy";
import { ownedVenue } from "./service";
import type { Actor } from "@/lib/reviews/service";
export async function recordActivity(
  venueId: string,
  kind: "views" | "phone" | "website" | "directions" | "favorites",
) {
  // Shared ceiling per venue/window, no identifiers, IP addresses, user agents or cookies.
  const window = new Date(
    Math.floor(Date.now() / 900000) * 900000,
  ).toISOString();
  const allowed = await db.execute(
    sql`INSERT INTO abuse_buckets(key,"window",count) VALUES (${`traffic:${venueId}`},${window},1) ON CONFLICT(key) DO UPDATE SET "window"=EXCLUDED."window",count=CASE WHEN abuse_buckets."window"=EXCLUDED."window" THEN abuse_buckets.count+1 ELSE 1 END WHERE abuse_buckets."window"<>EXCLUDED."window" OR abuse_buckets.count<3000 RETURNING count`,
  );
  if (!allowed.rows.length) return;
  await db
    .insert(venueAnalytics)
    .values({ venueId, day: parisDate(), [kind]: 1 })
    .onConflictDoUpdate({
      target: [venueAnalytics.venueId, venueAnalytics.day],
      set: { [kind]: sql`${venueAnalytics[kind]}+1` },
    });
}
export async function toggleFavorite(user: Actor, venueId: string) {
  return db.transaction(async (tx) => {
    const [v] = await tx
      .select({ id: venues.id })
      .from(venues)
      .where(eq(venues.id, venueId))
      .for("update");
    if (!v) return null;
    const removed = await tx
      .delete(favorites)
      .where(and(eq(favorites.venueId, venueId), eq(favorites.userId, user.id)))
      .returning();
    if (removed.length) return false;
    await tx.insert(favorites).values({ userId: user.id, venueId });
    return true;
  });
}
export async function ownerAnalytics(user: Actor, venueId: string) {
  return db.transaction(async (tx) => {
    await ownedVenue(tx, user, venueId);
    const from = parisDate(new Date(Date.now() - 29 * 86400000));
    const daily = await tx
      .select()
      .from(venueAnalytics)
      .where(
        and(eq(venueAnalytics.venueId, venueId), gte(venueAnalytics.day, from)),
      )
      .orderBy(venueAnalytics.day);
    const trend = await tx
      .select({
        day: sql<string>`(${reviews.createdAt} AT TIME ZONE 'Europe/Paris')::date::text`,
        count: sql<number>`count(*)::int`,
        rating: sql<number>`avg((${reviews.coffee}+${reviews.food}+${reviews.service}+${reviews.ambiance}+${reviews.value})/5.0)::float`,
      })
      .from(reviews)
      .where(
        and(
          eq(reviews.venueId, venueId),
          eq(reviews.status, "PUBLISHED"),
          gte(reviews.createdAt, new Date(`${from}T00:00:00Z`)),
        ),
      )
      .groupBy(sql`(${reviews.createdAt} AT TIME ZONE 'Europe/Paris')::date`);
    const [{ count }] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(favorites)
      .where(eq(favorites.venueId, venueId));
    return { daily, trend, favorites: count, today: parisDate() };
  });
}
