// Explicit CLI operation: no import runs at request time. Respect Overpass usage policy.
import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { venues } from "../src/db/schema";
import { z } from "zod";
const schema = z.object({
  elements: z.array(
    z.object({
      id: z.number(),
      type: z.enum(["node", "way", "relation"]),
      lat: z.number().optional(),
      lon: z.number().optional(),
      center: z.object({ lat: z.number(), lon: z.number() }).optional(),
      tags: z.record(z.string(), z.string()).optional(),
    }),
  ),
});
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);
async function main() {
  const city = process.argv[2];
  if (!["Paris", "Lyon", "Marseille", "Bordeaux", "Lille"].includes(city))
    throw new Error(
      "Usage : npm run db:import -- Paris (ou Lyon, Marseille, Bordeaux, Lille)",
    );
  const query = `[out:json][timeout:30];area["name"="${city}"]["boundary"="administrative"]["admin_level"="8"]->.a;(nwr["amenity"="cafe"](area.a);nwr["cuisine"~"brunch"](area.a););out center tags;`;
  const response = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "PauseCafe-MVP/0.1 (manual city import)",
    },
    body: new URLSearchParams({ data: query }),
    signal: AbortSignal.timeout(45000),
  });
  if (!response.ok) throw new Error(`Overpass : HTTP ${response.status}`);
  const data = schema.parse(await response.json());
  let count = 0;
  for (const e of data.elements) {
    const t = e.tags,
      p =
        e.center ??
        (e.lat !== undefined && e.lon !== undefined
          ? { lat: e.lat, lon: e.lon }
          : undefined);
    if (!t?.name || !p) continue;
    const sourceId = `${e.type}/${e.id}`;
    await db
      .insert(venues)
      .values({
        slug: `osm-${e.type}-${e.id}`,
        sourceId,
        source: "OSM",
        name: t.name,
        city,
        neighborhood: t["addr:suburb"] || "",
        address:
          [t["addr:housenumber"], t["addr:street"]].filter(Boolean).join(" ") ||
          "Adresse à compléter",
        latitude: p.lat,
        longitude: p.lon,
        type: t.cuisine?.includes("brunch") ? "Brunch" : "Coffee shop",
        price: 1,
        tags: [],
        description:
          "Établissement importé depuis OpenStreetMap. Informations à vérifier auprès du lieu.",
        claimed: false,
      })
      .onConflictDoNothing({ target: venues.sourceId });
    count++;
  }
  await pool.query(
    "UPDATE venues SET location = ST_SetSRID(ST_MakePoint(longitude, latitude),4326)::geography WHERE source = 'OSM'",
  );
  console.log(
    `${count} lieux traités. © OpenStreetMap contributors, ODbL. Conserver l’attribution et les obligations de partage à l’identique.`,
  );
}
main().finally(() => pool.end());
