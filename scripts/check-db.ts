import "dotenv/config";
import assert from "node:assert/strict";
import { Pool } from "pg";
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
try {
  const {
    rows: [counts],
  } = await pool.query(
    `SELECT (SELECT count(*) FROM venues WHERE source='DEMO')::int venues,(SELECT count(*) FROM menu_items)::int menus,(SELECT count(*) FROM venue_hours)::int hours,(SELECT count(*) FROM plans)::int plans,(SELECT count(*) FROM venues WHERE location IS NOT NULL)::int geocoded`,
  );
  assert.equal(counts.venues, 50);
  assert.equal(counts.menus, 150);
  assert.equal(counts.hours, 350);
  assert.equal(counts.plans, 3);
  assert.ok(counts.geocoded >= 50);
  const { rows } = await pool.query(
    `SELECT name FROM venues ORDER BY location <-> ST_SetSRID(ST_MakePoint(2.3522,48.8566),4326)::geography LIMIT 1`,
  );
  assert.ok(rows[0].name);
  await assert.rejects(
    pool.query(
      `INSERT INTO users (id, role) VALUES ('00000000-0000-0000-0000-000000000001','INVALID')`,
    ),
  );
  console.log(
    "Base validée : 50 lieux, 150 plats, 350 horaires, 3 offres, géocodage et requête spatiale, contrainte de rôle.",
  );
} finally {
  await pool.end();
}
