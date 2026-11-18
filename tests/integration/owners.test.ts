import { beforeAll, afterAll, it, expect } from "vitest";
import { db, pool } from "../../src/lib/db";
import {
  users,
  venues,
  venueClaims,
  venueOwners,
  menuItems,
  photos,
  auditLogs,
  mailOutbox,
  venueAnalytics,
} from "../../src/db/schema";
import {
  submitClaim,
  verifyClaimCode,
  decideClaim,
  ownerEdit,
  ownerDashboard,
  addVenuePhoto,
} from "../../src/lib/owners/service";
import { ownerAnalytics, recordActivity } from "../../src/lib/owners/analytics";
import { codeHash } from "../../src/lib/owners/code";
import { eq, inArray } from "drizzle-orm";
import { requireLocalTestDatabase } from "../fixtures/local-db";
import type { Actor } from "../../src/lib/reviews/service";
requireLocalTestDatabase();
const claimant: Actor = { id: crypto.randomUUID(), role: "CONSUMER" },
  other: Actor = { id: crypto.randomUUID(), role: "OWNER" },
  admin: Actor = { id: crypto.randomUUID(), role: "ADMIN" };
const a = crypto.randomUUID(),
  b = crypto.randomUUID();
let claimId = "";
let menuId = "";
const input = {
  venueId: a,
  siret: "73282932000074",
  businessEmail: `${claimant.id}@example.invalid`,
  phone: "0102030405",
  applicantRole: "owner" as const,
  statement: "Je représente cette entreprise de démonstration.",
  captchaToken: "",
};
beforeAll(async () => {
  process.env.MAIL_TRANSPORT = "local";
  await db.insert(users).values([claimant, other, admin]);
  await db.insert(venues).values(
    [a, b].map((id) => ({
      id,
      slug: `test-owner-${id}`,
      name: "Fixture propriétaire",
      city: "Paris",
      neighborhood: "Paris 11e",
      address: "Adresse de test",
      latitude: 48.85,
      longitude: 2.35,
      type: "Brunch",
      price: 2,
      tags: [],
      description: "Test des droits du propriétaire.",
      source: "TEST",
    })),
  );
});
afterAll(async () => {
  await db
    .delete(auditLogs)
    .where(inArray(auditLogs.actorId, [claimant.id, other.id, admin.id]));
  await db
    .delete(mailOutbox)
    .where(eq(mailOutbox.recipient, input.businessEmail));
  await db.delete(venues).where(inArray(venues.id, [a, b]));
  await db
    .delete(users)
    .where(inArray(users.id, [claimant.id, other.id, admin.id]));
  await pool.query("DELETE FROM abuse_buckets WHERE key=ANY($1::text[])", [
    [`traffic:${a}`, `traffic:${b}`],
  ]);
  await pool.end();
});
it("une seule revendication active par lieu, justificatif facultatif", async () => {
  const result = await Promise.allSettled([
    submitClaim(claimant, input),
    submitClaim({ ...other, role: "CONSUMER" }, input),
  ]);
  expect(result.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  const [claim] = await db
    .select()
    .from(venueClaims)
    .where(eq(venueClaims.venueId, a));
  claimId = claim.id;
  expect(claim.documentKey).toBeNull();
  expect(claim.codeHash).toHaveLength(64);
  expect(claim.emailVerifiedAt).toBeNull();
  if (claim.userId !== claimant.id)
    await db
      .update(venueClaims)
      .set({ userId: claimant.id })
      .where(eq(venueClaims.id, claim.id));
});
it("ne peut valider avant vérification e-mail ou depuis un compte tiers", async () => {
  await expect(
    decideClaim(admin, claimId, {
      action: "APPROVE",
      reason: "Registre contrôlé avec attention.",
      registryChecked: true,
      authorityChecked: true,
    }),
  ).rejects.toMatchObject({ status: 409 });
  await expect(verifyClaimCode(other, claimId, "000000")).rejects.toMatchObject(
    { status: 404 },
  );
});
it("les mauvais essais sont persistés ; un bon code vérifie sans donner de rôle", async () => {
  await db
    .update(venueClaims)
    .set({
      codeHash: codeHash(claimId, "123456"),
      codeExpires: new Date(Date.now() + 900000),
    })
    .where(eq(venueClaims.id, claimId));
  await expect(
    verifyClaimCode(claimant, claimId, "000000"),
  ).rejects.toMatchObject({ status: 400 });
  const [before] = await db
    .select()
    .from(venueClaims)
    .where(eq(venueClaims.id, claimId));
  expect(before.codeAttempts).toBe(1);
  await verifyClaimCode(claimant, claimId, "123456");
  const [user] = await db.select().from(users).where(eq(users.id, claimant.id));
  expect(user.role).toBe("CONSUMER");
});
it("approbation atomique, journal et notification en outbox", async () => {
  await decideClaim(admin, claimId, {
    action: "APPROVE",
    reason: "Entreprise et habilitation confirmées.",
    registryChecked: true,
    authorityChecked: true,
  });
  const [user] = await db.select().from(users).where(eq(users.id, claimant.id));
  expect(user.role).toBe("OWNER");
  expect(
    await db.select().from(venueOwners).where(eq(venueOwners.venueId, a)),
  ).toHaveLength(1);
  expect(
    await db
      .select()
      .from(mailOutbox)
      .where(eq(mailOutbox.recipient, input.businessEmail)),
  ).toHaveLength(1);
  await expect(
    decideClaim(admin, claimId, {
      action: "REJECT",
      reason: "Tentative de double décision.",
    }),
  ).rejects.toMatchObject({ status: 409 });
});
it("contrôle la propriété en lecture et écriture, y compris IDs produits étrangers", async () => {
  await expect(ownerDashboard(other, a)).rejects.toMatchObject({ status: 403 });
  await expect(
    ownerEdit({ ...claimant, role: "OWNER" }, b, {
      action: "menu-create",
      data: {
        name: "Produit interdit",
        description: "",
        price: 100,
        tags: [],
        specialDate: null,
        category: "Menu",
        allergens: [],
        available: true,
        specialEndDate: null,
        featuredStart: null,
        featuredEnd: null,
      },
    }),
  ).rejects.toMatchObject({ status: 403 });
});
it("gère produits, ordre, couverture, miniature et fermeture exceptionnelle", async () => {
  const user = { ...claimant, role: "OWNER" as const };
  const menu = {
    name: "Tartine locale",
    description: "Test",
    price: 1290,
    tags: ["vegan"],
    allergens: ["gluten"],
    available: true,
    category: "Brunch",
    specialDate: null,
    specialEndDate: null,
    featuredStart: null,
    featuredEnd: null,
  };
  await ownerEdit(user, a, { action: "menu-create", data: menu });
  const [item] = await db
    .select()
    .from(menuItems)
    .where(eq(menuItems.venueId, a));
  menuId = item.id;
  await expect(
    ownerEdit(user, a, { action: "menu-order", ids: [crypto.randomUUID()] }),
  ).rejects.toMatchObject({ status: 400 });
  await ownerEdit(user, a, {
    action: "schedule",
    data: {
      hours: [{ day: 1, open: "09:00", close: "17:00" }],
      exceptions: [{ date: "2026-12-25", closed: true }],
    },
  });
  await addVenuePhoto(
    user,
    a,
    "venues/test.jpg",
    "Une photo test",
    undefined,
    "venues/test-thumb.jpg",
  );
  const [photo] = await db.select().from(photos).where(eq(photos.venueId, a));
  await ownerEdit(user, a, { action: "photo-cover", photoId: photo.id });
  const dashboard = await ownerDashboard(user, a);
  expect(dashboard.images[0].cover).toBe(true);
  expect(dashboard.exceptions).toHaveLength(1);
});
it("agrège les statistiques sans données personnelles et supprime les produits", async () => {
  await recordActivity(a, "views");
  await recordActivity(a, "website");
  const stats = await ownerAnalytics({ ...claimant, role: "OWNER" }, a);
  expect(stats.daily[0].views).toBe(1);
  expect(stats.daily[0].website).toBe(1);
  expect(Object.keys(stats.daily[0])).not.toContain("ip");
  await expect(ownerAnalytics(other, a)).rejects.toMatchObject({ status: 403 });
  await ownerEdit({ ...claimant, role: "OWNER" }, a, {
    action: "menu-delete",
    itemId: menuId,
  });
  expect(
    await db.select().from(menuItems).where(eq(menuItems.venueId, a)),
  ).toHaveLength(0);
  expect(
    await db.select().from(venueAnalytics).where(eq(venueAnalytics.venueId, a)),
  ).toHaveLength(1);
});
it("cinq mauvais codes ferment définitivement la demande et libèrent le lieu", async () => {
  const result = await submitClaim(claimant, { ...input, venueId: b });
  const id = result!.id;
  await db
    .update(venueClaims)
    .set({ codeHash: codeHash(id, "123456") })
    .where(eq(venueClaims.id, id));
  for (let i = 0; i < 5; i++)
    await expect(verifyClaimCode(claimant, id, "999999")).rejects.toMatchObject(
      { status: 400 },
    );
  const [claim] = await db
    .select()
    .from(venueClaims)
    .where(eq(venueClaims.id, id));
  expect(claim.status).toBe("REJECTED");
  await expect(verifyClaimCode(claimant, id, "123456")).rejects.toMatchObject({
    status: 409,
  });
});
it("un propriétaire peut faire approuver et gérer un second établissement", async () => {
  const c = crypto.randomUUID();
  try {
    await db
      .insert(venues)
      .values({
        id: c,
        slug: `test-second-${c}`,
        name: "Second lieu",
        city: "Paris",
        neighborhood: "Paris 11e",
        address: "Adresse de test",
        latitude: 48.85,
        longitude: 2.35,
        type: "Brunch",
        price: 2,
        tags: [],
        description: "Deuxième lieu de test.",
        source: "TEST",
      });
    const claim = await submitClaim(
      { ...claimant, role: "OWNER" },
      { ...input, venueId: c, siret: "55210055400013" },
    );
    await db
      .update(venueClaims)
      .set({ codeHash: codeHash(claim!.id, "123456") })
      .where(eq(venueClaims.id, claim!.id));
    await verifyClaimCode(claimant, claim!.id, "123456");
    await decideClaim(admin, claim!.id, {
      action: "APPROVE",
      reason: "Second établissement et habilitation confirmés.",
      registryChecked: true,
      authorityChecked: true,
    });
    expect(
      (await ownerDashboard({ ...claimant, role: "OWNER" }, a)).venue.id,
    ).toBe(a);
    expect(
      (await ownerDashboard({ ...claimant, role: "OWNER" }, c)).venue.id,
    ).toBe(c);
  } finally {
    await db.delete(venues).where(eq(venues.id, c));
  }
});
