import { expect, test, type Browser, type Page } from "@playwright/test";

// Spec 031: public registration of the collectives and their evaluation.
// The admin (seed "Kim Brenner") opens the registration window, a visitor
// without login registers "E2E Testkollektiv …", the admin sets the status,
// deletes the registration and restores the former window. Only made-up data.

function isNarrow(page: Page) {
  return (page.viewportSize()?.width ?? 0) <= 900;
}

async function devLogin(page: Page, name: string) {
  await page.goto("/dev/login");
  await page.getByRole("button", { name: new RegExp(`Als ${name} anmelden`) }).click();
  await expect(page).toHaveURL(/\/$/);
}

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow, "Seite scrollt horizontal").toBeLessThanOrEqual(0);
}

/** "YYYY-MM-DD" in Europe/Berlin, `offset` days from today. */
function berlinDay(offset: number): string {
  const moment = new Date(Date.now() + offset * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(moment);
}

async function setWindow(page: Page, opensOn: string, closesOn: string) {
  await page.goto("/kollektive");
  const form = page.getByRole("form", { name: "Zeitfenster der Anmeldung" });
  if (opensOn === "" && closesOn === "") {
    await form.getByRole("button", { name: "Anmeldung schließen" }).click();
  } else {
    await form.getByLabel("Offen ab").fill(opensOn);
    await form.getByLabel("Offen bis").fill(closesOn);
    await form.getByRole("button", { name: "Zeitfenster speichern" }).click();
  }
  await expect(form.getByRole("status")).toHaveText("Gespeichert.");
}

/** A visitor without a session, same viewport as the project. */
async function visitor(browser: Browser, page: Page) {
  const context = await browser.newContext({
    viewport: page.viewportSize() ?? undefined,
    hasTouch: isNarrow(page),
    isMobile: isNarrow(page),
    locale: "de-DE",
    timezoneId: "Europe/Berlin",
    reducedMotion: "reduce",
  });
  return { context, page: await context.newPage() };
}

function field(page: Page, name: string) {
  return page.locator(`#f-${name.replace(/\./g, "-")}`);
}

function choose(page: Page, name: string, option: string | RegExp) {
  return field(page, name)
    .getByRole("radio", { name: option, exact: typeof option === "string" })
    .check();
}

test.describe("Kollektiv-Anmeldung", () => {
  test("ohne Login anmelden, Orga sieht, sagt zu und löscht", async ({ page, browser }, testInfo) => {
    const name = `E2E Testkollektiv ${testInfo.project.name} ${Date.now()}`;

    await devLogin(page, "Kim Brenner");
    await page.goto("/kollektive");
    const windowForm = page.getByRole("form", { name: "Zeitfenster der Anmeldung" });
    const formerOpens = await windowForm.getByLabel("Offen ab").inputValue();
    const formerCloses = await windowForm.getByLabel("Offen bis").inputValue();

    const guest = await visitor(browser, page);
    const errors: string[] = [];
    guest.page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    guest.page.on("pageerror", (error) => errors.push(error.message));

    try {
      await setWindow(page, berlinDay(-1), berlinDay(7));

      // The form must have been open long enough (20 s): the visitor's clock
      // starts a minute in the past.
      await guest.page.clock.install({ time: Date.now() - 60_000 });
      await guest.page.goto("/anmeldung");
      await expect(guest.page.getByRole("heading", { level: 1, name: /Finale Anmeldung Krachparade/ })).toBeVisible();
      await expectNoHorizontalScroll(guest.page);

      // Empty → message and focus on the first field.
      const submit = guest.page.getByRole("button", { name: "Verbindlich anmelden" });
      await expect(async () => {
        await submit.click();
        await expect(guest.page.getByText("Bitte prüft die markierten Felder.")).toBeVisible({ timeout: 1000 });
      }).toPass();
      await expect(field(guest.page, "contactFirstName")).toBeFocused();

      // Without a motor: no TÜV question, no section lead.
      await choose(guest.page, "vehicle", /Nicht motorisierter Wagen/);
      await expect(field(guest.page, "tuev")).toHaveCount(0);
      await expect(guest.page.getByRole("heading", { name: "Freiwillige Abschnittsleitung" })).toHaveCount(0);
      await choose(guest.page, "vehicle", /Kleiner LKW/);
      await expect(field(guest.page, "tuev")).toBeVisible();
      await expect(guest.page.getByRole("heading", { name: "Freiwillige Abschnittsleitung" })).toBeVisible();

      await field(guest.page, "contactFirstName").fill("Robin");
      await field(guest.page, "contactLastName").fill("Beispiel");
      await field(guest.page, "contactEmail").fill("robin.beispiel@example.org");
      await field(guest.page, "contactPhone").fill("+49 000 0000099");
      await field(guest.page, "collectiveName").fill(name);
      await field(guest.page, "displayName").fill("E2E TESTKOLLEKTIV");
      await field(guest.page, "demands").fill(
        "E2E: Mehr Freiräume für Subkultur, bezahlbare Proberäume und eine Stadt, in der laute Kultur Platz hat."
      );
      await choose(guest.page, "participatedBefore", "Nein");
      await choose(guest.page, "musicType", "DJs");
      await field(guest.page, "genres").getByRole("checkbox", { name: "Melodic / House" }).check();
      await choose(guest.page, "homeBase", "München Stadt");
      await choose(guest.page, "eventSize", "1–50");
      await choose(guest.page, "tuev", "Ja");
      await field(guest.page, "awareness").fill("E2E Awareness-Team");
      await choose(guest.page, "soundCoupling", "Nein");
      await field(guest.page, "atmosphere").fill("E2E tanzbar");
      await field(guest.page, "vehicleLeadFirstName").fill("Kai");
      await field(guest.page, "vehicleLeadLastName").fill("Probe");
      await field(guest.page, "vehicleLeadEmail").fill("kai.probe@example.org");
      await field(guest.page, "vehicleLeadPhone").fill("+49 000 0000098");
      await choose(guest.page, "vehicleLeadSize", "L");
      await field(guest.page, "shirts.standard.M").fill("2");
      await field(guest.page, "stewardsConfirmed").check();
      await field(guest.page, "privacyConfirmed").check();

      // 150 € deposit + 100 € TÜV + 2 × 30 € shirts.
      await expect(guest.page.getByTestId("kosten-summe")).toHaveText("310 €");

      await submit.click();
      await expect(guest.page).toHaveURL(/\/anmeldung\/danke\?id=/);
      await expect(guest.page.getByRole("heading", { level: 1, name: "Danke, eure Anmeldung ist da!" })).toBeVisible();
      await expect(guest.page.getByRole("heading", { level: 2, name })).toBeVisible();
      await expect(guest.page.getByTestId("danke-summe")).toHaveText("310 €");
      await expect(guest.page.getByText("robin.beispiel@example.org")).toHaveCount(0);
      await expectNoHorizontalScroll(guest.page);

      // The evaluation stays closed without a login.
      await guest.page.goto("/kollektive");
      await expect(guest.page).toHaveURL(/\/login$/);

      expect(errors, "Konsolen-Fehler auf der Anmeldung").toEqual([]);

      // The core team sees, accepts and deletes the registration.
      await page.goto("/kollektive");
      await page.getByRole("link", { name }).filter({ visible: true }).click();
      await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
      await expect(page.getByRole("link", { name: "+49 000 0000099" })).toBeVisible();
      await page.getByRole("group", { name: "Status" }).getByRole("button", { name: "Zugesagt" }).click();
      await expect(page.getByText("Status: Zugesagt.")).toBeVisible();
      await expectNoHorizontalScroll(page);

      await page.getByRole("button", { name: "Anmeldung löschen" }).click();
      await page.getByRole("alertdialog", { name: "Löschen bestätigen" }).getByRole("button", { name: "Endgültig löschen" }).click();
      await expect(page).toHaveURL(/\/kollektive$/);
      await expect(page.getByRole("link", { name })).toHaveCount(0);
    } finally {
      await setWindow(page, formerOpens, formerCloses);
      await guest.context.close();
    }
  });

  test("geschlossene Anmeldung zeigt nur einen Hinweis", async ({ page }) => {
    await devLogin(page, "Kim Brenner");
    await page.goto("/kollektive");
    const windowForm = page.getByRole("form", { name: "Zeitfenster der Anmeldung" });
    const formerOpens = await windowForm.getByLabel("Offen ab").inputValue();
    const formerCloses = await windowForm.getByLabel("Offen bis").inputValue();
    try {
      await setWindow(page, "", "");
      await page.goto("/anmeldung");
      await expect(page.getByText(/Die Anmeldung ist geschlossen\./)).toBeVisible();
      await expect(page.getByRole("button", { name: "Verbindlich anmelden" })).toHaveCount(0);
    } finally {
      await setWindow(page, formerOpens, formerCloses);
    }
  });
});
