import { expect, test, type Locator, type Page } from "@playwright/test";

// Spec 015: bell with the "Neuigkeiten" panel. Only reads pages and the
// device's localStorage, creates no data. Needs the dev seed (admin Kim
// Brenner, example plan).

const SEEN_KEY = "kp-news-seen";
const LATEST_TITLE = "Neuigkeiten in der App";
const OLDER_TITLE = "Alles zählt auf die Krachparade";

function isNarrow(page: Page) {
  return (page.viewportSize()?.width ?? 0) <= 900;
}

async function devLogin(page: Page, name: string) {
  await page.goto("/dev/login");
  await page.getByRole("button", { name: new RegExp(`Als ${name} anmelden`) }).click();
  await expect(page).toHaveURL(/\/$/);
}

async function expectPlanReady(page: Page) {
  await expect(page.getByRole("heading", { level: 1, name: "Plan KP27" })).toBeVisible();
  await expect(page.getByText(/^Lade .+ …$/).filter({ visible: true })).toHaveCount(0);
}

async function box(locator: Locator) {
  const result = await locator.boundingBox();
  expect(result, "Element hat keine Fläche").not.toBeNull();
  return result!;
}

function bell(page: Page) {
  // The panel sits inside the header in the DOM, hence the exact names.
  return page.getByRole("banner").getByRole("button", { name: /^Neuigkeiten( – es gibt Neues)?$/ });
}

function panel(page: Page) {
  return page.getByRole("dialog", { name: "Neuigkeiten" });
}

function entryToggle(page: Page, title: string) {
  return panel(page).getByRole("button", { name: new RegExp(`^${title}`) });
}

/** Sets or removes the stored value and reloads, as on a fresh visit. */
async function reloadWithSeen(page: Page, value: string | null) {
  await page.evaluate(
    ([key, stored]) => {
      if (stored === null) window.localStorage.removeItem(key);
      else window.localStorage.setItem(key, stored);
    },
    [SEEN_KEY, value] as const
  );
  await page.reload();
  await expectPlanReady(page);
}

/** Opens a plan element: Gantt on wide screens, sheet from the list on phones. */
async function openPlanElement(page: Page) {
  const name = "Kooperationsgespräch KVR/Polizei";
  if (isNarrow(page)) {
    await page.getByRole("region", { name: "Überfällig & Verzug" }).getByText(name, { exact: true }).click();
  } else {
    await page.getByRole("button", { name: new RegExp(`^${name}`) }).filter({ visible: true }).click();
  }
  const details = page.getByRole("complementary", { name: "Details" });
  await expect(details.getByRole("heading", { name })).toBeVisible();
  return details;
}

test.describe("Neuigkeiten", () => {
  let errors: string[];

  test.beforeEach(async ({ page }) => {
    errors = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));
    // Locally the Next.js dev tools button covers parts of the page.
    await page.addInitScript(() => {
      const style = document.createElement("style");
      style.textContent = "nextjs-portal { display: none !important; }";
      document.addEventListener("DOMContentLoaded", () => document.head.append(style));
    });
    await devLogin(page, "Kim Brenner");
    await expectPlanReady(page);
  });

  test.afterEach(() => {
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("Kopfleiste: Glocke links vom Käfer, eine Zeile, Tippflächen", async ({ page }) => {
    const banner = page.getByRole("banner");
    const logo = await box(banner.getByRole("link", { name: "Krachparade Orga" }));
    const bellBox = await box(bell(page));
    const bug = await box(banner.getByRole("button", { name: /^Feedback geben/ }));
    const countdown = await box(page.getByTestId("dday-label"));

    // Admin: the pink number at the bug button stays.
    await expect(page.getByTestId("feedback-new-count")).toBeVisible();

    // One row: all vertical ranges overlap with the logo.
    for (const other of [bellBox, bug, countdown]) {
      expect(other.y, "liegt unter dem Logo").toBeLessThan(logo.y + logo.height);
      expect(other.y + other.height, "liegt über dem Logo").toBeGreaterThan(logo.y);
    }
    // Bell directly left of the bug button.
    expect(bellBox.x + bellBox.width).toBeLessThanOrEqual(bug.x + 1);
    expect(bug.x - (bellBox.x + bellBox.width)).toBeLessThanOrEqual(16);
    for (const target of [bellBox, bug]) {
      expect(target.width).toBeGreaterThanOrEqual(44);
      expect(target.height).toBeGreaterThanOrEqual(44);
    }

    const width = page.viewportSize()!.width;
    if (isNarrow(page)) {
      // Phones: logo · bell · bug · countdown, no app name.
      await expect(banner.getByText("Krachparade Orga", { exact: true })).toBeHidden();
      expect(logo.width).toBeLessThanOrEqual(48);
      expect(logo.x + logo.width).toBeLessThanOrEqual(bellBox.x);
      expect(bug.x + bug.width).toBeLessThanOrEqual(countdown.x);
      const header = await box(banner);
      expect(header.height).toBeLessThanOrEqual(logo.height + 24);
    } else {
      await expect(banner.getByText("Krachparade Orga", { exact: true })).toBeVisible();
      expect(countdown.x + countdown.width).toBeLessThanOrEqual(bellBox.x);
    }
    expect(Math.max(countdown.x + countdown.width, bug.x + bug.width)).toBeLessThanOrEqual(width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });

  test("Öffnen, Aufklappen, Schließen per ×, Esc und Klick daneben", async ({ page }) => {
    await bell(page).click();
    const dialog = panel(page);
    await expect(dialog).toBeVisible();
    await expect(bell(page)).toHaveAttribute("aria-expanded", "true");
    await expect(dialog.getByRole("heading", { name: "Neuigkeiten" })).toBeFocused();
    await expect(dialog.getByText("Was sich in der App geändert hat.")).toBeVisible();
    await expect(dialog.getByText("Melde ihn über den Käfer oben.", { exact: false })).toBeVisible();

    // Newest open, older ones closed and expandable.
    await expect(entryToggle(page, LATEST_TITLE)).toHaveAttribute("aria-expanded", "true");
    await expect(dialog.getByText("Glocke in der Kopfleiste.")).toBeVisible();
    await expect(entryToggle(page, OLDER_TITLE)).toHaveAttribute("aria-expanded", "false");
    await expect(dialog.getByText("Countdown in Tagen.")).toBeHidden();
    await expect(dialog.getByText("Start der Orga-App")).toBeVisible();
    await entryToggle(page, OLDER_TITLE).click();
    await expect(entryToggle(page, OLDER_TITLE)).toHaveAttribute("aria-expanded", "true");
    await expect(dialog.getByText("Countdown in Tagen.")).toBeVisible();
    await expect(dialog.getByText("16.10.2026").first()).toBeVisible();
    await expect(dialog).not.toContainText(/D-Day|D[-−]\d/);
    await entryToggle(page, OLDER_TITLE).click();
    await expect(dialog.getByText("Countdown in Tagen.")).toBeHidden();

    // Touch targets in the panel.
    for (const target of [dialog.getByRole("button", { name: "Neuigkeiten schließen" }), entryToggle(page, LATEST_TITLE)]) {
      const targetBox = await box(target);
      expect(targetBox.height).toBeGreaterThanOrEqual(44);
      expect(targetBox.width).toBeGreaterThanOrEqual(44);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      page.viewportSize()!.width
    );

    // ×
    await dialog.getByRole("button", { name: "Neuigkeiten schließen" }).click();
    await expect(dialog).toBeHidden();
    await expect(bell(page)).toBeFocused();
    await expect(bell(page)).toHaveAttribute("aria-expanded", "false");

    // Esc
    await bell(page).click();
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(bell(page)).toBeFocused();

    // Click on the dimming (top left corner, above the sheet on phones).
    await bell(page).click();
    await expect(dialog).toBeVisible();
    await page.mouse.click(8, 8);
    await expect(dialog).toBeHidden();
    await expect(bell(page)).toBeFocused();
  });

  test("Pinker Punkt: ohne Wert und bei altem Wert, weg nach dem Öffnen", async ({ page }) => {
    const dot = page.getByTestId("news-dot");

    await reloadWithSeen(page, null);
    await expect(dot).toBeVisible();
    await expect(bell(page)).toHaveAccessibleName("Neuigkeiten – es gibt Neues");

    await bell(page).click();
    await expect(panel(page)).toBeVisible();
    await expect(dot).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(bell(page)).toHaveAccessibleName("Neuigkeiten");
    expect(await page.evaluate((key) => window.localStorage.getItem(key), SEEN_KEY)).toBe("015-neuigkeiten");

    await page.reload();
    await expectPlanReady(page);
    await expect(bell(page)).toHaveAccessibleName("Neuigkeiten");
    await expect(dot).toHaveCount(0);

    await reloadWithSeen(page, "r1-start");
    await expect(dot).toBeVisible();

    await reloadWithSeen(page, "gibt-es-nicht");
    await expect(dot).toBeVisible();
  });

  test("Liegt über Kopfleiste und offenem Plan-Element, das danach offen bleibt", async ({ page }) => {
    const details = await openPlanElement(page);

    await bell(page).click();
    const dialog = panel(page);
    await expect(dialog).toBeVisible();

    // The header (bug button) is covered: a hit there lands on the panel or its dimming.
    const bug = await box(page.getByRole("banner").getByRole("button", { name: /^Feedback geben/ }));
    const covered = await page.evaluate(
      ([x, y]) => Boolean(document.elementFromPoint(x, y)?.closest("dialog[open]")),
      [bug.x + bug.width / 2, bug.y + bug.height / 2] as const
    );
    expect(covered, "Kopfleiste liegt über dem Panel").toBe(true);
    // The panel covers the plan details where they overlap.
    const panelBox = await box(dialog);
    const point = [panelBox.x + panelBox.width / 2, panelBox.y + Math.min(panelBox.height / 2, 120)] as const;
    const onPanel = await page.evaluate(
      ([x, y]) => Boolean(document.elementFromPoint(x, y)?.closest("dialog[open]")),
      point
    );
    expect(onPanel, "Plan-Element liegt über dem Panel").toBe(true);

    // Escape closes only the news, the plan element stays open.
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(details).toBeVisible();
    await expect(details.getByRole("heading", { name: "Kooperationsgespräch KVR/Polizei" })).toBeVisible();
    await details.getByRole("button", { name: "Details schließen" }).click();
    await expect(details).toHaveCount(0);
  });
});
