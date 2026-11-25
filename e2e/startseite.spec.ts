import { expect, test, type Page } from "@playwright/test";

// Spec 036: without a session "/" shows the public start page (no redirect),
// which explains what the app is for and links to login and privacy policy.

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow, "Seite scrollt horizontal").toBeLessThanOrEqual(0);
}

test.describe("Startseite", () => {
  test("ohne Anmeldung zeigt / die Startseite, auch auf dem Handy", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    const response = await page.goto("/");
    expect(response?.status()).toBe(200);
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { level: 1, name: "Krachparade Orga" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Wofür die App da ist" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Anmeldung mit Google" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Datenschutzerklärung" })).toHaveAttribute("href", "/datenschutz");
    await expect(page.getByRole("link", { name: "Impressum" })).toHaveAttribute("href", "https://krachparade.de");
    await expectNoHorizontalScroll(page);
  });

  test("Anmelden führt zu /login", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Anmelden", exact: true }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("button", { name: "Mit Google anmelden" })).toBeVisible();
  });
});
