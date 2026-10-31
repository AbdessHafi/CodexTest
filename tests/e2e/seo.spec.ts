import { test, expect } from "@playwright/test";
test("pages ville et quartier rendues sans JavaScript, canonique et JSON-LD", async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:3000/villes/paris");
  await expect(
    page.getByRole("heading", {
      name: "Meilleurs cafés et brunchs à Paris",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    /\/villes\/paris$/,
  );
  await page.getByRole("link", { name: "Bastille", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Meilleurs brunchs à Bastille, Paris",
      exact: true,
    }),
  ).toBeVisible();
  expect(
    JSON.parse(
      (await page.locator('script[type="application/ld+json"]').textContent())!,
    )["@type"],
  ).toBe("ItemList");
  await page.goto("http://127.0.0.1:3000/lieux/paris-1");
  const venueJson = JSON.parse(
    (await page.locator('script[type="application/ld+json"]').textContent())!,
  );
  expect(venueJson["@type"]).toBe("CafeOrCoffeeShop");
  expect(venueJson).not.toHaveProperty("aggregateRating");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    /noindex/,
  );
  await context.close();
});
test("sitemap sans lieux fictifs, robots et politique de collecte", async ({
  page,
  request,
}) => {
  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.status()).toBe(200);
  expect(await sitemap.text()).not.toContain("/lieux/paris-1");
  expect(await sitemap.text()).toContain("/avis-et-moderation");
  const robots = await request.get("/robots.txt");
  expect(await robots.text()).toContain("Disallow: /admin/");
  expect(await robots.text()).toContain("sitemap.xml");
  await page.goto("/avis-et-moderation");
  await expect(
    page.getByRole("heading", { name: "Collecte et vérification" }),
  ).toBeVisible();
  expect((await page.goto("/villes/inconnue"))?.status()).toBe(404);
});
