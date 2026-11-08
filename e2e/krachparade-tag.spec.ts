import { expect, test, type Locator, type Page } from "@playwright/test";

// Spec 030: the day of the Krachparade. Works only with its own "E2E …"
// column, entries and roles, unique per run; entries of the seed are never
// changed. Everything created here is deleted at the end, also after a
// failure. Needs the dev seed (member Kim Brenner, at least one column).

/** Pixels per minute of the day plan (see day-timeline.tsx). */
const PX_PER_MINUTE = 1.5;

function isNarrow(page: Page) {
  return (page.viewportSize()?.width ?? 0) < 1024;
}

function escape(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function devLogin(page: Page, name: string) {
  await page.goto("/dev/login");
  await page.getByRole("button", { name: new RegExp(`Als ${name} anmelden`) }).click();
  await expect(page).toHaveURL(/\/$/);
}

async function openDay(page: Page, path = "/krachparade") {
  await page.goto(path);
  await expect(page.getByRole("heading", { level: 1, name: /^Krachparade · / })).toBeVisible();
  await expect(page.getByText(/^Lade .+ …$/).filter({ visible: true })).toHaveCount(0);
}

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow, "Seite scrollt horizontal").toBeLessThanOrEqual(0);
}

function panel(page: Page, label: "Eintrag" | "Spalte" | "Rolle") {
  return page.getByRole("complementary", { name: label });
}

async function closePanel(page: Page, label: "Eintrag" | "Spalte" | "Rolle") {
  await panel(page, label).getByRole("button", { name: "Schließen", exact: true }).click();
  await expect(panel(page, label)).toHaveCount(0);
}

/** Types into a field, leaves it and waits until the panel shows "Gespeichert ✓". */
async function saveField(field: Locator, value: string) {
  await field.fill(value);
  await field.blur();
}

/** The block of an entry in the day plan (laptop). */
function block(page: Page, title: string) {
  return page.getByRole("button", { name: new RegExp(`^${escape(title)}, `) });
}

async function dismissBar(page: Page) {
  const close = page.getByRole("button", { name: "Hinweis schließen" });
  if (await close.isVisible()) await close.click();
}

/** Drags with the mouse from the point (x, y) by (dx, dy). */
async function drag(page: Page, x: number, y: number, dx: number, dy: number) {
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx / 2, y + dy / 2, { steps: 4 });
  await page.mouse.move(x + dx, y + dy, { steps: 4 });
  await page.mouse.up();
}

async function center(locator: Locator) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) throw new Error("kein Rahmen");
  return { x: box.x + box.width / 2, y: box.y + box.height / 2, box };
}

/** Creates the column and an entry 10:00–11:00 in it through the panel or sheet. */
async function createColumnAndEntry(page: Page, column: string, title: string) {
  await page.getByRole("button", { name: "+ Spalte" }).filter({ visible: true }).click();
  const name = panel(page, "Spalte").getByRole("textbox", { name: "Name" });
  await expect(name).toBeFocused();
  await saveField(name, column);
  await expect(panel(page, "Spalte").getByRole("heading", { name: column })).toBeVisible();
  await closePanel(page, "Spalte");

  await page.getByRole("button", { name: "+ Eintrag" }).filter({ visible: true }).click();
  const entry = panel(page, "Eintrag");
  const titleField = entry.getByRole("textbox", { name: "Titel" });
  await expect(titleField).toBeFocused();
  await saveField(titleField, title);
  await expect(entry.getByRole("heading", { name: title })).toBeVisible();
  await entry.getByRole("combobox", { name: "Spalte" }).selectOption({ label: column });
  const meta = entry.getByTestId("entry-panel-meta");
  await expect(meta).toContainText(column);
  await saveField(entry.getByLabel("von", { exact: true }), "10:00");
  await expect(meta).toContainText("10:00–13:00");
  await saveField(entry.getByLabel("bis (optional)", { exact: true }), "11:00");
  await expect(meta).toContainText("10:00–11:00");
}

/** Deletes the entry (with confirmation) from its panel or sheet. */
async function deleteOpenEntry(page: Page) {
  page.once("dialog", (dialog) => void dialog.accept());
  await panel(page, "Eintrag").getByRole("button", { name: "Eintrag löschen" }).click();
  await expect(panel(page, "Eintrag")).toHaveCount(0);
}

async function accessibleName(locator: Locator): Promise<string> {
  return locator.evaluate(
    (element) => element.getAttribute("aria-label") ?? (element.textContent ?? "").replace(/\s+/g, " ").trim()
  );
}

/**
 * Removes every "E2E …" entry, column and role that is still there (also left
 * over from an aborted earlier run; the click tests run one after another).
 */
async function cleanUp(page: Page) {
  await devLogin(page, "Kim Brenner");
  await openDay(page);
  for (let round = 0; round < 10; round++) {
    const entry = page.getByRole("button", { name: /E2E Aufbau / }).filter({ visible: true });
    if ((await entry.count()) === 0) break;
    const title = /E2E Aufbau \S+ \d+/.exec(await accessibleName(entry.first()))?.[0] ?? "E2E Aufbau ";
    await entry.first().click();
    await expect(panel(page, "Eintrag")).toBeVisible();
    await deleteOpenEntry(page);
    // Until the reloaded data arrives, the deleted entry is still listed.
    await expect(
      page.getByRole("button", { name: new RegExp(escape(title)) }).filter({ visible: true })
    ).toHaveCount(0);
  }
  for (let round = 0; round < 10; round++) {
    const column = page.getByRole("button", { name: /^Spalte E2E Spalte .* ändern$/ }).filter({ visible: true });
    if ((await column.count()) === 0) break;
    const name = await accessibleName(column.first());
    await column.first().click();
    await panel(page, "Spalte").getByRole("button", { name: "Spalte löschen" }).click();
    await expect(panel(page, "Spalte")).toHaveCount(0);
    await expect(page.getByRole("button", { name, exact: true }).filter({ visible: true })).toHaveCount(0);
  }
  await openDay(page, "/krachparade/rollen");
  for (let round = 0; round < 10; round++) {
    const role = page.getByTestId("role-card").filter({ hasText: /E2E Rolle / });
    if ((await role.count()) === 0) break;
    const title = (await role.first().getByRole("heading").textContent()) ?? "";
    await role.first().getByRole("button").first().click();
    page.once("dialog", (dialog) => void dialog.accept());
    await panel(page, "Rolle").getByRole("button", { name: "Rolle löschen" }).click();
    await expect(panel(page, "Rolle")).toHaveCount(0);
    await expect(page.getByTestId("role-card").filter({ hasText: title })).toHaveCount(0);
  }
}

test.describe("Tag der Krachparade", () => {
  let errors: string[];
  let run: string;

  test.beforeEach(async ({ page }, testInfo) => {
    errors = [];
    run = `${testInfo.project.name} ${Date.now() % 100000}`;
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

  test.afterEach(async ({ page }) => {
    await cleanUp(page);
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("Laptop: Spalte, Eintrag, Ziehen, Rückgängig, Dauer, Tastatur, Panel, Zugang", async ({ page }) => {
    test.skip(isNarrow(page), "nur auf breiten Bildschirmen");
    const column = `E2E Spalte ${run}`;
    const title = `E2E Aufbau ${run}`;

    // Access: navigation "Krachparade".
    await page.getByRole("navigation", { name: "Hauptnavigation" }).getByRole("link", { name: "Krachparade" }).click();
    await expect(page).toHaveURL(/\/krachparade$/);
    await openDay(page);

    await createColumnAndEntry(page, column, title);

    // A column with an entry cannot be deleted.
    await closePanel(page, "Eintrag");
    await page.getByRole("button", { name: `Spalte ${column} ändern` }).click();
    await expect(panel(page, "Spalte").getByTestId("track-delete-hint")).toContainText(
      "Löschen geht erst, wenn die Spalte leer ist (1 Eintrag verschieben)."
    );
    await expect(panel(page, "Spalte").getByRole("button", { name: "Spalte löschen" })).toHaveCount(0);
    await closePanel(page, "Spalte");

    // Drag by +30 minutes → 10:30–11:30, also after reloading.
    let point = await center(block(page, title));
    await drag(page, point.x, point.box.y + 12, 0, 30 * PX_PER_MINUTE);
    await expect(page.getByRole("status").filter({ hasText: `Verschoben auf 10:30 · Spalte „${column}“` })).toBeVisible();
    await expect(block(page, title)).toHaveAccessibleName(`${title}, 10:30–11:30`);
    await dismissBar(page);
    await page.reload();
    await expect(block(page, title)).toHaveAccessibleName(`${title}, 10:30–11:30`);

    // Undo restores the old values.
    point = await center(block(page, title));
    await drag(page, point.x, point.box.y + 12, 0, 30 * PX_PER_MINUTE);
    await expect(block(page, title)).toHaveAccessibleName(`${title}, 11:00–12:00`);
    await page.getByRole("button", { name: "Rückgängig" }).click();
    await expect(block(page, title)).toHaveAccessibleName(`${title}, 10:30–11:30`);
    // "Rückgängig" restores start and end one after the other: wait for both before reloading.
    await page.waitForLoadState("networkidle");
    await page.reload();
    await expect(block(page, title)).toHaveAccessibleName(`${title}, 10:30–11:30`);

    // Into the neighbouring column on the left, same time.
    const columns = page.getByRole("group", { name: /^Spalte / });
    const names = (await columns.evaluateAll((elements) => elements.map((element) => element.getAttribute("aria-label")))).map(
      (label) => (label ?? "").replace(/^Spalte /, "")
    );
    const otherName = names[names.indexOf(column) - 1];
    expect(otherName, "Spalte links von der E2E-Spalte").toBeTruthy();
    const other = page.getByRole("group", { name: `Spalte ${otherName}`, exact: true });
    point = await center(block(page, title));
    // Only the x position counts; scrolling the (tall) column into view would move the block.
    const target = await other.boundingBox();
    if (!target) throw new Error("Spalte nicht sichtbar");
    await drag(page, point.x, point.box.y + 12, target.x + target.width / 2 - point.x, 0);
    await expect(page.getByRole("status").filter({ hasText: `Verschoben auf 10:30 · Spalte „${otherName}“` })).toBeVisible();
    await dismissBar(page);

    // The lower edge changes the duration: +30 minutes → until 12:00.
    const handle = page.getByTestId("day-block").filter({ has: block(page, title) }).getByTestId("day-block-resize");
    const edge = await center(handle);
    await drag(page, edge.x, edge.y, 0, 30 * PX_PER_MINUTE);
    await expect(page.getByRole("status").filter({ hasText: `„${title}“ jetzt bis 12:00` })).toBeVisible();
    await expect(block(page, title)).toHaveAccessibleName(`${title}, 10:30–12:00`);
    await dismissBar(page);

    // Arrow down: +5 minutes.
    await block(page, title).focus();
    await page.keyboard.press("ArrowDown");
    await expect(block(page, title)).toHaveAccessibleName(`${title}, 10:35–12:05`);
    await dismissBar(page);

    // Click without dragging opens the panel: checkpoint, tick off, free text person.
    await block(page, title).click();
    const entry = panel(page, "Eintrag");
    await expect(entry.getByRole("heading", { name: title })).toBeVisible();
    const checklist = entry.getByRole("form", { name: "Checkpunkt hinzufügen" });
    await checklist.getByRole("textbox", { name: "Neuer Punkt" }).fill("E2E Punkt");
    await checklist.getByRole("button", { name: "Hinzufügen" }).click();
    await expect(entry.getByTestId("entry-checks-progress")).toHaveText("0/1");
    await entry.getByRole("checkbox", { name: "Erledigt: E2E Punkt" }).click();
    await expect(entry.getByTestId("entry-checks-progress")).toHaveText("1/1 ✓");
    await dismissBar(page);
    await entry.getByRole("combobox", { name: "Person" }).fill("E2E Person");
    await page.getByRole("option", { name: "Ohne Account: E2E Person" }).click();
    await expect(entry.getByText("Gespeichert ✓")).toBeVisible();
    await expect(page.getByTestId("day-block").filter({ has: block(page, title) })).toContainText("E2E Person");
    await expect(page.getByTestId("day-block").filter({ has: block(page, title) })).toContainText("1/1");

    // Delete the entry, then the empty column.
    await deleteOpenEntry(page);
    await expect(block(page, title)).toHaveCount(0);
    await page.getByRole("button", { name: `Spalte ${column} ändern` }).click();
    await panel(page, "Spalte").getByRole("button", { name: "Spalte löschen" }).click();
    await expect(page.getByRole("button", { name: `Spalte ${column} ändern` })).toHaveCount(0);
    await expectNoHorizontalScroll(page);

    // Access from the plan: Krachparade label → "Ablauf am Tag ansehen".
    await page.goto("/");
    await page.getByRole("button", { name: "Krachparade: Ablauf am Tag" }).click();
    await page.getByRole("dialog", { name: "Krachparade" }).getByRole("link", { name: "Ablauf am Tag ansehen ›" }).click();
    await expect(page).toHaveURL(/\/krachparade$/);
  });

  test("Handy: Liste nach Stunde, Blatt mit +15 min, Checkliste aufklappen, Zugang über Mehr", async ({ page }) => {
    test.skip(!isNarrow(page), "nur auf schmalen Bildschirmen");
    const column = `E2E Spalte ${run}`;
    const title = `E2E Aufbau ${run}`;

    // Access: "Mehr" → "Krachparade – Ablauf & Rollen".
    await page.getByRole("navigation", { name: "Navigation" }).getByRole("link", { name: "Mehr" }).click();
    await page.getByRole("link", { name: "Krachparade – Ablauf & Rollen" }).click();
    await expect(page).toHaveURL(/\/krachparade$/);
    await openDay(page);

    await createColumnAndEntry(page, column, title);
    await closePanel(page, "Eintrag");

    // The list shows the entry under "10 Uhr".
    const card = page.getByTestId("day-card").filter({ hasText: title });
    await expect(page.getByRole("region", { name: "10 Uhr" }).getByTestId("day-card").filter({ hasText: title })).toBeVisible();
    await expect(card).toContainText(column);
    await expectNoHorizontalScroll(page);

    // Sheet: +15 min, checkpoint.
    await card.getByRole("button", { name: new RegExp(escape(title)) }).click();
    const sheet = panel(page, "Eintrag");
    await sheet.getByRole("button", { name: "+15 min" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Verschoben auf 10:15" })).toBeVisible();
    await expect(sheet.getByTestId("entry-panel-meta")).toContainText("10:15–11:15");
    await dismissBar(page);
    const checklist = sheet.getByRole("form", { name: "Checkpunkt hinzufügen" });
    await checklist.getByRole("textbox", { name: "Neuer Punkt" }).fill("E2E Punkt");
    await checklist.getByRole("button", { name: "Hinzufügen" }).click();
    await expect(sheet.getByTestId("entry-checks-progress")).toHaveText("0/1");
    await expectNoHorizontalScroll(page);
    await closePanel(page, "Eintrag");

    // Open the checklist in the list and tick it off.
    await expect(card).toContainText("10:15–11:15");
    await card.getByRole("button", { name: "Checkliste 0/1" }).click();
    await card.getByRole("checkbox", { name: "Erledigt: E2E Punkt" }).click();
    await expect(card.getByRole("button", { name: "Checkliste 1/1 ✓" })).toBeVisible();
    await dismissBar(page);
  });

  test("Rollen: anlegen, unbesetzt, Person als Freitext", async ({ page }) => {
    const role = `E2E Rolle ${run}`;
    await openDay(page, "/krachparade/rollen");
    await page.getByRole("button", { name: "+ Rolle" }).click();
    const rolePanel = panel(page, "Rolle");
    const titleField = rolePanel.getByRole("textbox", { name: "Rolle" });
    await expect(titleField).toBeFocused();
    await saveField(titleField, role);
    await expect(rolePanel.getByRole("heading", { name: role })).toBeVisible();
    await closePanel(page, "Rolle");

    const card = page.getByTestId("role-card").filter({ hasText: role });
    await expect(card.getByTestId("role-people")).toHaveText("noch niemand eingetragen");
    await expect(page.getByTestId("day-summary")).toContainText("unbesetzt");

    await card.getByRole("button", { name: new RegExp(escape(role)) }).click();
    await rolePanel.getByRole("combobox", { name: "Person eintragen" }).fill("E2E Mensch");
    await page.getByRole("option", { name: "Ohne Account: E2E Mensch" }).click();
    await rolePanel.getByRole("button", { name: "Hinzufügen" }).click();
    await expect(card.getByTestId("role-people")).toHaveText("E2E Mensch");
    await expectNoHorizontalScroll(page);
  });
});
