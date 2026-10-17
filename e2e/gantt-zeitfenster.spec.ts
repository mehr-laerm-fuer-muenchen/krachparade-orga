import { expect, test, type Page } from "@playwright/test";

// Spec 026: time windows in the Gantt, pin, frames for critical/tight, the
// explanation of the filter, the legend, the cause of a follow-on delay and
// the window line in the week list. Reads the seed elements only; its own
// elements "E2E … ‹run›" are deleted at the end, also after a failure. Needs
// the dev seed (member Kim Brenner, Krachparade 08.05.2027, the fixed
// "Kooperationsgespräch KVR/Polizei" 2 days too late).

const D_DAY = "2027-05-08";
const DAY_MS = 24 * 60 * 60 * 1000;
const MEETING = "Kooperationsgespräch KVR/Polizei";

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

function details(page: Page) {
  return page.getByRole("complementary", { name: "Details" });
}

const RELATIVE_DAY = /(\d+\sT (vorher|danach)|Krachparade)$/;

function ganttName(page: Page, name: string) {
  return page
    .getByRole("button", { name: new RegExp(`^${escape(name)}\\s*(Fix\\s*)?${RELATIVE_DAY.source}`) })
    .filter({ visible: true });
}

function ganttElement(page: Page, name: string) {
  return page.locator(`[data-testid="gantt-element"][data-element-name="${name}"]`);
}

function todayInBerlin(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(new Date());
}

async function openInGantt(page: Page, name: string) {
  const panel = details(page);
  if (await panel.getByRole("heading", { name, exact: true }).isVisible()) return panel;
  await ganttName(page, name).click();
  await expect(panel.getByRole("heading", { name, exact: true })).toBeVisible();
  return panel;
}

/** "+ Element" → short form → "Anlegen"; `successor` null = the Krachparade. */
async function createElement(
  page: Page,
  element: { name: string; kind: "Meilenstein" | "Vorgang"; duration?: number; successor: string | null; lag: number }
) {
  await page.getByRole("button", { name: "+ Element" }).filter({ visible: true }).click();
  const dialog = page.getByRole("dialog", { name: "Neues Element" });
  await dialog.getByLabel("Name", { exact: true }).fill(element.name);
  await dialog.getByRole("group", { name: "Art" }).getByRole("button", { name: element.kind }).click();
  if (element.duration !== undefined) await dialog.getByLabel("Dauer in Tagen").fill(String(element.duration));
  await dialog
    .getByLabel("Nachfolger")
    .selectOption(element.successor === null ? { value: "dday" } : { label: element.successor });
  await dialog.getByLabel("Mindestabstand (T)").fill(String(element.lag));
  await dialog.getByRole("button", { name: "Anlegen" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(details(page).getByRole("heading", { name: element.name, exact: true })).toBeVisible();
}

async function deleteShown(page: Page) {
  const panel = details(page);
  await panel.getByRole("button", { name: "Element löschen" }).click();
  await panel.getByRole("group", { name: "Element löschen" }).getByRole("button", { name: "Löschen" }).click();
  await expect(panel).toHaveCount(0);
}

function placementButton(page: Page, name: string) {
  return details(page).getByRole("group", { name: "Lage" }).getByRole("button", { name, exact: true });
}

test.describe("Gantt mit Zeitfenstern", () => {
  let errors: string[];
  let created: string[];

  test.beforeEach(async ({ page }) => {
    errors = [];
    created = [];
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
    await devLogin(page, "Kim Brenner");
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();
    await expectPageReady(page, "Plan KP27");
  });

  // After a failure: clean up whatever is left of this run's elements.
  test.afterEach(async ({ page }, testInfo) => {
    if (created.length > 0 && testInfo.status !== testInfo.expectedStatus) {
      await page.setViewportSize({ width: 1280, height: 800 });
      await devLogin(page, "Kim Brenner");
      await expectPageReady(page, "Plan KP27");
      await page.getByRole("group", { name: "Ansicht" }).getByRole("button", { name: "Gantt" }).click();
      for (const name of created) {
        if ((await ganttName(page, name).count()) === 0) continue;
        await openInGantt(page, name);
        await deleteShown(page);
      }
      for (const name of created) await expect(ganttName(page, name)).toHaveCount(0);
    }
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("Fenster, Pin, Ursache, Filter, Legende, Wochenliste", async ({ page }) => {
    test.skip(isNarrow(page), "läuft bei 1280 × 800 und schaltet selbst auf 375 × 812");
    test.setTimeout(180_000);
    const today = todayInBerlin();
    const daysToDDay = Math.round((Date.parse(`${D_DAY}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY_MS);
    test.skip(daysToDDay < 60 || daysToDDay > 360, "braucht eine Krachparade 60 bis 360 Tage in der Zukunft");

    const run = Date.now().toString(36);
    const late = `E2E Spät ${run}`;
    const early = `E2E Früh ${run}`;
    created.push(late, early);

    // Legend for the new model.
    const legend = page.getByRole("list", { name: "Legende" });
    for (const item of ["Zeitfenster", "zu spät", "fest", "kritisch", "knapp"]) {
      await expect(legend.getByText(item, { exact: true })).toBeVisible();
    }

    // "So spät" task with a predecessor: it has a band.
    await createElement(page, { name: late, kind: "Vorgang", duration: 5, successor: null, lag: 30 });
    await createElement(page, { name: early, kind: "Meilenstein", successor: late, lag: 0 });
    // "So früh wie möglich" without predecessors: today, so the week list shows it this week.
    await placementButton(page, "So früh wie möglich").click();
    await expect(placementButton(page, "So früh wie möglich")).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Details schließen" }).click();
    const windows = page.getByRole("button", { name: "Fenster", exact: true });
    await expect(windows).toHaveAttribute("aria-pressed", "true");
    await expect(ganttElement(page, late).getByTestId("gantt-window")).toHaveCount(1);
    await expect(ganttElement(page, late)).toContainText(/Luft \d+\sT/);

    // Switched off: no bands, also after reloading; switched on again.
    await windows.click();
    await expect(windows).toHaveAttribute("aria-pressed", "false");
    await expect(page.getByTestId("gantt-window")).toHaveCount(0);
    await page.reload();
    await expectPageReady(page, "Plan KP27");
    await expect(windows).toHaveAttribute("aria-pressed", "false");
    await expect(page.getByTestId("gantt-window")).toHaveCount(0);
    await windows.click();
    await expect(windows).toHaveAttribute("aria-pressed", "true");
    await expect(ganttElement(page, late).getByTestId("gantt-window")).toHaveCount(1);

    // "Fest · Tage vor der Krachparade": pin and "fest · N T vorher", no band.
    let panel = await openInGantt(page, late);
    await placementButton(page, "Fest").click();
    await expect(panel.getByTestId("detail-window-pill")).toHaveText(/^fest · \d+\sT vorher$/);
    await expect(ganttElement(page, late)).toContainText(/fest · \d+\sT vorher/);
    await expect(ganttElement(page, late).getByTestId("gantt-pin")).toHaveCount(1);
    await expect(ganttElement(page, late).getByTestId("gantt-window")).toHaveCount(0);
    await panel.getByRole("button", { name: "Details schließen" }).click();

    // "Finaler Crosscheck" is late because of the fixed meeting; its name opens it.
    panel = await openInGantt(page, "Finaler Crosscheck");
    await expect(panel.getByText("Verzug", { exact: true })).toBeVisible();
    const cause = panel.getByTestId("detail-cause");
    await expect(cause).toHaveText(`– wegen ${MEETING} (fester Termin zu spät)`);
    await cause.getByRole("button", { name: MEETING }).click();
    await expect(panel.getByRole("heading", { name: MEETING, exact: true })).toBeVisible();
    await panel.getByRole("button", { name: "Details schließen" }).click();

    // Filter "Kritisch & knapp": explanation; framed elements carry the word.
    const filter = page.getByRole("button", { name: "Kritisch & knapp", exact: true });
    await filter.click();
    await expect(filter).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("critical-explanation")).toContainText("Kritisch heißt keine Luft");
    await expect(page.getByTestId("critical-explanation")).toContainText("Knapp heißt höchstens 7 Tage Luft");
    await expect(ganttElement(page, MEETING)).toHaveAttribute("data-frame", "critical");
    for (const element of await page.locator('[data-testid="gantt-element"][data-frame="critical"]').all()) {
      await expect(element).toContainText("kritisch");
    }
    for (const element of await page.locator('[data-testid="gantt-element"][data-frame="tight"]').all()) {
      await expect(element).toContainText("knapp");
    }
    await filter.click();
    await expect(page.getByTestId("critical-explanation")).toHaveCount(0);

    // Phone: the week list shows the window of the own milestone (starts today)
    // and a visible "kritisch" at the late meeting.
    await page.setViewportSize({ width: 375, height: 812 });
    await page.reload();
    await expectPageReady(page, "Plan KP27");
    const card = page.getByRole("listitem").filter({ has: page.getByText(early, { exact: true }) });
    await expect(card.getByTestId("card-window")).toHaveText(/^Fenster \d{2}\.\d{2}\.–\d{2}\.\d{2}\. · (Luft \d+\sT|keine Luft)$/);
    const meeting = page
      .getByRole("region", { name: "Überfällig & Verzug" })
      .getByRole("listitem")
      .filter({ has: page.getByText(MEETING, { exact: true }) });
    await expect(meeting.getByText(/· kritisch$/)).toBeVisible();
    await expect(meeting).toHaveAttribute("data-frame", "critical");
    // Right side of the card: "fest" instead of the buffer (spec 026, Franz).
    await expect(meeting.getByText("fest", { exact: true })).toBeVisible();
    await expect(meeting.getByText(/^[+−]?\d+\sT$/)).toHaveCount(0);
    await expectNoHorizontalScroll(page);

    // Clean up in the Gantt.
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.reload();
    await expectPageReady(page, "Plan KP27");
    for (const name of [early, late]) {
      await openInGantt(page, name);
      await deleteShown(page);
    }
    for (const name of created) await expect(ganttName(page, name)).toHaveCount(0);
  });
});
