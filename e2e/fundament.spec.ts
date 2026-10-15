import { expect, test } from "@playwright/test";

// Spec 001: the start page and the dev login page load. That /dev/** is 404
// in production is covered by the unit tests of isDevLoginEnabled in
// src/lib/dev-login.test.ts.

test.describe("Fundament", () => {
  test("Startseite zeigt Krachparade Orga", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));

    // Since spec 002 the start page needs a session.
    await page.goto("/dev/login");
    await page.getByRole("button", { name: /Als Kim Brenner anmelden/ }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page).toHaveTitle(/Krachparade Orga/);
    // Since spec 006 the start page is the plan preview; the app name sits in the header.
    await expect(page.getByRole("heading", { level: 1, name: "Plan KP27" })).toBeVisible();
    await expect(page.getByRole("banner").getByText("Krachparade Orga")).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow, "Startseite scrollt horizontal").toBeLessThanOrEqual(0);
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("Dev-Login-Seite lädt", async ({ page }) => {
    const response = await page.goto("/dev/login");
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1, name: "Dev-Login" })).toBeVisible();
  });
});
