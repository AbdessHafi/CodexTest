import { test, expect } from "@playwright/test";
import { readdir, readFile } from "node:fs/promises";
import { sessionCookie, venueId } from "../fixtures/accounts";
import sharp from "sharp";
test("revendication, code, validation et gestion propriétaire sans accès à un autre lieu", async ({
  page,
  context,
}, info) => {
  test.setTimeout(60000);
  const project = info.project.name,
    id = `e2e-phase3-${project}`,
    email = `claimant-${project}@example.invalid`;
  await context.addCookies([sessionCookie(project, "consumer")]);
  await page.goto(`/lieux/${id}`);
  await page.getByRole("link", { name: "Revendiquer cette fiche" }).click();
  await page.getByLabel("E-mail professionnel", { exact: true }).fill(email);
  await page
    .getByLabel("Téléphone professionnel", { exact: true })
    .fill("0102030405");
  await page
    .getByLabel("SIRET de l’établissement", { exact: true })
    .fill(project === "mobile" ? "55210055400013" : "73282932000074");
  await page
    .getByLabel("Votre lien avec l’établissement")
    .fill(`Je suis le propriétaire du lieu pour le test ${project}.`);
  const png = await sharp({
    create: { width: 40, height: 40, channels: 3, background: "blue" },
  })
    .png()
    .toBuffer();
  await page
    .getByLabel("Justificatif de votre habilitation (facultatif)")
    .setInputFiles({ name: "preuve.png", mimeType: "image/png", buffer: png });
  const previousMail = new Set(await readdir(".local/mail").catch(() => []));
  await page.getByRole("button", { name: "Envoyer ma demande" }).click();
  await expect(
    page.getByRole("heading", { name: "Vérifier l’e-mail professionnel" }),
  ).toBeVisible();
  let code = "";
  await expect
    .poll(async () => {
      for (const name of await readdir(".local/mail")) {
        if (previousMail.has(name)) continue;
        const mail = JSON.parse(await readFile(`.local/mail/${name}`, "utf8"));
        if (mail.to === email && mail.text.match(/\b\d{6}\b/)) {
          code = mail.text.match(/\b\d{6}\b/)[0];
          return true;
        }
      }
      return false;
    })
    .toBe(true);
  await page.getByLabel("Code de vérification", { exact: true }).fill(code);
  await page.getByRole("button", { name: "Vérifier mon e-mail" }).click();
  await expect(page.getByRole("status")).toContainText("E-mail vérifié");
  await context.clearCookies();
  await context.addCookies([sessionCookie(project, "admin")]);
  await page.goto("/admin/revendications");
  const card = page
    .locator(".claim-card")
    .filter({ hasText: `Revendication ${project}` });
  await expect(card).toHaveCount(1);
  const proof = await card
    .getByRole("link", { name: "Consulter le justificatif privé" })
    .getAttribute("href");
  expect(proof).toContain("signature=");
  expect((await page.request.get(proof!)).status()).toBe(200);
  const anon = await context.browser()!.newContext();
  expect(
    (await anon.request.get(`http://127.0.0.1:3002${proof}`)).status(),
  ).toBe(401);
  await anon.close();
  await card
    .getByRole("combobox", { name: "Décision de revendication" })
    .selectOption("APPROVE");
  await card.getByLabel(/J’ai vérifié le SIRET/).check();
  await card.getByLabel(/J’ai vérifié l’habilitation/).check();
  await card
    .getByLabel("Motif de la décision")
    .fill("Registre et habilitation contrôlés pour ce test.");
  await card
    .getByRole("button", { name: "Enregistrer la revendication" })
    .click();
  await expect(card).toHaveCount(0);
  await context.clearCookies();
  await context.addCookies([sessionCookie(project, "consumer")]);
  await page.goto("/pro");
  await page
    .getByRole("link", { name: new RegExp(`Revendication ${project}`) })
    .click();
  await expect(
    page.getByRole("heading", { name: "Vos statistiques" }),
  ).toBeVisible();
  const menu = page.getByRole("form", {
    name: "Ajouter un produit",
    exact: true,
  });
  await page.getByText("Ajouter un produit", { exact: true }).click();
  await menu
    .getByLabel("Nom du produit", { exact: true })
    .fill(`Tartine ${project}`);
  await menu.getByLabel("Prix en euros").fill("12.90");
  await menu
    .getByLabel("Description du produit")
    .fill("Tartine maison de saison.");
  await menu.getByLabel("Allergènes (séparés par des virgules)").fill("gluten");
  await menu.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(menu.getByRole("status")).toContainText(
    "Modifications enregistrées",
  );
  const hours = page.getByRole("form", { name: "Modifier les horaires" });
  await hours.getByLabel("Lundi", { exact: true }).check();
  await hours.getByLabel("Ouverture Lundi", { exact: true }).fill("10:00");
  await hours.getByLabel("Fermeture Lundi", { exact: true }).fill("16:00");
  await hours.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(hours.getByRole("status")).toContainText(
    "Modifications enregistrées",
  );
  const photo = page.getByRole("form", { name: "Ajouter une photo" });
  await photo
    .getByLabel("Photo", { exact: true })
    .setInputFiles({ name: "salle.png", mimeType: "image/png", buffer: png });
  await photo.getByLabel("Légende de la photo").fill(`Salle ${project}`);
  await photo.getByRole("button", { name: "Publier la photo" }).click();
  await expect(photo.getByRole("status")).toContainText("Photo publiée");
  const cover = page.getByRole("form", { name: `Couverture Salle ${project}` });
  await cover.getByRole("button", { name: "Enregistrer" }).click();
  await expect(cover.getByRole("status")).toContainText(
    "Modifications enregistrées",
  );
  const csv = await page.request.get(`/api/owner/venues/${id}`);
  expect(csv.status()).toBe(200);
  expect(await csv.text()).toContain(`Tartine ${project}`);
  const forbidden = await page.request.post(
    `/api/owner/venues/${venueId(project)}`,
    {
      headers: { origin: "http://127.0.0.1:3002" },
      data: { action: "menu-delete", itemId: "inconnu" },
    },
  );
  expect(forbidden.status()).toBe(403);
  await page.goto(`/lieux/${id}`);
  await expect(
    page.getByText("Établissement vérifié", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Brunch" })).toHaveCount(0);
  await expect(
    page.getByText(`Tartine ${project}`, { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Allergènes : gluten", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("10:00 – 16:00", { exact: true })).toBeVisible();
  await expect(page.locator(".venue-cover")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
