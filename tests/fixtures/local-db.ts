export function requireLocalTestDatabase() {
  const url = new URL(process.env.DATABASE_URL || "postgresql://invalid/");
  if (!["localhost", "127.0.0.1", "db"].includes(url.hostname))
    throw new Error(
      "Les tests avec fixtures exigent une base locale dédiée ; ne pas les exécuter sur une base de production.",
    );
}
