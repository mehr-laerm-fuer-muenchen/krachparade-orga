import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // e2e/ holds the Playwright tests (`pnpm e2e`), not Vitest tests.
    exclude: [...configDefaults.exclude, "e2e/**"],
  },
});
