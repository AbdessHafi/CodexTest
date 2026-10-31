import { test, expect } from "@playwright/test";
test("recherche, filtre, fiche serveur et retour", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Votre prochaine/ }),
  ).toBeVisible();
  await expect(page.getByText("50 adresses", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Lyon", exact: true }).click();
  await expect(page.getByText("10 adresses", { exact: true })).toBeVisible();
  await page.getByLabel("Type d’établissement").selectOption("Brunch");
  await expect(page.getByText("3 adresses", { exact: true })).toBeVisible();
  await page.locator(".venue-card").first().click();
  await expect(page.getByRole("heading", { name: "À la carte" })).toBeVisible();
  await expect(page.getByText(/Aucun créneau n’est réservable/)).toBeVisible();
});
test("connexion non configurée et adresse absente", async ({ page }) => {
  await page.goto("/connexion");
  await expect(
    page.getByRole("button", { name: "Recevoir un lien de connexion" }),
  ).toBeDisabled();
  const response = await page.goto("/lieux/introuvable");
  expect(response?.status()).toBe(404);
  await expect(
    page.getByRole("heading", { name: "Cette adresse nous échappe." }),
  ).toBeVisible();
});
test("la carte peut être ouverte et refermée sans dépendre des tuiles", async ({
  page,
}) => {
  await page.route("https://tile.openstreetmap.org/**", (route) =>
    route.abort(),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Voir la carte" }).click();
  await expect(
    page.getByRole("region", { name: "Carte des établissements" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Voir la liste" }).click();
  await expect(page.locator(".venue-card")).toHaveCount(50);
});
