import { defineConfig } from "@playwright/test";

// `pnpm e2e` runs against an already running app: locally `pnpm dev`, in CI
// the Vercel preview (BASE_URL + VERCEL_AUTOMATION_BYPASS_SECRET).
const baseURL = process.env.BASE_URL ?? "http://localhost:3000";
const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

export default defineConfig({
  testDir: "./e2e",
  // Both viewports share one database and the same "E2E …" entries.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    browserName: "chromium",
    reducedMotion: "reduce",
    locale: "de-DE",
    timezoneId: "Europe/Berlin",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    extraHTTPHeaders: bypassSecret
      ? { "x-vercel-protection-bypass": bypassSecret, "x-vercel-set-bypass-cookie": "true" }
      : undefined,
  },
  projects: [
    { name: "iphone", use: { viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true } },
    { name: "desktop", use: { viewport: { width: 1280, height: 800 } } },
  ],
});
