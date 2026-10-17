import { expect, test, type Locator, type Page } from "@playwright/test";

// Spec 018: AK overview and AK workspace. Runs on the shared dev database
// and never changes seed data: it works with its own working group "E2E AK
// ‹run›", department "E2E Bereich ‹run›", element and meeting, all unique per
// run, and deletes everything again at the end, also after a failure.
//
// Next.js keeps the previous page hidden in the DOM, so locators go by role
// (which skips hidden elements) or are filtered to visible ones.

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

/** Today in Europe/Berlin as "YYYY-MM-DD", moved by `days`. */
function berlinDay(days: number): string {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(new Date());
  return new Date(Date.parse(`${today}T00:00:00Z`) + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function region(scope: Page | Locator, name: string | RegExp) {
  return scope.getByRole("region", { name, exact: typeof name === "string" });
}

/** The "Rückgängig" bar with this text. */
function bar(page: Page, text: string | RegExp) {
  return page.getByRole("status").filter({ hasText: text });
}

async function undo(page: Page, text: string | RegExp) {
  await bar(page, text).getByRole("button", { name: "Rückgängig" }).click();
}

/** Opens a folded list ("Erledigt (1)", "Erreicht (1)") unless it is open. */
async function unfold(scope: Locator, label: string) {
  const summary = scope.locator("summary", { hasText: label });
  await expect(summary).toBeVisible();
  if ((await summary.locator("xpath=..").getAttribute("open")) === null) await summary.click();
}

/** Resolves once the next server action of the meeting page has answered. */
function saved(page: Page) {
  return page.waitForResponse(
    (response) => response.request().method() === "POST" && /\/protokolle\//.test(response.url())
  );
}

async function openBoard(page: Page) {
  await page.goto("/arbeitskreise/verwalten");
  await expectPageReady(page, "AKs verwalten");
}

async function deleteMeeting(page: Page, url: string) {
  await page.goto(`${url}?ansicht=bearbeiten`);
  const head = page.getByRole("region", { name: "Kopf" });
  await expect(head.or(page.getByText("This page could not be found."))).toBeVisible();
  if ((await head.count()) === 0) return;
  page.once("dialog", (dialog) => void dialog.accept());
  await head.getByRole("button", { name: "Treffen löschen" }).click();
  await expect(page).toHaveURL(/\/protokolle$/);
}

type State = { title: string; area: string; element: string; workspace: string | null; meetings: string[] };

/**
 * Tidies up in the order the database needs: meetings (they point to the
 * department), the plan element, points and notes of the department, then
 * the department (its empty "Laufende Aufgaben" go with it) and the AK.
 */
async function cleanUp(page: Page, state: State) {
  for (const url of state.meetings.splice(0)) await deleteMeeting(page, url);

  if (state.workspace) {
    await page.goto(state.workspace);
    await expectPageReady(page, state.title);
    const department = region(page, state.area);
    if ((await department.count()) > 0) {
      const card = department.getByRole("listitem").filter({ hasText: state.element });
      if ((await card.count()) > 0) {
        const panel = page.getByRole("complementary", { name: "Details" });
        await expect(async () => {
          await card.first().getByRole("button").first().click();
          await expect(panel.getByRole("heading", { name: state.element, exact: true })).toBeVisible({ timeout: 2000 });
        }).toPass();
        await panel.getByRole("button", { name: "Element löschen" }).click();
        await panel.getByRole("group", { name: "Element löschen" }).getByRole("button", { name: "Löschen" }).click();
        await expect(panel).toHaveCount(0);
        await expect(card).toHaveCount(0);
      }
      const ongoing = region(department, /^Laufende Aufgaben/);
      const done = ongoing.locator("summary", { hasText: /^Erledigt/ });
      if ((await done.count()) > 0) await unfold(ongoing, "Erledigt");
      const points = ongoing.getByRole("button", { name: /^Punkt löschen: / });
      while ((await points.count()) > 0) {
        const before = await points.count();
        await points.first().click();
        await expect(points).toHaveCount(before - 1);
      }
      for (const notes of [region(department, "Notizen"), region(page, "Notizen zum AK")]) {
        const remove = notes.getByRole("button", { name: "Löschen" });
        while ((await remove.count()) > 0) {
          const before = await remove.count();
          await remove.first().click();
          await expect(remove).toHaveCount(before - 1);
        }
      }
    }
    state.workspace = null;
  }

  await openBoard(page);
  const card = page.getByRole("region", { name: state.title, exact: true });
  if ((await card.count()) === 0) return;
  const rows = card.getByRole("list", { name: `Aufgabenbereiche ${state.title}` }).getByRole("listitem");
  while ((await rows.count()) > 0) {
    const name = (await rows.first().getAttribute("aria-label")) ?? "";
    const before = await rows.count();
    const toggle = rows.first().getByRole("button", { name: `Bearbeiten: ${name}` });
    if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
    page.once("dialog", (dialog) => void dialog.accept());
    await rows.first().getByRole("button", { name: "Löschen" }).click();
    await expect(rows).toHaveCount(before - 1);
  }
  const menu = card.getByRole("button", { name: `Menü ${state.title}` });
  if ((await menu.getAttribute("aria-expanded")) !== "true") await menu.click();
  page.once("dialog", (dialog) => void dialog.accept());
  await card.getByRole("button", { name: "AK löschen" }).click();
  await expect(card).toHaveCount(0);
}

test.describe("AK-Arbeitsbereich", () => {
  let state: State | null = null;

  test.beforeEach(async ({ page }) => {
    // Locally the Next.js dev tools button covers the first tab on phones.
    await page.addInitScript(() => {
      const style = document.createElement("style");
      style.textContent = "nextjs-portal { display: none !important; }";
      document.addEventListener("DOMContentLoaded", () => document.head.append(style));
    });
  });

  test.afterEach(async ({ page }) => {
    if (!state) return;
    const leftover = state;
    state = null;
    await devLogin(page, "Kim Brenner");
    await cleanUp(page, leftover);
  });

  test("Übersicht, Laufende Aufgaben, Notizen, Plan, Protokolle, Löschsperre", async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });

    const run = `${testInfo.project.name} ${Date.now()}`;
    const current: State = {
      title: `AK E2E AK ${run}`,
      area: `E2E Bereich ${run}`,
      element: `E2E Element ${run}`,
      workspace: null,
      meetings: [],
    };
    state = current;
    const { title, area } = current;
    const pointKim = `E2E Punkt Kim ${run}`;
    const pointNobody = `E2E Punkt offen ${run}`;
    const areaNote = `E2E Bereichsnotiz ${run}`;
    const groupNote = `E2E AK-Notiz ${run}`;
    const meetingTitle = `E2E Treffen ${run}`;
    const meetingTodo = `E2E To-do ${run}`;
    const decision = `E2E Beschluss ${run}`;

    // --- Overview --------------------------------------------------------------
    await devLogin(page, "Kim Brenner");
    await page.goto("/arbeitskreise");
    await expectPageReady(page, "AKs");
    const demo = region(page, "AK Demo & Route");
    await expect(demo).toBeVisible();
    await expect(demo.getByText(/^(\d+ Verzug|\d+ wackelt|Alles im Plan)$/).first()).toBeVisible();
    await expect(demo.getByText(/^(\d+\/\d+ To-dos erledigt|Noch nichts geplant)$/)).toBeVisible();
    await expect(demo.getByText(/^Nächster Termin:/)).toBeVisible();
    await expect(page.getByText("@example.org")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Als beschlossen markieren" })).toHaveCount(0);
    await expectNoHorizontalScroll(page);

    // --- Own AK and department through "AKs verwalten" -------------------------
    await page.getByRole("link", { name: "AKs verwalten" }).click();
    await expect(page).toHaveURL(/\/arbeitskreise\/verwalten$/);
    await expectPageReady(page, "AKs verwalten");
    const create = page.getByRole("form", { name: "AK hinzufügen" });
    await create.getByRole("textbox", { name: "AK hinzufügen" }).fill(`E2E AK ${run}`);
    await create.getByRole("button", { name: "Anlegen" }).click();
    const board = page.getByRole("region", { name: title, exact: true });
    await expect(board).toBeVisible();
    const addArea = page.getByRole("form", { name: `Aufgabenbereich hinzufügen in ${title}` });
    await addArea.getByRole("textbox", { name: "Aufgabenbereich hinzufügen" }).fill(area);
    await addArea.getByRole("button", { name: "Hinzufügen" }).click();
    await expect(board.getByRole("listitem", { name: area, exact: true })).toBeVisible();
    await board.getByRole("button", { name: "Mach ich mit" }).click();
    await expect(board.getByRole("list", { name: `Teilnehmende ${title}` })).toContainText("Kim Brenner");

    // --- The card opens the workspace -------------------------------------------
    await page.getByRole("link", { name: "Alle AKs" }).click();
    await expectPageReady(page, "AKs");
    const own = region(page, title);
    await expect(own.getByText("Alles im Plan")).toBeVisible();
    await expect(own.getByText("Noch nichts geplant")).toBeVisible();
    await expect(own.getByRole("button", { name: "Austreten" })).toBeVisible();
    await own.getByRole("link").first().click();
    await expect(page).toHaveURL(/\/arbeitskreise\/[0-9a-f-]{36}$/);
    current.workspace = new URL(page.url()).pathname;
    await expectPageReady(page, title);
    const attention = region(page, "Braucht Aufmerksamkeit");
    await expect(attention.getByText("Nichts überfällig, nichts wackelt.")).toBeVisible();
    await expectNoHorizontalScroll(page);

    // --- Laufende Aufgaben: first point creates the element, second does not --
    const department = region(page, area);
    const ongoing = region(department, /^Laufende Aufgaben/);
    await expect(ongoing.getByText("Noch keine Punkte.")).toBeVisible();
    const form = ongoing.getByRole("form", { name: `Punkt ohne Termin hinzufügen: ${area}` });
    await form.getByRole("textbox", { name: "Punkt ohne Termin hinzufügen" }).fill(pointKim);
    await form.getByRole("combobox", { name: "Wer? (optional)" }).selectOption({ label: "Kim Brenner" });
    await form.getByRole("button", { name: "Hinzufügen" }).click();
    const openPoints = ongoing.getByRole("list", { name: `Offene Punkte ${area}` });
    await expect(openPoints.getByRole("listitem", { name: pointKim })).toContainText("Kim Brenner");
    await expect(bar(page, "Laufende Aufgaben angelegt (im Plan ausgeblendet)")).toBeVisible();
    await expect(bar(page, "Laufende Aufgaben angelegt")).toHaveCount(0, { timeout: 10_000 });

    const pointInput = form.getByRole("textbox", { name: "Punkt ohne Termin hinzufügen" });
    await pointInput.fill(pointNobody);
    await pointInput.press("Enter");
    await expect(openPoints.getByRole("listitem")).toHaveCount(2);
    await expect(pointInput).toHaveValue("");
    // Same element: no second "angelegt".
    await expect(bar(page, "Laufende Aufgaben angelegt")).toHaveCount(0);
    await expect(region(page, /^Laufende Aufgaben/)).toHaveCount(1);

    // --- Hidden in the plan -----------------------------------------------------
    await page.goto("/");
    await expectPageReady(page, /^Plan /);
    await expect(page.getByText(/Laufende Aufgaben/).filter({ visible: true })).toHaveCount(0);
    if (!isNarrow(page)) {
      await page.getByRole("group", { name: "Ansicht" }).getByRole("button", { name: "Liste" }).click();
      await expect(page.getByRole("button", { name: "Meine AKs" })).toBeVisible();
      await expect(page.getByText(/Laufende Aufgaben/).filter({ visible: true })).toHaveCount(0);
      await page.getByRole("group", { name: "Ansicht" }).getByRole("button", { name: "Gantt" }).click();
    }

    // --- "/meine": under "Ohne Datum", opens the workspace ----------------------
    await page.goto("/meine");
    await expectPageReady(page, "Meine Aufgaben");
    const undated = page.getByRole("list", { name: "Ohne Datum" });
    const mine = undated.getByRole("listitem", { name: pointKim, exact: true });
    await expect(mine).toContainText(`Laufende Aufgaben · ${area}`);
    await mine.getByRole("link").click();
    await expect(page).toHaveURL(new RegExp(`${current.workspace}$`));
    await expectPageReady(page, title);

    // --- Tick off, "Rückgängig" -------------------------------------------------
    await openPoints.getByRole("checkbox", { name: `Erledigt: ${pointKim}` }).click();
    await expect(ongoing.locator("summary", { hasText: "Erledigt (1)" })).toBeVisible();
    await expect(openPoints.getByRole("listitem")).toHaveCount(1);
    await undo(page, `Erledigt: ${pointKim}`);
    await expect(openPoints.getByRole("listitem", { name: pointKim })).toBeVisible();
    await expect(ongoing.locator("summary", { hasText: /^Erledigt/ })).toHaveCount(0);

    // --- Department note: save, edit --------------------------------------------
    const notes = region(department, "Notizen");
    await notes.getByRole("textbox", { name: "Neue Notiz" }).fill(areaNote);
    await notes.getByRole("button", { name: "Notiz speichern" }).click();
    await expect(notes.getByText("Gespeichert ✓")).toBeVisible();
    await expect(notes.getByText(areaNote)).toBeVisible();
    await expect(notes.getByText(/^Kim Brenner · /)).toBeVisible();
    await notes.getByRole("button", { name: "Bearbeiten" }).click();
    await notes.getByRole("textbox", { name: "Notiz bearbeiten" }).fill(`${areaNote} geändert`);
    await notes.getByRole("button", { name: "Speichern", exact: true }).click();
    await expect(notes.getByText(`${areaNote} geändert`)).toBeVisible();
    await expect(notes.getByText(/· bearbeitet$/)).toBeVisible();

    // --- AK note; Alex sees no controls, the server refuses his change ----------
    const groupNotes = region(page, "Notizen zum AK");
    await groupNotes.getByRole("textbox", { name: "Neue Notiz" }).fill(groupNote);
    await groupNotes.getByRole("button", { name: "Notiz speichern" }).click();
    await expect(groupNotes.getByText(groupNote)).toBeVisible();
    // Kim opens the edit form, then the browser signs in as Alex in another tab.
    await groupNotes.getByRole("button", { name: "Bearbeiten" }).click();
    await groupNotes.getByRole("textbox", { name: "Notiz bearbeiten" }).fill(`${groupNote} von Alex`);
    const alex = await page.context().newPage();
    await devLogin(alex, "Alex Rauch");
    await alex.goto(current.workspace);
    await expectPageReady(alex, title);
    const alexNotes = region(alex, "Notizen zum AK");
    await expect(alexNotes.getByText(groupNote)).toBeVisible();
    await expect(alexNotes.getByRole("button", { name: "Bearbeiten" })).toHaveCount(0);
    await expect(alexNotes.getByRole("button", { name: "Löschen" })).toHaveCount(0);
    await alex.close();
    await groupNotes.getByRole("button", { name: "Speichern", exact: true }).click();
    await expect(groupNotes.getByText("Nur eigene Notizen lassen sich ändern.")).toBeVisible();
    await devLogin(page, "Kim Brenner");
    await page.goto(current.workspace);
    await expectPageReady(page, title);
    await expect(groupNotes.getByText(groupNote, { exact: true })).toBeVisible();

    // --- "+ Plan-Element" with AK and department filled in -----------------------
    const plan = region(department, "Plan");
    await plan.getByRole("button", { name: "+ Plan-Element" }).click();
    const dialog = page.getByRole("dialog", { name: "Neues Element" });
    await expect(dialog.locator('select[name="group"] option:checked')).toHaveText(title);
    await expect(dialog.locator('select[name="department"] option:checked')).toHaveText(area);
    await dialog.getByLabel("Name", { exact: true }).fill(current.element);
    await dialog.getByRole("group", { name: "Art" }).getByRole("button", { name: "Meilenstein" }).click();
    await dialog.getByLabel("Abstand (T)").fill("30");
    await dialog.getByRole("button", { name: "Anlegen" }).click();
    await expect(dialog).toHaveCount(0);
    const panel = page.getByRole("complementary", { name: "Details" });
    await expect(panel.getByRole("heading", { name: current.element, exact: true })).toBeVisible();
    await panel.getByRole("button", { name: "Details schließen" }).click();
    await expect(panel).toHaveCount(0);
    const openElements = plan.getByRole("list", { name: `Offene Plan-Elemente ${area}` });
    await expect(openElements.getByRole("listitem").filter({ hasText: current.element })).toBeVisible();
    await openElements.getByRole("checkbox", { name: `${current.element} als erreicht markieren` }).click();
    await expect(plan.locator("summary", { hasText: "Erreicht (1)" })).toBeVisible();
    await undo(page, /erreicht/i);
    await expect(openElements.getByRole("listitem").filter({ hasText: current.element })).toBeVisible();
    await expect(plan.locator("summary", { hasText: /^Erreicht/ })).toHaveCount(0);

    // --- Own meeting: to-do due yesterday and a decision ------------------------
    await page.goto("/protokolle");
    await page.getByRole("button", { name: "Neues Treffen" }).click();
    await expect(page).toHaveURL(/\/protokolle\/[0-9a-f-]{36}$/);
    current.meetings.push(new URL(page.url()).pathname);
    await page.getByRole("textbox", { name: "Titel", exact: true }).fill(meetingTitle);
    await Promise.all([saved(page), page.getByRole("textbox", { name: "Ort", exact: true }).click()]);
    await expect(page.getByRole("heading", { level: 1, name: meetingTitle })).toBeVisible();
    await page.getByRole("button", { name: "+ TOP hinzufügen" }).click();
    await page.getByRole("textbox", { name: "Überschrift des neuen TOPs", exact: true }).fill("E2E TOP");
    await page.keyboard.press("Enter");
    const entry = page.getByRole("form", { name: "Neuer Punkt unter E2E TOP" });
    const text = entry.getByRole("textbox", { name: "Text" });
    await expect(text).toBeFocused();
    const items = page.getByRole("list", { name: "Punkte zu E2E TOP" }).getByRole("listitem");
    await page.keyboard.press("Alt+Digit4");
    await page.keyboard.type(meetingTodo);
    await entry.getByLabel("Bis wann").fill(berlinDay(-1));
    await entry.getByRole("combobox", { name: "Aufgabenbereich" }).selectOption({ label: area });
    await text.press("Enter");
    await expect(items).toHaveCount(1);
    await text.focus();
    await page.keyboard.press("Alt+Digit3");
    await page.keyboard.type(decision);
    await entry.getByRole("combobox", { name: "Aufgabenbereich" }).selectOption({ label: area });
    await text.press("Enter");
    await expect(items).toHaveCount(2);

    // --- Workspace: to-do in "Braucht Aufmerksamkeit" and "Aus Protokollen" -----
    await page.goto(current.workspace);
    await expectPageReady(page, title);
    const fromMeetings = region(department, "Aus Protokollen");
    await expect(attention.getByRole("listitem", { name: meetingTodo })).toContainText(`aus ${meetingTitle}`);
    await expect(fromMeetings.getByRole("listitem", { name: meetingTodo })).toBeVisible();
    await expect(fromMeetings.getByRole("link", { name: new RegExp(`^${meetingTitle} `) })).toBeVisible();
    await expect(region(department, "Beschlüsse").getByText(decision)).toBeVisible();
    await expect(region(department, "Beschlüsse").getByText("Beschluss", { exact: true })).toBeVisible();
    await attention.getByRole("checkbox", { name: `Erledigt: ${meetingTodo}` }).click();
    await expect(attention.getByText("Nichts überfällig, nichts wackelt.")).toBeVisible();
    await expect(fromMeetings.locator("summary", { hasText: "Erledigt (1)" })).toBeVisible();
    await expect(fromMeetings.getByText("Keine offenen To-dos aus Treffen.")).toBeVisible();

    // --- Deleting the department is locked while it has points or notes --------
    await deleteMeeting(page, current.meetings.pop()!);
    await openBoard(page);
    const row = page.getByRole("region", { name: title, exact: true }).getByRole("listitem", { name: area, exact: true });
    await row.getByRole("button", { name: `Bearbeiten: ${area}` }).click();
    page.once("dialog", (dialog) => void dialog.accept());
    await row.getByRole("button", { name: "Löschen" }).click();
    await expect(row.getByText("Hat laufende Aufgaben oder Notizen – stattdessen umbenennen oder verschieben.")).toBeVisible();
    await expect(row).toBeVisible();

    // --- Unknown id ---------------------------------------------------------------
    await page.goto("/arbeitskreise/abc");
    await expectPageReady(page, "Diesen AK gibt es nicht.");
    await expect(page.getByRole("link", { name: "Alle AKs" })).toBeVisible();

    // --- Tidy up (meeting, element, points, notes, department, AK) ---------------
    state = null;
    await cleanUp(page, current);
    await expect(page.getByRole("region", { name: title, exact: true })).toHaveCount(0);

    expect(errors, errors.join("\n")).toEqual([]);
  });
});
