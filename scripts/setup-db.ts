import { checkEnvironment, safeDatabaseCommand } from "./lib/db-runtime";
import { migrateDatabase } from "./migrate";
import { seedDatabase } from "./seed";
import { checkDatabase } from "./check-db";
await safeDatabaseCommand("Configuration de la base", async () => {
  console.log(
    "1/4 — Vérification des variables et des connexions (aucun mot de passe affiché).",
  );
  const config = await checkEnvironment();
  console.log("2/4 — Application des migrations.");
  await migrateDatabase(config);
  console.log("3/4 — Préparation des 50 lieux fictifs.");
  await seedDatabase(config);
  console.log("4/4 — Vérification de PostGIS et des données.");
  // PostGIS is required here after migrations, unlike the initial fresh-database check.
  const { probeDatabase } = await import("./lib/db-runtime");
  const { DatabaseSetupError } = await import("./lib/db-config");
  if (!(await probeDatabase(config.database)))
    throw new DatabaseSetupError(
      "PostGIS reste absent après migration. Vérifiez que DATABASE_URL et DIRECT_URL concernent la même base et les droits d’extension.",
    );
  const result = await checkDatabase(config);
  console.log(`Base prête : ${result.tables} tables, ${result.venues} lieux`);
});
