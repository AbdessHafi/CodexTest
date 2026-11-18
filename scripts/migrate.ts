import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import {
  checkEnvironment,
  databasePool,
  isEntry,
  safeDatabaseCommand,
} from "./lib/db-runtime";
import type { DatabaseConfig } from "./lib/db-config";
export async function migrateDatabase(config: DatabaseConfig) {
  const pool = databasePool(config.migration);
  try {
    await migrate(drizzle(pool), { migrationsFolder: "./drizzle" });
    console.log("Migrations appliquées.");
  } finally {
    await pool.end();
  }
}
if (isEntry(import.meta.url))
  await safeDatabaseCommand("Migration", async () => {
    await migrateDatabase(await checkEnvironment());
  });
