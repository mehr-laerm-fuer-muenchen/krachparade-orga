import { expect, test, type Locator, type Page } from "@playwright/test";

// Spec 008: editing the plan. Works only with its own elements, named
// "E2E … ‹run›" and unique per run; elements of the seed are never changed
// (the click tests of spec 007 need them). Everything created here is
// deleted at the end, also after a failure. Needs the dev seed (members Kim
// Brenner and Alex Rauch, Krachparade 08.05.2027).

const D_DAY = "2027-05-08";
const DAY_MS = 24 * 60 * 60 * 1000;
/** Pixels per day at zoom "Monat" (default after clearing the stored view). */
const MONTH_PX = 6;

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

/** Relative date at the end of a name button: "52 T vorher", "Krachparade", "3 T danach". */
const RELATIVE_DAY = /(\d+\sT (vorher|danach)|Krachparade)$/;

/** Name button of an element in the Gantt: name, maybe "Fix", then its relative date. */
function ganttName(page: Page, name: string) {
  return page
    .getByRole("button", { name: new RegExp(`^${escape(name)}\\s*(Fix\\s*)?${RELATIVE_DAY.source}`) })
    .filter({ visible: true });
}

function ganttElement(page: Page, name: string) {
  return page.locator(`[data-testid="gantt-element"][data-element-name="${name}"]`);
}

/** Today in Europe/Berlin as "YYYY-MM-DD". */
function todayInBerlin(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(new Date());
}

function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Opens the details of an element in the Gantt (without closing them if already open). */
async function openInGantt(page: Page, name: string) {
  const panel = details(page);
  if (await panel.getByRole("heading", { name, exact: true }).isVisible()) return panel;
  await ganttName(page, name).click();
  await expect(panel.getByRole("heading", { name, exact: true })).toBeVisible();
  return panel;
}

/** `successor` null = the Krachparade (selected by its option value, not its name). */
type NewElement = {
  name: string;
  kind: "Meilenstein" | "Vorgang";
  duration?: number;
  successor: string | null;
  lag: number;
};

/** "+ Element" → short form → "Anlegen"; the new element is selected afterwards. */
async function createElement(page: Page, element: NewElement) {
  await page.getByRole("button", { name: "+ Element" }).filter({ visible: true }).click();
  const dialog = page.getByRole("dialog", { name: "Neues Element" });
  await expect(dialog).toBeVisible();
  await expectNoHorizontalScroll(page);
  await dialog.getByLabel("Name", { exact: true }).fill(element.name);
  await dialog.getByRole("group", { name: "Art" }).getByRole("button", { name: element.kind }).click();
  if (element.duration !== undefined) await dialog.getByLabel("Dauer in Tagen").fill(String(element.duration));
  await dialog
    .getByLabel("Nachfolger")
    .selectOption(element.successor === null ? { value: "dday" } : { label: element.successor });
  await dialog.getByLabel("Abstand (T)").fill(String(element.lag));
  await dialog.getByRole("button", { name: "Anlegen" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(details(page).getByRole("heading", { name: element.name, exact: true })).toBeVisible();
}

/** Deletes the element shown in the panel (with the confirmation in the page). */
async function deleteShown(page: Page) {
  const panel = details(page);
  await panel.getByRole("button", { name: "Element löschen" }).click();
  await panel.getByRole("group", { name: "Element löschen" }).getByRole("button", { name: "Löschen" }).click();
  await expect(panel).toHaveCount(0);
}

/** Drags from the centre of `target` by `dx` pixels with the mouse. */
async function dragBy(page: Page, target: Locator, dx: number) {
  await target.scrollIntoViewIfNeeded();
  const box = (await target.boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y, { steps: 8 });
  await page.mouse.up();
}

async function closeNotice(page: Page) {
  const close = page.getByRole("button", { name: "Hinweis schließen" });
  if (await close.isVisible()) await close.click();
}

/** "52 T vorher" (or "Krachparade", "3 T danach") from the name button of an element. */
async function dLabel(page: Page, name: string): Promise<string> {
  return RELATIVE_DAY.exec((await ganttName(page, name).textContent()) ?? "")?.[0] ?? "";
}

test.describe("Plan bearbeiten", () => {
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
    // Start without remembered view preferences of earlier runs (zoom "Monat").
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();
    await expectPageReady(page, "Plan KP27");
  });

  // After a failure: clean up whatever is left of this run's elements.
  test.afterEach(async ({ page }, testInfo) => {
    if (created.length > 0 && testInfo.status !== testInfo.expectedStatus) {
      await devLogin(page, "Kim Brenner");
      await expectPageReady(page, "Plan KP27");
      const narrow = isNarrow(page);
      if (narrow) {
        await page.setViewportSize({ width: 1280, height: 800 });
      }
      const views = page.getByRole("group", { name: "Ansicht" });
      await views.getByRole("button", { name: "Gantt" }).click();
      for (const name of created) {
        if ((await ganttName(page, name).count()) === 0) continue;
        await openInGantt(page, name);
        await deleteShown(page);
      }
      for (const name of created) await expect(ganttName(page, name)).toHaveCount(0);
    }
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("Laptop: anlegen, ziehen, Ränder, Panel, Konflikt, löschen", async ({ page }) => {
    test.skip(isNarrow(page), "nur auf breiten Bildschirmen");
    test.setTimeout(240_000);

    const run = Date.now().toString(36);
    let a = `E2E A ${run}`;
    const b = `E2E B ${run}`;
    const c = `E2E C ${run}`;
    created.push(a, `${a} neu`, b, c);

    // Three elements: A → Krachparade (40 T), B → A, C → B (3 T).
    await createElement(page, { name: a, kind: "Vorgang", duration: 10, successor: null, lag: 40 });
    await createElement(page, { name: b, kind: "Meilenstein", successor: a, lag: 0 });
    await createElement(page, { name: c, kind: "Vorgang", duration: 5, successor: b, lag: 3 });
    for (const name of [a, b, c]) await expect(ganttName(page, name)).toBeVisible();
    await details(page).getByRole("button", { name: "Details schließen" }).click();

    // Drag A 5 days earlier (spec 025): A becomes "Frei im Fenster", its label
    // shows the new dates (spec 026: no buffer in the label any more), B and C
    // ("so spät") move along; "Rückgängig".
    const before = { a: await dLabel(page, a), b: await dLabel(page, b), c: await dLabel(page, c) };
    const labelA = (await ganttElement(page, a).textContent()) ?? "";
    await dragBy(page, ganttElement(page, a).getByTestId("gantt-mark"), -5 * MONTH_PX);
    await expect(page.getByRole("status").filter({ hasText: "Verschoben" })).toBeVisible();
    await expect(ganttElement(page, a)).not.toHaveText(labelA);
    await expect.poll(() => dLabel(page, b)).not.toBe(before.b);
    await expect.poll(() => dLabel(page, c)).not.toBe(before.c);
    await expect(details(page)).toHaveCount(0);
    await page.getByRole("button", { name: "Rückgängig" }).click();
    await expect.poll(() => dLabel(page, a)).toBe(before.a);
    await expect.poll(() => dLabel(page, b)).toBe(before.b);
    await expect.poll(() => dLabel(page, c)).toBe(before.c);
    await expect(ganttElement(page, a)).toHaveText(labelA);

    // Right edge: longer, start stays. Left edge: end stays.
    let panel = await openInGantt(page, a);
    const start = (await panel.getByTestId("detail-start").textContent())!;
    const end = (await panel.getByTestId("detail-end").textContent())!;
    await dragBy(page, ganttElement(page, a).getByTestId("gantt-handle-end"), 3 * MONTH_PX);
    await expect(panel.getByTestId("detail-end")).not.toHaveText(end);
    await expect(panel.getByTestId("detail-start")).toHaveText(start);
    await expect(panel.getByLabel("Dauer in Tagen")).toHaveValue("13");
    const longerEnd = (await panel.getByTestId("detail-end").textContent())!;
    await dragBy(page, ganttElement(page, a).getByTestId("gantt-handle-start"), -3 * MONTH_PX);
    await expect(panel.getByTestId("detail-start")).not.toHaveText(start);
    await expect(panel.getByTestId("detail-end")).toHaveText(longerEnd);
    await expect(panel.getByLabel("Dauer in Tagen")).toHaveValue("16");
    await closeNotice(page);

    // C: A and B would close a cycle as predecessors; B is linked already as successor.
    panel = await openInGantt(page, c);
    const predecessorOptions = await panel.getByLabel("Vorgänger wählen").locator("option").allTextContents();
    expect(predecessorOptions).not.toContain(a);
    expect(predecessorOptions).not.toContain(b);
    const successorOptions = await panel.getByLabel("Nachfolger wählen").locator("option").allTextContents();
    expect(successorOptions).not.toContain(b);
    const lagToB = panel.getByLabel(`Abstand zu ${b} in Tagen`);
    await expect(lagToB).toHaveValue("3");
    await lagToB.fill("7");
    await lagToB.press("Tab");
    await expect(panel.getByText("Gespeichert")).toBeVisible();
    await page.reload();
    await expectPageReady(page, "Plan KP27");
    panel = await openInGantt(page, c);
    await expect(panel.getByLabel(`Abstand zu ${b} in Tagen`)).toHaveValue("7");

    // Fixed date for B, 3 days later → late; remove it again.
    panel = await openInGantt(page, b);
    // Spec 025: "Fest · Festes Datum"; the date saves as soon as it is complete.
    const placement = panel.getByRole("group", { name: "Lage" });
    await placement.getByRole("button", { name: "Fest" }).click();
    await panel.getByRole("group", { name: "Fest" }).getByRole("button", { name: "Festes Datum" }).click();
    const fixed = panel.getByLabel("Festes Datum", { exact: true });
    await expect(fixed).toBeVisible();
    const fixedDate = await fixed.inputValue();
    await fixed.fill(addDays(fixedDate, 3));
    await expect(panel.getByTestId("detail-reason")).toHaveText(/der feste Termin ist zu spät$/);
    await expect(panel.getByTestId("detail-window-pill")).toHaveText("festes Datum");
    await placement.getByRole("button", { name: "So spät wie möglich" }).click();
    await expect(placement.getByRole("button", { name: "So spät wie möglich" })).toHaveAttribute("aria-pressed", "true");
    await expect(panel.getByLabel("Festes Datum", { exact: true })).toHaveCount(0);
    await expect(panel.getByTestId("detail-reason")).toHaveCount(0);

    // C reached.
    panel = await openInGantt(page, c);
    await panel.getByLabel("Erreicht", { exact: true }).check();
    await expect(panel.getByTestId("detail-window-pill")).toHaveText("erreicht");
    await expect(panel.getByText(/^Erreicht$/).first()).toBeVisible();

    // To-do at A: add, tick off, delete.
    panel = await openInGantt(page, a);
    await expect(panel.getByText("Keine Telefonnummern, Adressen oder Kontodaten eintragen.")).toHaveCount(2);
    const todoText = `E2E To-do ${run}`;
    await panel.getByLabel("Neues To-do").fill(todoText);
    await panel.getByLabel("Wer?").selectOption({ label: "Alex Rauch" });
    await panel.getByLabel("Tage vorher").fill("2");
    await panel.getByLabel("Bezug").selectOption("start");
    await panel.getByRole("button", { name: "Hinzufügen" }).click();
    const todo = panel.getByRole("listitem").filter({ hasText: todoText });
    await expect(todo).toContainText("Alex Rauch");
    await expect(todo).toContainText("(2 Tage vor Start)");
    await todo.getByLabel(`Erledigt: ${todoText}`).check();
    await expect(todo.getByText(todoText)).toHaveClass(/line-through/);
    await todo.getByRole("button", { name: `To-do löschen: ${todoText}` }).click();
    await expect(todo).toHaveCount(0);

    // Note at A: write, edit; Alex cannot change it; Kim deletes it.
    const noteText = `E2E Notiz ${run}`;
    await panel.getByLabel("Neue Notiz").fill(noteText);
    await panel.getByRole("button", { name: "Notiz speichern" }).click();
    let note = panel.getByRole("listitem").filter({ hasText: noteText });
    await expect(note).toBeVisible();
    await note.getByRole("button", { name: "Bearbeiten" }).click();
    await note.getByLabel("Notiz bearbeiten").fill(`${noteText} geändert`);
    await note.getByRole("button", { name: "Speichern" }).click();
    note = panel.getByRole("listitem").filter({ hasText: `${noteText} geändert` });
    await expect(note.getByText(/· bearbeitet$/)).toBeVisible();

    await devLogin(page, "Alex Rauch");
    await expectPageReady(page, "Plan KP27");
    panel = await openInGantt(page, a);
    note = panel.getByRole("listitem").filter({ hasText: `${noteText} geändert` });
    await expect(note).toBeVisible();
    await expect(note.getByRole("button", { name: "Bearbeiten" })).toHaveCount(0);
    await expect(note.getByRole("button", { name: "Löschen" })).toHaveCount(0);

    await devLogin(page, "Kim Brenner");
    await expectPageReady(page, "Plan KP27");
    panel = await openInGantt(page, a);
    note = panel.getByRole("listitem").filter({ hasText: `${noteText} geändert` });
    await note.getByRole("button", { name: "Löschen" }).click();
    await expect(note).toHaveCount(0);

    // History of A: plan changes only.
    const history = panel.locator("section").filter({ has: page.getByRole("heading", { name: "Verlauf" }) });
    const showAll = history.getByRole("button", { name: /^Alle anzeigen/ });
    if (await showAll.isVisible()) await showAll.click();
    await expect(history.getByText(/^Kim Brenner · \d{2}\.\d{2}\. \d{2}:\d{2} · Angelegt$/)).toBeVisible();
    await expect(history.getByText(/· Verschoben um −5 T \(Lage jetzt Frei im Fenster\)$/)).toBeVisible();
    await expect(history.getByText(/To-do|Notiz/)).toHaveCount(0);

    // Conflict: page 2 changes the duration, page 1 then the name.
    const second = await page.context().newPage();
    await second.goto("/");
    await expectPageReady(second, "Plan KP27");
    const secondPanel = await openInGantt(second, a);
    const duration = secondPanel.getByLabel("Dauer in Tagen");
    await duration.fill("20");
    await duration.press("Tab");
    await expect(secondPanel.getByText("Gespeichert")).toBeVisible();
    await second.close();

    const nameField = panel.getByLabel("Name", { exact: true });
    await nameField.fill(`${a} neu`);
    await nameField.press("Tab");
    await expect(page.getByText("Wurde gerade von Kim Brenner geändert – Plan neu geladen.")).toBeVisible();
    a = `${a} neu`;
    await expect(ganttName(page, a)).toBeVisible();
    await closeNotice(page);

    // Delete B: C is linked with A, lag = 7 (C→B) + 0 (B) + 0 (B→A).
    await openInGantt(page, b);
    await deleteShown(page);
    await expect(ganttName(page, b)).toHaveCount(0);
    panel = await openInGantt(page, c);
    await expect(panel.getByLabel(`Abstand zu ${a} in Tagen`)).toHaveValue("7");

    // Clean up.
    await deleteShown(page);
    await openInGantt(page, a);
    await deleteShown(page);
    for (const name of [a, b, c]) await expect(ganttName(page, name)).toHaveCount(0);
    await expectNoHorizontalScroll(page);
  });

  test("Handy: über die Wochenliste öffnen, +1 T, Rückgängig, Formular", async ({ page }) => {
    test.skip(!isNarrow(page), "nur auf schmalen Bildschirmen");

    // A task starting today, so it shows up in "Diese Woche".
    const daysToDDay = Math.round((Date.parse(`${D_DAY}T00:00:00Z`) - Date.parse(`${todayInBerlin()}T00:00:00Z`)) / DAY_MS);
    test.skip(daysToDDay < 8 || daysToDDay > 372, "braucht eine Krachparade 8 bis 372 Tage in der Zukunft");
    const name = `E2E M ${Date.now().toString(36)}`;
    created.push(name);

    await createElement(page, { name, kind: "Vorgang", duration: 7, successor: null, lag: daysToDDay - 7 });
    await expectNoHorizontalScroll(page);
    await details(page).getByRole("button", { name: "Details schließen" }).click();

    const week = page.getByRole("region", { name: "Diese Woche" });
    await week.getByRole("button", { name: new RegExp(escape(name)) }).click();
    const panel = details(page);
    await expect(panel.getByRole("heading", { name, exact: true })).toBeVisible();
    const start = (await panel.getByTestId("detail-start").textContent())!;

    await panel.getByRole("button", { name: "+1 T" }).click();
    await expect(panel.getByTestId("detail-start")).not.toHaveText(start);
    await expect(page.getByRole("status").filter({ hasText: "Verschoben" })).toBeVisible();
    await page.getByRole("button", { name: "Rückgängig" }).click();
    await expect(panel.getByTestId("detail-start")).toHaveText(start);
    await expectNoHorizontalScroll(page);

    await deleteShown(page);
    await expect(week.getByRole("button", { name: new RegExp(escape(name)) })).toHaveCount(0);
    await expectNoHorizontalScroll(page);
  });
});
