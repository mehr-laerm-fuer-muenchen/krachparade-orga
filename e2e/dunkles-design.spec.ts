import { expect, test, type Page } from "@playwright/test";

// Spec 034: light or dark design under Einstellungen → Darstellung. The choice
// lives in localStorage of the test browser, nothing goes to the database.

async function devLogin(page: Page, name: string) {
  await page.goto("/dev/login");
  await page.getByRole("button", { name: new RegExp(`Als ${name} anmelden`) }).click();
  await expect(page).toHaveURL(/\/$/);
}

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

test.describe("Darstellung, Gerät hell", () => {
  test.use({ colorScheme: "light" });

  test("dunkel wählen, neu laden, zurück zum Gerät", async ({ page }) => {
    const errors = collectErrors(page);
    await devLogin(page, "Alex Rauch");
    await page.goto("/einstellungen");

    const html = page.locator("html");
    const section = page.getByRole("region", { name: "Darstellung" });
    const toggle = section.getByRole("switch", { name: "Dunkles Design" });

    await expect(toggle).toBeEnabled();
    await expect(toggle).toHaveAttribute("aria-checked", "false");
    await expect(html).toHaveAttribute("data-theme", "light");
    await expect(section.getByText("Folgt dem Gerät")).toBeVisible();

    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", "true");
    await expect(html).toHaveAttribute("data-theme", "dark");

    // Set by the inline script while parsing, before the page is interactive.
    await page.reload({ waitUntil: "commit" });
    await expect(html).toHaveAttribute("data-theme", "dark");
    await expect(toggle).toHaveAttribute("aria-checked", "true");

    // Stays on other pages too.
    await page.goto("/");
    await expect(html).toHaveAttribute("data-theme", "dark");
    await page.goto("/einstellungen");

    await section.getByRole("button", { name: "Wie das Gerät" }).click();
    await expect(html).toHaveAttribute("data-theme", "light");
    await expect(toggle).toHaveAttribute("aria-checked", "false");
    await expect(section.getByText("Folgt dem Gerät")).toBeVisible();

    expect(errors).toEqual([]);
  });
});

test.describe("Darstellung, Gerät dunkel", () => {
  test.use({ colorScheme: "dark" });

  test("folgt dem Gerät ohne eigene Wahl", async ({ page }) => {
    await devLogin(page, "Alex Rauch");
    await page.goto("/einstellungen");

    const section = page.getByRole("region", { name: "Darstellung" });
    const toggle = section.getByRole("switch", { name: "Dunkles Design" });
    await expect(toggle).toHaveAttribute("aria-checked", "true");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(section.getByText("Folgt dem Gerät")).toBeVisible();

    // Own choice "hell" wins over the dark device.
    await toggle.click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await section.getByRole("button", { name: "Wie das Gerät" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  });
});
