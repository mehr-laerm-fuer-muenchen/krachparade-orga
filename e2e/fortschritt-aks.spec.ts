import { expect, test, type Locator, type Page } from "@playwright/test";

// Spec 024: progress on the AK cards and in the department heads, which are
// buttons. Runs on the shared dev database and never changes seed data: it
// works with its own working group "E2E AK ‹run›" and department "E2E
// Bereich ‹run›" and deletes both again at the end, also after a failure.
//
// Next.js keeps the previous page hidden in the DOM, so locators go by role
// (which skips hidden elements) or are filtered to visible ones.

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

function region(scope: Page | Locator, name: string | RegExp) {
  return scope.getByRole("region", { name, exact: typeof name === "string" });
}

/** The head of a department: a button inside its h2. */
function head(department: Locator) {
  return department.getByRole("heading", { level: 2 }).getByRole("button");
}

async function openBoard(page: Page) {
  await page.goto("/arbeitskreise/verwalten");
  await expectPageReady(page, "AKs verwalten");
}

type State = { title: string; area: string; workspace: string | null };

/** Points of the department, then the department (its empty "Laufende Aufgaben" go with it) and the AK. */
async function cleanUp(page: Page, state: State) {
  if (state.workspace) {
    await page.goto(state.workspace);
    await expectPageReady(page, state.title);
    const department = region(page, state.area);
    if ((await department.count()) > 0) {
      const toggle = head(department);
      if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
      const ongoing = region(department, /^Laufende Aufgaben/);
      const done = ongoing.locator("summary", { hasText: /^Erledigt/ });
      if ((await done.count()) > 0 && (await done.locator("xpath=..").getAttribute("open")) === null) {
        await done.click();
      }
      const points = ongoing.getByRole("button", { name: /^Punkt löschen: / });
      while ((await points.count()) > 0) {
        const before = await points.count();
        await points.first().click();
        await expect(points).toHaveCount(before - 1);
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

test.describe("Fortschritt in den AKs", () => {
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

  test("Karte und Bereichs-Kopf zeigen den Fortschritt, der Kopf klappt auf und zu", async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });

    const run = `${testInfo.project.name} ${Date.now()}`;
    const current: State = { title: `AK E2E AK ${run}`, area: `E2E Bereich ${run}`, workspace: null };
    state = current;
    const { title, area } = current;
    const point = `E2E Punkt ${run}`;

    // --- Own AK with a department ---------------------------------------------
    await devLogin(page, "Kim Brenner");
    await openBoard(page);
    const create = page.getByRole("form", { name: "AK hinzufügen" });
    await create.getByRole("textbox", { name: "AK hinzufügen" }).fill(`E2E AK ${run}`);
    await create.getByRole("button", { name: "Anlegen" }).click();
    const board = page.getByRole("region", { name: title, exact: true });
    await expect(board).toBeVisible();
    const addArea = page.getByRole("form", { name: `Aufgabenbereich hinzufügen in ${title}` });
    await addArea.getByRole("textbox", { name: "Aufgabenbereich hinzufügen" }).fill(area);
    await addArea.getByRole("button", { name: "Hinzufügen" }).click();
    await expect(board.getByRole("listitem", { name: area, exact: true })).toBeVisible();

    // --- Empty: "Noch nichts geplant" -------------------------------------------
    await page.goto("/arbeitskreise");
    await expectPageReady(page, "AKs");
    const card = region(page, title);
    await expect(card.getByText("Noch nichts geplant")).toBeVisible();
    await card.getByRole("link").first().click();
    await expect(page).toHaveURL(/\/arbeitskreise\/[0-9a-f-]{36}$/);
    current.workspace = new URL(page.url()).pathname;
    await expectPageReady(page, title);

    // --- One point without a date: "0/1" ----------------------------------------
    const department = region(page, area);
    const toggle = head(department);
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(toggle).not.toContainText("To-dos");
    const ongoing = region(department, /^Laufende Aufgaben/);
    const form = ongoing.getByRole("form", { name: `Punkt ohne Termin hinzufügen: ${area}` });
    await form.getByRole("textbox", { name: "Punkt ohne Termin hinzufügen" }).fill(point);
    await form.getByRole("button", { name: "Hinzufügen" }).click();
    await expect(ongoing.getByRole("listitem", { name: point })).toBeVisible();
    await expect(toggle).toContainText("0/1 To-dos");
    await expect(toggle).not.toContainText("Alles erledigt ✓");
    await expectNoHorizontalScroll(page);

    await page.goto("/arbeitskreise");
    await expectPageReady(page, "AKs");
    await expect(card.getByText("0/1 To-dos erledigt")).toBeVisible();
    await expect(card.getByText("0/0 Plan-Elemente erreicht")).toBeVisible();

    // --- Tick off: "Alles erledigt ✓" and "1/1" -----------------------------------
    await page.goto(current.workspace);
    await expectPageReady(page, title);
    await ongoing.getByRole("checkbox", { name: `Erledigt: ${point}` }).click();
    await expect(toggle).toContainText("Alles erledigt ✓");
    await expect(toggle).not.toContainText("To-dos");

    await page.goto("/arbeitskreise");
    await expectPageReady(page, "AKs");
    await expect(card.getByText("1/1 To-dos erledigt")).toBeVisible();
    await expectNoHorizontalScroll(page);

    // --- The head opens and closes, by click and by keyboard, remembered -------
    await page.goto(current.workspace);
    await expectPageReady(page, title);
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(ongoing).toBeVisible();
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(ongoing).toHaveCount(0);
    await page.reload();
    await expectPageReady(page, title);
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await toggle.focus();
    await page.keyboard.press("Enter");
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(ongoing).toBeVisible();
    await page.keyboard.press("Space");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    const box = await toggle.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);

    // --- Tidy up (point, department, AK) ------------------------------------------
    state = null;
    await cleanUp(page, current);
    await expect(page.getByRole("region", { name: title, exact: true })).toHaveCount(0);

    expect(errors, errors.join("\n")).toEqual([]);
  });
});
