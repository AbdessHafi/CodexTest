import { config as dotenv } from "dotenv";
import { Client, Pool } from "pg";
import { pathToFileURL } from "node:url";
import {
  DatabaseSetupError,
  maskedDatabaseError,
  validateDatabaseEnvironment,
  type DatabaseConfig,
  type DatabaseTarget,
} from "./db-config";
export function loadDatabaseEnvironment() {
  dotenv({ path: [".env.local", ".env"], quiet: true });
}
export function isEntry(url: string) {
  return !!process.argv[1] && pathToFileURL(process.argv[1]).href === url;
}
export async function safeDatabaseCommand(
  label: string,
  work: () => Promise<void>,
) {
  try {
    loadDatabaseEnvironment();
    await work();
  } catch (error) {
    console.error(`${label} — arrêt : ${maskedDatabaseError(error)}`);
    process.exitCode = 1;
  }
}
export function databasePool(target: DatabaseTarget) {
  const pool = new Pool({
    connectionString: target.url.toString(),
    max: 1,
    connectionTimeoutMillis: 10000,
  });
  pool.on("error", (error) => {
    console.error(`Connexion interrompue : ${maskedDatabaseError(error)}`);
    process.exitCode = 1;
  });
  return pool;
}
export async function probeDatabase(target: DatabaseTarget) {
  const client = new Client({
    connectionString: target.url.toString(),
    connectionTimeoutMillis: 10000,
    query_timeout: 10000,
    statement_timeout: 10000,
  });
  client.on("error", () => {});
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      (async () => {
        await client.connect();
        await client.query("SELECT 1");
        const result = await client.query(
          "SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname='postgis') AS installed",
        );
        return result.rows[0].installed === true;
      })(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(
            new DatabaseSetupError(
              "Connexion PostgreSQL trop longue (limite : 10 s). Vérifiez le Session pooler sur le port 5432, le projet actif et votre pare-feu/VPN.",
            ),
          );
        }, 10000);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
    await client.end().catch(() => {});
  }
}
export async function checkEnvironment(
  requirePostgis = false,
): Promise<DatabaseConfig> {
  loadDatabaseEnvironment();
  const config = validateDatabaseEnvironment(process.env);
  console.log(config.database.summary);
  console.log(config.migration.summary);
  config.warnings.forEach((w) => console.log(`À noter : ${w}`));
  const checked = new Map<string, boolean>();
  for (const target of [config.database, config.migration]) {
    const key = target.url.toString();
    let installed = checked.get(key);
    if (installed === undefined) {
      try {
        installed = await probeDatabase(target);
      } catch (e) {
        throw new DatabaseSetupError(
          `${target.name} : ${maskedDatabaseError(e)}`,
        );
      }
      checked.set(key, installed);
    }
    if (!installed && requirePostgis)
      throw new DatabaseSetupError(
        `${target.name} : PostGIS n’est pas installé. Lancez npm run db:migrate : la première migration active l’extension avec les droits requis.`,
      );
    console.log(
      `${target.name} : connexion SELECT 1 réussie ; ${installed ? "PostGIS présent." : "PostGIS absent : db:migrate doit activer l’extension."}`,
    );
  }
  return config;
}
