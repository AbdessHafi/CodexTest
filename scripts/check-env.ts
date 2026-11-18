import {
  checkEnvironment,
  isEntry,
  safeDatabaseCommand,
} from "./lib/db-runtime";
export { checkEnvironment };
if (isEntry(import.meta.url))
  await safeDatabaseCommand("Vérification de l’environnement", async () => {
    await checkEnvironment();
  });
