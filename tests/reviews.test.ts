import { describe, it, expect, vi, afterEach } from "vitest";
import {
  reviewInput,
  reportInput,
  moderationInput,
  summarize,
  canReply,
  contentFingerprint,
} from "../src/lib/reviews/policy";
import { verifyCaptcha } from "../src/lib/reviews/captcha";
import { safeJson, venueStructuredData, slugify } from "../src/lib/seo";
import { demoVenues } from "../src/lib/demo";
import { preparePhotos } from "../src/lib/reviews/storage";
import sharp from "sharp";
const valid = {
  venueId: "demo-0-0",
  visitDate: "2026-01-01",
  coffee: 5,
  food: 4,
  service: 3,
  ambiance: 4,
  value: 4,
  text: "Une belle visite avec un excellent café.",
};
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe("Intégrité des avis", () => {
  it("accepte une visite et refuse notes, dates ou preuves forgées", () => {
    expect(reviewInput.safeParse(valid).success).toBe(true);
    for (const patch of [
      { coffee: 0 },
      { food: 6 },
      { value: 2.5 },
      { visitDate: "2999-01-01" },
      { visitDate: "2026-02-31" },
      { text: "court" },
      { verified: true },
      { userId: "autre" },
      { status: "PUBLISHED" },
    ])
      expect(reviewInput.safeParse({ ...valid, ...patch }).success).toBe(false);
  });
  it("exige des raisons explicites pour signalements et décisions", () => {
    expect(reportInput.safeParse({ reason: "non" }).success).toBe(false);
    expect(
      moderationInput.safeParse({
        action: "DELETE",
        reason: "Contenu inapproprié",
      }).success,
    ).toBe(false);
  });
  it("calcule une moyenne égale par critère puis par avis", () => {
    const result = summarize([
      valid,
      { ...valid, coffee: 1, food: 1, service: 1, ambiance: 1, value: 1 },
    ]);
    expect(result.count).toBe(2);
    expect(result.average).toBe(2.5);
    expect(result.criteria.coffee).toBe(3);
    expect(summarize([]).average).toBe(0);
  });
  it("réserve la réponse au propriétaire approuvé de ce lieu", () => {
    expect(
      canReply({ id: "a", role: "OWNER" }, { userId: "a", status: "APPROVED" }),
    ).toBe(true);
    expect(
      canReply({ id: "b", role: "OWNER" }, { userId: "a", status: "APPROVED" }),
    ).toBe(false);
    expect(
      canReply({ id: "a", role: "OWNER" }, { userId: "a", status: "PENDING" }),
    ).toBe(false);
    expect(
      canReply(
        { id: "a", role: "CONSUMER" },
        { userId: "a", status: "APPROVED" },
      ),
    ).toBe(false);
  });
  it("détecte les textes copiés malgré espaces et ponctuation", () =>
    expect(contentFingerprint("Très BON !")).toBe(
      contentFingerprint("très bon"),
    ));
});
describe("CAPTCHA", () => {
  it("échoue fermé sans configuration, y compris en production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CAPTCHA_MODE", "disabled");
    vi.stubEnv("TURNSTILE_SECRET_KEY", "");
    expect(await verifyCaptcha("anything", "review")).toBe(false);
  });
  it("contrôle succès, hostname et action du fournisseur", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "test-only");
    vi.stubEnv("CAPTCHA_HOSTNAME", "pause.example");
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        hostname: "pause.example",
        action: "review",
      }),
    });
    vi.stubGlobal("fetch", fetch);
    expect(await verifyCaptcha("token", "review")).toBe(true);
    expect(await verifyCaptcha("token", "report")).toBe(false);
    fetch.mockRejectedValueOnce(new Error("offline"));
    expect(await verifyCaptcha("token", "review")).toBe(false);
  });
});
describe("Photos", () => {
  it("rejette SVG, trop de photos et faux JPEG", async () => {
    await expect(
      preparePhotos([new File(["<svg/>"], "x.svg", { type: "image/svg+xml" })]),
    ).rejects.toThrow();
    await expect(
      preparePhotos(
        Array.from(
          { length: 4 },
          () => new File(["x"], "x.jpg", { type: "image/jpeg" }),
        ),
      ),
    ).rejects.toThrow();
    await expect(
      preparePhotos([
        new File(["not an image"], "x.jpg", { type: "image/jpeg" }),
      ]),
    ).rejects.toThrow();
  });
  it("réencode en JPEG sans EXIF", async () => {
    const original = await sharp({
      create: { width: 20, height: 20, channels: 3, background: "red" },
    })
      .withExif({ IFD0: { Artist: "Donnée privée" } })
      .jpeg()
      .toBuffer();
    const [output] = await preparePhotos([
      new File([new Uint8Array(original)], "photo.jpg", { type: "image/jpeg" }),
    ]);
    const meta = await sharp(output).metadata();
    expect(meta.format).toBe("jpeg");
    expect(meta.exif).toBeUndefined();
  });
});
describe("SEO", () => {
  it("neutralise les sorties de script dans le JSON-LD", () => {
    expect(
      safeJson({ name: "</script><script>alert(1)</script>" }),
    ).not.toContain("<");
    expect(JSON.parse(safeJson({ name: "<lieu>" })).name).toBe("<lieu>");
  });
  it("ne crée aucune note sur une fiche sans avis ou fictive", () => {
    expect(
      venueStructuredData(demoVenues[0], summarize([valid])),
    ).not.toHaveProperty("aggregateRating");
    expect(
      venueStructuredData({ ...demoVenues[0], source: "OSM" }, summarize([])),
    ).not.toHaveProperty("aggregateRating");
    expect(
      venueStructuredData(
        { ...demoVenues[0], source: "OSM" },
        summarize([valid]),
      ),
    ).toHaveProperty("aggregateRating.reviewCount", 1);
  });
  it("forme des URL stables pour les quartiers français", () =>
    expect(slugify("Paris 11e · République")).toBe("paris-11e-republique"));
});
