import { and, eq, desc, sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import {
  reviews,
  reviewPhotos,
  reviewReplies,
  reportFlags,
  auditLogs,
  venues,
  bookings,
  slots,
  venueOwners,
} from "@/db/schema";
import {
  type ReviewInput,
  contentFingerprint,
  canReply,
  parisDate,
} from "./policy";
import { ReviewError } from "./http";
export type Actor = { id: string; role: "CONSUMER" | "OWNER" | "ADMIN" };
export async function submitReview(
  user: Actor,
  data: ReviewInput,
  objectKeys: string[] = [],
) {
  const { captchaToken: _captchaToken, ...values } = data;
  void _captchaToken;
  const hash = createHash("sha256")
    .update(contentFingerprint(data.text))
    .digest("hex");
  try {
    return await db.transaction(async (tx) => {
      const [venue] = await tx
        .select()
        .from(venues)
        .where(eq(venues.id, data.venueId));
      if (!venue) throw new ReviewError(404, "Établissement introuvable.");
      let verified = false;
      if (data.bookingId) {
        const [booking] = await tx
          .select({
            userId: bookings.userId,
            venueId: bookings.venueId,
            status: bookings.status,
            startsAt: slots.startsAt,
          })
          .from(bookings)
          .innerJoin(slots, eq(slots.id, bookings.slotId))
          .where(eq(bookings.id, data.bookingId));
        if (
          !booking ||
          booking.userId !== user.id ||
          booking.venueId !== data.venueId ||
          booking.status !== "COMPLETED" ||
          booking.startsAt > new Date() ||
          parisDate(booking.startsAt) !== data.visitDate
        )
          throw new ReviewError(
            400,
            "La réservation ne correspond pas à une visite terminée à cette date.",
          );
        verified = true;
      }
      const [duplicate] = await tx
        .select({ id: reviews.id })
        .from(reviews)
        .where(eq(reviews.contentHash, hash))
        .limit(1);
      const [review] = await tx
        .insert(reviews)
        .values({
          ...values,
          userId: user.id,
          verified,
          status: "PENDING",
          contentHash: hash,
          abuseReason: duplicate
            ? "Texte identique à un avis existant : vérifier l’authenticité."
            : null,
        })
        .returning();
      if (objectKeys.length)
        await tx
          .insert(reviewPhotos)
          .values(
            objectKeys.map((objectKey, i) => ({
              reviewId: review.id,
              objectKey,
              alt: `Photo de la visite ${i + 1}`,
            })),
          );
      return review;
    });
  } catch (error) {
    const cause = error as { code?: string; cause?: { code?: string } };
    if (cause.code === "23505" || cause.cause?.code === "23505")
      throw new ReviewError(
        409,
        "Un avis existe déjà pour cette visite ou cette réservation.",
      );
    throw error;
  }
}
export async function reportReview(user: Actor, id: string, reason: string) {
  return db.transaction(async (tx) => {
    // Lock the same review as moderation, so a newly filed report cannot be silently resolved by an older decision.
    const [review] = await tx
      .select()
      .from(reviews)
      .where(eq(reviews.id, id))
      .for("update");
    if (!review || review.status !== "PUBLISHED")
      throw new ReviewError(404, "Avis introuvable.");
    if (review.userId === user.id)
      throw new ReviewError(
        400,
        "Vous ne pouvez pas signaler votre propre avis.",
      );
    const rows = await tx
      .insert(reportFlags)
      .values({ reporterId: user.id, targetId: id, reason })
      .onConflictDoNothing()
      .returning();
    if (!rows.length)
      throw new ReviewError(409, "Vous avez déjà signalé cet avis.");
  });
}
export async function replyToReview(user: Actor, id: string, text: string) {
  return db.transaction(async (tx) => {
    const [review] = await tx
      .select()
      .from(reviews)
      .where(eq(reviews.id, id))
      .for("update");
    if (!review || review.status !== "PUBLISHED")
      throw new ReviewError(404, "Avis introuvable.");
    const [owner] = await tx
      .select()
      .from(venueOwners)
      .where(
        and(
          eq(venueOwners.userId, user.id),
          eq(venueOwners.venueId, review.venueId),
        ),
      )
      .for("share");
    if (!canReply(user, owner))
      throw new ReviewError(
        403,
        "Seul le propriétaire validé de ce lieu peut répondre.",
      );
    const inserted = await tx
      .insert(reviewReplies)
      .values({ reviewId: id, authorId: user.id, text })
      .onConflictDoNothing()
      .returning();
    if (!inserted.length)
      throw new ReviewError(409, "Une réponse existe déjà.");
  });
}
export async function moderateReview(
  user: Actor,
  id: string,
  action: "PUBLISH" | "REJECT" | "DISMISS_REPORTS",
  reason: string,
) {
  if (user.role !== "ADMIN")
    throw new ReviewError(403, "Accès administrateur requis.");
  return db.transaction(async (tx) => {
    const [review] = await tx
      .select()
      .from(reviews)
      .where(eq(reviews.id, id))
      .for("update");
    if (!review) throw new ReviewError(404, "Avis introuvable.");
    const flags = await tx
      .select()
      .from(reportFlags)
      .where(
        and(eq(reportFlags.targetId, id), eq(reportFlags.status, "PENDING")),
      );
    if (action === "DISMISS_REPORTS" && !flags.length)
      throw new ReviewError(409, "Aucun signalement en attente.");
    if (action === "PUBLISH" && review.status === "PUBLISHED" && !flags.length)
      throw new ReviewError(409, "Cet avis est déjà publié.");
    if (action === "REJECT" && review.status === "REJECTED")
      throw new ReviewError(409, "Cet avis est déjà rejeté.");
    const next =
      action === "DISMISS_REPORTS"
        ? review.status
        : action === "PUBLISH"
          ? "PUBLISHED"
          : "REJECTED";
    await tx.update(reviews).set({ status: next }).where(eq(reviews.id, id));
    await tx
      .update(reportFlags)
      .set({ status: "RESOLVED" })
      .where(
        and(eq(reportFlags.targetId, id), eq(reportFlags.status, "PENDING")),
      );
    await tx
      .insert(auditLogs)
      .values({
        actorId: user.id,
        action: `REVIEW_${action}`,
        targetId: id,
        metadata: {
          reason,
          before: review.status,
          after: next,
          reportIds: flags.map((f) => f.id),
        },
      });
  });
}
export async function moderationQueue() {
  return db
    .select({
      review: reviews,
      venueName: venues.name,
      flags: sql<number>`(SELECT count(*)::int FROM report_flags WHERE target_id=${reviews.id} AND status='PENDING')`,
    })
    .from(reviews)
    .innerJoin(venues, eq(venues.id, reviews.venueId))
    .where(
      sql`${reviews.status}='PENDING' OR EXISTS (SELECT 1 FROM report_flags WHERE target_id=${reviews.id} AND status='PENDING')`,
    )
    .orderBy(desc(reviews.createdAt))
    .limit(100);
}
