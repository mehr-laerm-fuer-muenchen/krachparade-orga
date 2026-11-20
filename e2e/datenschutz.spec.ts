import { expect, test, type Page } from "@playwright/test";

// Spec 035: the privacy policy is reachable without a session and linked
// from /login.

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow, "Seite scrollt horizontal").toBeLessThanOrEqual(0);
}

test.describe("Datenschutz", () => {
  test("ohne Anmeldung erreichbar, auch auf dem Handy", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/datenschutz");
    await expect(page).toHaveURL(/\/datenschutz$/);
    await expect(page.getByRole("heading", { level: 1, name: "Datenschutzerklärung" })).toBeVisible();
    await expect(page.getByText("Initiative MEHR LÄRM FÜR MÜNCHEN")).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Deine Rechte" })).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test("von /login aus verlinkt", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("link", { name: "Datenschutzerklärung" }).click();
    await expect(page).toHaveURL(/\/datenschutz$/);
    await expect(page.getByRole("heading", { level: 1, name: "Datenschutzerklärung" })).toBeVisible();
  });
});
