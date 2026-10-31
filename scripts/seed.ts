import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { demoVenues } from "../src/lib/demo";
import { venues, venueHours, menuItems, plans } from "../src/db/schema";
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);
try {
  await db.transaction(async (tx) => {
    for (const v of demoVenues) {
      const { menu, hours, ...data } = v;
      const inserted = await tx
        .insert(venues)
        .values(data)
        .onConflictDoNothing({ target: venues.slug })
        .returning({ id: venues.id });
      if (!inserted.length) continue;
      await tx
        .insert(menuItems)
        .values(menu.map((m) => ({ ...m, venueId: v.id })));
      await tx
        .insert(venueHours)
        .values(hours.map((h) => ({ ...h, venueId: v.id })));
    }
    for (const [name, monthlyPrice, perCoverFee, features] of [
      ["Free", 0, 75, ["listing"]],
      ["Pro", 3900, 0, ["listing", "booking", "menu", "analytics", "replies"]],
      [
        "Premium",
        9900,
        0,
        [
          "listing",
          "booking",
          "menu",
          "analytics",
          "replies",
          "sponsored",
          "events",
        ],
      ],
    ] as const) {
      await tx
        .insert(plans)
        .values({ name, monthlyPrice, perCoverFee, features: [...features] })
        .onConflictDoNothing({ target: plans.name });
    }
  });
  await pool.query(
    `UPDATE venues SET location = ST_SetSRID(ST_MakePoint(longitude,latitude),4326)::geography WHERE source = 'DEMO'`,
  );
  console.log(
    "Seed terminé : 50 lieux et 3 offres ; sans doublon à la réexécution.",
  );
} finally {
  await pool.end();
}
