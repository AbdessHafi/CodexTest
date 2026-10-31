import { requireLocalTestDatabase } from "../fixtures/local-db";
import { beforeAll, afterAll, it, expect } from "vitest";
import { db, pool } from "../../src/lib/db";
import {
  users,
  venues,
  reviews,
  reviewPhotos,
  reviewReplies,
  venueOwners,
  slots,
  bookings,
  reportFlags,
  auditLogs,
  abuseBuckets,
} from "../../src/db/schema";
import {
  submitReview,
  moderateReview,
  reportReview,
  replyToReview,
  type Actor,
} from "../../src/lib/reviews/service";
import { publishedReviews } from "../../src/lib/reviews/queries";
import { reviewLimit } from "../../src/lib/reviews/limit";
import { eq, inArray } from "drizzle-orm";
requireLocalTestDatabase();
const author: Actor = { id: crypto.randomUUID(), role: "CONSUMER" },
  reporter: Actor = { id: crypto.randomUUID(), role: "CONSUMER" },
  owner: Actor = { id: crypto.randomUUID(), role: "OWNER" },
  admin: Actor = { id: crypto.randomUUID(), role: "ADMIN" };
const venueId = crypto.randomUUID(),
  slotId = crypto.randomUUID(),
  bookingId = crypto.randomUUID();
let id = "";
const input = {
  venueId,
  visitDate: "2026-01-01",
  coffee: 5,
  food: 4,
  service: 4,
  ambiance: 4,
  value: 3,
  text: "Une visite pour tester la modération transactionnelle.",
  captchaToken: "",
};
beforeAll(async () => {
  process.env.DEMO_MODE = "false";
  await db.insert(users).values([author, reporter, owner, admin]);
  await db.insert(venues).values({
    id: venueId,
    slug: `test-${venueId}`,
    name: "Test integration",
    city: "Paris",
    neighborhood: "Paris 11e",
    address: "Test",
    latitude: 48.85,
    longitude: 2.35,
    type: "Brunch",
    price: 2,
    tags: [],
    description: "Fixture automatisée",
    source: "TEST",
  });
  await db
    .insert(venueOwners)
    .values({ userId: owner.id, venueId, status: "APPROVED" });
  await db.insert(slots).values({
    id: slotId,
    venueId,
    startsAt: new Date("2026-01-01T11:00:00Z"),
    capacity: 10,
  });
  await db.insert(bookings).values({
    id: bookingId,
    userId: author.id,
    venueId,
    slotId,
    partySize: 2,
    status: "COMPLETED",
  });
});
afterAll(async () => {
  await db
    .delete(auditLogs)
    .where(inArray(auditLogs.actorId, [admin.id, author.id]));
  await db.delete(reportFlags).where(eq(reportFlags.reporterId, reporter.id));
  await db.delete(reviews).where(eq(reviews.venueId, venueId));
  await db.delete(bookings).where(eq(bookings.venueId, venueId));
  await db.delete(venues).where(eq(venues.id, venueId));
  for (const u of [author, reporter, owner, admin])
    for (const action of ["review", "reply", "report", "moderate"])
      await db
        .delete(abuseBuckets)
        .where(eq(abuseBuckets.key, `${action}:${u.id}`));
  await db
    .delete(users)
    .where(inArray(users.id, [author.id, reporter.id, owner.id, admin.id]));
  await pool.end();
});
it("crée en attente, stocke les photos privées et masque la note", async () => {
  const r = await submitReview(author, input, ["reviews/test.jpg"]);
  id = r.id;
  expect(r.status).toBe("PENDING");
  expect(r.verified).toBe(false);
  expect((await publishedReviews(venueId)).summary.count).toBe(0);
  expect(
    await db.select().from(reviewPhotos).where(eq(reviewPhotos.reviewId, id)),
  ).toHaveLength(1);
});
it("résiste à la course de création pour une même visite", async () => {
  const result = await Promise.allSettled([
    submitReview(author, input),
    submitReview(author, input),
  ]);
  expect(
    result.every((r) => r.status === "rejected" && r.reason.status === 409),
  ).toBe(true);
});
it("refuse publication et réponse par un consommateur sans audit parasite", async () => {
  await expect(
    moderateReview(author, id, "PUBLISH", "Tentative non autorisée"),
  ).rejects.toMatchObject({ status: 403 });
  await expect(
    replyToReview(author, id, "Réponse non autorisée"),
  ).rejects.toMatchObject({ status: 404 });
  expect(
    await db.select().from(auditLogs).where(eq(auditLogs.targetId, id)),
  ).toHaveLength(0);
});
it("publie sans éditer le texte, journalise et agrège seulement les avis publiés", async () => {
  await moderateReview(
    admin,
    id,
    "PUBLISH",
    "Visite conforme à notre politique.",
  );
  const result = await publishedReviews(venueId);
  expect(result.summary.count).toBe(1);
  expect(result.summary.average).toBe(4);
  expect(result.items[0].text).toBe(input.text);
  expect(
    await db.select().from(auditLogs).where(eq(auditLogs.targetId, id)),
  ).toHaveLength(1);
});
it("autorise une seule réponse du propriétaire lié et refuse un tiers", async () => {
  await expect(
    replyToReview({ ...reporter, role: "OWNER" }, id, "Une réponse usurpée"),
  ).rejects.toMatchObject({ status: 403 });
  await replyToReview(owner, id, "Merci pour cette visite !");
  await expect(
    replyToReview(owner, id, "Une seconde réponse"),
  ).rejects.toMatchObject({ status: 409 });
  expect(
    await db.select().from(reviewReplies).where(eq(reviewReplies.reviewId, id)),
  ).toHaveLength(1);
});
it("signale une seule fois, retire après décision et conserve les audits", async () => {
  await reportReview(reporter, id, "Cette photographie présente un problème.");
  await expect(
    reportReview(reporter, id, "Un second signalement"),
  ).rejects.toMatchObject({ status: 409 });
  await moderateReview(
    admin,
    id,
    "REJECT",
    "Photo contenant des informations personnelles.",
  );
  expect((await publishedReviews(venueId)).summary.count).toBe(0);
  expect(
    await db.select().from(auditLogs).where(eq(auditLogs.targetId, id)),
  ).toHaveLength(2);
  const [report] = await db
    .select()
    .from(reportFlags)
    .where(eq(reportFlags.targetId, id));
  expect(report.status).toBe("RESOLVED");
});
it("vérifie uniquement une réservation terminée de la bonne personne et date", async () => {
  await expect(
    submitReview(reporter, { ...input, bookingId }),
  ).rejects.toMatchObject({ status: 400 });
  await expect(
    submitReview(author, { ...input, visitDate: "2026-01-02", bookingId }),
  ).rejects.toMatchObject({ status: 400 });
  await db.delete(reviews).where(eq(reviews.id, id));
  const r = await submitReview(author, { ...input, bookingId });
  expect(r.verified).toBe(true);
});
it("signale les copies et applique une limite atomique partagée", async () => {
  const duplicate = await submitReview(reporter, { ...input });
  expect(duplicate.abuseReason).toContain("Texte identique");
  const results = await Promise.allSettled(
    Array.from({ length: 7 }, () => reviewLimit(author.id, "review")),
  );
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(5);
  expect(results.filter((r) => r.status === "rejected")).toHaveLength(2);
});
