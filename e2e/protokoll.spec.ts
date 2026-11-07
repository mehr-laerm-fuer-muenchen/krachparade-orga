import { expect, test, type Page } from "@playwright/test";
import { savePoint } from "./punkt-speichern";

// Spec 004: minutes. Runs on the shared dev database: every title and text is
// unique per run, every check is relative, and the meetings created here are
// deleted again at the end (as Kim, who is an admin).
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

/** Resolves once the next server action of the meeting page has answered. */
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

/** Deletes the meeting; `required` fails if the button is missing, otherwise a gone meeting is fine. */
async function deleteMeeting(page: Page, url: string, required = false) {
  await page.goto(`${url}?ansicht=bearbeiten`);
  const head = page.getByRole("region", { name: "Kopf" });
  await expect(head.or(page.getByText("This page could not be found."))).toBeVisible();
  const button = head.getByRole("button", { name: "Treffen löschen" });
  if (required) {
    await expect(button).toBeVisible();
  } else if ((await head.count()) === 0 || (await button.count()) === 0) {
    return;
  }
  page.once("dialog", (dialog) => void dialog.accept());
  await button.click();
  await expect(page).toHaveURL(/\/protokolle$/);
}

test.describe("Protokoll", () => {
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

  test("Treffen mitschreiben, Beschlüsse, To-dos, Meine, Löschrecht", async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    const run = `${testInfo.project.name} ${Date.now()}`;
    const title = `E2E Treffen ${run}`;
    const decision = `E2E Beschluss ${run}`;
    const todoAlex = `E2E To-do Alex ${run}`;
    const todoGuest = `E2E To-do Gast ${run}`;

    // --- Kim: new meeting with head data -------------------------------------
    await devLogin(page, "Kim Brenner");
    const url = await createMeeting(page, title);
    created.push(url);

    await Promise.all([saved(page), page.getByRole("checkbox", { name: "Alex Rauch" }).check()]);
    await Promise.all([saved(page), page.getByRole("checkbox", { name: "Sascha Möller" }).check()]);
    await textbox(page, "Gäste (ohne Account)").fill("Gast Eins");
    await Promise.all([saved(page), textbox(page, "Titel").click()]);

    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    await expect(page.getByRole("checkbox", { name: "Alex Rauch" })).toBeChecked();
    await expect(page.getByRole("checkbox", { name: "Sascha Möller" })).toBeChecked();
    await expect(textbox(page, "Gäste (ohne Account)")).toHaveValue("Gast Eins");

    // --- TOP and quick entry, keyboard only ----------------------------------
    await page.getByRole("button", { name: "+ TOP hinzufügen" }).click();
    await textbox(page, "Überschrift des neuen TOPs").fill("E2E TOP");
    await page.keyboard.press("Enter");
    const entry = page.getByRole("form", { name: "Neuer Punkt unter E2E TOP" });
    const text = entry.getByRole("textbox", { name: "Text" });
    await expect(text).toBeFocused();
    const items = page.getByRole("list", { name: "Punkte zu E2E TOP" }).getByRole("listitem");

    const quick: [string, string][] = [
      ["Alt+Digit1", `E2E Info ${run}`],
      ["Alt+Digit2", `E2E Diskussion ${run}`],
      ["Alt+Digit3", decision],
    ];
    for (const [index, [shortcut, value]] of quick.entries()) {
      await page.keyboard.press(shortcut);
      await page.keyboard.type(value);
      await savePoint(entry);
      await expect(items).toHaveCount(index + 1);
      await expect(text).toHaveValue("");
      await expect(text).toBeFocused();
    }

    await page.keyboard.press("Alt+Digit4");
    await expect(entry.getByRole("radio", { name: /To-do/ })).toBeChecked();
    await page.keyboard.type(todoAlex);
    await entry.getByRole("combobox", { name: "Wer" }).fill("Alex");
    await entry.getByRole("option", { name: "Alex Rauch" }).click();
    await entry.getByLabel("Bis wann").fill("2026-10-30");
    await entry.getByRole("combobox", { name: "Aufgabenbereich" }).selectOption({ label: "Finanzen" });
    await savePoint(entry);
    await expect(items).toHaveCount(4);
    await expect(items.nth(3)).toContainText("Wer: Alex Rauch");
    await expect(items.nth(3)).toContainText("Aufgabenbereich: Finanzen");

    await text.fill(todoGuest);
    await entry.getByRole("combobox", { name: "Wer" }).fill("Gast Test");
    await entry.getByRole("option", { name: "Ohne Account: Gast Test" }).click();
    await savePoint(entry);
    await expect(items).toHaveCount(5);
    await expect(items.nth(4)).toContainText("Wer: Gast Test (ohne Account)");

    // --- Note ----------------------------------------------------------------
    await textbox(page, "Notiz oder Transkript").fill(`E2E Notiz ${run}`);
    await Promise.all([saved(page), textbox(page, "Titel").click()]);
    await page.reload();
    await expect(textbox(page, "Notiz oder Transkript")).toHaveValue(`E2E Notiz ${run}`);
    await expect(items).toHaveCount(5);

    // --- Export: "Kopiert" or the selected text field -------------------------
    await page.getByRole("button", { name: "Als Text kopieren" }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "Kopiert" }).or(page.getByRole("textbox", { name: /bitte selbst kopieren/ }))
    ).toBeVisible();

    // --- Phone: head, quick entry and note usable, no horizontal scroll -------
    if (isNarrow(page)) {
      for (const control of [
        textbox(page, "Titel"),
        page.getByRole("form", { name: "Neuer Punkt unter E2E TOP" }).getByRole("textbox", { name: "Text" }),
        textbox(page, "Notiz oder Transkript"),
      ]) {
        await control.scrollIntoViewIfNeeded();
        await expect(control).toBeInViewport();
        await expect(control).toBeEditable();
      }
      await expectNoHorizontalScroll(page);
    }

    // --- Beschlüsse ------------------------------------------------------------
    await page.goto(`/protokolle/beschluesse?q=${encodeURIComponent(decision.toUpperCase())}`);
    const decisions = page.getByRole("list", { name: "Beschlüsse" });
    await expect(decisions.getByRole("listitem", { name: decision })).toBeVisible();
    await expect(decisions.getByRole("listitem")).toHaveCount(1);
    if (!isNarrow(page)) {
      await expect(
        page.getByRole("navigation", { name: "Hauptnavigation" }).getByRole("link", { name: "Protokolle" })
      ).toHaveAttribute("aria-current", "page");
    } else {
      await expect(
        page.getByRole("navigation", { name: "Navigation", exact: true }).getByRole("link", { name: "Protokolle" })
      ).toHaveAttribute("aria-current", "page");
    }
    await expectNoHorizontalScroll(page);

    // --- To-dos: both open, tick one off → moves to "Erledigt" -----------------
    await page.goto("/protokolle/todos");
    const open = page.getByRole("list", { name: "Offene To-dos" });
    await expect(open.getByRole("listitem", { name: todoAlex })).toBeVisible();
    await expect(open.getByRole("listitem", { name: todoGuest })).toBeVisible();
    await expectNoHorizontalScroll(page);

    await open.getByRole("checkbox", { name: `Erledigt: ${todoGuest}` }).check();
    await expect(open.getByRole("listitem", { name: todoGuest })).toHaveCount(0);
    await page.getByRole("navigation", { name: "Status" }).getByRole("link", { name: "Erledigt" }).click();
    await expect(
      page.getByRole("list", { name: "Erledigte To-dos" }).getByRole("listitem", { name: todoGuest })
    ).toBeVisible();

    // --- Final locks nothing ------------------------------------------------------
    await page.goto(url);
    await Promise.all([saved(page), page.getByRole("button", { name: "Final" }).click()]);
    // Final opens the read view (spec 017); editing is one click away.
    await expect(page).toHaveURL(/\?ansicht=lesen$/);
    await page.getByRole("link", { name: "Bearbeiten", exact: true }).click();
    await expect(page.getByRole("button", { name: "Final" })).toHaveAttribute("aria-pressed", "true");
    await items.getByRole("button", { name: `Bearbeiten: E2E Info ${run}` }).click();
    const editor = page.getByRole("form", { name: "Punkt bearbeiten" });
    await editor.getByRole("textbox", { name: "Text" }).fill(`E2E Info final ${run}`);
    await savePoint(editor);
    // The editor closes once the server has saved; the textarea itself already shows the new text.
    await expect(editor).toHaveCount(0);
    await expect(items.filter({ hasText: `E2E Info final ${run}` })).toHaveCount(1);
    await page.reload();
    await expect(items.filter({ hasText: `E2E Info final ${run}` })).toHaveCount(1);

    // --- Alex: own to-do under /meine, no delete on Kim's meeting --------------
    await devLogin(page, "Alex Rauch");
    await page.goto("/meine");
    const mine = page.getByRole("main");
    await expect(mine.getByRole("listitem", { name: todoAlex })).toBeVisible();
    await expect(page.getByRole("listitem", { name: todoGuest })).toHaveCount(0);
    await expectNoHorizontalScroll(page);

    await page.goto(url);
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    await page.getByRole("link", { name: "Bearbeiten", exact: true }).click();
    await expect(page.getByRole("region", { name: "Kopf" }).getByRole("button", { name: "Entwurf" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Treffen löschen" })).toHaveCount(0);

    // Alex creates an own meeting and may delete it.
    const ownUrl = await createMeeting(page, `E2E Treffen Alex ${run}`);
    created.push(ownUrl);
    await deleteMeeting(page, ownUrl, true);
    await expect(page.getByRole("list", { name: "Treffen" }).or(page.getByText("Noch keine Treffen."))).toBeVisible();
    await expect(page.getByRole("link", { name: new RegExp(`E2E Treffen Alex ${run}`) })).toHaveCount(0);

    expect(errors, errors.join("\n")).toEqual([]);
  });
});
