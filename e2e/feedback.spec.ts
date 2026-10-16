import { expect, test, type Page } from "@playwright/test";

// Spec 014: bug button and feedback dialog (part A). Reports are named
// "E2E Feedback ‹project› ‹time›" and unique per run; the app cannot delete
// feedback, `pnpm db:seed` removes them. Seed plan elements are only opened,
// never moved or ticked. Needs the dev seed (Alex Rauch, seed element
// "Kooperationsgespräch KVR/Polizei" under "Überfällig & Verzug").

const ELEMENT = "Kooperationsgespräch KVR/Polizei";

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

function bugButton(page: Page) {
  return page.getByRole("banner").getByRole("button", { name: /^Feedback geben/ });
}

function dialog(page: Page) {
  return page.getByRole("dialog", { name: "Feedback geben" });
}

function details(page: Page) {
  return page.getByRole("complementary", { name: "Details" });
}

/**
 * Opens the dialog. Retries, since a click right after loading can come
 * before the page is hydrated.
 */
async function openDialog(page: Page) {
  await expect(async () => {
    if (!(await dialog(page).isVisible())) await bugButton(page).click();
    await expect(dialog(page)).toBeVisible({ timeout: 1000 });
  }).toPass();
}

/** Marks the current document; gone after a reload or a full navigation. */
async function markDocument(page: Page) {
  await page.evaluate(() => {
    (window as unknown as { e2eMarker?: boolean }).e2eMarker = true;
  });
}

async function expectSameDocument(page: Page) {
  expect(await page.evaluate(() => (window as unknown as { e2eMarker?: boolean }).e2eMarker)).toBe(true);
}

test.describe("Feedback", () => {
  let errors: string[];

  test.beforeEach(async ({ page }) => {
    errors = [];
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
    await devLogin(page, "Alex Rauch");
  });

  test.afterEach(() => {
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("Wunsch auf /meine absenden, Seite bleibt unverändert", async ({ page }, testInfo) => {
    await page.goto("/meine");
    await expectPageReady(page, "Meine Aufgaben");
    await expect(bugButton(page)).toBeVisible();
    await expectNoHorizontalScroll(page);
    const title = await page.title();
    await markDocument(page);

    await openDialog(page);
    const form = dialog(page);
    await expect(form.getByText(/^Seite, Zeitpunkt, Gerät und dein Name werden mitgeschickt\./)).toBeVisible();
    await expect(form.getByText(/^Bezieht sich auf:/)).toHaveCount(0);
    await form.getByRole("button", { name: "Wunsch" }).click();
    await expect(form.getByRole("button", { name: "Wunsch" })).toHaveAttribute("aria-pressed", "true");
    await expect(form.getByRole("button", { name: "Fehler" })).toHaveAttribute("aria-pressed", "false");
    await form.getByLabel("Beschreibung").fill(`E2E Feedback ${testInfo.project.name} ${Date.now()}`);
    await form.getByRole("button", { name: "Absenden" }).click();
    await expect(form.getByText("Danke! Deine Meldung ist gespeichert.")).toBeVisible();
    await expect(form.getByRole("link", { name: "Alle Meldungen" })).toHaveAttribute("href", "/feedback");
    await form.getByRole("button", { name: "Schließen" }).click();
    await expect(dialog(page)).toBeHidden();
    await expect(bugButton(page)).toBeFocused();

    await expect(page).toHaveURL(/\/meine$/);
    expect(await page.title()).toBe(title);
    await expectPageReady(page, "Meine Aufgaben");
    await expectSameDocument(page);

    // Opened again, the form is empty.
    await openDialog(page);
    await expect(dialog(page).getByLabel("Beschreibung")).toHaveValue("");
    await expect(dialog(page).getByRole("button", { name: "Wunsch" })).toHaveAttribute("aria-pressed", "false");
    await dialog(page).getByRole("button", { name: "Abbrechen" }).click();
    await expect(dialog(page)).toBeHidden();
  });

  test("Ohne Art und Text: Fehlermeldungen, Abbrechen schließt", async ({ page }) => {
    await page.goto("/meine");
    await expectPageReady(page, "Meine Aufgaben");

    await openDialog(page);
    const form = dialog(page);
    await form.getByRole("button", { name: "Absenden" }).click();
    await expect(form.getByText("Bitte Fehler oder Wunsch wählen.")).toBeVisible();
    await expect(form.getByText("Bitte kurz beschreiben.")).toBeVisible();
    await expect(form).toBeVisible();

    await form.getByRole("button", { name: "Abbrechen" }).click();
    await expect(dialog(page)).toBeHidden();
    await expect(bugButton(page)).toBeFocused();
  });

  test("Offenes Plan-Element wird mitgeschickt, Panel bleibt offen", async ({ page }, testInfo) => {
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();
    await expectPageReady(page, "Plan KP27");

    // Only open the seed element, never move or tick it.
    if (isNarrow(page)) {
      await page.getByRole("region", { name: "Überfällig & Verzug" }).getByText(ELEMENT, { exact: true }).click();
    } else {
      await page
        .getByRole("button", { name: new RegExp(`^${escape(ELEMENT)}`) })
        .filter({ visible: true })
        .click();
    }
    const panel = details(page);
    await expect(panel.getByRole("heading", { name: ELEMENT })).toBeVisible();
    await markDocument(page);

    await openDialog(page);
    const form = dialog(page);
    await expect(form.getByText(`Bezieht sich auf: ${ELEMENT}`)).toBeVisible();
    await form.getByRole("button", { name: "Fehler" }).click();
    await form.getByLabel("Beschreibung").fill(`E2E Feedback ${testInfo.project.name} Plan ${Date.now()}`);
    await form.getByRole("button", { name: "Absenden" }).click();
    await expect(form.getByText("Danke! Deine Meldung ist gespeichert.")).toBeVisible();

    // Escape closes the dialog only, not the panel behind it.
    await page.keyboard.press("Escape");
    await expect(dialog(page)).toBeHidden();
    await expect(panel.getByRole("heading", { name: ELEMENT })).toBeVisible();
    await expectSameDocument(page);
    await expectNoHorizontalScroll(page);
  });

  // Part B: overview, detail, status and reply by an admin, number at the bug.
  test("Admin setzt Status und Antwort, alle anderen lesen nur", async ({ page }, testInfo) => {
    const text = `E2E Feedback ${testInfo.project.name} Antwort ${Date.now()}`;

    // Alex reports and goes to the overview via the dialog.
    await page.goto("/meine");
    await expectPageReady(page, "Meine Aufgaben");
    await openDialog(page);
    await dialog(page).getByRole("button", { name: "Fehler" }).click();
    await dialog(page).getByLabel("Beschreibung").fill(text);
    await dialog(page).getByRole("button", { name: "Absenden" }).click();
    await dialog(page).getByRole("link", { name: "Alle Meldungen" }).click();
    await expect(page).toHaveURL(/\/feedback$/);
    await expectPageReady(page, "Feedback");
    await expect(page.getByRole("navigation", { name: "Filter" }).getByRole("link", { name: "Offen" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    await page.getByRole("link", { name: new RegExp(escape(text)) }).click();
    await expect(page).toHaveURL(/\/feedback\/[0-9a-f-]{36}$/);
    const detailUrl = page.url();
    await expectPageReady(page, "Fehler");
    // Next.js keeps the previous page hidden in the document: visible elements only.
    await expect(page.getByText(text).filter({ visible: true })).toBeVisible();
    await expect(page.getByText(/^Seite: .*\(\/meine\)$/)).toBeVisible();
    await expect(page.getByText(/^Gerät: .+ · \d+ × \d+$/)).toBeVisible();
    await expect(page.getByRole("form", { name: "Status und Antwort" })).toHaveCount(0);
    await expectNoHorizontalScroll(page);

    // Alex is no admin: no number at the bug.
    await expect(bugButton(page)).toHaveAttribute("aria-label", "Feedback geben");
    await expect(page.getByTestId("feedback-new-count")).toHaveCount(0);

    // Kim (admin): number at the bug, set "Erledigt" with a reply.
    await devLogin(page, "Kim Brenner");
    await expect(bugButton(page)).toHaveAttribute("aria-label", /^Feedback geben, \d+ neue Meldungen?$/);
    await expect(page.getByTestId("feedback-new-count").filter({ visible: true })).toHaveText(/^\d+$/);
    await page.goto(detailUrl);
    await expectPageReady(page, "Fehler");
    const form = page.getByRole("form", { name: "Status und Antwort" });
    await expect(form.getByRole("button", { name: "Neu" })).toHaveAttribute("aria-pressed", "true");
    await form.getByRole("button", { name: "Erledigt" }).click();
    await expect(form.getByRole("button", { name: "Erledigt" })).toHaveAttribute("aria-pressed", "true");
    await form.getByLabel("Antwort").fill("E2E Antwort");
    // The server action request, replayed below as Alex.
    const actionRequest = page.waitForRequest(
      (request) => request.method() === "POST" && Boolean(request.headers()["next-action"])
    );
    await form.getByRole("button", { name: "Speichern" }).click();
    await expect(form.getByText("Gespeichert.")).toBeVisible();
    const request = await actionRequest;

    await page.getByRole("link", { name: "Feedback", exact: true }).filter({ visible: true }).click();
    await expectPageReady(page, "Feedback");
    await expect(page.getByRole("list", { name: "Offene Meldungen" }).getByText(text)).toHaveCount(0);
    await page.getByRole("navigation", { name: "Filter" }).getByRole("link", { name: "Alle" }).click();
    await expect(page).toHaveURL(/\/feedback\?filter=alle$/);
    const entry = page.getByRole("list", { name: "Alle Meldungen" }).getByRole("link", { name: new RegExp(escape(text)) });
    await expect(entry).toContainText("Erledigt");
    await expect(entry).toContainText("Antwort vorhanden");

    // Alex: no number, reply readable.
    await devLogin(page, "Alex Rauch");
    await expect(bugButton(page)).toHaveAttribute("aria-label", "Feedback geben");
    await page.goto(detailUrl);
    await expectPageReady(page, "Fehler");
    await expect(page.getByText(/^Antwort von Kim Brenner · /)).toBeVisible();
    await expect(page.getByText("E2E Antwort")).toBeVisible();
    await expect(page.getByRole("form", { name: "Status und Antwort" })).toHaveCount(0);

    // Calling updateFeedback directly as Alex is refused by the server.
    const body = request.postData() ?? "";
    expect(body).toContain('"done"');
    const response = await page.request.post(detailUrl, {
      headers: {
        "next-action": request.headers()["next-action"],
        "content-type": request.headers()["content-type"] ?? "text/plain;charset=UTF-8",
        accept: "text/x-component",
      },
      data: body.replace('"done"', '"rejected"').replace("E2E Antwort", "E2E Alex"),
    });
    expect(await response.text()).toContain("Nur Admins können das ändern.");
    await page.reload();
    await expectPageReady(page, "Fehler");
    await expect(page.getByRole("region", { name: "Status und Antwort" }).getByText("Erledigt")).toBeVisible();
    await expect(page.getByText("E2E Alex")).toHaveCount(0);
  });

  test("Einstellungen verlinken auf die Übersicht", async ({ page }) => {
    await page.goto("/einstellungen");
    await expectPageReady(page, "Einstellungen");
    const link = page.getByRole("link", { name: /^Feedback/ });
    await expect(link).toHaveAttribute("href", "/feedback");
    await expect(link).toContainText(/Keine neuen Meldungen\.|\d+ neue Meldungen?/);
    await link.click();
    await expectPageReady(page, "Feedback");
    // "Einstellungen" (wide) or "Mehr" (phones) stays marked as active.
    const active = isNarrow(page)
      ? page.getByRole("navigation", { name: "Navigation" }).getByRole("link", { name: "Mehr" })
      : page.getByRole("navigation", { name: "Hauptnavigation" }).getByRole("link", { name: "Einstellungen" });
    await expect(active).toHaveAttribute("aria-current", "page");
    await expectNoHorizontalScroll(page);
  });

  test("Unbekannte Meldung zeigt 404", async ({ page }) => {
    // Streamed pages keep status 200; the content is the 404 page, as on /protokolle/[id].
    for (const id of ["00000000-0000-4000-8000-000000000000", "keine-id"]) {
      await page.goto(`/feedback/${id}`);
      await expect(page.getByText("This page could not be found.")).toBeVisible();
      await expect(page.getByRole("heading", { level: 1, name: /^(Fehler|Wunsch)$/ })).toHaveCount(0);
    }
    errors = errors.filter((message) => !/404/.test(message));
  });

  test("Kein Käfer auf /login", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/login");
    await expect(page.getByRole("button", { name: /^Feedback geben/ })).toHaveCount(0);
  });
});
