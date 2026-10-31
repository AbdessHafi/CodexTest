import { test, expect } from "@playwright/test";
import sharp from "sharp";
import { sessionCookie, venueId } from "../fixtures/accounts";
test("avis avec photo, publication, réponse propriétaire, signalement et retrait audité", async ({
  page,
  context,
}, info) => {
  const project = info.project.name;
  const venue = venueId(project);
  const reviewText = `Un brunch de test ${project} avec un excellent accueil et un bon café.`;
  await context.addCookies([sessionCookie(project, "consumer")]);
  await page.goto(`/lieux/${venue}`);
  await page.getByText("Partager ma visite", { exact: true }).click();
  for (const label of [
    "Café",
    "Cuisine",
    "Service",
    "Ambiance",
    "Rapport qualité-prix",
  ])
    await page
      .getByRole("combobox", { name: label, exact: true })
      .selectOption("4");
  await page.getByLabel("Date de visite", { exact: true }).fill("2026-01-01");
  await page.getByLabel("Votre avis", { exact: true }).fill(reviewText);
  const image = await sharp({
    create: { width: 50, height: 50, channels: 3, background: "green" },
  })
    .png()
    .toBuffer();
  await page
    .getByLabel(/Photos de votre visite/)
    .setInputFiles({ name: "photo.png", mimeType: "image/png", buffer: image });
  await page
    .getByRole("button", { name: "Envoyer mon avis", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "en attente de modération",
  );
  await expect(page.locator(".review-card")).toHaveCount(0);
  const denied = await page.request.post("/api/admin/reviews/fake", {
    headers: { origin: "http://127.0.0.1:3002" },
    data: { action: "PUBLISH", reason: "Tentative non autorisée" },
  });
  expect(denied.status()).toBe(403);
  await context.clearCookies();
  await context.addCookies([sessionCookie(project, "admin")]);
  await page.goto("/admin/moderation");
  const card = page.locator(".review-card").filter({ hasText: reviewText });
  await expect(card).toHaveCount(1);
  await expect(card.locator("img")).toBeVisible();
  await expect
    .poll(() =>
      card.locator("img").evaluate((img: HTMLImageElement) => img.naturalWidth),
    )
    .toBeGreaterThan(0);
  const imageUrl = await card.locator("img").getAttribute("src");
  // Pending photo remains inaccessible to a public visitor.
  const anon = await context.browser()!.newContext();
  expect(
    (await anon.request.get(`http://127.0.0.1:3002${imageUrl}`)).status(),
  ).toBe(401);
  await anon.close();
  await card
    .getByLabel("Motif conservé dans le journal")
    .fill("Contenu conforme après vérification.");
  await card.getByRole("button", { name: "Enregistrer la décision" }).click();
  await expect(
    page.locator(".review-card").filter({ hasText: reviewText }),
  ).toHaveCount(0);
  await context.clearCookies();
  await context.addCookies([sessionCookie(project, "owner")]);
  await page.goto(`/lieux/${venue}`);
  await expect(
    page.getByText("4.0 / 5", { exact: false }).first(),
  ).toBeVisible();
  await expect(
    page.getByText("Visite non vérifiée", { exact: true }),
  ).toBeVisible();
  expect(
    JSON.parse(
      (await page.locator('script[type="application/ld+json"]').textContent())!,
    ).aggregateRating.reviewCount,
  ).toBe(1);
  await page
    .getByText("Répondre en tant que propriétaire", { exact: true })
    .click();
  await page
    .getByLabel("Réponse publique")
    .fill("Merci pour votre visite et votre retour.");
  await page.getByRole("button", { name: "Publier la réponse" }).click();
  await expect(
    page.getByText("Merci pour votre visite et votre retour.", { exact: true }),
  ).toBeVisible();
  await context.clearCookies();
  await context.addCookies([sessionCookie(project, "reporter")]);
  await page.goto(`/lieux/${venue}`);
  await page.getByText("Signaler cet avis", { exact: true }).click();
  await page
    .getByLabel("Motif du signalement")
    .fill("La photo contient une information à vérifier.");
  await page.getByRole("button", { name: "Envoyer le signalement" }).click();
  await expect(page.getByRole("status")).toContainText("Signalement transmis");
  await context.clearCookies();
  await context.addCookies([sessionCookie(project, "admin")]);
  await page.goto("/admin/moderation");
  const flagged = page.locator(".review-card").filter({ hasText: reviewText });
  await flagged
    .getByRole("combobox", { name: "Décision", exact: true })
    .selectOption("REJECT");
  await flagged
    .getByLabel("Motif conservé dans le journal")
    .fill("Retrait pour vérifier une donnée personnelle.");
  await flagged
    .getByRole("button", { name: "Enregistrer la décision" })
    .click();
  await expect(
    page.getByText("REVIEW_REJECT", { exact: false }).first(),
  ).toBeVisible();
  await context.clearCookies();
  await page.goto(`/lieux/${venue}`);
  await expect(page.locator(".review-card")).toHaveCount(0);
  expect(
    (await page.request.get(`http://127.0.0.1:3002${imageUrl}`)).status(),
  ).toBe(401);
});
test("rejette anonyme, e-mail non vérifié, origine étrangère et modification", async ({
  request,
  context,
  page,
}, info) => {
  const headers = { origin: "http://127.0.0.1:3002" };
  expect(
    (
      await request.post("/api/reviews", {
        headers,
        multipart: { payload: "{}" },
      })
    ).status(),
  ).toBe(401);
  await context.addCookies([sessionCookie(info.project.name, "unverified")]);
  expect(
    (
      await page.request.post("/api/reviews", {
        headers,
        multipart: { payload: "{}" },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await page.request.post("/api/reviews", {
        headers: { origin: "https://evil.invalid" },
        multipart: { payload: "{}" },
      })
    ).status(),
  ).toBe(403);
  expect((await page.request.delete("/api/reviews/id")).status()).toBe(404);
});
