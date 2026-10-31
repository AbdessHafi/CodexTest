import { describe, it, expect } from "vitest";
import { demoVenues, cityNames } from "../src/lib/demo";
import { filterVenues, isOpen, distance } from "../src/lib/search";
import { allow } from "../src/lib/rate-limit";
describe("Catalogue de démonstration", () => {
  it("contient 50 lieux uniques, dix dans chacune des cinq villes", () => {
    expect(demoVenues).toHaveLength(50);
    expect(new Set(demoVenues.map((v) => v.slug)).size).toBe(50);
    for (const city of cityNames)
      expect(demoVenues.filter((v) => v.city === city)).toHaveLength(10);
  });
  it("recherche sans accents par nom, ville et quartier", () => {
    expect(filterVenues(demoVenues, { q: "republique" })).toHaveLength(2);
    expect(filterVenues(demoVenues, { q: "LYON" })).toHaveLength(10);
    expect(filterVenues(demoVenues, { q: "aube" })).toHaveLength(5);
  });
  it("combine budget, type et tags sans élargir les résultats", () => {
    const result = filterVenues(demoVenues, {
      type: "Coffee shop",
      price: 2,
      tags: ["Végétarien"],
    });
    expect(result.length).toBeGreaterThan(0);
    expect(
      result.every(
        (v) =>
          v.type === "Coffee shop" &&
          v.price <= 2 &&
          v.tags.includes("Végétarien"),
      ),
    ).toBe(true);
  });
  it("calcule l’ouverture en heure de Paris, été comme hiver, borne de fermeture exclusive", () => {
    const v = demoVenues[0];
    expect(isOpen(v, new Date("2026-07-06T06:30:00Z"))).toBe(true);
    expect(isOpen(v, new Date("2026-01-05T07:30:00Z"))).toBe(true);
    expect(isOpen(v, new Date("2026-01-05T17:00:00Z"))).toBe(false);
  });
  it("calcule la proximité et sépare les villes", () => {
    const p = demoVenues[0];
    expect(distance({ lat: p.latitude, lng: p.longitude }, p)).toBe(0);
    expect(
      distance({ lat: 48.8566, lng: 2.3522 }, demoVenues[10]),
    ).toBeGreaterThan(300);
  });
  it("renvoie une liste vide sans correspondance", () =>
    expect(filterVenues(demoVenues, { q: "inexistant" })).toEqual([]));
});
it("limite les tentatives et réouvre la fenêtre après expiration", () => {
  for (let i = 0; i < 5; i++) expect(allow("test", 100)).toBe(true);
  expect(allow("test", 101)).toBe(false);
  expect(allow("test", 900101)).toBe(true);
});
