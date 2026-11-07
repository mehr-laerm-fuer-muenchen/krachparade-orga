import { expect, test, type Locator, type Page } from "@playwright/test";
import { isTouch, savePoint } from "./punkt-speichern";

// Spec 028: multi-line items. Laptop: Shift+Enter adds a line, Enter saves.
// Phone (touch): Enter adds a line, "Speichern" saves. Runs on the shared dev
// database with its own "E2E …" meeting, which is deleted at the end.

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

/** The text as shown on screen: line breaks only count if they are rendered. */
async function shownText(scope: Locator): Promise<string> {
  return scope.getByText("Zeile eins").first().evaluate((element) => (element as HTMLElement).innerText);
}

/** Adds a new line at the end of the field: Shift+Enter on a laptop, Enter on a phone. */
async function newLine(page: Page, touch: boolean) {
  await page.keyboard.press(touch ? "Enter" : "Shift+Enter");
}

test.describe("Mehrzeilige Punkte", () => {
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

  test("Punkt mit mehreren Zeilen anlegen, lesen und bearbeiten", async ({ page }, testInfo) => {
    const problems: string[] = [];
    page.on("pageerror", (error) => problems.push(error.message));
    page.on("console", (message) => {
      if (/hydrat/i.test(message.text())) problems.push(message.text());
    });

    await devLogin(page, "Kim Brenner");
    const url = await createMeeting(page, `E2E Mehrzeilig ${testInfo.project.name} ${Date.now()}`);
    created.push(url);

    await page.getByRole("button", { name: "+ TOP hinzufügen" }).click();
    await textbox(page, "Überschrift des neuen TOPs").fill("E2E TOP");
    await page.keyboard.press("Enter");
    const entry = page.getByRole("form", { name: "Neuer Punkt unter E2E TOP" });
    const text = entry.getByRole("textbox", { name: "Text" });
    await expect(text).toBeFocused();
    const items = page.getByRole("list", { name: "Punkte zu E2E TOP" }).getByRole("listitem");
    const touch = await isTouch(entry);
    await expect(text).toHaveAttribute(
      "placeholder",
      touch ? "Punkt eingeben" : "Punkt eingeben – Enter speichert, Umschalt+Enter neue Zeile"
    );
    const oneLine = (await text.boundingBox())?.height ?? 0;

    // --- New item with two lines ------------------------------------------------
    await page.keyboard.press("Alt+Digit3");
    await expect(entry.getByRole("radio", { name: /Beschluss/ })).toBeChecked();
    await page.keyboard.type("Zeile eins");
    await newLine(page, touch);
    await page.keyboard.type("Zeile zwei");
    // The new line did not save anything and the field grew with the text.
    await expect(text).toHaveValue("Zeile eins\nZeile zwei");
    await expect(items).toHaveCount(0);
    expect((await text.boundingBox())?.height ?? 0).toBeGreaterThan(oneLine + 10);
    if (touch) {
      await entry.getByRole("button", { name: "Speichern", exact: true }).click();
    } else {
      await page.keyboard.press("Enter");
    }
    await expect(items).toHaveCount(1);
    expect(await shownText(items.first())).toBe("Zeile eins\nZeile zwei");
    await expect(text).toHaveValue("");
    await expect(text).toBeFocused();
    await expect.poll(async () => (await text.boundingBox())?.height ?? 0).toBeLessThanOrEqual(oneLine + 1);
    await expectNoHorizontalScroll(page);

    // --- Read view ---------------------------------------------------------------
    await page.goto(`${url}?ansicht=lesen`);
    const decisions = page.getByRole("list", { name: "Beschlüsse" });
    await expect(decisions).toBeVisible();
    expect(await shownText(decisions)).toBe("Zeile eins\nZeile zwei");
    await expectNoHorizontalScroll(page);

    // --- Edit: add a third line ----------------------------------------------------
    await page.goto(`${url}?ansicht=bearbeiten`);
    await items.getByRole("button", { name: /^Bearbeiten: Zeile eins/ }).click();
    const editor = page.getByRole("form", { name: "Punkt bearbeiten" });
    const editorText = editor.getByRole("textbox", { name: "Text" });
    await expect(editorText).toHaveValue("Zeile eins\nZeile zwei");
    await editorText.evaluate((field: HTMLTextAreaElement) => field.setSelectionRange(field.value.length, field.value.length));
    await newLine(page, touch);
    await page.keyboard.type("Zeile drei");
    await expect(editorText).toHaveValue("Zeile eins\nZeile zwei\nZeile drei");
    await expect(editor).toBeVisible();
    await savePoint(editor);
    await expect(editor).toHaveCount(0);
    await page.reload();
    await expect(items).toHaveCount(1);
    expect(await shownText(items.first())).toBe("Zeile eins\nZeile zwei\nZeile drei");
    await expectNoHorizontalScroll(page);

    expect(problems).toEqual([]);
  });
});
