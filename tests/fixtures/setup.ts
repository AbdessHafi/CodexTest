import "dotenv/config";
import { requireLocalTestDatabase } from "./local-db";
import { Pool } from "pg";
import { projects, roles, userId, venueId } from "./accounts";
export default async function setup() {
  requireLocalTestDatabase();
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const cleanup = async () => {
    for (const p of projects) {
      const venue = venueId(p);
      const ids = roles.map((r) => userId(p, r));
      await pool.query(
        "DELETE FROM audit_logs WHERE actor_id=ANY($1::uuid[])",
        [ids],
      );
      await pool.query(
        "DELETE FROM report_flags WHERE reporter_id=ANY($1::uuid[])",
        [ids],
      );
      await pool.query("DELETE FROM reviews WHERE venue_id=$1", [venue]);
      await pool.query("DELETE FROM venues WHERE id=ANY($1::text[])", [
        [venue, `e2e-phase3-${p}`],
      ]);
      await pool.query("DELETE FROM mail_outbox WHERE recipient=$1", [
        `claimant-${p}@example.invalid`,
      ]);
      await pool.query("DELETE FROM abuse_buckets WHERE key=ANY($1::text[])", [
        ids.flatMap((id) =>
          [
            "review",
            "report",
            "reply",
            "moderate",
            "owner",
            "claim",
            "claim-code",
            "claim-resend",
          ].map((a) => `${a}:${id}`),
        ),
      ]);
      await pool.query("DELETE FROM users WHERE id=ANY($1::uuid[])", [ids]);
    }
  };
  await cleanup();
  for (const p of projects) {
    for (const role of roles)
      await pool.query("INSERT INTO users(id,role) VALUES ($1,$2)", [
        userId(p, role),
        role === "admin" ? "ADMIN" : role === "owner" ? "OWNER" : "CONSUMER",
      ]);
    await pool.query(
      `INSERT INTO venues(id,slug,name,city,neighborhood,address,latitude,longitude,type,price,tags,description,source) VALUES ($1,$1,'Brunch de test','Paris','Paris 11e','Adresse de test',48.85,2.35,'Brunch',2,'{}','Fixture automatisée, pas un établissement réel.','TEST')`,
      [venueId(p)],
    );
    await pool.query(
      `INSERT INTO venues(id,slug,name,city,neighborhood,address,latitude,longitude,type,price,tags,description,source) VALUES ($1,$1,$2,'Paris','Paris 11e','Adresse fictive',48.85,2.35,'Brunch',2,'{}','Établissement de test pour la revendication.','TEST')`,
      [`e2e-phase3-${p}`, `Revendication ${p}`],
    );
    await pool.query(
      `INSERT INTO venue_owners(id,user_id,venue_id,status) VALUES ($1,$2,$3,'APPROVED')`,
      [crypto.randomUUID(), userId(p, "owner"), venueId(p)],
    );
  }
  return async () => {
    await cleanup();
    await pool.end();
  };
}
