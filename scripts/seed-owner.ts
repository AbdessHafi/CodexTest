import "dotenv/config";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { users, venues, venueOwners, venueClaims } from "../src/db/schema";
import { demoAccounts } from "./demo-accounts";
if (
  !["localhost", "127.0.0.1", "db"].includes(
    new URL(process.env.DATABASE_URL || "postgresql://invalid/").hostname,
  )
)
  throw new Error("Seed propriétaire réservé à une base locale.");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);
try {
  await db.transaction(async (tx) => {
    for (const a of Object.values(demoAccounts))
      await tx.insert(users).values(a).onConflictDoNothing();
    for (const [id, name] of [
      ["local-owner", "Atelier du propriétaire démo"],
      ["local-claim", "Fiche à revendiquer démo"],
    ])
      await tx
        .insert(venues)
        .values({
          id,
          slug: id,
          name,
          city: "Paris",
          neighborhood: "Paris 11e",
          address: "Adresse fictive de démonstration",
          latitude: 48.85,
          longitude: 2.35,
          type: "Brunch",
          price: 2,
          tags: [],
          description: "Lieu fictif pour les essais locaux du tableau de bord.",
          source: "LOCAL_DEMO",
          claimed: id === "local-owner",
        })
        .onConflictDoNothing();
    await tx
      .insert(venueOwners)
      .values({
        userId: demoAccounts.owner.id,
        venueId: "local-owner",
        status: "APPROVED",
      })
      .onConflictDoNothing();
    await tx
      .insert(venueClaims)
      .values({
        id: "local-pending-claim",
        venueId: "local-claim",
        userId: demoAccounts.claimant.id,
        siret: "73282932000074",
        businessEmail: "claimant@example.invalid",
        phone: "0102030405",
        applicantRole: "owner",
        statement: "Demande fictive pour tester la validation locale.",
        emailVerifiedAt: new Date(),
        status: "PENDING",
      })
      .onConflictDoNothing();
  });
  console.log(
    "Comptes locaux et demande démo prêts. Aucune identité Supabase distante créée.",
  );
} finally {
  await pool.end();
}
