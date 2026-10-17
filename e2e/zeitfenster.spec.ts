import { expect, test, type Page } from "@playwright/test";

// Spec 025: time windows and placements in the panel and the sheet. Works only
// with its own elements "E2E … ‹run›" (unique per run), never with the seed;
// everything created here is deleted at the end, also after a failure. Needs
// the dev seed (member Kim Brenner, Krachparade 08.05.2027).

const D_DAY = "2027-05-08";
const DAY_MS = 24 * 60 * 60 * 1000;
/** Pixels per day at zoom "Quartal". */
const QUARTER_PX = 3;

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

function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/** "2026-10-17" → "Sa 17.10.2026", as the panel writes dates. */
function weekdayDate(date: string): string {
  const name = new Intl.DateTimeFormat("de-DE", { weekday: "short", timeZone: "UTC" })
    .format(new Date(`${date}T00:00:00Z`))
    .replace(".", "");
  const [year, month, day] = date.split("-");
  return `${name} ${day}.${month}.${year}`;
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

async function closeNotice(page: Page) {
  const close = page.getByRole("button", { name: "Hinweis schließen" });
  if (await close.isVisible()) await close.click();
}

function placementButton(page: Page, name: string) {
  return details(page).getByRole("group", { name: "Lage" }).getByRole("button", { name, exact: true });
}

function history(page: Page) {
  return details(page).locator("section").filter({ has: page.getByRole("heading", { name: "Verlauf" }) });
}

test.describe("Zeitfenster", () => {
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

  test("Lage, Zeitfenster, Mindestabstand, Ziehen, Erreicht, Filter, Blatt", async ({ page }) => {
    test.skip(isNarrow(page), "läuft bei 1280 × 800 und schaltet selbst auf 375 × 812");
    test.setTimeout(240_000);
    const today = todayInBerlin();
    const daysToDDay = Math.round((Date.parse(`${D_DAY}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY_MS);
    test.skip(daysToDDay < 60 || daysToDDay > 360, "braucht eine Krachparade 60 bis 360 Tage in der Zukunft");

    const run = Date.now().toString(36);
    const a = `E2E A ${run}`;
    const b = `E2E B ${run}`;
    const c = `E2E C ${run}`;
    created.push(a, b, c);

    // A: task, 5 days, Krachparade at least 30 days later → "So spät wie möglich", earliest today.
    await createElement(page, { name: a, kind: "Vorgang", duration: 5, successor: null, lag: 30 });
    let panel = details(page);
    await expect(placementButton(page, "So spät wie möglich")).toHaveAttribute("aria-pressed", "true");
    await expect(panel.getByTestId("detail-earliest")).toHaveText(weekdayDate(today));
    await expect(panel.getByTestId("detail-window-pill")).toHaveText(/^Luft \d+\sT$/);

    // B: milestone before A (at least 0 days); then at least 7 days, also after reloading.
    await createElement(page, { name: b, kind: "Meilenstein", successor: a, lag: 0 });
    panel = details(page);
    const successors = panel.locator("section").filter({ has: page.getByRole("heading", { name: "Nachfolger" }) });
    const lagToA = panel.getByLabel(`Abstand zu ${a} in Tagen`);
    await expect(lagToA).toHaveValue("0");
    await expect(successors.getByRole("listitem").filter({ hasText: a })).toContainText(/mind\.\s*T davor/);
    await lagToA.fill("7");
    await lagToA.press("Tab");
    await expect(panel.getByText("Gespeichert")).toBeVisible();
    await page.reload();
    await expectPageReady(page, "Plan KP27");
    panel = await openInGantt(page, b);
    await expect(panel.getByLabel(`Abstand zu ${a} in Tagen`)).toHaveValue("7");
    await expect(history(page).getByText(new RegExp(`· Mindestabstand zu ${escape(a)}: 0 → 7 T$`))).toBeVisible();

    // B "So früh wie möglich": without predecessors it starts today.
    await placementButton(page, "So früh wie möglich").click();
    await expect(placementButton(page, "So früh wie möglich")).toHaveAttribute("aria-pressed", "true");
    await expect(panel.getByTestId("detail-start")).toContainText(weekdayDate(today));
    await expect(history(page).getByText(/· Lage: So spät wie möglich → So früh wie möglich$/)).toBeVisible();

    // A "Fest", N days before the Krachparade: the field shows the distance so far; 20 → new date.
    panel = await openInGantt(page, a);
    await placementButton(page, "Fest").click();
    const variants = panel.getByRole("group", { name: "Fest" });
    await expect(variants.getByRole("button", { name: "Tage vor der Krachparade" })).toHaveAttribute("aria-pressed", "true");
    const offset = panel.getByLabel("Tage vor der Krachparade", { exact: true });
    await expect(offset).toHaveValue("35");
    const dateLine = (await panel.getByTestId("fixed-date-line").textContent())!;
    await offset.fill("20");
    await offset.press("Tab");
    await expect(panel.getByTestId("fixed-date-line")).not.toHaveText(dateLine);
    await expect(panel.getByTestId("fixed-date-line")).toHaveText(`Start ${weekdayDate(addDays(D_DAY, -20))}`);
    await expect(panel.getByTestId("detail-window-pill")).toHaveText(/^fest · 20\sT vorher$/);
    await variants.getByRole("button", { name: "Festes Datum" }).click();
    await expect(panel.getByLabel("Festes Datum", { exact: true })).toHaveValue(addDays(D_DAY, -20));
    await expect(panel.getByTestId("detail-window-pill")).toHaveText("festes Datum");
    await panel.getByRole("button", { name: "Details schließen" }).click();

    // Drag B to the right behind the start of A → "Verzug", the bar names the new placement; undo.
    await page.getByRole("group", { name: "Zoom" }).getByRole("button", { name: "Quartal" }).click();
    const mark = ganttElement(page, b).getByTestId("gantt-mark");
    await mark.scrollIntoViewIfNeeded();
    const box = (await mark.boundingBox())!;
    const days = daysToDDay - 17; // from today to 3 days after the start of A (20 days before)
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + days * QUARTER_PX, box.y + box.height / 2, { steps: 12 });
    await page.mouse.up();
    const bar = page.getByRole("status").filter({ hasText: "Verschoben" });
    await expect(bar).toContainText("Lage jetzt „Frei im Fenster“");
    panel = await openInGantt(page, b);
    await expect(panel.getByText("Verzug", { exact: true })).toBeVisible();
    await expect(placementButton(page, "Frei im Fenster")).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Rückgängig" }).click();
    await expect(placementButton(page, "So früh wie möglich")).toHaveAttribute("aria-pressed", "true");
    await closeNotice(page);

    // B reached: window "Erreicht am ‹today›", placement buttons disabled; untick → choosable again.
    await panel.getByLabel("Erreicht", { exact: true }).check();
    await expect(panel.getByTestId("detail-window")).toHaveText(`Erreicht am ${weekdayDate(today)}`);
    await expect(placementButton(page, "Fest")).toBeDisabled();
    await panel.getByLabel("Erreicht", { exact: true }).uncheck();
    await expect(placementButton(page, "Fest")).toBeEnabled();
    await expect(placementButton(page, "So früh wie möglich")).toHaveAttribute("aria-pressed", "true");
    await panel.getByRole("button", { name: "Details schließen" }).click();

    // Filter "Kritisch & knapp".
    const filter = page.getByRole("button", { name: "Kritisch & knapp", exact: true });
    await filter.click();
    await expect(filter).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText(/ · (\d+ kritisch · \d+ knapp|nichts kritisch)/)).toBeVisible();
    await filter.click();
    await expect(filter).toHaveAttribute("aria-pressed", "false");

    // A's fixed date today, so the week list shows it right at the top (saved without leaving the field).
    panel = await openInGantt(page, a);
    await panel.getByLabel("Festes Datum", { exact: true }).fill(today);
    await expect(panel.getByTestId("detail-start")).toHaveText(weekdayDate(today));

    // Phone: open A from the week list; the sheet shows placement and window.
    await page.setViewportSize({ width: 375, height: 812 });
    await page.reload();
    await expectPageReady(page, "Plan KP27");
    await page.getByRole("button", { name: new RegExp(escape(a)) }).filter({ visible: true }).first().click();
    panel = details(page);
    await expect(panel.getByRole("heading", { name: a, exact: true })).toBeVisible();
    await expect(panel.getByRole("group", { name: "Lage" })).toBeVisible();
    await expect(panel.getByTestId("detail-window")).toBeVisible();
    await expectNoHorizontalScroll(page);
    await panel.getByRole("button", { name: "Details schließen" }).click();

    // An own "so spät" element starting today: "+1 T" makes it "Frei im Fenster"; undo.
    await createElement(page, { name: c, kind: "Vorgang", duration: 7, successor: null, lag: daysToDDay - 7 });
    panel = details(page);
    await expect(placementButton(page, "So spät wie möglich")).toHaveAttribute("aria-pressed", "true");
    const start = (await panel.getByTestId("detail-start").textContent())!;
    await panel.getByRole("button", { name: "+1 T" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Verschoben" })).toContainText("Lage jetzt „Frei im Fenster“");
    await expect(panel.getByTestId("detail-start")).not.toHaveText(start);
    await page.getByRole("button", { name: "Rückgängig" }).click();
    await expect(panel.getByTestId("detail-start")).toHaveText(start);
    await expect(placementButton(page, "So spät wie möglich")).toHaveAttribute("aria-pressed", "true");
    await expectNoHorizontalScroll(page);
    await closeNotice(page);

    // Clean up: C, then B and A in the Gantt.
    await deleteShown(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.reload();
    await expectPageReady(page, "Plan KP27");
    for (const name of [b, a]) {
      await openInGantt(page, name);
      await deleteShown(page);
    }
    for (const name of [a, b, c]) await expect(ganttName(page, name)).toHaveCount(0);
  });
});
