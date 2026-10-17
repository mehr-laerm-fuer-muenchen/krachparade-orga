import { expect, test, type Locator, type Page } from "@playwright/test";

// Spec 013: "Krachparade" instead of "D-Day". Only reads pages, never moves or
// ticks anything (seed plan elements stay unchanged). Needs the dev seed
// (admin Kim Brenner, example plan).

const PAGES = [
  { href: "/", h1: /^Plan / },
  { href: "/meine", h1: "Meine Aufgaben" },
  { href: "/einstellungen", h1: "Einstellungen" },
  { href: "/feedback", h1: "Feedback" },
  { href: "/protokolle", h1: "Protokolle" },
  { href: "/arbeitskreise", h1: "AKs" },
];

/** "D-Day", "D-80" or "D−80" (Unicode minus). */
const OLD_TERM = /D-Day|D[-−]\d/;

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

async function box(locator: Locator) {
  const result = await locator.boundingBox();
  expect(result, "Element hat keine Fläche").not.toBeNull();
  return result!;
}

test.describe("Begriff Krachparade", () => {
  let errors: string[];

  test.beforeEach(async ({ page }) => {
    errors = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));
    await devLogin(page, "Kim Brenner");
    await expectPageReady(page, /^Plan /);
  });

  test.afterEach(() => {
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("Kopfleiste: Countdown in einer Reihe mit Logo und Käfer", async ({ page }) => {
    const banner = page.getByRole("banner");
    const countdown = page.getByTestId("dday-label");
    await expect(countdown).toHaveText(/^(noch \d+\sT|heute!|vorbei)$/);
    await expect(banner.getByText(/^(Noch \d+ Tage? bis zur Krachparade|Heute ist Krachparade|Krachparade ist vorbei)$/)).toHaveCount(1);

    const logo = await box(banner.getByRole("img", { name: "Mehr Lärm für München" }));
    const bug = await box(banner.getByRole("button", { name: /^Feedback zur App geben/ }));
    const label = await box(countdown);
    // One row: the vertical ranges of logo, bug button and countdown overlap.
    for (const other of [bug, label]) {
      expect(other.y, "liegt unter dem Logo").toBeLessThan(logo.y + logo.height);
      expect(other.y + other.height, "liegt über dem Logo").toBeGreaterThan(logo.y);
    }
    // Countdown and bug button side by side (order differs per width), inside the viewport.
    const width = page.viewportSize()!.width;
    const apart = label.x >= bug.x + bug.width || bug.x >= label.x + label.width;
    expect(apart, "Countdown und Käfer überlappen").toBe(true);
    expect(Math.max(label.x + label.width, bug.x + bug.width)).toBeLessThanOrEqual(width);
    expect(bug.width).toBeGreaterThanOrEqual(44);
    expect(bug.height).toBeGreaterThanOrEqual(44);

    if (isNarrow(page)) {
      // Header as before: one row of 44 px plus padding and border.
      const header = await box(banner);
      expect(header.height).toBeLessThanOrEqual(logo.height + 24);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });

  test("Kein D-Day und kein D-N auf den Seiten", async ({ page }) => {
    for (const { href, h1 } of PAGES) {
      await page.goto(href);
      await expectPageReady(page, h1);
      const texts = await page.evaluate(() => [
        document.title,
        document.body.innerText,
        ...Array.from(document.querySelectorAll("[aria-label]"), (element) => element.getAttribute("aria-label") ?? ""),
        ...Array.from(document.querySelectorAll("[title]"), (element) => element.getAttribute("title") ?? ""),
      ]);
      const found = texts.filter((text) => OLD_TERM.test(text)).map((text) => text.match(OLD_TERM)![0]);
      expect(found, `${href}: alter Begriff gefunden`).toEqual([]);
    }
  });

  test("Gantt zeigt das Linien-Schild Krachparade", async ({ page }) => {
    test.skip(isNarrow(page), "Gantt nur auf breiten Bildschirmen");
    const gantt = page.getByRole("img", { name: "Gantt-Plan" });
    await expect(gantt).toBeVisible();
    await expect(gantt.locator("text").filter({ hasText: /^Krachparade$/ })).toHaveCount(1);
    await expect(gantt.locator("text").filter({ hasText: /^Heute$/ })).toHaveCount(1);
  });
});
