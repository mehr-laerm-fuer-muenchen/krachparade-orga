import { expect, test, type Locator, type Page } from "@playwright/test";

// Spec 016: to-do progress in Gantt and week list, ticking off in the week
// list, the "Als erreicht markieren?" hint, "Gespeichert ✓" and "Beschluss".
// Works only with its own element "E2E Checkliste ‹run›" and its own meeting,
// both deleted at the end (also after a failure). Elements of the seed are
// never changed. Needs the dev seed (Kim Brenner, Krachparade 08.05.2027).

const D_DAY = "2027-05-08";
const DAY_MS = 24 * 60 * 60 * 1000;
const DURATION = 5;

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

function todayInBerlin(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(new Date());
}

/** Days from today to the Krachparade. */
function daysToDDay(): number {
  return Math.round((Date.parse(`${D_DAY}T00:00:00Z`) - Date.parse(`${todayInBerlin()}T00:00:00Z`)) / DAY_MS);
}

/** Name button of an element in the Gantt: name, maybe "Fix", then its relative date. */
function ganttName(page: Page, name: string) {
  return page
    .getByRole("button", { name: new RegExp(`^${escape(name)}\\s*(Fix\\s*)?(\\d+\\sT (vorher|danach)|Krachparade)$`) })
    .filter({ visible: true });
}

function ganttProgress(page: Page, name: string) {
  return page.locator(`[data-testid="gantt-element"][data-element-name="${name}"]`).getByTestId("gantt-progress-text");
}

/** Cards of an element in the week list (its main button starts with the name). */
function weekCards(page: Page, name: string): Locator {
  return page
    .getByRole("listitem")
    .filter({ has: page.getByRole("button", { name: new RegExp(`^${escape(name)}`) }) })
    .filter({ visible: true });
}

/** A task can be listed twice ("startet …" and "endet …"); the first card is its start. */
function weekCard(page: Page, name: string): Locator {
  return weekCards(page, name).first();
}

/** A 5-day task starting in a week from today, before the Krachparade. */
async function createElement(page: Page, name: string) {
  await page.getByRole("button", { name: "+ Element" }).filter({ visible: true }).click();
  const dialog = page.getByRole("dialog", { name: "Neues Element" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Name", { exact: true }).fill(name);
  await dialog.getByRole("group", { name: "Art" }).getByRole("button", { name: "Vorgang" }).click();
  await dialog.getByLabel("Dauer in Tagen").fill(String(DURATION));
  await dialog.getByLabel("Nachfolger").selectOption({ value: "dday" });
  await dialog.getByLabel("Abstand (T)").fill(String(daysToDDay() - 7 - DURATION));
  await dialog.getByRole("button", { name: "Anlegen" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(details(page).getByRole("heading", { name, exact: true })).toBeVisible();
}

async function addTodo(panel: Locator, text: string) {
  await panel.getByLabel("Neues To-do").fill(text);
  await panel.getByRole("button", { name: "Hinzufügen" }).click();
  await expect(panel.getByRole("listitem").filter({ hasText: text })).toBeVisible();
}

/** Deletes the element shown in the panel (with the confirmation in the page). */
async function deleteShown(page: Page) {
  const panel = details(page);
  await panel.getByRole("button", { name: "Element löschen" }).click();
  await panel.getByRole("group", { name: "Element löschen" }).getByRole("button", { name: "Löschen" }).click();
  await expect(panel).toHaveCount(0);
}

function notice(page: Page, text: string | RegExp) {
  return page.getByRole("status").filter({ hasText: text }).filter({ has: page.getByRole("button", { name: "Hinweis schließen" }) });
}

async function closeNotice(page: Page) {
  const close = page.getByRole("button", { name: "Hinweis schließen" });
  if (await close.isVisible()) await close.click();
}

async function showView(page: Page, view: "Gantt" | "Liste") {
  await page.getByRole("group", { name: "Ansicht" }).getByRole("button", { name: view }).click();
}

const HINT = "Alle To-dos erledigt. Als erreicht markieren?";

test.describe("Checklisten & Fortschritt", () => {
  let errors: string[];
  let created: string[];
  /** While a save is aborted on purpose, the failed request may be logged. */
  let offline = false;

  test.beforeEach(async ({ page }) => {
    errors = [];
    created = [];
    offline = false;
    page.on("console", (message) => {
      if (message.type() === "error" && !offline) errors.push(message.text());
    });
    page.on("pageerror", (error) => {
      if (!offline) errors.push(error.message);
    });
    // Locally the Next.js dev tools button covers the first tab on phones.
    await page.addInitScript(() => {
      const style = document.createElement("style");
      style.textContent = "nextjs-portal { display: none !important; }";
      document.addEventListener("DOMContentLoaded", () => document.head.append(style));
    });
    test.skip(daysToDDay() < 30, "braucht eine Krachparade mindestens 30 Tage in der Zukunft");

    await devLogin(page, "Kim Brenner");
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();
    await expectPageReady(page, "Plan KP27");
  });

  // After a failure: delete whatever is left of this run's element.
  test.afterEach(async ({ page }, testInfo) => {
    if (created.length > 0 && testInfo.status !== testInfo.expectedStatus) {
      await page.unrouteAll({ behavior: "ignoreErrors" });
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto("/");
      await expectPageReady(page, "Plan KP27");
      await showView(page, "Gantt");
      for (const name of created) {
        if ((await ganttName(page, name).count()) === 0) continue;
        await ganttName(page, name).click();
        await deleteShown(page);
      }
    }
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("Laptop: Fortschritt, Gespeichert, Abhaken, Hinweis, Beschluss", async ({ page }) => {
    test.skip(isNarrow(page), "nur auf breiten Bildschirmen");
    test.setTimeout(240_000);

    const run = Date.now().toString(36);
    const base = `E2E Checkliste ${run}`;
    let name = base;
    created.push(base, `${base} B`, `${base} C`);
    const todo1 = `E2E Punkt eins ${run}`;
    const todo2 = `E2E Punkt zwei ${run}`;

    // New element, two to-dos: "Gespeichert ✓", "0/2" and an empty bar in the Gantt.
    await createElement(page, name);
    const panel = details(page);
    await addTodo(panel, todo1);
    await expect(panel.getByText("Gespeichert ✓")).toBeVisible();
    await addTodo(panel, todo2);
    await expect(ganttProgress(page, name)).toHaveText("0/2");
    const bar = page.locator(`[data-testid="gantt-element"][data-element-name="${name}"]`).getByTestId("gantt-progress");
    await expect(bar).toHaveAttribute("data-done", "0");
    await expect(bar).toHaveAttribute("data-total", "2");

    // Ticking off in the panel updates the Gantt without reloading.
    await panel.getByLabel(`Erledigt: ${todo1}`).check();
    await expect(ganttProgress(page, name)).toHaveText("1/2");
    await panel.getByLabel(`Erledigt: ${todo1}`).uncheck();
    await expect(ganttProgress(page, name)).toHaveText("0/2");
    await expect(panel.getByText("Gespeichert ✓")).toHaveCount(0);

    // New name: "Gespeichert ✓" at the field, then gone.
    // The save status sits next to the field, not in its name.
    const nameField = panel.getByLabel("Name", { exact: true });
    await nameField.fill(`${base} B`);
    await nameField.press("Tab");
    name = `${base} B`;
    await expect(panel.getByRole("heading", { name, exact: true })).toBeVisible();
    await expect(panel.getByText("Gespeichert ✓")).toBeVisible();
    await expect(nameField).toHaveAccessibleName("Name");
    await expect(panel.getByText("Gespeichert ✓")).toHaveCount(0);

    // Duration: same, then back to 5 days.
    const durationField = panel.getByLabel("Dauer in Tagen", { exact: true });
    for (const days of ["6", String(DURATION)]) {
      await durationField.fill(days);
      await durationField.press("Tab");
      await expect(panel.getByText("Gespeichert ✓")).toBeVisible();
      await expect(durationField).toHaveAccessibleName("Dauer in Tagen");
      await expect(panel.getByText("Gespeichert ✓")).toHaveCount(0);
    }

    // Saving fails (server action aborted): "Nicht gespeichert – nochmal", then it works.
    offline = true;
    await page.route("**/*", (route) =>
      route.request().method() === "POST" && route.request().headers()["next-action"] ? route.abort() : route.continue()
    );
    await nameField.fill(`${base} C`);
    await nameField.press("Tab");
    await expect(panel.getByRole("alert").filter({ hasText: "Nicht gespeichert" })).toBeVisible();
    await expect(nameField).toHaveValue(`${base} C`);
    await expect(nameField).toHaveAccessibleName("Name");
    await page.unrouteAll();
    offline = false;
    await panel.getByRole("button", { name: "nochmal" }).click();
    name = `${base} C`;
    await expect(panel.getByRole("heading", { name, exact: true })).toBeVisible();
    await expect(panel.getByText("Gespeichert ✓")).toBeVisible();
    await expect(panel.getByRole("alert").filter({ hasText: "Nicht gespeichert" })).toHaveCount(0);
    await panel.getByRole("button", { name: "Details schließen" }).click();

    // List: open the to-dos, tick one off, "Rückgängig".
    await showView(page, "Liste");
    const card = weekCard(page, name);
    await expect(card).toBeVisible();
    const counter = card.getByRole("button", { name: "To-dos 0/2" });
    await expect(counter).toHaveAttribute("aria-expanded", "false");
    await counter.click();
    await expect(card.getByRole("button", { name: /^To-dos / })).toHaveAttribute("aria-expanded", "true");
    const todos = card.getByRole("list", { name: `To-dos von ${name}` });
    await expect(todos.getByText(todo1)).toBeVisible();
    await expect(todos.getByText(todo2)).toBeVisible();

    await todos.getByRole("checkbox", { name: `Erledigt: ${todo1}` }).click();
    await expect(card.getByRole("button", { name: "To-dos 1/2" })).toBeVisible();
    await notice(page, `Erledigt: ${todo1}`).getByRole("button", { name: "Rückgängig" }).click();
    await expect(card.getByRole("button", { name: "To-dos 0/2" })).toBeVisible();

    // Both done → hint; "Noch nicht" hides it; the panel still asks.
    await todos.getByRole("checkbox", { name: `Erledigt: ${todo1}` }).click();
    await expect(card.getByRole("button", { name: "To-dos 1/2" })).toBeVisible();
    await todos.getByRole("checkbox", { name: `Erledigt: ${todo2}` }).click();
    await expect(card.getByRole("button", { name: "To-dos 2/2 ✓" })).toBeVisible();
    await expect(card.getByText(HINT)).toBeVisible();
    await card.getByRole("button", { name: "Noch nicht" }).click();
    await expect(card.getByText(HINT)).toHaveCount(0);
    await closeNotice(page);

    await card.getByRole("button", { name: new RegExp(`^${escape(name)}`) }).click();
    await expect(panel.getByRole("heading", { name, exact: true })).toBeVisible();
    await expect(panel.getByText(HINT)).toBeVisible();
    await panel.getByRole("status").filter({ hasText: HINT }).getByRole("button", { name: "Erreicht" }).click();
    await expect(notice(page, /^Erreicht/)).toBeVisible();
    await expect(panel.getByLabel("Erreicht", { exact: true })).toBeChecked();
    await expect(panel.getByText(HINT)).toHaveCount(0);
    await expect(card.getByRole("checkbox", { name: `${name} – erreicht zurücknehmen` })).toHaveAttribute(
      "aria-checked",
      "true"
    );
    await panel.getByRole("button", { name: "Details schließen" }).click();
    await closeNotice(page);

    await showView(page, "Gantt");
    await expect(ganttProgress(page, name)).toHaveText("2/2 ✓");
    await expect(ganttProgress(page, name)).toHaveClass(/fill-progress-fill/);

    // Open again via the box, untick a to-do, reach with an open to-do.
    await showView(page, "Liste");
    await card.getByRole("checkbox", { name: `${name} – erreicht zurücknehmen` }).click();
    await expect(notice(page, "Wieder offen")).toBeVisible();
    await expect(card.getByRole("checkbox", { name: `${name} als erreicht markieren` })).toHaveAttribute(
      "aria-checked",
      "false"
    );
    if ((await card.getByRole("button", { name: /^To-dos / }).getAttribute("aria-expanded")) !== "true") {
      await card.getByRole("button", { name: /^To-dos / }).click();
    }
    await todos.getByRole("checkbox", { name: `Erledigt: ${todo2}` }).click();
    await expect(card.getByRole("button", { name: "To-dos 1/2" })).toBeVisible();
    await card.getByRole("checkbox", { name: `${name} als erreicht markieren` }).click();
    await expect(notice(page, "Erreicht · 1 To-do noch offen")).toBeVisible();
    await expect(card.getByRole("checkbox", { name: `${name} – erreicht zurücknehmen` })).toHaveAttribute(
      "aria-checked",
      "true"
    );
    await closeNotice(page);
    await expectNoHorizontalScroll(page);

    // Clean up the element.
    await card.getByRole("button", { name: new RegExp(`^${escape(name)}`) }).click();
    await deleteShown(page);
    await expect(weekCards(page, name)).toHaveCount(0);
    created = [];

    // Minutes: "Beschluss" everywhere, nothing says "Entscheidung".
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/protokolle");
    await page.getByRole("button", { name: "Neues Treffen" }).click();
    await expect(page).toHaveURL(/\/protokolle\/[0-9a-f-]{36}$/);
    const meetingUrl = new URL(page.url()).pathname;
    try {
      const title = `E2E Treffen ${run}`;
      const titleField = page.getByRole("textbox", { name: "Titel", exact: true });
      await titleField.fill(title);
      await titleField.press("Tab");
      await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
      await expect(page.getByText("Gespeichert ✓", { exact: true })).toBeVisible();
      await expect(titleField).toHaveAccessibleName("Titel");

      await page.getByRole("button", { name: "+ TOP hinzufügen" }).click();
      await page.getByRole("textbox", { name: "Überschrift des neuen TOPs", exact: true }).fill("E2E TOP");
      await page.keyboard.press("Enter");
      const entry = page.getByRole("form", { name: "Neuer Punkt unter E2E TOP" });
      await expect(entry.getByRole("textbox", { name: "Text" })).toBeFocused();
      await page.keyboard.press("Alt+Digit3");
      await expect(entry.getByRole("radio", { name: /Beschluss/ })).toBeChecked();
      const decision = `E2E Beschluss ${run}`;
      await page.keyboard.type(decision);
      await page.keyboard.press("Enter");
      const item = page.getByRole("list", { name: "Punkte zu E2E TOP" }).getByRole("listitem").filter({ hasText: decision });
      await expect(item.getByText("Beschluss", { exact: true })).toBeVisible();

      await page.getByRole("button", { name: "Als Text kopieren" }).click();
      const fallback = page.getByRole("textbox", { name: /bitte selbst kopieren/ });
      await expect(page.getByRole("status").filter({ hasText: "Kopiert" }).or(fallback)).toBeVisible();
      const copied = (await fallback.isVisible())
        ? await fallback.inputValue()
        : await page.evaluate(() => navigator.clipboard.readText());
      expect(copied).toContain("Beschlüsse:");
      expect(copied).toContain(decision);
      expect(copied).not.toContain("Entscheidung");
      await expect(page.getByText(/Entscheidung/).filter({ visible: true })).toHaveCount(0);
    } finally {
      await page.goto(meetingUrl);
      const head = page.getByRole("region", { name: "Kopf" });
      await expect(head.getByRole("button", { name: "Treffen löschen" })).toBeVisible();
      page.once("dialog", (dialog) => void dialog.accept());
      await head.getByRole("button", { name: "Treffen löschen" }).click();
      await expect(page).toHaveURL(/\/protokolle$/);
    }
    await expectPageReady(page, "Protokolle");
    await expect(page.getByText(/Entscheidung/).filter({ visible: true })).toHaveCount(0);
  });

  test("Handy: Kästchen und Zähler bedienbar, To-dos ohne Querscrollen, Hinweis im Blatt", async ({ page }) => {
    test.skip(!isNarrow(page), "nur auf schmalen Bildschirmen");
    test.setTimeout(180_000);

    const run = Date.now().toString(36);
    const name = `E2E Checkliste ${run}`;
    created.push(name);
    const todo1 = `E2E Punkt eins ${run}`;
    const todo2 = `E2E Punkt zwei mit einem etwas längeren Text ${run}`;

    await createElement(page, name);
    const sheet = details(page);
    await addTodo(sheet, todo1);
    await addTodo(sheet, todo2);
    await sheet.getByRole("button", { name: "Details schließen" }).click();

    const card = weekCard(page, name);
    await expect(card).toBeVisible();
    const box = card.getByRole("checkbox", { name: `${name} als erreicht markieren` });
    const counter = card.getByRole("button", { name: "To-dos 0/2" });
    for (const control of [box, counter]) {
      const size = (await control.boundingBox())!;
      expect(size.width).toBeGreaterThanOrEqual(44);
      expect(size.height).toBeGreaterThanOrEqual(44);
    }

    await counter.click();
    const todos = card.getByRole("list", { name: `To-dos von ${name}` });
    await expect(todos.getByText(todo2)).toBeVisible();
    await expectNoHorizontalScroll(page);
    for (const todo of [todo1, todo2]) {
      const tick = todos.getByRole("checkbox", { name: `Erledigt: ${todo}` });
      const size = (await tick.boundingBox())!;
      expect(size.width).toBeGreaterThanOrEqual(44);
      expect(size.height).toBeGreaterThanOrEqual(44);
      await tick.click();
      await expect(notice(page, `Erledigt: ${todo}`)).toBeVisible();
    }
    await expect(card.getByRole("button", { name: "To-dos 2/2 ✓" })).toBeVisible();
    await expect(card.getByText(HINT)).toBeVisible();
    await expectNoHorizontalScroll(page);
    await closeNotice(page);

    // The sheet asks as well.
    await card.getByRole("button", { name: new RegExp(`^${escape(name)}`) }).click();
    await expect(sheet.getByRole("heading", { name, exact: true })).toBeVisible();
    await expect(sheet.getByText(HINT)).toBeVisible();
    await expectNoHorizontalScroll(page);

    await deleteShown(page);
    await expect(weekCards(page, name)).toHaveCount(0);
    created = [];
  });
});
