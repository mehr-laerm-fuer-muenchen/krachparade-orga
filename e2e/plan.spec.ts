import { expect, test, type Page } from "@playwright/test";

// Spec 006: read-only preview of the plan engine on the start page. Needs the
// dev seed (example plan, D-Day 08.05.2027); checks go by element name and
// read nothing else. Nothing is created, so nothing has to be cleaned up.

async function devLogin(page: Page, name: string) {
  await page.goto("/dev/login");
  await page.getByRole("button", { name: new RegExp(`Als ${name} anmelden`) }).click();
  await expect(page).toHaveURL(/\/$/);
}

async function openPlan(page: Page) {
  await expect(page.getByRole("heading", { level: 1, name: /^Plan / })).toBeVisible();
  await expect(page.getByText("Lade Plan …").filter({ visible: true })).toHaveCount(0);
}

function elementRow(page: Page, name: string) {
  return page.getByRole("row").filter({ has: page.getByRole("rowheader", { name: new RegExp(`^${name}`) }) });
}

test.describe("Plan-Vorschau", () => {
  test.beforeEach(async ({ page }) => {
    await devLogin(page, "Kim Brenner");
    await openPlan(page);
  });

  test("zeigt Fixtermin mit Verzug", async ({ page }) => {
    const row = elementRow(page, "Kooperationsgespräch KVR/Polizei");
    await expect(row).toHaveCount(1);
    await expect(row.getByText("Fix", { exact: true })).toBeVisible();
    await expect(row.getByRole("cell", { name: "−2 T", exact: true })).toBeVisible();
    await expect(row.getByText("Verzug", { exact: true })).toBeVisible();
  });

  test("zeigt rückwärts gerechnete Termine und Puffer", async ({ page }) => {
    const signup = elementRow(page, "Voranmeldung geöffnet");
    await expect(signup).toContainText("21.12.2026");
    await expect(signup).toContainText("D-138");

    const commitment = elementRow(page, "Finale Zusage an Kollektive");
    await expect(commitment).toContainText("17.02.2027");
    await expect(commitment).toContainText("D-80");

    const social = elementRow(page, "Social-Media-Plan");
    await expect(social.getByRole("cell", { name: "+10 T", exact: true })).toBeVisible();
  });

  test("Kopfzeile nennt Verzug und den kritischen Pfad", async ({ page }) => {
    // At least the fixed date "Kooperationsgespräch KVR/Polizei" is late.
    await expect(page.getByText(/ · [1-9]\d* in Verzug · /)).toBeVisible();
    await expect(page.getByText(/Kritischer Pfad: \d+ Elemente, Start spätestens \S+ \d{2}\.\d{2}\. \(D-150\)/)).toBeVisible();
  });

  test("Seite scrollt nicht waagrecht", async ({ page }) => {
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow, "Seite scrollt horizontal").toBeLessThanOrEqual(0);
  });
});
