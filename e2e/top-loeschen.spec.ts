import { expect, test, type Page } from "@playwright/test";
import { savePoint } from "./punkt-speichern";

// Spec 029: delete a TOP with all its items. Runs on the shared dev database
// with its own "E2E …" meeting, which is deleted at the end.

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

function saved(page: Page) {
  return page.waitForResponse(
    (response) => response.request().method() === "POST" && /\/protokolle\//.test(response.url())
  );
}

function textbox(page: Page, name: string) {
  return page.getByRole("textbox", { name, exact: true });
}

function berlinDay(days: number): string {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(new Date());
  return new Date(Date.parse(`${today}T00:00:00Z`) + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

async function createMeeting(page: Page, title: string): Promise<string> {
  await page.goto("/protokolle");
  await page.getByRole("button", { name: "Neues Treffen" }).click();
  await expect(page).toHaveURL(/\/protokolle\/[0-9a-f-]{36}$/);
  const url = new URL(page.url()).pathname;
  await textbox(page, "Titel").fill(title);
  await Promise.all([saved(page), textbox(page, "Ort").click()]);
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  return url;
}

async function deleteMeeting(page: Page, url: string) {
  await page.goto(`${url}?ansicht=bearbeiten`);
  const head = page.getByRole("region", { name: "Kopf" });
  await expect(head.or(page.getByText("This page could not be found."))).toBeVisible();
  const button = head.getByRole("button", { name: "Treffen löschen" });
  if ((await head.count()) === 0 || (await button.count()) === 0) return;
  page.once("dialog", (dialog) => void dialog.accept());
  await button.click();
  await expect(page).toHaveURL(/\/protokolle$/);
}

async function addTopic(page: Page, topic: string) {
  await page.getByRole("button", { name: "+ TOP hinzufügen" }).click();
  await textbox(page, "Überschrift des neuen TOPs").fill(topic);
  await page.keyboard.press("Enter");
  const entry = page.getByRole("form", { name: `Neuer Punkt unter ${topic}` });
  await expect(entry.getByRole("textbox", { name: "Text" })).toBeFocused();
  return entry;
}

function topicHeading(page: Page, topic: string) {
  return page.getByRole("heading", { level: 2, name: topic, exact: true });
}

test.describe("TOP löschen", () => {
  const created: string[] = [];

  test.beforeEach(async ({ page }) => {
    // Locally the Next.js dev tools button covers the first tab on phones.
    await page.addInitScript(() => {
      const style = document.createElement("style");
      style.textContent = "nextjs-portal { display: none !important; }";
      document.addEventListener("DOMContentLoaded", () => document.head.append(style));
    });
  });

  test.afterEach(async ({ page }) => {
    if (created.length === 0) return;
    await devLogin(page, "Kim Brenner");
    for (const url of created.splice(0)) {
      await deleteMeeting(page, url);
    }
  });

  test("TOP mit Punkten löschen, Abbrechen, leeren Entwurf löschen", async ({ page }, testInfo) => {
    const problems: string[] = [];
    page.on("pageerror", (error) => problems.push(error.message));
    page.on("console", (message) => {
      if (/hydrat/i.test(message.text())) problems.push(message.text());
    });

    const run = `${testInfo.project.name} ${Date.now()}`;
    const first = "E2E TOP eins";
    const second = "E2E TOP zwei";
    const decision = `E2E Beschluss ${run}`;
    const todo = `E2E To-do ${run}`;
    const info = `E2E Info ${run}`;

    await devLogin(page, "Kim Brenner");
    const url = await createMeeting(page, `E2E TOP löschen ${run}`);
    created.push(url);

    // --- First TOP: a decision and a to-do (Kim, due yesterday) ------------------
    const entryOne = await addTopic(page, first);
    const itemsOne = page.getByRole("list", { name: `Punkte zu ${first}` }).getByRole("listitem");
    await page.keyboard.press("Alt+Digit3");
    await page.keyboard.type(decision);
    await savePoint(entryOne);
    await expect(itemsOne).toHaveCount(1);
    await page.keyboard.press("Alt+Digit4");
    await page.keyboard.type(todo);
    await entryOne.getByRole("combobox", { name: "Wer" }).fill("Kim");
    await entryOne.getByRole("option", { name: "Kim Brenner" }).click();
    await entryOne.getByLabel("Bis wann").fill(berlinDay(-1));
    await savePoint(entryOne);
    await expect(itemsOne).toHaveCount(2);

    // --- Second TOP: an info ------------------------------------------------------
    const entryTwo = await addTopic(page, second);
    await page.keyboard.press("Alt+Digit1");
    await page.keyboard.type(info);
    await savePoint(entryTwo);
    await expect(page.getByRole("list", { name: `Punkte zu ${second}` }).getByRole("listitem")).toHaveCount(1);

    // The to-do is listed before the TOP goes.
    await page.goto("/protokolle/todos");
    await expect(page.getByRole("list", { name: "Offene To-dos" }).getByRole("listitem", { name: todo })).toBeVisible();
    await page.goto("/meine");
    await expect(page.getByRole("listitem", { name: todo })).toHaveCount(1);

    await page.goto(`${url}?ansicht=bearbeiten`);
    const deleteFirst = page.getByRole("button", { name: `${first} löschen`, exact: true });
    await expect(deleteFirst).toBeVisible();
    await expect(deleteFirst).toHaveAttribute("title", "TOP löschen");
    const box = await deleteFirst.boundingBox();
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    await expectNoHorizontalScroll(page);

    // --- Cancel: nothing changes ----------------------------------------------------
    let question = "";
    page.once("dialog", (dialog) => {
      question = dialog.message();
      void dialog.dismiss();
    });
    await deleteFirst.click();
    await expect.poll(() => question).toContain("2 Punkten");
    expect(question).toBe(`TOP „${first}“ mit 2 Punkten löschen? Darunter 1 Beschluss und 1 To-do.`);
    await expect(topicHeading(page, first)).toBeVisible();
    await expect(itemsOne).toHaveCount(2);

    // --- Confirm: the TOP and its items are gone, the second stays --------------------
    page.once("dialog", (dialog) => void dialog.accept());
    await deleteFirst.click();
    await expect(page.getByRole("status").filter({ hasText: "Gelöscht" })).toBeVisible();
    await expect(topicHeading(page, first)).toHaveCount(0);
    await expect(itemsOne).toHaveCount(0);
    await expect(topicHeading(page, second)).toBeVisible();
    await page.reload();
    await expect(topicHeading(page, second)).toBeVisible();
    await expect(topicHeading(page, first)).toHaveCount(0);

    // The to-do left the to-do list and "Meine Aufgaben".
    await page.goto("/protokolle/todos");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("listitem", { name: todo })).toHaveCount(0);
    await page.goto("/meine");
    await expect(page.getByRole("heading", { level: 1, name: "Meine Aufgaben" })).toBeVisible();
    await expect(page.getByRole("listitem", { name: todo })).toHaveCount(0);

    // --- An empty draft goes at once, without a question ----------------------------------
    await page.goto(`${url}?ansicht=bearbeiten`);
    await expect(topicHeading(page, second)).toBeVisible();
    await addTopic(page, "E2E Entwurf");
    await expect(topicHeading(page, "E2E Entwurf")).toBeVisible();
    let asked = false;
    page.once("dialog", (dialog) => {
      asked = true;
      void dialog.dismiss();
    });
    await page.getByRole("button", { name: "E2E Entwurf löschen", exact: true }).click();
    await expect(topicHeading(page, "E2E Entwurf")).toHaveCount(0);
    await expect(topicHeading(page, second)).toBeVisible();
    expect(asked).toBe(false);
    page.removeAllListeners("dialog");

    expect(problems).toEqual([]);
  });
});
