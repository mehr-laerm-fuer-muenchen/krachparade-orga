import { expect, test, type Page } from "@playwright/test";

// Spec 003: app frame (navigation, header, tab bar) and settings (edition,
// people, departments). Runs on the shared dev database, so every check is
// relative and every change is undone at the end.

const PAGES = [
  { href: "/", nav: "Plan", tab: "Plan", h1: "Plan KP27" },
  { href: "/arbeitskreise", nav: "AKs", tab: "AKs", h1: "AKs" },
  { href: "/protokolle", nav: "Protokolle", tab: "Protokolle", h1: "Protokolle" },
  { href: "/meine", nav: "Meine Aufgaben", tab: "Meine", h1: "Meine Aufgaben" },
  { href: "/kollektive", nav: "Kollektive", tab: null, h1: "Kollektive" },
  { href: "/einstellungen", nav: "Einstellungen", tab: "Mehr", h1: "Einstellungen" },
];

function isNarrow(page: Page) {
  return (page.viewportSize()?.width ?? 0) <= 900;
}

async function devLogin(page: Page, name: string) {
  await page.goto("/dev/login");
  await page.getByRole("button", { name: new RegExp(`Als ${name} anmelden`) }).click();
  await expect(page).toHaveURL(/\/$/);
}

/**
 * Waits until a page is finished: its heading is visible and no visible
 * "Lade …" placeholder is left (pages kept hidden by the router do not count).
 *
 * Why: Next.js 16 with cacheComponents keeps the last pages in hidden React
 * <Activity> boundaries and drops the oldest. If a page is left while its data
 * is still streaming and is dropped before the data arrives, React throws
 * "Cannot read properties of null (reading '_retryCache')" (a gap in React,
 * still present in the React shipped with Next.js 16.4/16.5 canary). That only
 * happens when clicking on faster than the data loads, e.g. in a deployed
 * preview with ~150 ms server latency. The check for console errors below
 * stays as strict as before.
 */
async function expectPageReady(page: Page, h1: string) {
  await expect(page.getByRole("heading", { level: 1, name: h1 })).toBeVisible();
  await expect(page.getByText(/^Lade .+ …$/).filter({ visible: true })).toHaveCount(0);
}

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow, "Seite scrollt horizontal").toBeLessThanOrEqual(0);
}

/** "noch 206 T" → 206, "heute!" → 0, "vorbei" → null. */
async function daysToGo(page: Page): Promise<number | null> {
  const label = (await page.getByTestId("dday-label").textContent())?.trim() ?? "";
  if (label === "heute!") return 0;
  if (label === "vorbei") return null;
  const match = /^noch (\d+)\sT$/.exec(label);
  expect(match, `Countdown unerwartet: "${label}"`).not.toBeNull();
  return Number(match![1]);
}

/** The header countdown for `days` days to go (inverse of daysToGo). */
function countdownText(days: number): RegExp | string {
  return days > 0 ? new RegExp(`^noch ${days}\\sT$`) : days === 0 ? "heute!" : "vorbei";
}

async function setDDay(page: Page, value: string) {
  await page.getByLabel("Datum der Krachparade", { exact: true }).fill(value);
  await page.getByRole("button", { name: "Speichern" }).click();
  await expect(page.getByText("Datum der Krachparade gespeichert.")).toBeVisible();
}

function personRow(page: Page, name: string) {
  return page.getByRole("list", { name: "Personen" }).getByRole("listitem", { name, exact: true });
}

test.describe("App-Rahmen", () => {
  // Locally the Next.js dev tools button covers the first tab on phones.
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const style = document.createElement("style");
      style.textContent = "nextjs-portal { display: none !important; }";
      document.addEventListener("DOMContentLoaded", () => document.head.append(style));
    });
  });

  test("Navigation, Logo, Tab-Leiste und Abmelden", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));

    await devLogin(page, "Kim Brenner");
    await expect(page.getByRole("banner").getByRole("img", { name: "Mehr Lärm für München" })).toBeVisible();

    const headerNav = page.getByRole("navigation", { name: "Hauptnavigation" });
    const tabBar = page.getByRole("navigation", { name: "Navigation", exact: true });
    if (isNarrow(page)) {
      await expect(tabBar).toBeVisible();
      await expect(headerNav).toBeHidden();
    } else {
      await expect(headerNav).toBeVisible();
      await expect(tabBar).toBeHidden();
    }

    for (const target of PAGES) {
      if (!isNarrow(page)) {
        await headerNav.getByRole("link", { name: target.nav }).click();
      } else if (target.tab) {
        await tabBar.getByRole("link", { name: target.tab, exact: true }).click();
      } else {
        // Kollektive sits under "Mehr" on narrow screens.
        await tabBar.getByRole("link", { name: "Mehr", exact: true }).click();
        await expectPageReady(page, "Einstellungen");
        await page.getByRole("main").getByRole("link", { name: /Kollektive/ }).click();
      }
      await expect(page).toHaveURL(new RegExp(`${target.href === "/" ? "/" : target.href}$`));
      await expectPageReady(page, target.h1);
      await expectNoHorizontalScroll(page);
    }

    if (isNarrow(page)) {
      await tabBar.getByRole("link", { name: "Mehr", exact: true }).click();
      await expectPageReady(page, "Einstellungen");
    }
    await page.getByRole("button", { name: "Abmelden" }).filter({ visible: true }).click();
    await expect(page).toHaveURL(/\/login$/);
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("Datum der Krachparade ändern zeigt den neuen Abstand in der Kopfleiste", async ({ page }) => {
    await devLogin(page, "Kim Brenner");
    await page.goto("/einstellungen");
    await expect(page.getByLabel("Datum der Krachparade", { exact: true })).toHaveValue("2027-05-08");
    const before = await daysToGo(page);
    test.skip(before === null, "braucht eine Krachparade, die noch nicht vorbei ist");

    await setDDay(page, "2027-05-15");
    await expect(page.getByTestId("dday-label")).toHaveText(countdownText(before! + 7));
    await expect(page.getByRole("banner").getByText("Krachparade 15.05.2027")).toBeVisible();

    await setDDay(page, "2027-05-08");
    await expect(page.getByTestId("dday-label")).toHaveText(countdownText(before!));
  });

  test("Person einladen und deaktivieren, eigene Zeile gesperrt", async ({ page }) => {
    await devLogin(page, "Kim Brenner");
    await page.goto("/einstellungen");

    const own = personRow(page, "Kim Brenner");
    await expect(own.getByRole("button", { name: "Deaktivieren" })).toBeDisabled();
    await expect(own.getByRole("button", { name: "Admin nehmen" })).toBeDisabled();

    // "Test Person" stays in dev as deactivated (there is no delete), so a
    // later run sees the refusal for the address instead of the invitation.
    const existed = (await personRow(page, "Test Person").count()) > 0;
    const invite = page.getByRole("form", { name: "Person einladen" });
    await invite.getByLabel("Name").fill("Test Person");
    await invite.getByLabel("E-Mail").fill("  Test.Person@example.org ");
    await invite.getByRole("button", { name: "Einladen" }).click();
    if (existed) {
      await expect(invite.getByText("Diese Adresse ist schon eingeladen.")).toBeVisible();
    } else {
      await expect(invite.getByText(/^Eingeladen\. .*Testnutzer eintragen/)).toBeVisible();
    }

    const row = personRow(page, "Test Person");
    await expect(row).toBeVisible();
    await expect(row.getByText("test.person@example.org")).toBeVisible();
    const deactivate = row.getByRole("button", { name: "Deaktivieren" });
    if (await deactivate.count()) {
      await deactivate.click();
    }
    await expect(row.getByText("deaktiviert", { exact: true })).toBeVisible();
    await expect(row.getByRole("button", { name: "Wieder aktivieren" })).toBeEnabled();
    await expectNoHorizontalScroll(page);
  });

  test("Nicht-Admin kann Datum der Krachparade und Einladungen nicht ändern", async ({ page }) => {
    await devLogin(page, "Alex Rauch");
    await page.goto("/einstellungen");

    await expect(page.getByLabel("Datum der Krachparade", { exact: true })).toBeDisabled();
    await expect(page.getByRole("form", { name: "Person einladen" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Einladen" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Deaktivieren" })).toHaveCount(0);
    await expect(page.getByLabel("Leitung Route", { exact: true })).toHaveCount(0);
    // E-mail addresses are for admins only.
    await expect(page.getByText("@example.org")).toHaveCount(0);
    await expectNoHorizontalScroll(page);
  });
});
