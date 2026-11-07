import { expect, test, type Page } from "@playwright/test";
import { savePoint } from "./punkt-speichern";

// Spec 017: read view and edit view of a meeting. Runs on the shared dev
// database: every title and text is unique per run, every check is relative,
// and the meeting created here is deleted again at the end (as Kim).
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

/** Resolves once the next server action of the meeting page has answered. */
function saved(page: Page) {
  return page.waitForResponse(
    (response) => response.request().method() === "POST" && /\/protokolle\//.test(response.url())
  );
}

function textbox(page: Page, name: string) {
  return page.getByRole("textbox", { name, exact: true });
}

/** The switch in the title row; empty meetings have a second "Bearbeiten" link further down. */
function editLink(page: Page) {
  return page.getByRole("link", { name: "Bearbeiten", exact: true }).first();
}

/** Read view: no text fields, selects or plain checkboxes on the page. */
async function expectReadView(page: Page) {
  await expect(editLink(page)).toBeVisible();
  await expect(page.getByRole("main").getByRole("textbox")).toHaveCount(0);
  await expect(page.getByRole("main").getByRole("combobox")).toHaveCount(0);
  await expect(page.getByRole("main").locator("input:visible, select:visible, textarea:visible")).toHaveCount(0);
}

async function expectEditView(page: Page) {
  await expect(page.getByRole("link", { name: "Leseansicht", exact: true })).toBeVisible();
  await expect(textbox(page, "Titel")).toBeEditable();
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

test.describe("Protokoll lesen", () => {
  const created: string[] = [];

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      // Locally the Next.js dev tools button covers the first tab on phones.
      const style = document.createElement("style");
      style.textContent = "nextjs-portal { display: none !important; }";
      document.addEventListener("DOMContentLoaded", () => document.head.append(style));
      // The copied text lands here instead of the real clipboard.
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async (text: string) => {
            (window as unknown as { __copied: string }).__copied = text;
          },
        },
      });
    });
  });

  test.afterEach(async ({ page }) => {
    if (created.length === 0) return;
    await devLogin(page, "Kim Brenner");
    for (const url of created.splice(0)) {
      await deleteMeeting(page, url);
    }
  });

  test("Leseansicht, Umschalten, Abhaken, Final springt in Lesen", async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });

    const run = `${testInfo.project.name} ${Date.now()}`;
    const title = `E2E Lesen ${run}`;
    const topic = `E2E TOP ${run}`;
    const info = `E2E Info ${run}`;
    const discussion = `E2E Diskussion ${run}`;
    const decision = `E2E Beschluss ${run}`;
    const todo = `E2E To-do ${run}`;
    const summary = `E2E Kurzfassung ${run}. Zweiter Satz.`;
    const note = `E2E Notiz ${run}`;

    // --- New meeting opens for editing ------------------------------------------
    await devLogin(page, "Kim Brenner");
    await page.goto("/protokolle");
    await page.getByRole("button", { name: "Neues Treffen" }).click();
    await expect(page).toHaveURL(/\/protokolle\/[0-9a-f-]{36}$/);
    const url = new URL(page.url()).pathname;
    created.push(url);
    await expectEditView(page);
    await textbox(page, "Titel").fill(title);
    await Promise.all([saved(page), textbox(page, "Ort").click()]);
    await expectPageReady(page, title);

    // --- Empty read view: "Hinzufügen" leads to the summary field ----------------
    await page.getByRole("link", { name: "Leseansicht", exact: true }).click();
    await expect(page).toHaveURL(/\?ansicht=lesen$/);
    await expectPageReady(page, title);
    await expectReadView(page);
    await expect(page.getByText("Noch keine Kurzfassung")).toBeVisible();
    await expect(page.getByText("Noch keine Punkte.")).toBeVisible();
    await page.getByRole("link", { name: "Hinzufügen" }).click();
    await expect(page).toHaveURL(/\?ansicht=bearbeiten#kurzfassung$/);
    await expect(textbox(page, "Kurzfassung")).toBeFocused();

    // --- TOP with info, discussion, decision and to-do ---------------------------
    await page.getByRole("button", { name: "+ TOP hinzufügen" }).click();
    await textbox(page, "Überschrift des neuen TOPs").fill(topic);
    await page.keyboard.press("Enter");
    const entry = page.getByRole("form", { name: `Neuer Punkt unter ${topic}` });
    const text = entry.getByRole("textbox", { name: "Text" });
    await expect(text).toBeFocused();
    const items = page.getByRole("list", { name: `Punkte zu ${topic}` }).getByRole("listitem");

    const quick: [string, string][] = [
      ["Alt+Digit1", info],
      ["Alt+Digit2", discussion],
      ["Alt+Digit3", decision],
    ];
    for (const [index, [shortcut, value]] of quick.entries()) {
      await page.keyboard.press(shortcut);
      await page.keyboard.type(value);
      await savePoint(entry);
      await expect(items).toHaveCount(index + 1);
      await expect(text).toBeFocused();
    }
    await page.keyboard.press("Alt+Digit4");
    await page.keyboard.type(todo);
    await entry.getByRole("combobox", { name: "Wer" }).fill("Alex");
    await entry.getByRole("option", { name: "Alex Rauch" }).click();
    await entry.getByLabel("Bis wann").fill("2026-10-30");
    await savePoint(entry);
    await expect(items).toHaveCount(4);

    // --- Summary and note --------------------------------------------------------
    const summaryField = textbox(page, "Kurzfassung");
    await summaryField.fill(summary);
    await Promise.all([saved(page), textbox(page, "Titel").click()]);
    await expect(summaryField.locator("..").getByText("Gespeichert ✓")).toBeVisible();
    await textbox(page, "Notiz oder Transkript").fill(note);
    await Promise.all([saved(page), textbox(page, "Titel").click()]);

    // --- Read view ---------------------------------------------------------------
    await page.getByRole("link", { name: "Leseansicht", exact: true }).click();
    await expect(page).toHaveURL(/\?ansicht=lesen$/);
    await expectPageReady(page, title);
    await expectReadView(page);
    await expect(page.getByRole("region", { name: "Kurzfassung" })).toContainText(summary);
    await expect(
      page.getByRole("list", { name: "Beschlüsse" }).getByRole("listitem", { name: decision })
    ).toBeVisible();
    const todoRow = page.getByRole("list", { name: "To-dos" }).getByRole("listitem", { name: todo });
    await expect(todoRow).toContainText("Alex Rauch");
    await expect(todoRow).toContainText("bis 30.10.");
    const topicRegion = page.getByRole("region", { name: topic });
    await expect(topicRegion.getByText(info)).toBeVisible();
    await expect(page.getByText(discussion)).toHaveCount(0);
    const discussions = topicRegion.getByRole("button", { name: "1 Diskussionspunkt" });
    await expect(discussions).toHaveAttribute("aria-expanded", "false");
    await discussions.focus();
    await page.keyboard.press("Enter");
    await expect(discussions).toHaveAttribute("aria-expanded", "true");
    await expect(topicRegion.getByText(discussion)).toBeVisible();
    const notes = page.getByRole("button", { name: "Notiz/Transkript anzeigen" });
    await expect(notes).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByText(note)).toHaveCount(0);
    await notes.click();
    await expect(page.getByText(note)).toBeVisible();
    if (isNarrow(page)) await expectNoHorizontalScroll(page);

    // --- Tick off in the read view, with "Rückgängig" -------------------------------
    await todoRow.getByRole("checkbox", { name: `${todo} erledigt` }).click();
    await expect(page.getByRole("status").filter({ hasText: "Erledigt" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Rückgängig" })).toBeVisible();
    await expect(todoRow.getByRole("checkbox", { name: `${todo} erledigt` })).toHaveAttribute("aria-checked", "true");
    await expect(todoRow.getByText(todo)).toHaveCSS("text-decoration-line", "line-through");
    await expect(page.getByRole("heading", { name: "To-dos (0 offen)" })).toBeVisible();

    // --- Export contains the summary ------------------------------------------------
    await page.getByRole("button", { name: "Als Text kopieren" }).click();
    await expect.poll(() => page.evaluate(() => (window as unknown as { __copied?: string }).__copied ?? "")).toContain(
      summary
    );

    // --- Back to editing, Final jumps to the read view -------------------------------
    await editLink(page).click();
    await expect(page).toHaveURL(/\?ansicht=bearbeiten$/);
    await expectEditView(page);
    if (isNarrow(page)) await expectNoHorizontalScroll(page);
    await Promise.all([saved(page), page.getByRole("button", { name: "Final" }).click()]);
    await expect(page).toHaveURL(/\?ansicht=lesen$/);
    await expectReadView(page);

    // Without a parameter and from the list, final minutes open for reading.
    await page.goto(url);
    await expectPageReady(page, title);
    await expectReadView(page);
    await expect(page.getByText("Final", { exact: true })).toBeVisible();
    await page.goto("/protokolle");
    await page.getByRole("link", { name: new RegExp(title) }).click();
    await expect(page).toHaveURL(new RegExp(`${url}$`));
    await expectPageReady(page, title);
    await expectReadView(page);

    // --- Phone: switch reachable, no horizontal scroll --------------------------------
    if (isNarrow(page)) {
      const toggle = editLink(page);
      await expect(toggle).toBeInViewport();
      const box = await toggle.boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
      await expectNoHorizontalScroll(page);
    }

    expect(errors, errors.join("\n")).toEqual([]);
  });
});
