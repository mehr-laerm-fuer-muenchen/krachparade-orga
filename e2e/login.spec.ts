import { expect, test, type Page } from "@playwright/test";

// Spec 002: without a session every page leads to /login; the dev login
// signs in the seeded admin "Kim Brenner"; logging out leads back to /login.
// Google itself is not clicked through (needs a real account).

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow, "Seite scrollt horizontal").toBeLessThanOrEqual(0);
}

test.describe("Login", () => {
  test("ohne Anmeldung landet jede Seite auf /login", async ({ page }) => {
    for (const path of ["/", "/irgendeine-seite", "/api/irgendwas"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login$/);
    }

    await expect(page.getByRole("heading", { level: 1, name: "Krachparade Orga" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Mit Google anmelden" })).toBeVisible();
    await expect(page.getByText("Dein Passwort sehen wir nie.", { exact: false })).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test("abgelehntes Konto sieht die Absage auf /login", async ({ page }) => {
    await page.goto("/login?error=AccessDenied");
    await expect(
      page.getByText(
        "Dieses Google-Konto ist nicht für die Krachparade Orga freigeschaltet. Melde dich bei einem Admin."
      )
    ).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test("Dev-Login, Startseite mit Namen, Abmelden", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));

    await page.goto("/dev/login");
    await page.getByRole("button", { name: /Als Kim Brenner anmelden/ }).click();

    await expect(page).toHaveURL(/\/$/);
    // Since spec 003: name and "Abmelden" sit in the header on wide screens
    // and under "Mehr" in the tab bar on narrow screens.
    if ((page.viewportSize()?.width ?? 0) <= 900) {
      await page.getByRole("link", { name: "Mehr", exact: true }).click();
      await expect(page).toHaveURL(/\/einstellungen$/);
    }
    await expect(
      page.getByText("Angemeldet als Kim Brenner").filter({ visible: true })
    ).toBeVisible();
    await expectNoHorizontalScroll(page);

    const logout = page.getByRole("button", { name: "Abmelden" });
    const box = await logout.boundingBox();
    expect(box?.height ?? 0, "Abmelden ist zu klein zum Tippen").toBeGreaterThanOrEqual(44);
    await logout.click();

    await expect(page).toHaveURL(/\/login$/);
    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
    expect(errors, errors.join("\n")).toEqual([]);
  });
});
