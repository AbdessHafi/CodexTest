import { it, expect } from "vitest";
import {
  validSiret,
  scheduleInput,
  profileInput,
  claimDecision,
} from "../src/lib/owners/policy";
it("contrôle le SIRET et refuse les clés ou formats invalides", () => {
  expect(validSiret("73282932000074")).toBe(true);
  for (const s of [
    "73282932000075",
    "732829320",
    "00000000000000",
    "7328293200007x",
  ])
    expect(validSiret(s)).toBe(false);
});
it("refuse horaires inversés et jours dupliqués", () => {
  expect(
    scheduleInput.safeParse({
      hours: [{ day: 1, open: "18:00", close: "09:00" }],
      exceptions: [],
    }).success,
  ).toBe(false);
  expect(
    scheduleInput.safeParse({
      hours: [
        { day: 1, open: "09:00", close: "18:00" },
        { day: 1, open: "09:00", close: "18:00" },
      ],
      exceptions: [],
    }).success,
  ).toBe(false);
});
it("ne permet pas de forger un propriétaire via la fiche", () =>
  expect(
    profileInput.safeParse({ claimed: true, siret: "73282932000074" }).success,
  ).toBe(false));
it("exige le contrôle humain avant approbation", () =>
  expect(
    claimDecision.safeParse({
      action: "APPROVE",
      reason: "Je valide cette demande.",
    }).success,
  ).toBe(false));
import {
  codeHash,
  codeMatches,
  codeUsable,
  newCode,
} from "../src/lib/owners/code";
import { proofUrl, validProofUrl, prepareProof } from "../src/lib/owners/proof";
import { exportMenuCsv, importMenuCsv } from "../src/lib/owners/csv";
import {
  menuInput,
  visibleMenuItem,
  featuredMenuItem,
} from "../src/lib/owners/policy";
import { isOpen } from "../src/lib/search";
import { demoVenues } from "../src/lib/demo";
it("hachage de code lié à la demande, expiration et cinq essais", () => {
  const code = newCode();
  expect(code).toMatch(/^\d{6}$/);
  const hash = codeHash("claim", code);
  expect(hash).not.toContain(code);
  expect(codeMatches("claim", code, hash)).toBe(true);
  expect(codeMatches("other", code, hash)).toBe(false);
  expect(codeMatches("claim", "abc", hash)).toBe(false);
  expect(codeUsable(new Date(10000), 4, new Date(9999))).toBe(true);
  expect(codeUsable(new Date(10000), 5, new Date(9999))).toBe(false);
  expect(codeUsable(new Date(10000), 0, new Date(10000))).toBe(false);
});
it("liens justificatifs signés, temporaires et liés au compte", () => {
  const url = new URL(proofUrl("claim", "user"), "https://example.invalid");
  const params = url.searchParams;
  expect(
    validProofUrl(
      "claim",
      "user",
      params.get("expires"),
      params.get("signature"),
    ),
  ).toBe(true);
  expect(
    validProofUrl(
      "claim",
      "other",
      params.get("expires"),
      params.get("signature"),
    ),
  ).toBe(false);
  expect(
    validProofUrl("claim", "user", "1000000000000", params.get("signature")),
  ).toBe(false);
});
it("PDF borné et contrôle de signature, aucun SVG accepté", async () => {
  await expect(
    prepareProof(new File(["not pdf"], "x.pdf", { type: "application/pdf" })),
  ).rejects.toThrow();
  const pdf = await prepareProof(
    new File(["%PDF-1.4\n%%EOF"], "x.pdf", { type: "application/pdf" }),
  );
  expect(pdf.type).toBe("application/pdf");
  await expect(
    prepareProof(new File(["<svg/>"], "x.svg", { type: "image/svg+xml" })),
  ).rejects.toThrow();
});
it("importe/exporte CSV avec virgules, guillemets et protection tableur", () => {
  const item = menuInput.parse({
    name: 'Tartine, "maison"',
    price: 1250,
    description: "Pain frais",
    tags: ["vegan"],
    category: "Brunch",
    allergens: ["gluten"],
  });
  expect(importMenuCsv(exportMenuCsv([item]))).toEqual([item]);
  expect(exportMenuCsv([{ ...item, name: '=IMPORTXML("evil")' }])).toContain(
    "'=IMPORTXML",
  );
  expect(() => importMenuCsv("bad,header\nx,y")).toThrow();
  expect(() =>
    importMenuCsv(exportMenuCsv([item]).replace("12.50", "-1")),
  ).toThrow();
});
it("contrôle dates de promotion et disponibilité", () => {
  const item = menuInput.parse({
    name: "Test",
    description: "",
    price: 1200,
    tags: [],
    specialDate: "2026-11-18",
    specialEndDate: "2026-11-20",
    featuredStart: "2026-11-18",
    featuredEnd: "2026-11-19",
  });
  expect(visibleMenuItem(item, "2026-11-18")).toBe(true);
  expect(visibleMenuItem(item, "2026-11-21")).toBe(false);
  expect(featuredMenuItem(item, "2026-11-19")).toBe(true);
  expect(featuredMenuItem(item, "2026-11-20")).toBe(false);
  expect(visibleMenuItem({ ...item, available: false }, "2026-11-18")).toBe(
    false,
  );
});
it("les fermetures exceptionnelles priment sur le planning hebdomadaire", () => {
  const v = {
    ...demoVenues[0],
    exceptions: [{ date: "2026-11-18", closed: true, open: null, close: null }],
  };
  expect(isOpen(v, new Date("2026-11-18T11:00:00Z"))).toBe(false);
  expect(
    isOpen(
      {
        ...v,
        exceptions: [
          { date: "2026-11-18", closed: false, open: "10:00", close: "15:00" },
        ],
      },
      new Date("2026-11-18T11:00:00Z"),
    ),
  ).toBe(true);
});
