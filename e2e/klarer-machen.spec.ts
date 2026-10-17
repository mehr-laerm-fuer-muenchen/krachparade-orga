import { expect, test, type Page } from "@playwright/test";

// Spec 023: due dates written out, progress in the panel head, the bug says
// "Feedback zur App". Works only with its own element "E2E Klarer ‹run›";
// elements of the seed are never changed. The element is deleted at the end,
// also after a failure. Needs the dev seed (member Kim Brenner, Krachparade
// 08.05.2027).

const DAY_MS = 24 * 60 * 60 * 1000;

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

/** Name button of an element in the Gantt. */
function ganttName(page: Page, name: string) {
  return page
    .getByRole("button", { name: new RegExp(`^${escape(name)}\\s*(Fix\\s*)?(\\d+\\sT (vorher|danach)|Krachparade)$`) })
    .filter({ visible: true });
}

/** "Mi 17.02.2027 · 80 T vorher" → "17.02." of the day `days` earlier. */
function dayMonthBefore(text: string, days: number): string {
  const match = /(\d{2})\.(\d{2})\.(\d{4})/.exec(text);
  if (!match) throw new Error(`Kein Datum in „${text}“`);
  const [, day, month, year] = match;
  const date = new Date(Date.parse(`${year}-${month}-${day}T00:00:00Z`) - days * DAY_MS);
  const iso = date.toISOString().slice(0, 10);
  return `${iso.slice(8, 10)}.${iso.slice(5, 7)}.`;
}

test.describe("Klarer machen", () => {
  let errors: string[];
  let created: string | null;

  test.beforeEach(async ({ page }) => {
    errors = [];
    created = null;
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
  });

  // After a failure: delete the element of this run if it is still there.
  test.afterEach(async ({ page }, testInfo) => {
    if (created !== null && testInfo.status !== testInfo.expectedStatus) {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto("/");
      await expectPageReady(page, "Plan KP27");
      await page.getByRole("group", { name: "Ansicht" }).getByRole("button", { name: "Gantt" }).click();
      if ((await ganttName(page, created).count()) > 0) {
        await ganttName(page, created).click();
        const panel = details(page);
        await panel.getByRole("button", { name: "Element löschen" }).click();
        await panel.getByRole("group", { name: "Element löschen" }).getByRole("button", { name: "Löschen" }).click();
        await expect(panel).toHaveCount(0);
      }
    }
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("Fälligkeit mit Datum, Fortschritt im Kopf", async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto("/");
    await expectPageReady(page, "Plan KP27");

    const name = `E2E Klarer ${Date.now().toString(36)}`;
    created = name;

    // Own milestone 40 days before the Krachparade; the panel opens with it.
    await page.getByRole("button", { name: "+ Element" }).filter({ visible: true }).click();
    const dialog = page.getByRole("dialog", { name: "Neues Element" });
    await dialog.getByLabel("Name", { exact: true }).fill(name);
    await dialog.getByRole("group", { name: "Art" }).getByRole("button", { name: "Meilenstein" }).click();
    await dialog.getByLabel("Nachfolger").selectOption({ value: "dday" });
    await dialog.getByLabel("Abstand (T)").fill("40");
    await dialog.getByRole("button", { name: "Anlegen" }).click();
    await expect(dialog).toHaveCount(0);
    const panel = details(page);
    await expect(panel.getByRole("heading", { name, exact: true })).toBeVisible();

    // Without to-dos there is no progress in the head.
    await expect(panel.getByTestId("detail-progress")).toHaveCount(0);
    const due = dayMonthBefore((await panel.getByTestId("detail-start").textContent())!, 3);

    // Input: unit "Tage", new labels, date line updates while typing.
    const todoText = `E2E To-do ${name}`;
    const form = panel.getByRole("form", { name: "To-do hinzufügen" });
    await form.getByLabel("Neues To-do").fill(todoText);
    await expect(form.getByText("Tage", { exact: true })).toBeVisible();
    await expect(form.getByLabel("Bezug").locator("option")).toHaveText([
      "vor Start des Elements",
      "vor Ende des Elements",
    ]);
    await form.getByLabel("Tage vorher").fill("3");
    await form.getByLabel("Bezug").selectOption("start");
    await expect(form.getByTestId("todo-due-preview")).toHaveText(new RegExp(`^fällig am \\S+ ${escape(due)}$`));
    await expectNoHorizontalScroll(page);
    await form.getByRole("button", { name: "Hinzufügen" }).click();

    // Display: "fällig ‹Datum› (3 Tage vor Start)"; head "0/1 To-dos".
    const todo = panel.getByRole("listitem").filter({ hasText: todoText });
    await expect(todo).toContainText(`fällig ${due} (3 Tage vor Start)`);
    await expect(panel.getByTestId("detail-progress")).toHaveText("0/1 To-dos");

    // Tick off: the head shows "1/1" with the tick right away.
    await todo.getByLabel(`Erledigt: ${todoText}`).check();
    await expect(panel.getByTestId("detail-progress")).toHaveText("1/1 To-dos ✓");

    // Delete the element again.
    await panel.getByRole("button", { name: "Element löschen" }).click();
    await panel.getByRole("group", { name: "Element löschen" }).getByRole("button", { name: "Löschen" }).click();
    await expect(panel).toHaveCount(0);
    created = null;
    if (!isNarrow(page)) {
      await page.getByRole("group", { name: "Ansicht" }).getByRole("button", { name: "Gantt" }).click();
      await expect(ganttName(page, name)).toHaveCount(0);
    }
  });

  test("Käfer: Feedback zur App mit Hinweiszeile", async ({ page }) => {
    await page.goto("/");
    await expectPageReady(page, "Plan KP27");
    const bug = page.getByRole("banner").getByRole("button", { name: /^Feedback zur App geben/ });
    await bug.click();
    const dialog = page.getByRole("dialog", { name: "Feedback zur App" });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByText(
        "Fehler gefunden oder Wunsch an die App? Hier rein. Inhaltliches zur Krachparade gehört in die Notizen am Element oder am AK."
      )
    ).toBeVisible();
    await expectNoHorizontalScroll(page);
    await dialog.getByRole("button", { name: "Abbrechen" }).click();
    await expect(dialog).toBeHidden();
  });
});
