import { cache } from "react";
import { and, eq, desc, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { reviews, reviewReplies, reviewPhotos } from "@/db/schema";
import { isDemo } from "@/lib/venues";
import { summarize } from "./policy";
export const publishedReviews = cache(async function publishedReviews(
  venueId: string,
) {
  if (isDemo()) return { items: [], summary: summarize([]) };
  const filter = and(
    eq(reviews.venueId, venueId),
    eq(reviews.status, "PUBLISHED"),
  );
  const [stats] = await db
    .select({
      count: sql<number>`count(*)::int`,
      coffee: sql<number>`coalesce(avg(coffee),0)::float`,
      food: sql<number>`coalesce(avg(food),0)::float`,
      service: sql<number>`coalesce(avg(service),0)::float`,
      ambiance: sql<number>`coalesce(avg(ambiance),0)::float`,
      value: sql<number>`coalesce(avg(value),0)::float`,
    })
    .from(reviews)
    .where(filter);
  const summary = {
    count: stats.count,
    average:
      (stats.coffee +
        stats.food +
        stats.service +
        stats.ambiance +
        stats.value) /
      5,
    criteria: {
      coffee: stats.coffee,
      food: stats.food,
      service: stats.service,
      ambiance: stats.ambiance,
      value: stats.value,
    },
  };
  const items = await db
    .select()
    .from(reviews)
    .where(filter)
    .orderBy(desc(reviews.createdAt), desc(reviews.id))
    .limit(50);
  const ids = items.map((r) => r.id);
  const photos = ids.length
    ? await db
        .select({
          id: reviewPhotos.id,
          reviewId: reviewPhotos.reviewId,
          alt: reviewPhotos.alt,
        })
        .from(reviewPhotos)
        .where(inArray(reviewPhotos.reviewId, ids))
    : [];
  const replies = ids.length
    ? await db
        .select()
        .from(reviewReplies)
        .where(inArray(reviewReplies.reviewId, ids))
    : [];
  return {
    items: items.map((r) => ({
      id: r.id,
      visitDate: r.visitDate,
      createdAt: r.createdAt.toISOString(),
      text: r.text,
      verified: r.verified,
      coffee: r.coffee,
      food: r.food,
      service: r.service,
      ambiance: r.ambiance,
      value: r.value,
      photos: photos.filter((p) => p.reviewId === r.id),
      reply: replies.find((reply) => reply.reviewId === r.id)?.text,
    })),
    summary,
  };
});
