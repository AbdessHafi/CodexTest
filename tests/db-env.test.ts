import { describe, it, expect } from "vitest";
import {
  parseDatabaseUrl,
  validateDatabaseEnvironment,
  maskedDatabaseError,
} from "../scripts/lib/db-config";
const base =
  "postgresql://postgres.projectref:Alnum123@aws-0-eu-west-3.pooler.supabase.com:5432/postgres?sslmode=verify-full";
const environment = {
  DEMO_MODE: "false",
  DATABASE_URL: base,
  DIRECT_URL: base,
  NEXT_PUBLIC_SUPABASE_URL: "https://projectref.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_unit_fixture",
};
describe("URL PostgreSQL et masquage", () => {
  it("affiche les champs utiles et masque intégralement le mot de passe", () => {
    const target = parseDatabaseUrl("DATABASE_URL", base, false);
    expect(target.summary).toContain("utilisateur=postgres.projectref");
    expect(target.summary).toContain("port=5432");
    expect(target.summary).toContain("base=postgres");
    expect(target.summary).toContain("mot de passe=****");
    expect(target.summary).not.toContain("Alnum123");
  });
  it("accepte les caractères réservés encodés sans les afficher", () => {
    const t = parseDatabaseUrl(
      "DIRECT_URL",
      base.replace("Alnum123", "Unit%40pass%2Fwith%23sign%25"),
      false,
    );
    expect(t.summary).not.toContain("Unit");
    expect(t.summary).not.toContain("%40");
    expect(decodeURIComponent(t.url.password)).toBe("Unit@pass/with#sign%");
  });
  it("refuse les placeholders avec un message sans valeur fournie", () => {
    for (const password of ["[YOUR-PASSWORD]", "COLLE_ICI"])
      expect(() =>
        parseDatabaseUrl(
          "DATABASE_URL",
          base.replace("Alnum123", password),
          false,
        ),
      ).toThrow(/remplacement/);
  });
  it("explique le faux hôte base et le localhost hors démo", () => {
    expect(() =>
      parseDatabaseUrl(
        "DATABASE_URL",
        "postgresql://user:Alnum123@base:5432/postgres",
        false,
      ),
    ).toThrow(/hôte « base »/);
    expect(() =>
      parseDatabaseUrl(
        "DATABASE_URL",
        "postgresql://user:Alnum123@localhost:5432/postgres",
        false,
      ),
    ).toThrow(/DEMO_MODE=false/);
    expect(
      parseDatabaseUrl(
        "DATABASE_URL",
        "postgresql://user:Alnum123@localhost:5432/postgres",
        true,
      ).remote,
    ).toBe(false);
  });
  it("refuse les guillemets et espaces littéraux", () => {
    for (const raw of [
      `"${base}"`,
      `${base} `,
      base.replace("Alnum123", "two words"),
    ])
      expect(() => parseDatabaseUrl("DATABASE_URL", raw, false)).toThrow(
        /guillemet/,
      );
  });
  it("refuse les mots de passe réservés non encodés et les % invalides", () => {
    for (const password of [
      "Unit@password",
      "Unit/password",
      "Unit#password",
      "Unit?password",
      "Unit:password",
      "Unit%XX",
      "Unit!password",
    ])
      expect(() =>
        parseDatabaseUrl(
          "DATABASE_URL",
          base.replace("Alnum123", password),
          false,
        ),
      ).toThrow();
  });
  it("oriente la connexion directe et le pooler transaction vers Session 5432", () => {
    expect(() =>
      parseDatabaseUrl(
        "DIRECT_URL",
        base.replace(
          "aws-0-eu-west-3.pooler.supabase.com",
          "db.projectref.supabase.co",
        ),
        false,
      ),
    ).toThrow(/connexion directe/);
    expect(() =>
      parseDatabaseUrl("DIRECT_URL", base.replace(":5432", ":6543"), false),
    ).toThrow(/Session/);
    expect(() =>
      parseDatabaseUrl(
        "DIRECT_URL",
        base.replace("postgres.projectref:", "postgres:"),
        false,
      ),
    ).toThrow(/postgres\.<référence-projet>/);
  });
  it("exige TLS et conserve la vérification du certificat", () => {
    expect(() =>
      parseDatabaseUrl(
        "DATABASE_URL",
        base.replace("?sslmode=verify-full", ""),
        false,
      ),
    ).toThrow(/TLS/);
    expect(() =>
      parseDatabaseUrl(
        "DATABASE_URL",
        base.replace("verify-full", "disable"),
        false,
      ),
    ).toThrow(/TLS/);
    expect(
      parseDatabaseUrl(
        "DATABASE_URL",
        base.replace("verify-full", "require"),
        false,
      ).url.searchParams.get("sslmode"),
    ).toBe("verify-full");
  });
  it("masque un mot de passe même s’il est aussi présent dans le nom d’utilisateur", () => {
    const t = parseDatabaseUrl(
      "DATABASE_URL",
      "postgresql://SecretUser:Secret@localhost/postgres",
      true,
    );
    expect(t.summary).not.toContain("Secret");
  });
  it("refuse une URL incomplète sans imprimer le texte reçu", () => {
    for (const value of [
      "",
      undefined,
      "postgresql://bad",
      "https://example.invalid/db",
      "postgresql://u:p@host/",
    ])
      expect(() => parseDatabaseUrl("DATABASE_URL", value, false)).toThrow();
  });
});
describe("Variables publiques et cibles", () => {
  it("valide les deux URL et explique le repli DIRECT_URL", () => {
    expect(validateDatabaseEnvironment(environment).migration.name).toBe(
      "DIRECT_URL",
    );
    const result = validateDatabaseEnvironment({
      ...environment,
      DIRECT_URL: undefined,
    });
    expect(result.warnings).toHaveLength(1);
    expect(result.migration.summary).toContain("repli sur DATABASE_URL");
  });
  it("refuse les paramètres publics absents", () => {
    expect(() =>
      validateDatabaseEnvironment({
        ...environment,
        NEXT_PUBLIC_SUPABASE_URL: "",
      }),
    ).toThrow(/Renseignez NEXT_PUBLIC/);
    expect(() =>
      validateDatabaseEnvironment({
        ...environment,
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "",
      }),
    ).toThrow(/Renseignez NEXT_PUBLIC/);
  });
  it("refuse toutes les clés secrètes publiques, y compris un JWT service_role", () => {
    const jwt = [
      "header",
      Buffer.from(JSON.stringify({ role: "service_role" })).toString(
        "base64url",
      ),
      "signature",
    ].join(".");
    for (const key of [
      "sb_secret_unit_fixture",
      "secret_unit_fixture",
      "service_role",
      jwt,
    ])
      expect(() =>
        validateDatabaseEnvironment({ ...environment, NEXT_PUBLIC_OTHER: key }),
      ).toThrow(/clé secrète ou service_role/);
  });
  it("refuse un ancien DIRECT_URL incorrect même si DATABASE_URL est bon", () =>
    expect(() =>
      validateDatabaseEnvironment({
        ...environment,
        DIRECT_URL: "postgresql://user:Alnum123@base/postgres",
      }),
    ).toThrow(/DIRECT_URL/));
});
describe("Traduction des erreurs sans fuite", () => {
  const cases = [
    ["ENOTFOUND base", "Hôte PostgreSQL introuvable"],
    ["password authentication failed for user postgres", "Réinitialisez"],
    ["Tenant or user not found", "postgres.<référence-projet>"],
    ["ETIMEDOUT", "10 s"],
    ["connection terminated due to connection timeout", "10 s"],
    ["ECONNREFUSED", "Connexion refusée"],
    ["self-signed certificate", "Échec TLS"],
    ["permission denied", "Droits PostgreSQL insuffisants"],
    ["42P01", "db:migrate"],
  ];
  for (const [message, expected] of cases)
    it(`traduit ${expected}`, () =>
      expect(maskedDatabaseError(new Error(message))).toContain(expected));
  it("inspecte les causes imbriquées sans reproduire le mot de passe ou la stack", () => {
    const error = new Error(
      "Failed query with postgresql://u:NeverPrintThis@host/db",
      {
        cause: Object.assign(new Error("password authentication failed"), {
          code: "28P01",
        }),
      },
    );
    const text = maskedDatabaseError(error);
    expect(text).toContain("Mot de passe PostgreSQL refusé");
    expect(text).not.toContain("NeverPrintThis");
    expect(text).not.toContain("postgresql://");
    expect(text).not.toContain("at ");
  });
  it("ne recopie pas une erreur inconnue contenant un secret", () => {
    const result = maskedDatabaseError(new Error("SensitiveCredentialXYZ"));
    expect(result).not.toContain("SensitiveCredentialXYZ");
    expect(result).toContain("détails techniques sont masqués");
  });
});
