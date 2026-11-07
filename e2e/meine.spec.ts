import { expect, test, type Page } from "@playwright/test";
import { savePoint } from "./punkt-speichern";

// Spec 009: "Meine Aufgaben". Works only with its own elements and meetings,
// named "E2E Meine … ‹run›" and unique per run; elements of the seed are only
// read, never changed. Everything created here is deleted at the end, also
// after a failure. Needs the dev seed (Kim Brenner in "AK Demo & Route",
// Alex Rauch not; seed element "Kooperationsgespräch KVR/Polizei" of Kim late).

const AK = "AK Demo & Route";

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

function details(page: Page) {
  return page.getByRole("complementary", { name: "Details" });
}

/** Today in Europe/Berlin as "YYYY-MM-DD", moved by `days`. */
function berlinDay(days: number): string {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(new Date());
  return new Date(Date.parse(`${today}T00:00:00Z`) + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

async function openMine(page: Page) {
  await page.goto("/meine");
  await expectPageReady(page, "Meine Aufgaben");
}

/**
 * Opens a foldable section of "/meine" unless it is open already. Retries,
 * since a click right after loading can come before the page is hydrated.
 */
async function unfold(page: Page, title: RegExp) {
  const button = page.getByRole("button", { name: title });
  await expect(async () => {
    if ((await button.getAttribute("aria-expanded")) === "false") await button.click();
    await expect(button).toHaveAttribute("aria-expanded", "true", { timeout: 1000 });
  }).toPass();
}

async function unfoldAll(page: Page) {
  for (const title of [/^Später \(/, /^Aus meinen AKs/, /^Zuletzt erledigt/]) {
    if ((await page.getByRole("button", { name: title }).count()) > 0) await unfold(page, title);
  }
}

/** Card of an entry on "/meine" (any section). */
function card(page: Page, name: string) {
  return page.getByRole("listitem", { name, exact: true });
}

function doneList(page: Page) {
  return page.getByRole("list", { name: "Zuletzt erledigt" });
}

function unassignedList(page: Page) {
  return page.getByRole("list", { name: "Noch niemand eingetragen" });
}

/** "+ Element" on the plan page: a task of `days` days in Kim's AK, 20 days before the Krachparade, nobody responsible. */
async function createElement(page: Page, name: string, days: number) {
  await page.goto("/");
  await expectPageReady(page, /^Plan /);
  await page.getByRole("button", { name: "+ Element" }).filter({ visible: true }).click();
  const dialog = page.getByRole("dialog", { name: "Neues Element" });
  await dialog.getByLabel("Name", { exact: true }).fill(name);
  // The label text of the select contains its options, so it is found by name.
  await dialog.locator('select[name="group"]').selectOption({ label: AK });
  await dialog.getByRole("group", { name: "Art" }).getByRole("button", { name: "Vorgang" }).click();
  await dialog.getByLabel("Dauer in Tagen").fill(String(days));
  await dialog.getByLabel("Nachfolger").selectOption({ value: "dday" });
  await dialog.getByLabel("Abstand (T)").fill("20");
  await dialog.getByRole("button", { name: "Anlegen" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(details(page).getByRole("heading", { name, exact: true })).toBeVisible();
}

/** Deletes an own element through its panel on "/meine" (it must be listed there or unassigned). */
async function deleteElement(page: Page, name: string) {
  await openMine(page);
  await unfoldAll(page);
  if ((await card(page, name).count()) === 0) return;
  const panel = details(page);
  await expect(async () => {
    await card(page, name).first().getByRole("button").first().click();
    await expect(panel.getByRole("heading", { name, exact: true })).toBeVisible({ timeout: 2000 });
  }).toPass();
  await panel.getByRole("button", { name: "Element löschen" }).click();
  await panel.getByRole("group", { name: "Element löschen" }).getByRole("button", { name: "Löschen" }).click();
  await expect(panel).toHaveCount(0);
  await expect(card(page, name)).toHaveCount(0);
}

/** Resolves once the next server action of the meeting page has answered. */
function saved(page: Page) {
  return page.waitForResponse(
    (response) => response.request().method() === "POST" && /\/protokolle\//.test(response.url())
  );
}

/** New meeting with one to-do for Kim Brenner, due yesterday. Returns its path. */
async function createMeetingWithTodo(page: Page, title: string, todo: string): Promise<string> {
  await page.goto("/protokolle");
  await page.getByRole("button", { name: "Neues Treffen" }).click();
  await expect(page).toHaveURL(/\/protokolle\/[0-9a-f-]{36}$/);
  const url = new URL(page.url()).pathname;
  await page.getByRole("textbox", { name: "Titel", exact: true }).fill(title);
  await Promise.all([saved(page), page.getByRole("textbox", { name: "Ort", exact: true }).click()]);
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();

  await page.getByRole("button", { name: "+ TOP hinzufügen" }).click();
  await page.getByRole("textbox", { name: "Überschrift des neuen TOPs", exact: true }).fill("E2E TOP");
  await page.keyboard.press("Enter");
  const entry = page.getByRole("form", { name: "Neuer Punkt unter E2E TOP" });
  const text = entry.getByRole("textbox", { name: "Text" });
  await expect(text).toBeFocused();
  await page.keyboard.press("Alt+Digit4");
  await expect(entry.getByRole("radio", { name: /To-do/ })).toBeChecked();
  await page.keyboard.type(todo);
  await entry.getByRole("combobox", { name: "Wer" }).fill("Kim");
  await entry.getByRole("option", { name: "Kim Brenner" }).click();
  await entry.getByLabel("Bis wann").fill(berlinDay(-1));
  await savePoint(entry);
  await expect(page.getByRole("list", { name: "Punkte zu E2E TOP" }).getByRole("listitem")).toHaveCount(1);
  return url;
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

test.describe("Meine Aufgaben", () => {
  let errors: string[];
  let elements: string[];
  let meetings: string[];

  test.beforeEach(async ({ page }) => {
    errors = [];
    elements = [];
    meetings = [];
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
    // Start with the default folding of "/meine".
    await page.evaluate(() => window.localStorage.clear());
  });

  // Clean up as Kim, also after a failure.
  test.afterEach(async ({ page }) => {
    if (elements.length > 0 || meetings.length > 0) {
      await devLogin(page, "Kim Brenner");
      for (const name of elements) await deleteElement(page, name);
      for (const url of meetings) await deleteMeeting(page, url);
    }
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("Laptop: übernehmen, To-do, abhaken, Rückgängig, Protokoll, Alex", async ({ page }) => {
    test.skip(isNarrow(page), "nur auf breiten Bildschirmen");
    test.setTimeout(240_000);

    const run = Date.now().toString(36);
    const name = `E2E Meine ${run}`;
    const todo = `E2E Meine To-do ${run}`;
    const meetingTodo = `E2E Meine Protokoll ${run}`;

    // New element without anyone responsible in Kim's AK.
    elements.push(name);
    await createElement(page, name, 5);

    // "Aus meinen AKs – noch niemand eingetragen" → "Übernehmen".
    await openMine(page);
    await unfold(page, /^Aus meinen AKs – noch niemand eingetragen \(\d+\)$/);
    const free = unassignedList(page).getByRole("listitem", { name, exact: true });
    await expect(free).toBeVisible();
    await free.getByRole("button", { name: "Übernehmen" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Übernommen" })).toBeVisible();
    await expect(unassignedList(page).getByRole("listitem", { name, exact: true })).toHaveCount(0);
    await unfold(page, /^Später \(\d+\)$/);
    await expect(card(page, name)).toHaveCount(1);
    await expect(card(page, name)).toContainText("startet");

    // Panel on "/meine": a to-do without anyone appears "an deinem Element".
    await card(page, name).getByRole("button").click();
    const panel = details(page);
    await expect(panel.getByRole("heading", { name, exact: true })).toBeVisible();
    await panel.getByLabel("Neues To-do").fill(todo);
    await panel.getByRole("button", { name: "Hinzufügen" }).click();
    await expect(card(page, todo)).toContainText("an deinem Element");
    await expect(card(page, todo)).toContainText(`für ${name}`);
    await panel.getByRole("button", { name: "Details schließen" }).click();
    await expect(panel).toHaveCount(0);

    // Tick off → "Rückgängig" → open again.
    await unfold(page, /^Zuletzt erledigt \(\d+\)$/);
    await card(page, name).getByRole("checkbox", { name: `${name} erledigt` }).click();
    await expect(doneList(page).getByRole("listitem", { name, exact: true })).toBeVisible();
    await page.getByRole("status").filter({ hasText: "Erledigt" }).getByRole("button", { name: "Rückgängig" }).click();
    await expect(doneList(page).getByRole("listitem", { name, exact: true })).toHaveCount(0);
    await expect(card(page, name).getByRole("checkbox", { name: `${name} erledigt` })).toHaveAttribute(
      "aria-checked",
      "false"
    );

    // Tick off again → "Zuletzt erledigt"; untick there → open again.
    await card(page, name).getByRole("checkbox", { name: `${name} erledigt` }).click();
    const done = doneList(page).getByRole("listitem", { name, exact: true });
    await expect(done).toBeVisible();
    await expect(done.getByRole("checkbox")).toHaveAttribute("aria-checked", "true");
    await done.getByRole("checkbox", { name: `${name} erledigt` }).click();
    await expect(doneList(page).getByRole("listitem", { name, exact: true })).toHaveCount(0);
    await expect(card(page, name)).toContainText("startet");

    // Seed element of Kim is late (only read); the navigation shows a number.
    await expect(
      page
        .getByRole("list", { name: "Überfällig & Verzug" })
        .getByRole("listitem", { name: "Kooperationsgespräch KVR/Polizei", exact: true })
    ).toBeVisible();
    const badge = page.getByRole("navigation", { name: "Hauptnavigation" }).getByLabel(/^\d+ überfällig$/);
    await expect(badge).toBeVisible();
    expect(Number(await badge.textContent())).toBeGreaterThanOrEqual(1);

    // Own meeting with a to-do for Kim due yesterday → overdue, "Protokoll".
    const url = await createMeetingWithTodo(page, `E2E Meine Treffen ${run}`, meetingTodo);
    meetings.push(url);
    await openMine(page);
    const late = page.getByRole("list", { name: "Überfällig & Verzug" }).getByRole("listitem", { name: meetingTodo });
    await expect(late).toBeVisible();
    await expect(late).toContainText("Protokoll");
    await late.getByRole("link").click();
    await expect(page).toHaveURL(new RegExp(`${url}$`));
    await expect(page.getByRole("heading", { level: 1, name: `E2E Meine Treffen ${run}` })).toBeVisible();
    await Promise.all([saved(page), page.getByRole("checkbox", { name: `Erledigt: ${meetingTodo}` }).check()]);
    await openMine(page);
    await unfold(page, /^Zuletzt erledigt \(\d+\)$/);
    await expect(doneList(page).getByRole("listitem", { name: meetingTodo })).toBeVisible();

    // Alex: Kim's element is not in Alex's list.
    await devLogin(page, "Alex Rauch");
    await openMine(page);
    await unfoldAll(page);
    await expect(card(page, name)).toHaveCount(0);
    await expect(card(page, todo)).toHaveCount(0);
    await expectNoHorizontalScroll(page);
  });

  test("Handy: Liste, Blatt, Kästchen, kein waagrechtes Scrollen", async ({ page }) => {
    test.skip(!isNarrow(page), "nur auf schmalen Bildschirmen");
    test.setTimeout(180_000);

    const run = Date.now().toString(36);
    const name = `E2E Meine Handy ${run}`;
    elements.push(name);
    await createElement(page, name, 5);

    await openMine(page);
    await expect(
      page.getByRole("navigation", { name: "Navigation", exact: true }).getByLabel(/^\d+ überfällig$/)
    ).toBeVisible();
    await unfold(page, /^Aus meinen AKs/);
    await unassignedList(page).getByRole("listitem", { name, exact: true }).getByRole("button", { name: "Übernehmen" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Übernommen" })).toBeVisible();
    await expect(unassignedList(page).getByRole("listitem", { name, exact: true })).toHaveCount(0);
    await unfold(page, /^Später \(\d+\)$/);
    await expect(card(page, name)).toContainText("startet");
    await expectNoHorizontalScroll(page);

    // Tapping opens the sheet from the bottom.
    await card(page, name).getByRole("button").click();
    const sheet = details(page);
    await expect(sheet.getByRole("heading", { name, exact: true })).toBeVisible();
    await expect(sheet).toBeInViewport();
    await expectNoHorizontalScroll(page);
    await sheet.getByRole("button", { name: "Details schließen" }).click();
    await expect(sheet).toHaveCount(0);

    // The box is big enough and works; "Rückgängig" opens it again.
    const box = card(page, name).getByRole("checkbox", { name: `${name} erledigt` });
    const size = (await box.boundingBox())!;
    expect(size.width).toBeGreaterThanOrEqual(44);
    expect(size.height).toBeGreaterThanOrEqual(44);
    await box.click();
    await page.getByRole("status").filter({ hasText: "Erledigt" }).getByRole("button", { name: "Rückgängig" }).click();
    await expect(card(page, name).getByRole("checkbox", { name: `${name} erledigt` })).toHaveAttribute(
      "aria-checked",
      "false"
    );
    await expect(card(page, name)).toContainText("startet");
    await expectNoHorizontalScroll(page);
  });
});
