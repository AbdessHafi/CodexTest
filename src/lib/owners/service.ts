import { and, eq, sql, desc, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  venues,
  venueOwners,
  venueClaims,
  users,
  auditLogs,
  menuItems,
  photos,
  venueHours,
  venueExceptions,
  mailOutbox,
} from "@/db/schema";
import { ReviewError } from "@/lib/reviews/http";
import type { Actor } from "@/lib/reviews/service";
import { claimInput, claimDecision, ownerCommand } from "./policy";
import { newCode, codeHash, codeMatches, codeUsable } from "./code";
import { sendMail } from "./mail";
import type { z } from "zod";
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
export async function ownedVenue(tx: Tx, user: Actor, venueId: string) {
  const [venue] = await tx
    .select()
    .from(venues)
    .where(eq(venues.id, venueId))
    .for("update");
  if (!venue) throw new ReviewError(404, "Établissement introuvable.");
  const [membership] = await tx
    .select({ id: venueOwners.id })
    .from(venueOwners)
    .innerJoin(users, eq(users.id, venueOwners.userId))
    .where(
      and(
        eq(venueOwners.userId, user.id),
        eq(venueOwners.venueId, venueId),
        eq(venueOwners.status, "APPROVED"),
        eq(users.role, "OWNER"),
      ),
    )
    .for("share");
  if (!membership)
    throw new ReviewError(
      403,
      "Accès réservé au propriétaire validé de cet établissement.",
    );
  return venue;
}
function conflict(error: unknown) {
  const e = error as { code?: string; cause?: { code?: string } };
  if ((e.code || e.cause?.code) === "23505")
    throw new ReviewError(
      409,
      "Une demande, un propriétaire ou ce SIRET existe déjà.",
    );
  throw error;
}
export async function submitClaim(
  user: Actor,
  data: z.infer<typeof claimInput>,
  documentKey: string | null = null,
  documentType: string | null = null,
) {
  const parsed = claimInput.parse(data);
  const id = crypto.randomUUID(),
    code = newCode();
  const hash = codeHash(id, code);
  try {
    await db.transaction(async (tx) => {
      const [venue] = await tx
        .select()
        .from(venues)
        .where(eq(venues.id, parsed.venueId))
        .for("update");
      if (!venue) throw new ReviewError(404, "Établissement introuvable.");
      const [owner] = await tx
        .select()
        .from(venueOwners)
        .where(
          and(
            eq(venueOwners.venueId, venue.id),
            eq(venueOwners.status, "APPROVED"),
          ),
        );
      if (venue.claimed || owner)
        throw new ReviewError(409, "Cette fiche est déjà revendiquée.");
      if (venue.siret && venue.siret !== parsed.siret)
        throw new ReviewError(409, "Le SIRET ne correspond pas à cette fiche.");
      const expired = await tx
        .update(venueClaims)
        .set({
          status: "REJECTED",
          reason: "Vérification e-mail expirée.",
          codeHash: null,
        })
        .where(
          sql`${venueClaims.venueId}=${venue.id} AND ${venueClaims.status}='PENDING' AND ${venueClaims.emailVerifiedAt} IS NULL AND ${venueClaims.codeExpires}<now()`,
        )
        .returning();
      for (const previous of expired) {
        await tx
          .insert(auditLogs)
          .values({
            actorId: user.id,
            action: "CLAIM_EXPIRED",
            targetId: previous.id,
            metadata: { reason: "Vérification e-mail expirée." },
          });
        await tx
          .insert(mailOutbox)
          .values({
            recipient: previous.businessEmail,
            subject: "Demande Pause Café expirée",
            text: "Votre demande a expiré sans vérification e-mail. Vous pouvez en déposer une nouvelle.",
          });
      }

      await tx.insert(venueClaims).values({
        id,
        venueId: venue.id,
        userId: user.id,
        siret: parsed.siret,
        statement: parsed.statement,
        businessEmail: parsed.businessEmail.toLowerCase(),
        phone: parsed.phone,
        applicantRole: parsed.applicantRole,
        documentKey,
        documentType,
        codeHash: hash,
        codeExpires: new Date(Date.now() + 900000),
      });
      await tx
        .insert(auditLogs)
        .values({ actorId: user.id, action: "CLAIM_SUBMIT", targetId: id });
    });
  } catch (e) {
    conflict(e);
  }
  const delivered = await sendMail(
    parsed.businessEmail,
    "Votre code de vérification Pause Café",
    `Votre code : ${code}. Valable 15 minutes. Ne le partagez pas.`,
  );
  return { id, delivered };
}
export async function verifyClaimCode(user: Actor, id: string, code: string) {
  const result = await db.transaction(async (tx) => {
    const [claim] = await tx
      .select()
      .from(venueClaims)
      .where(eq(venueClaims.id, id))
      .for("update");
    if (!claim || claim.userId !== user.id)
      throw new ReviewError(404, "Demande introuvable.");
    if (claim.status !== "PENDING")
      throw new ReviewError(409, "Demande déjà traitée.");
    if (claim.emailVerifiedAt) return true;
    if (!codeUsable(claim.codeExpires, claim.codeAttempts) || !claim.codeHash)
      return false;
    const valid = codeMatches(id, code, claim.codeHash);
    const attempts = claim.codeAttempts + 1;
    await tx
      .update(venueClaims)
      .set(
        valid
          ? { emailVerifiedAt: new Date(), codeHash: null }
          : {
              codeAttempts: attempts,
              ...(attempts >= 5
                ? {
                    status: "REJECTED",
                    reason: "Nombre maximal de tentatives atteint.",
                    codeHash: null,
                  }
                : {}),
            },
      )
      .where(eq(venueClaims.id, id));
    if (!valid && attempts >= 5) {
      await tx
        .insert(auditLogs)
        .values({
          actorId: user.id,
          action: "CLAIM_CODE_LOCKED",
          targetId: id,
        });
      await tx
        .insert(mailOutbox)
        .values({
          recipient: claim.businessEmail,
          subject: "Demande Pause Café rejetée",
          text: "Votre demande a été rejetée après cinq codes incorrects. Vous pouvez déposer une nouvelle demande.",
        });
    }
    if (valid)
      await tx.insert(auditLogs).values({
        actorId: user.id,
        action: "CLAIM_EMAIL_VERIFIED",
        targetId: id,
      });
    return valid;
  });
  if (!result)
    throw new ReviewError(
      400,
      "Code invalide, expiré ou nombre de tentatives atteint.",
    );
}
export async function resendClaimCode(user: Actor, id: string) {
  const code = newCode();
  const hash = codeHash(id, code);
  const email = await db.transaction(async (tx) => {
    const [claim] = await tx
      .select()
      .from(venueClaims)
      .where(eq(venueClaims.id, id))
      .for("update");
    if (!claim || claim.userId !== user.id)
      throw new ReviewError(404, "Demande introuvable.");
    if (
      claim.status !== "PENDING" ||
      claim.emailVerifiedAt ||
      claim.codeAttempts >= 5
    )
      throw new ReviewError(409, "Cette demande ne permet plus de renvoi.");
    await tx
      .update(venueClaims)
      .set({ codeHash: hash, codeExpires: new Date(Date.now() + 900000) })
      .where(eq(venueClaims.id, id));
    return claim.businessEmail;
  });
  return sendMail(
    email,
    "Nouveau code Pause Café",
    `Votre code : ${code}. Valable 15 minutes. Ne le partagez pas.`,
  );
}
export async function decideClaim(
  user: Actor,
  id: string,
  data: z.infer<typeof claimDecision>,
) {
  if (user.role !== "ADMIN")
    throw new ReviewError(403, "Accès administrateur requis.");
  const input = claimDecision.parse(data);
  try {
    return await db.transaction(async (tx) => {
      const [reference] = await tx
        .select()
        .from(venueClaims)
        .where(eq(venueClaims.id, id));
      if (!reference) throw new ReviewError(404, "Demande introuvable.");
      const [venue] = await tx
        .select()
        .from(venues)
        .where(eq(venues.id, reference.venueId))
        .for("update");
      const [claim] = await tx
        .select()
        .from(venueClaims)
        .where(eq(venueClaims.id, id))
        .for("update");
      if (claim.status !== "PENDING")
        throw new ReviewError(409, "Cette demande a déjà été traitée.");
      if (claim.userId === user.id)
        throw new ReviewError(
          403,
          "Un autre administrateur doit examiner votre propre demande.",
        );
      if (input.action === "APPROVE") {
        if (!claim.emailVerifiedAt)
          throw new ReviewError(
            409,
            "Vérifiez d’abord l’e-mail professionnel.",
          );
        const [owner] = await tx
          .select()
          .from(venueOwners)
          .where(
            and(
              eq(venueOwners.venueId, venue.id),
              eq(venueOwners.status, "APPROVED"),
            ),
          );
        if (venue.claimed || owner)
          throw new ReviewError(409, "Un propriétaire a déjà été validé.");
        if (venue.siret && venue.siret !== claim.siret)
          throw new ReviewError(409, "Le SIRET de la fiche a changé.");
        const [applicant] = await tx
          .select()
          .from(users)
          .where(eq(users.id, claim.userId))
          .for("update");
        if (applicant.role === "ADMIN")
          throw new ReviewError(
            409,
            "Un compte administrateur ne peut pas devenir propriétaire depuis ce parcours.",
          );
        await tx
          .insert(venueOwners)
          .values({
            venueId: venue.id,
            userId: claim.userId,
            status: "APPROVED",
          })
          .onConflictDoUpdate({
            target: [venueOwners.userId, venueOwners.venueId],
            set: { status: "APPROVED" },
          });
        await tx
          .update(users)
          .set({ role: "OWNER" })
          .where(eq(users.id, claim.userId));
        await tx
          .update(venues)
          .set({ claimed: true, siret: claim.siret })
          .where(eq(venues.id, venue.id));
      }
      await tx
        .update(venueClaims)
        .set({
          status: input.action === "APPROVE" ? "APPROVED" : "REJECTED",
          reason: input.reason,
          reviewedAt: new Date(),
        })
        .where(eq(venueClaims.id, id));
      await tx.insert(mailOutbox).values({
        recipient: claim.businessEmail,
        subject: "Votre demande Pause Café",
        text: `Votre demande pour ${venue.name} est ${input.action === "APPROVE" ? "approuvée" : "rejetée"}. Motif : ${input.reason}`,
      });
      await tx.insert(auditLogs).values({
        actorId: user.id,
        action: `CLAIM_${input.action}`,
        targetId: id,
        metadata: {
          reason: input.reason,
          venueId: venue.id,
          registryChecked: !!input.registryChecked,
          authorityChecked: !!input.authorityChecked,
        },
      });
    });
  } catch (e) {
    conflict(e);
  }
}
export async function ownerEdit(
  user: Actor,
  venueId: string,
  raw: z.infer<typeof ownerCommand>,
) {
  const command = ownerCommand.parse(raw);
  return db.transaction(async (tx) => {
    await ownedVenue(tx, user, venueId);
    let removedKeys: string[] = [];
    if (command.action === "menu-import") {
      const [{ count }] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(menuItems)
        .where(eq(menuItems.venueId, venueId));
      if (count + command.items.length > 100)
        throw new ReviewError(409, "Cent produits maximum.");
      await tx
        .insert(menuItems)
        .values(
          command.items.map((m, i) => ({ ...m, venueId, position: count + i })),
        );
    }
    if (command.action === "menu-order" || command.action === "photo-order") {
      const table = command.action === "menu-order" ? menuItems : photos;
      const current = await tx
        .select({ id: table.id })
        .from(table)
        .where(eq(table.venueId, venueId));
      if (
        command.ids.length !== current.length ||
        new Set(command.ids).size !== current.length ||
        current.some((r) => !command.ids.includes(r.id))
      )
        throw new ReviewError(
          400,
          "La liste doit contenir exactement les éléments de cet établissement.",
        );
      for (const [position, id] of command.ids.entries())
        await tx
          .update(table)
          .set({ position })
          .where(and(eq(table.id, id), eq(table.venueId, venueId)));
    }
    if (command.action === "photo-cover") {
      const [photo] = await tx
        .select()
        .from(photos)
        .where(
          and(eq(photos.id, command.photoId), eq(photos.venueId, venueId)),
        );
      if (!photo || photo.menuItemId)
        throw new ReviewError(400, "Sélectionnez une photo de la galerie.");
      await tx
        .update(photos)
        .set({ cover: false })
        .where(eq(photos.venueId, venueId));
      await tx
        .update(photos)
        .set({ cover: true })
        .where(eq(photos.id, photo.id));
    }

    if (command.action === "profile")
      await tx.update(venues).set(command.data).where(eq(venues.id, venueId));
    if (command.action === "schedule") {
      await tx.delete(venueHours).where(eq(venueHours.venueId, venueId));
      await tx
        .delete(venueExceptions)
        .where(eq(venueExceptions.venueId, venueId));
      if (command.data.hours.length)
        await tx
          .insert(venueHours)
          .values(command.data.hours.map((h) => ({ ...h, venueId })));
      if (command.data.exceptions.length)
        await tx
          .insert(venueExceptions)
          .values(command.data.exceptions.map((h) => ({ ...h, venueId })));
    }
    if (command.action === "menu-create") {
      const [{ count }] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(menuItems)
        .where(eq(menuItems.venueId, venueId));
      if (count >= 100) throw new ReviewError(409, "Cent produits maximum.");
      await tx
        .insert(menuItems)
        .values({ ...command.data, venueId, position: count });
    }
    if (command.action === "menu-update" || command.action === "menu-delete") {
      const [item] = await tx
        .select()
        .from(menuItems)
        .where(
          and(eq(menuItems.id, command.itemId), eq(menuItems.venueId, venueId)),
        );
      if (!item)
        throw new ReviewError(
          404,
          "Produit introuvable dans cet établissement.",
        );
      if (command.action === "menu-update")
        await tx
          .update(menuItems)
          .set(command.data)
          .where(eq(menuItems.id, item.id));
      else {
        removedKeys = (
          await tx.select().from(photos).where(eq(photos.menuItemId, item.id))
        ).flatMap((p) => [p.key, ...(p.thumbKey ? [p.thumbKey] : [])]);
        await tx.delete(menuItems).where(eq(menuItems.id, item.id));
      }
    }
    if (command.action === "photo-delete") {
      const deleted = await tx
        .delete(photos)
        .where(and(eq(photos.id, command.photoId), eq(photos.venueId, venueId)))
        .returning();
      if (!deleted.length) throw new ReviewError(404, "Photo introuvable.");
      removedKeys = deleted.flatMap((p) => [
        p.key,
        ...(p.thumbKey ? [p.thumbKey] : []),
      ]);
    }
    await tx.insert(auditLogs).values({
      actorId: user.id,
      action: `OWNER_${command.action.toUpperCase()}`,
      targetId: venueId,
      metadata: { itemId: "itemId" in command ? command.itemId : null },
    });
    return removedKeys;
  });
}
export async function addVenuePhoto(
  user: Actor,
  venueId: string,
  key: string,
  alt: string,
  menuItemId?: string,
  thumbKey: string | null = null,
) {
  return db.transaction(async (tx) => {
    await ownedVenue(tx, user, venueId);
    if (menuItemId) {
      const [item] = await tx
        .select()
        .from(menuItems)
        .where(
          and(eq(menuItems.id, menuItemId), eq(menuItems.venueId, venueId)),
        );
      if (!item) throw new ReviewError(404, "Produit introuvable.");
    }
    const [{ count }] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(photos)
      .where(eq(photos.venueId, venueId));
    if (count >= 20)
      throw new ReviewError(409, "Vingt photos maximum par établissement.");
    await tx
      .insert(photos)
      .values({ venueId, key, alt, menuItemId, thumbKey, position: count });
    await tx.insert(auditLogs).values({
      actorId: user.id,
      action: "OWNER_PHOTO_ADD",
      targetId: venueId,
    });
  });
}
export async function ownerDashboard(user: Actor, id: string) {
  return db.transaction(async (tx) => {
    const venue = await ownedVenue(tx, user, id);
    const menu = await tx
      .select()
      .from(menuItems)
      .where(eq(menuItems.venueId, id))
      .orderBy(menuItems.position, menuItems.name);
    const hours = await tx
      .select()
      .from(venueHours)
      .where(eq(venueHours.venueId, id));
    const exceptions = await tx
      .select()
      .from(venueExceptions)
      .where(eq(venueExceptions.venueId, id))
      .orderBy(venueExceptions.date);
    const images = await tx
      .select({
        id: photos.id,
        alt: photos.alt,
        menuItemId: photos.menuItemId,
        position: photos.position,
        cover: photos.cover,
      })
      .from(photos)
      .where(eq(photos.venueId, id))
      .orderBy(photos.position, photos.id);
    return { venue, menu, hours, exceptions, images };
  });
}
export async function pendingClaims() {
  return db
    .select({ claim: venueClaims, venueName: venues.name })
    .from(venueClaims)
    .innerJoin(venues, eq(venues.id, venueClaims.venueId))
    .where(
      and(
        eq(venueClaims.status, "PENDING"),
        isNotNull(venueClaims.emailVerifiedAt),
      ),
    )
    .orderBy(desc(venueClaims.createdAt))
    .limit(100);
}
