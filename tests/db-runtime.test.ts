import { it, expect, vi, afterEach, beforeEach } from "vitest";
const mock = vi.hoisted(() => ({
  connect: vi.fn(),
  query: vi.fn(),
  end: vi.fn(),
}));
vi.mock("pg", () => ({
  Client: class {
    on() {}
    connect() {
      return mock.connect();
    }
    query(sql: string) {
      return mock.query(sql);
    }
    end() {
      return mock.end();
    }
  },
}));
import { probeDatabase, safeDatabaseCommand } from "../scripts/lib/db-runtime";
import { parseDatabaseUrl } from "../scripts/lib/db-config";
const target = () =>
  parseDatabaseUrl(
    "DATABASE_URL",
    "postgresql://fixture:Alnum123@localhost/postgres",
    true,
  );
const exit = process.exitCode;
beforeEach(() => {
  mock.connect.mockResolvedValue(undefined);
  mock.end.mockResolvedValue(undefined);
});
afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
  process.exitCode = exit;
  vi.restoreAllMocks();
});
it("exécute SELECT 1 et vérifie la présence de PostGIS, sans migration implicite", async () => {
  mock.connect.mockResolvedValue(undefined);
  mock.end.mockResolvedValue(undefined);
  mock.query.mockResolvedValue({ rows: [{ installed: true }] });
  expect(await probeDatabase(target())).toBe(true);
  expect(mock.query).toHaveBeenCalledWith("SELECT 1");
  expect(mock.query).toHaveBeenCalledTimes(2);
  expect(mock.end).toHaveBeenCalledTimes(1);
});
it("signale PostGIS absent sans le confondre avec une connexion refusée", async () => {
  mock.query.mockResolvedValue({ rows: [{ installed: false }] });
  expect(await probeDatabase(target())).toBe(false);
});
it("interrompt le diagnostic complet après dix secondes", async () => {
  vi.useFakeTimers();
  mock.connect.mockImplementation(() => new Promise(() => {}));
  mock.end.mockResolvedValue(undefined);
  const assertion = expect(probeDatabase(target())).rejects.toThrow(
    /limite : 10 s/,
  );
  await vi.advanceTimersByTimeAsync(10000);
  await assertion;
  expect(mock.end).toHaveBeenCalledTimes(1);
});
it("n’imprime que le diagnostic masqué et utilise un code de sortie non nul", async () => {
  const output = vi.spyOn(console, "error").mockImplementation(() => {});
  await safeDatabaseCommand("Migration", async () => {
    throw Object.assign(new Error("postgresql://user:DoNotPrintMe@base/db"), {
      code: "ENOTFOUND",
    });
  });
  expect(process.exitCode).toBe(1);
  const text = output.mock.calls.flat().join(" ");
  expect(text).toContain("Migration — arrêt");
  expect(text).not.toContain("DoNotPrintMe");
  expect(text).not.toContain("postgresql://");
  expect(text).not.toContain("\n    at");
});
