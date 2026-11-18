/** Pure diagnostics. Never include a supplied value or an upstream error in a message. */
export class DatabaseSetupError extends Error {}
export type DatabaseTarget = {
  name: "DATABASE_URL" | "DIRECT_URL";
  url: URL;
  remote: boolean;
  summary: string;
};
export type DatabaseConfig = {
  database: DatabaseTarget;
  migration: DatabaseTarget;
  warnings: string[];
};
const placeholders =
  /YOUR[-_ ]?(?:PASSWORD|PROJECT|HOST)|COLLE[_ -]?ICI|REMPLAC(?:E|ER)|\[(?:PASSWORD|PROJECT|HOST|MOT[_ -]?DE[_ -]?PASSE)[^\]]*\]|<[^>]+>|\$\{/i;
export function parseDatabaseUrl(
  name: DatabaseTarget["name"],
  raw: string | undefined,
  demoMode: boolean,
): DatabaseTarget {
  const fail = (message: string): never => {
    throw new DatabaseSetupError(`${name} : ${message}`);
  };
  if (!raw)
    fail(
      "valeur absente. Copiez la chaîne PostgreSQL depuis Connect → Session pooler dans Supabase.",
    );
  const value = raw!;
  if (placeholders.test(value))
    fail(
      "un texte de remplacement est encore présent. Remplacez le mot de passe et les références de projet, sans crochets ni « COLLE_ICI ».",
    );
  if (/[\s"']/.test(value))
    fail(
      "la valeur contient un espace, un saut de ligne ou un guillemet littéral. Recopiez la chaîne sur une ligne et encodez ces caractères dans le mot de passe. Les guillemets entourant normalement une valeur .env sont gérés par dotenv.",
    );
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return fail(
      "URL PostgreSQL invalide. Recopiez Connect → Session pooler, puis remplacez uniquement le mot de passe encodé.",
    );
  }
  if (!["postgres:", "postgresql:"].includes(url.protocol))
    fail("utilisez une URL commençant par postgresql://.");
  // Inspect the original authority: URL alone silently normalizes some ambiguous passwords.
  const authority = value.slice(value.indexOf("://") + 3).split(/[/?#]/, 1)[0];
  if ((authority.match(/@/g) || []).length !== 1 || !authority.includes(":"))
    fail(
      "identifiants ambigus ou caractère réservé non encodé dans le mot de passe (@, /, ?, #…). Encodez le mot de passe avec un encodeur URL fiable, ou réinitialisez-le avec lettres et chiffres uniquement.",
    );
  const credentials = authority.slice(0, authority.indexOf("@"));
  const colon = credentials.indexOf(":");
  if (colon <= 0)
    fail(
      "utilisateur ou mot de passe absent. Recopiez la chaîne Session pooler complète.",
    );
  const password = credentials.slice(colon + 1);
  if (!password || !/^(?:[A-Za-z0-9._~-]|%[0-9A-Fa-f]{2})+$/.test(password))
    fail(
      "mot de passe vide ou caractères spéciaux non encodés. Encodez uniquement le mot de passe (pas toute l’URL), ou utilisez un nouveau mot de passe composé de lettres et chiffres.",
    );
  let user: string, decodedPassword: string, database: string;
  try {
    user = decodeURIComponent(url.username);
    decodedPassword = decodeURIComponent(url.password);
    database = decodeURIComponent(url.pathname.slice(1));
  } catch {
    return fail(
      "encodage % invalide. Encodez chaque caractère réservé du mot de passe sous la forme %XX.",
    );
  }
  if (
    !/^[A-Za-z0-9_.-]+$/.test(user!) ||
    !/^[A-Za-z0-9_-]+$/.test(database!) ||
    !url.hostname
  )
    fail(
      "utilisateur, hôte ou nom de base invalide. Reprenez la chaîne Session pooler sans modifier ces champs.",
    );
  if (url.hash)
    fail(
      "un fragment # est présent. Encodez le caractère # du mot de passe en %23, ou supprimez le fragment ajouté à l’URL.",
    );
  const host = url.hostname.toLowerCase();
  const local = ["localhost", "127.0.0.1", "[::1]", "db"].includes(host);
  if (host === "base")
    fail(
      "l’hôte « base » est un texte de remplacement, pas votre serveur. Copiez l’hôte exact du Session pooler dans Connect sur Supabase.",
    );
  if (!demoMode && local)
    fail(
      "l’hôte est local alors que DEMO_MODE=false. Pour Supabase, utilisez le Session pooler ; pour PostgreSQL local, mettez DEMO_MODE=true pour cette commande.",
    );
  if (/^db\.[^.]+\.supabase\.co$/.test(host))
    fail(
      "cette URL est la connexion directe, souvent accessible seulement en IPv6. Dans Supabase → Connect, sélectionnez Session pooler (port 5432) et recopiez aussi son utilisateur postgres.<référence-projet>.",
    );
  const managed =
    host.endsWith(".pooler.supabase.com") || host.endsWith(".supabase.co");
  if (host.endsWith(".pooler.supabase.com") && url.port && url.port !== "5432")
    fail(
      "le port du pooler doit être 5432 (Session), pas 6543 (Transaction), pour ces commandes de configuration.",
    );
  if (
    host.endsWith(".pooler.supabase.com") &&
    !/^postgres\.[a-z0-9]+$/i.test(user!)
  )
    fail(
      "l’utilisateur du Session pooler doit être postgres.<référence-projet>. Copiez-le depuis Connect, sans le remplacer par postgres seul.",
    );
  const ssl = url.searchParams.get("sslmode");
  if (managed && !["require", "verify-ca", "verify-full"].includes(ssl || ""))
    fail(
      "TLS est requis. Ajoutez ?sslmode=verify-full à l’URL (ou &sslmode=verify-full si elle contient déjà des paramètres). Ne désactivez pas la vérification du certificat.",
    );
  if (!local && !["require", "verify-ca", "verify-full"].includes(ssl || ""))
    fail(
      "pour une base distante, ajoutez sslmode=verify-full afin de protéger la connexion TLS.",
    );
  if (
    url.searchParams.has("sslcert") ||
    url.searchParams.has("sslkey") ||
    url.searchParams.has("uselibpqcompat")
  )
    fail(
      "paramètres TLS avancés non pris en charge par cet assistant. Utilisez la chaîne Session pooler avec sslmode=verify-full et les certificats de confiance du système.",
    );
  // Keep certificate/hostname verification even when a copied URL uses sslmode=require.
  if (!local || ["require", "verify-ca", "verify-full"].includes(ssl || ""))
    url.searchParams.set("sslmode", "verify-full");
  const safe = (part: string) => {
    if (
      [password, decodedPassword!].some(
        (secret) => secret && part.includes(secret),
      )
    )
      return "[masqué]";
    return part.replace(/[^A-Za-z0-9_.:[\]-]/g, "?").slice(0, 150);
  };
  return {
    name,
    url,
    remote: !local,
    summary: `${name} — utilisateur=${safe(user!)} ; hôte=${safe(host)} ; port=${url.port || "5432"} ; base=${safe(database!)} ; mot de passe=****`,
  };
}
function privatePublicKey(value: string) {
  if (/secret_|service_role/i.test(value)) return true;
  try {
    const payload = value.split(".")[1];
    return (
      !!payload &&
      JSON.parse(Buffer.from(payload, "base64url").toString()).role ===
        "service_role"
    );
  } catch {
    return false;
  }
}
export function validateDatabaseEnvironment(
  env: Record<string, string | undefined>,
): DatabaseConfig {
  for (const [name, value] of Object.entries(env))
    if (name.startsWith("NEXT_PUBLIC_") && value && privatePublicKey(value))
      throw new DatabaseSetupError(
        "Une clé secrète ou service_role a été placée dans une variable NEXT_PUBLIC_. Retirez-la de toutes les variables publiques, utilisez la clé Publishable, puis révoquez la clé secrète si elle a été exposée.",
      );
  if (
    !env.NEXT_PUBLIC_SUPABASE_URL ||
    !env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  )
    throw new DatabaseSetupError(
      "Renseignez NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY dans .env ou .env.local (Supabase → Project Settings → API Keys). La clé attendue est publique, pas service_role.",
    );
  try {
    const url = new URL(env.NEXT_PUBLIC_SUPABASE_URL);
    if (
      !["https:", "http:"].includes(url.protocol) ||
      /[\s"']/.test(env.NEXT_PUBLIC_SUPABASE_URL)
    )
      throw new Error();
  } catch {
    throw new DatabaseSetupError(
      "NEXT_PUBLIC_SUPABASE_URL est invalide. Copiez l’URL HTTPS du projet depuis Supabase, sans guillemet littéral ni espace.",
    );
  }
  const demo = env.DEMO_MODE !== "false";
  const database = parseDatabaseUrl("DATABASE_URL", env.DATABASE_URL, demo);
  const migration = env.DIRECT_URL
    ? parseDatabaseUrl("DIRECT_URL", env.DIRECT_URL, demo)
    : {
        ...database,
        name: "DIRECT_URL" as const,
        summary: database.summary.replace(
          "DATABASE_URL",
          "DIRECT_URL (repli sur DATABASE_URL)",
        ),
      };
  return {
    database,
    migration,
    warnings: env.DIRECT_URL
      ? []
      : [
          "DIRECT_URL absent : les migrations utiliseront DATABASE_URL. Pour Supabase, vous pouvez renseigner la même chaîne Session pooler dans les deux variables.",
        ],
  };
}
export function maskedDatabaseError(error: unknown): string {
  if (error instanceof DatabaseSetupError) return error.message;
  const details: string[] = [];
  const seen = new Set<unknown>();
  function visit(e: unknown) {
    if (!e || typeof e !== "object" || seen.has(e)) return;
    seen.add(e);
    const item = e as {
      code?: unknown;
      message?: unknown;
      cause?: unknown;
      errors?: unknown[];
    };
    for (const value of [item.code, item.message])
      if (typeof value === "string") details.push(value);
    visit(item.cause);
    if (Array.isArray(item.errors)) item.errors.forEach(visit);
  }
  visit(error);
  const text = details.join(" ").toLowerCase();
  if (
    text.includes("enotfound") ||
    text.includes("eai_again") ||
    text.includes("getaddrinfo")
  )
    return "Hôte PostgreSQL introuvable (DNS). Remplacez « base » ou tout placeholder par l’hôte exact de Supabase → Connect → Session pooler ; recopiez l’URL complète pour éviter qu’un caractère du mot de passe soit pris pour l’hôte.";
  if (text.includes("tenant or user not found"))
    return "Tenant ou utilisateur introuvable. Recopiez ensemble l’hôte Session pooler et l’utilisateur postgres.<référence-projet> depuis le même projet Supabase. Ne mélangez pas deux régions ou deux projets.";
  if (
    text.includes("28p01") ||
    text.includes("password authentication failed") ||
    text.includes("authentication failed")
  )
    return "Mot de passe PostgreSQL refusé. Réinitialisez le mot de passe de la base dans Supabase → Project Settings → Database, mettez à jour DATABASE_URL et DIRECT_URL, puis encodez ses caractères spéciaux. Ce mot de passe est distinct du mot de passe de connexion à Supabase.";
  if (
    /timeout|timed out|etimedout|econn?timeout|connection terminated due to connection timeout/.test(
      text,
    )
  )
    return "Connexion PostgreSQL trop longue (limite : 10 s). Vérifiez que le projet Supabase est actif, que le Session pooler utilise le port 5432 et que votre réseau/VPN/pare-feu autorise ce port. Réessayez après reprise du projet s’il était en pause.";
  if (/certificate|self.signed|unable_to_verify|cert_|ssl|tls/.test(text))
    return "Échec TLS. Utilisez sslmode=verify-full et installez le certificat de confiance officiel indiqué par Supabase ou votre organisation. Ne désactivez pas la vérification du certificat.";
  if (/econnrefused|connection refused/.test(text))
    return "Connexion refusée. Vérifiez l’hôte et le port 5432 du Session pooler ; en mode local, démarrez PostgreSQL avec docker compose up -d db.";
  if (text.includes("42501") || text.includes("permission denied"))
    return "Droits PostgreSQL insuffisants. Utilisez l’utilisateur postgres.<référence-projet> du Session pooler pour les migrations et l’activation de PostGIS.";
  if (text.includes("42p01") || text.includes("does not exist"))
    return "Une table ou PostGIS manque. Lancez npm run db:migrate (ou npm run db:setup) sur cette même base avant le seed et les contrôles.";
  if (text.includes("err_assertion"))
    return "Le contrôle des données a échoué. Lancez npm run db:setup sur la base de démonstration migrée ; vérifiez les 50 lieux fictifs et leurs données sans supprimer vos données existantes.";
  return "Opération PostgreSQL impossible. Vérifiez les URL Session pooler, le projet actif et les droits de migration, puis relancez npm run db:setup. Les détails techniques sont masqués pour protéger les identifiants.";
}
