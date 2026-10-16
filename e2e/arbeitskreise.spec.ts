import { expect, test, type Page } from "@playwright/test";

// Spec 005: working groups ("AKs") and departments ("Aufgabenbereiche"). Runs
// on the shared dev database: every name is unique per run, every check is
// relative, and everything created here is deleted again at the end.
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

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow, "Seite scrollt horizontal").toBeLessThanOrEqual(0);
}

async function openBoard(page: Page) {
  // Spec 018: managing the working groups moved to /arbeitskreise/verwalten.
  await page.goto("/arbeitskreise/verwalten");
  await expect(page.getByRole("heading", { level: 1, name: "AKs verwalten" })).toBeVisible();
  await expect(page.getByText("Lade AKs …").filter({ visible: true })).toHaveCount(0);
}

function card(page: Page, title: string) {
  return page.getByRole("region", { name: title, exact: true });
}

function departmentRow(page: Page, groupTitle: string, name: string) {
  return card(page, groupTitle).getByRole("listitem", { name, exact: true });
}

async function createGroup(page: Page, input: string) {
  const form = page.getByRole("form", { name: "AK hinzufügen" });
  await form.getByRole("textbox", { name: "AK hinzufügen" }).fill(input);
  await form.getByRole("button", { name: "Anlegen" }).click();
}

async function openGroupMenu(page: Page, title: string) {
  const menu = card(page, title).getByRole("button", { name: `Menü ${title}` });
  if ((await menu.getAttribute("aria-expanded")) !== "true") await menu.click();
}

async function openDepartment(page: Page, groupTitle: string, name: string) {
  const row = departmentRow(page, groupTitle, name);
  const toggle = row.getByRole("button", { name: `Bearbeiten: ${name}` });
  if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
  return row;
}

/** Deletes a working group with all its departments, if it (still) exists. */
async function removeGroup(page: Page, title: string) {
  const region = card(page, title);
  if ((await region.count()) === 0) return;
  const rows = region.getByRole("list", { name: `Aufgabenbereiche ${title}` }).getByRole("listitem");
  while ((await rows.count()) > 0) {
    const name = (await rows.first().getAttribute("aria-label")) ?? "";
    const before = await rows.count();
    const row = await openDepartment(page, title, name);
    page.once("dialog", (dialog) => void dialog.accept());
    await row.getByRole("button", { name: "Löschen" }).click();
    await expect(rows).toHaveCount(before - 1);
  }
  await openGroupMenu(page, title);
  page.once("dialog", (dialog) => void dialog.accept());
  await region.getByRole("button", { name: "AK löschen" }).click();
  await expect(region).toHaveCount(0);
}

async function deleteMeeting(page: Page, url: string) {
  await page.goto(url);
  const head = page.getByRole("region", { name: "Kopf" });
  await expect(head.or(page.getByText("This page could not be found."))).toBeVisible();
  if ((await head.count()) === 0) return;
  page.once("dialog", (dialog) => void dialog.accept());
  await head.getByRole("button", { name: "Treffen löschen" }).click();
  await expect(page).toHaveURL(/\/protokolle$/);
}

test.describe("Arbeitskreise", () => {
  const groups: string[] = [];
  const meetings: string[] = [];

  test.beforeEach(async ({ page }) => {
    // Locally the Next.js dev tools button covers the first tab on phones.
    await page.addInitScript(() => {
      const style = document.createElement("style");
      style.textContent = "nextjs-portal { display: none !important; }";
      document.addEventListener("DOMContentLoaded", () => document.head.append(style));
    });
  });

  test.afterEach(async ({ page }) => {
    if (groups.length === 0 && meetings.length === 0) return;
    await devLogin(page, "Kim Brenner");
    for (const url of meetings.splice(0)) await deleteMeeting(page, url);
    await openBoard(page);
    for (const title of groups.splice(0)) await removeGroup(page, title);
  });

  test("AKs anlegen, Bereiche verschieben, Mitmachen, Löschregeln", async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    const run = `${testInfo.project.name} ${Date.now()}`;
    const testGroup = `AK Test ${run}`;
    const otherGroup = `AK Doppelt ${run}`;
    const area = `Bereich ${run}`;
    groups.push(testGroup, otherGroup);

    // --- Redirect, navigation, notice ------------------------------------------
    await devLogin(page, "Kim Brenner");
    await page.goto("/referate");
    await expect(page).toHaveURL(/\/arbeitskreise$/);
    await expect(page.getByRole("heading", { level: 1, name: "AKs" })).toBeVisible();
    const nav = isNarrow(page)
      ? page.getByRole("navigation", { name: "Navigation", exact: true })
      : page.getByRole("navigation", { name: "Hauptnavigation" });
    await expect(nav.getByRole("link", { name: "AKs", exact: true })).toHaveAttribute("aria-current", "page");
    await expect(nav.getByText("Referate")).toHaveCount(0);
    await openBoard(page);
    await expect(nav.getByRole("link", { name: "AKs", exact: true })).toHaveAttribute("aria-current", "page");
    await expect(page.getByText(/^Die AKs müssen noch gemeinsam definiert werden\./)).toBeVisible();
    await expect(page.getByRole("button", { name: "Als beschlossen markieren" })).toBeVisible();
    // Names only, never e-mail addresses.
    await expect(page.getByText("@example.org")).toHaveCount(0);

    // --- Create: "AK" prefix once, duplicates refused ------------------------
    await createGroup(page, `Test ${run}`);
    await expect(page.getByRole("heading", { level: 2, name: testGroup, exact: true })).toBeVisible();
    await createGroup(page, `AK Doppelt ${run}`);
    await expect(page.getByRole("heading", { level: 2, name: otherGroup, exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: `AK AK Doppelt ${run}` })).toHaveCount(0);
    await createGroup(page, `test ${run}`);
    await expect(
      page.getByRole("form", { name: "AK hinzufügen" }).getByRole("alert")
    ).toHaveText("Diesen AK gibt es schon.");

    // --- Join and leave ------------------------------------------------------
    const members = card(page, testGroup);
    await members.getByRole("button", { name: "Mach ich mit" }).click();
    await expect(members.getByRole("list", { name: `Teilnehmende ${testGroup}` })).toContainText("Kim Brenner");
    await expect(members.getByRole("heading", { name: "Teilnehmende (1)" })).toBeVisible();
    await members.getByRole("button", { name: "Austreten" }).click();
    await expect(members.getByRole("list", { name: `Teilnehmende ${testGroup}` })).toHaveCount(0);
    await expect(members.getByRole("button", { name: "Mach ich mit" })).toBeVisible();

    // --- Department: add, move away and back -----------------------------------
    const addArea = page.getByRole("form", { name: `Aufgabenbereich hinzufügen in ${testGroup}` });
    await addArea.getByRole("textbox", { name: "Aufgabenbereich hinzufügen" }).fill(area);
    await addArea.getByRole("button", { name: "Hinzufügen" }).click();
    await expect(departmentRow(page, testGroup, area)).toBeVisible();

    let row = await openDepartment(page, testGroup, area);
    await expectNoHorizontalScroll(page);
    await row.getByRole("combobox", { name: "In anderen AK verschieben" }).selectOption({ label: otherGroup });
    await expect(departmentRow(page, otherGroup, area)).toBeVisible();
    await expect(departmentRow(page, testGroup, area)).toHaveCount(0);
    await page.reload();
    await expect(departmentRow(page, otherGroup, area)).toBeVisible();

    row = await openDepartment(page, otherGroup, area);
    await row.getByRole("combobox", { name: "In anderen AK verschieben" }).selectOption({ label: testGroup });
    await expect(departmentRow(page, testGroup, area)).toBeVisible();
    await page.reload();
    await expect(departmentRow(page, testGroup, area)).toBeVisible();
    await expect(departmentRow(page, otherGroup, area)).toHaveCount(0);

    // --- Deleting the group is locked while it holds a department -------------
    await openGroupMenu(page, testGroup);
    await expect(card(page, testGroup).getByRole("button", { name: "AK löschen" })).toBeDisabled();
    await expect(
      card(page, testGroup).getByText("Erst die Aufgabenbereiche in einen anderen AK verschieben.")
    ).toBeVisible();
    await expectNoHorizontalScroll(page);

    // --- Quick entry: "Aufgabenbereich" grouped by AK --------------------------
    await page.goto("/protokolle");
    await page.getByRole("button", { name: "Neues Treffen" }).click();
    await expect(page).toHaveURL(/\/protokolle\/[0-9a-f-]{36}$/);
    meetings.push(new URL(page.url()).pathname);
    await page.getByRole("button", { name: "+ TOP hinzufügen" }).click();
    await page.getByRole("textbox", { name: "Überschrift des neuen TOPs", exact: true }).fill("E2E TOP");
    await page.keyboard.press("Enter");
    const entry = page.getByRole("form", { name: "Neuer Punkt unter E2E TOP" });
    const select = entry.getByRole("combobox", { name: "Aufgabenbereich" });
    await expect(select).toBeVisible();
    await expect(select.locator(`optgroup[label="${testGroup}"] > option`)).toHaveText([area]);
    await expect(select.locator('optgroup[label^="AK "]').first()).toBeAttached();
    await select.selectOption({ label: area });
    await entry.getByRole("textbox", { name: "Text" }).fill(`E2E Punkt ${run}`);
    await entry.getByRole("textbox", { name: "Text" }).press("Enter");
    const items = page.getByRole("list", { name: "Punkte zu E2E TOP" }).getByRole("listitem");
    await expect(items).toHaveCount(1);
    await expect(items.first()).toContainText(`Aufgabenbereich: ${area} · ${testGroup}`);

    // --- A department used in minutes cannot be deleted ------------------------
    await openBoard(page);
    row = await openDepartment(page, testGroup, area);
    await expect(row.getByRole("button", { name: "Löschen" })).toBeDisabled();
    await expect(
      row.getByText("Wird in Protokollen verwendet – stattdessen umbenennen oder verschieben.")
    ).toBeVisible();

    // --- Without the meeting: delete department, then the group ---------------
    await deleteMeeting(page, meetings.pop()!);
    await openBoard(page);
    row = await openDepartment(page, testGroup, area);
    page.once("dialog", (dialog) => void dialog.accept());
    await row.getByRole("button", { name: "Löschen" }).click();
    await expect(departmentRow(page, testGroup, area)).toHaveCount(0);
    await openGroupMenu(page, testGroup);
    page.once("dialog", (dialog) => void dialog.accept());
    await card(page, testGroup).getByRole("button", { name: "AK löschen" }).click();
    await expect(card(page, testGroup)).toHaveCount(0);

    await expectNoHorizontalScroll(page);
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("Nicht-Admin: anlegen, mitmachen, löschen; keine Admin-Bedienelemente", async ({ page }, testInfo) => {
    const run = `${testInfo.project.name} ${Date.now()}`;
    const title = `AK Alex ${run}`;
    groups.push(title);

    await devLogin(page, "Alex Rauch");
    await openBoard(page);
    await expect(page.getByText(/^Die AKs müssen noch gemeinsam definiert werden\./)).toBeVisible();
    await expect(page.getByRole("button", { name: "Als beschlossen markieren" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Wieder als Vorschlag markieren" })).toHaveCount(0);
    await expect(page.getByLabel("Person eintragen")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Austragen" })).toHaveCount(0);
    await expect(page.getByText("@example.org")).toHaveCount(0);

    await createGroup(page, `Alex ${run}`);
    const region = card(page, title);
    await expect(region).toBeVisible();
    await region.getByRole("button", { name: "Mach ich mit" }).click();
    await expect(region.getByRole("list", { name: `Teilnehmende ${title}` })).toContainText("Alex Rauch");
    await expectNoHorizontalScroll(page);

    await openGroupMenu(page, title);
    page.once("dialog", (dialog) => void dialog.accept());
    await region.getByRole("button", { name: "AK löschen" }).click();
    await expect(region).toHaveCount(0);
  });
});
