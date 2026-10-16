import { expect, test, type Page } from "@playwright/test";

// Spec 007: the plan on the start page – Gantt with details on wide screens,
// the week list on phones. Needs the dev seed (example plan, D-Day
// 08.05.2027); checks go by element name and are relative to today. Read
// only: nothing is created, so nothing has to be cleaned up.

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

/** Name button of an element in the Gantt (its name starts the label). */
function ganttName(page: Page, name: string) {
  return page.getByRole("button", { name: new RegExp(`^${escape(name)}`) }).filter({ visible: true });
}

function lane(page: Page, name: string) {
  return page.getByRole("button", { name: new RegExp(`^${escape(name)} \\d+/\\d+$`) });
}

function details(page: Page) {
  return page.getByRole("complementary", { name: "Details" });
}

function weekCard(page: Page, name: string) {
  return page.getByRole("listitem").filter({ has: page.getByText(name, { exact: true }) });
}

test.describe("Plan", () => {
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

    await devLogin(page, "Kim Brenner");
    // Start without remembered view preferences of earlier runs.
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();
    await expectPageReady(page, "Plan KP27");
  });

  test.afterEach(() => {
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("Laptop: Gantt, Auswahl mit Details, Filter, Zuklappen, Liste", async ({ page }) => {
    test.skip(isNarrow(page), "nur auf breiten Bildschirmen");

    await expect(
      page.getByRole("navigation", { name: "Hauptnavigation" }).getByRole("link", { name: "Plan", exact: true })
    ).toBeVisible();
    const gantt = page.getByRole("img", { name: "Gantt-Plan" });
    await expect(gantt).toBeVisible();
    await expect(lane(page, "AK Demo & Route")).toBeVisible();

    // "Heute" sits inside the visible part of the scrolling time axis.
    const scroller = gantt.locator("xpath=..");
    const todayLabel = gantt.locator("text").filter({ hasText: /^Heute$/ });
    const area = (await scroller.boundingBox())!;
    const label = (await todayLabel.boundingBox())!;
    expect(label.x).toBeGreaterThanOrEqual(area.x);
    expect(label.x + label.width).toBeLessThanOrEqual(area.x + area.width);

    // Fixed date too late: details, arrows, Escape closes.
    await ganttName(page, "Kooperationsgespräch KVR/Polizei").click();
    const panel = details(page);
    await expect(panel).toBeVisible();
    await expect(panel.getByRole("heading", { name: "Kooperationsgespräch KVR/Polizei" })).toBeVisible();
    await expect(panel.getByText("Verzug", { exact: true })).toBeVisible();
    await expect(panel.getByText("−2 T Verzug", { exact: true })).toBeVisible();
    await expect(panel.getByText("Fixtermin (extern festgelegt)")).toBeVisible();
    await expect(panel.getByRole("button", { name: "Finaler Crosscheck", exact: true })).toBeVisible();
    await expect(panel.getByLabel("Abstand zu Finaler Crosscheck in Tagen")).toHaveValue("15");
    await expect(page.getByTestId("gantt-arrows").locator("path").first()).toBeAttached();
    expect(await page.getByTestId("gantt-arrows").locator("path").count()).toBeGreaterThanOrEqual(2);
    await page.keyboard.press("Escape");
    await expect(panel).toHaveCount(0);
    await expect(page.getByTestId("gantt-arrows")).toHaveCount(0);

    // To-dos and notes.
    await ganttName(page, "Finaler Crosscheck").click();
    const todo = panel.getByRole("listitem").filter({ hasText: "Rechtliches geprüft" });
    await expect(todo).toBeVisible();
    await expect(todo).toContainText("Kim Brenner");
    await expect(panel.getByRole("heading", { name: "Notizen" })).toBeVisible();
    await expect(panel.getByText(/^(Kim Brenner|Alex Rauch) · \S+ \d{2}\.\d{2}\.$/).first()).toBeVisible();
    await panel.getByRole("button", { name: "Details schließen" }).click();
    await expect(panel).toHaveCount(0);

    // Critical path: exactly the seven elements of the chain.
    await page.getByRole("button", { name: "Kritischer Pfad", exact: true }).click();
    await expect(page.getByRole("button", { name: "Kritischer Pfad", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await expect(page.getByTestId("gantt-element")).toHaveCount(7);
    await expect(ganttName(page, "Budget KP27 beschlossen")).toBeVisible();
    await expect(ganttName(page, "Schildermalen")).toHaveCount(0);
    await expect(page.getByText(/Kritischer Pfad: 7 Elemente, Start spätestens \S+ \d{2}\.\d{2}\. \(150\sT vorher\)/)).toBeVisible();
    await page.getByRole("button", { name: "Kritischer Pfad", exact: true }).click();
    await expect(ganttName(page, "Schildermalen")).toBeVisible();

    // Collapse a lane; it stays collapsed after reloading.
    const demo = lane(page, "AK Demo & Route");
    const laneBars = page.getByTestId("gantt-lane-bar");
    const bars = await laneBars.count();
    await demo.click();
    await expect(demo).toHaveAttribute("aria-expanded", "false");
    await expect(ganttName(page, "Finaler Crosscheck")).toHaveCount(0);
    await expect(laneBars).toHaveCount(bars);
    await page.reload();
    await expectPageReady(page, "Plan KP27");
    await expect(lane(page, "AK Demo & Route")).toHaveAttribute("aria-expanded", "false");
    await expect(ganttName(page, "Finaler Crosscheck")).toHaveCount(0);
    await lane(page, "AK Demo & Route").click();
    await expect(ganttName(page, "Finaler Crosscheck")).toBeVisible();

    // Week list instead of the Gantt; stays after reloading.
    const views = page.getByRole("group", { name: "Ansicht" });
    await views.getByRole("button", { name: "Liste" }).click();
    await expect(page.getByRole("heading", { name: "Diese Woche" })).toBeVisible();
    await expect(gantt).toHaveCount(0);
    await page.reload();
    await expectPageReady(page, "Plan KP27");
    await expect(page.getByRole("heading", { name: "Diese Woche" })).toBeVisible();
    await expect(page.getByRole("img", { name: "Gantt-Plan" })).toHaveCount(0);
    await page.getByRole("group", { name: "Ansicht" }).getByRole("button", { name: "Gantt" }).click();
    await expect(page.getByRole("img", { name: "Gantt-Plan" })).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test("Handy: Wochenliste, Meine AKs, Blatt mit Details", async ({ page }) => {
    test.skip(!isNarrow(page), "nur auf schmalen Bildschirmen");

    await expect(page.getByRole("img", { name: "Gantt-Plan" })).toBeHidden();
    await expect(page.getByRole("group", { name: "Ansicht" })).toBeHidden();
    await expect(page.getByRole("heading", { name: "Diese Woche" })).toBeVisible();

    const overdue = page.getByRole("region", { name: "Überfällig & Verzug" });
    await expect(overdue.getByText("Kooperationsgespräch KVR/Polizei", { exact: true })).toBeVisible();

    await expect(weekCard(page, "Budget KP27 beschlossen")).toBeVisible();
    await page.getByRole("button", { name: "Meine AKs" }).click();
    await expect(weekCard(page, "Budget KP27 beschlossen")).toHaveCount(0);
    await expect(overdue.getByText("Kooperationsgespräch KVR/Polizei", { exact: true })).toBeVisible();

    await overdue.getByText("Kooperationsgespräch KVR/Polizei", { exact: true }).click();
    const panel = details(page);
    await expect(panel).toBeVisible();
    await expect(panel.getByText("−2 T Verzug", { exact: true })).toBeVisible();
    await expectNoHorizontalScroll(page);
    await panel.getByRole("button", { name: "Details schließen" }).click();
    await expect(panel).toHaveCount(0);
    await expectNoHorizontalScroll(page);
  });
});
