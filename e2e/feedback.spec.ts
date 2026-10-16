import { expect, test, type Page } from "@playwright/test";

// Spec 014: bug button and feedback dialog (part A). Reports are named
// "E2E Feedback ‹project› ‹time›" and unique per run; the app cannot delete
// feedback, `pnpm db:seed` removes them. Seed plan elements are only opened,
// never moved or ticked. Needs the dev seed (Alex Rauch, seed element
// "Kooperationsgespräch KVR/Polizei" under "Überfällig & Verzug").

const ELEMENT = "Kooperationsgespräch KVR/Polizei";

function isNarrow(page: Page) {
  return (page.viewportSize()?.width ?? 0) <= 900;
}

async function devLogin(page: Page, name: string) {
  await page.goto("/dev/login");
  await page.getByRole("button", { name: new RegExp(`Als ${name} anmelden`) }).click();
  await expect(page).toHaveURL(/\/$/);
}

/** Same check as in rahmen.spec.ts: heading there, no visible "Lade … …" left. */
async function expectPageReady(page: Page, h1: string | RegExp) {
  await expect(page.getByRole("heading", { level: 1, name: h1 })).toBeVisible();
  await expect(page.getByText(/^Lade .+ …$/).filter({ visible: true })).toHaveCount(0);
}

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow, "Seite scrollt horizontal").toBeLessThanOrEqual(0);
}

function escape(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function bugButton(page: Page) {
  return page.getByRole("banner").getByRole("button", { name: /^Feedback geben/ });
}

function dialog(page: Page) {
  return page.getByRole("dialog", { name: "Feedback geben" });
}

function details(page: Page) {
  return page.getByRole("complementary", { name: "Details" });
}

/**
 * Opens the dialog. Retries, since a click right after loading can come
 * before the page is hydrated.
 */
async function openDialog(page: Page) {
  await expect(async () => {
    if (!(await dialog(page).isVisible())) await bugButton(page).click();
    await expect(dialog(page)).toBeVisible({ timeout: 1000 });
  }).toPass();
}

/** Marks the current document; gone after a reload or a full navigation. */
async function markDocument(page: Page) {
  await page.evaluate(() => {
    (window as unknown as { e2eMarker?: boolean }).e2eMarker = true;
  });
}

async function expectSameDocument(page: Page) {
  expect(await page.evaluate(() => (window as unknown as { e2eMarker?: boolean }).e2eMarker)).toBe(true);
}

test.describe("Feedback", () => {
  let errors: string[];

  test.beforeEach(async ({ page }) => {
    errors = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));
    // Locally the Next.js dev tools button covers the first tab on phones.
    await page.addInitScript(() => {
      const style = document.createElement("style");
      style.textContent = "nextjs-portal { display: none !important; }";
      document.addEventListener("DOMContentLoaded", () => document.head.append(style));
    });
    await devLogin(page, "Alex Rauch");
  });

  test.afterEach(() => {
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("Wunsch auf /meine absenden, Seite bleibt unverändert", async ({ page }, testInfo) => {
    await page.goto("/meine");
    await expectPageReady(page, "Meine Aufgaben");
    await expect(bugButton(page)).toBeVisible();
    await expectNoHorizontalScroll(page);
    const title = await page.title();
    await markDocument(page);

    await openDialog(page);
    const form = dialog(page);
    await expect(form.getByText(/^Seite, Zeitpunkt, Gerät und dein Name werden mitgeschickt\./)).toBeVisible();
    await expect(form.getByText(/^Bezieht sich auf:/)).toHaveCount(0);
    await form.getByRole("button", { name: "Wunsch" }).click();
    await expect(form.getByRole("button", { name: "Wunsch" })).toHaveAttribute("aria-pressed", "true");
    await expect(form.getByRole("button", { name: "Fehler" })).toHaveAttribute("aria-pressed", "false");
    await form.getByLabel("Beschreibung").fill(`E2E Feedback ${testInfo.project.name} ${Date.now()}`);
    await form.getByRole("button", { name: "Absenden" }).click();
    await expect(form.getByText("Danke! Deine Meldung ist gespeichert.")).toBeVisible();
    await expect(form.getByRole("link", { name: "Alle Meldungen" })).toHaveAttribute("href", "/feedback");
    await form.getByRole("button", { name: "Schließen" }).click();
    await expect(dialog(page)).toBeHidden();
    await expect(bugButton(page)).toBeFocused();

    await expect(page).toHaveURL(/\/meine$/);
    expect(await page.title()).toBe(title);
    await expectPageReady(page, "Meine Aufgaben");
    await expectSameDocument(page);

    // Opened again, the form is empty.
    await openDialog(page);
    await expect(dialog(page).getByLabel("Beschreibung")).toHaveValue("");
    await expect(dialog(page).getByRole("button", { name: "Wunsch" })).toHaveAttribute("aria-pressed", "false");
    await dialog(page).getByRole("button", { name: "Abbrechen" }).click();
    await expect(dialog(page)).toBeHidden();
  });

  test("Ohne Art und Text: Fehlermeldungen, Abbrechen schließt", async ({ page }) => {
    await page.goto("/meine");
    await expectPageReady(page, "Meine Aufgaben");

    await openDialog(page);
    const form = dialog(page);
    await form.getByRole("button", { name: "Absenden" }).click();
    await expect(form.getByText("Bitte Fehler oder Wunsch wählen.")).toBeVisible();
    await expect(form.getByText("Bitte kurz beschreiben.")).toBeVisible();
    await expect(form).toBeVisible();

    await form.getByRole("button", { name: "Abbrechen" }).click();
    await expect(dialog(page)).toBeHidden();
    await expect(bugButton(page)).toBeFocused();
  });

  test("Offenes Plan-Element wird mitgeschickt, Panel bleibt offen", async ({ page }, testInfo) => {
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();
    await expectPageReady(page, "Plan KP27");

    // Only open the seed element, never move or tick it.
    if (isNarrow(page)) {
      await page.getByRole("region", { name: "Überfällig & Verzug" }).getByText(ELEMENT, { exact: true }).click();
    } else {
      await page
        .getByRole("button", { name: new RegExp(`^${escape(ELEMENT)}`) })
        .filter({ visible: true })
        .click();
    }
    const panel = details(page);
    await expect(panel.getByRole("heading", { name: ELEMENT })).toBeVisible();
    await markDocument(page);

    await openDialog(page);
    const form = dialog(page);
    await expect(form.getByText(`Bezieht sich auf: ${ELEMENT}`)).toBeVisible();
    await form.getByRole("button", { name: "Fehler" }).click();
    await form.getByLabel("Beschreibung").fill(`E2E Feedback ${testInfo.project.name} Plan ${Date.now()}`);
    await form.getByRole("button", { name: "Absenden" }).click();
    await expect(form.getByText("Danke! Deine Meldung ist gespeichert.")).toBeVisible();

    // Escape closes the dialog only, not the panel behind it.
    await page.keyboard.press("Escape");
    await expect(dialog(page)).toBeHidden();
    await expect(panel.getByRole("heading", { name: ELEMENT })).toBeVisible();
    await expectSameDocument(page);
    await expectNoHorizontalScroll(page);
  });

  test("Kein Käfer auf /login", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/login");
    await expect(page.getByRole("button", { name: /^Feedback geben/ })).toHaveCount(0);
  });
});
