import { describe, expect, it } from "vitest";
import { resetBlockReason } from "./db-reset";

const DEV = "postgresql://dev.example.org/app";
const PROD = "postgresql://prod.example.org/app";

describe("resetBlockReason", () => {
  it("allows the dev database", () => {
    expect(resetBlockReason({ DATABASE_URL: DEV, DATABASE_URL_PROD: PROD })).toBeNull();
    expect(resetBlockReason({ DATABASE_URL: DEV, APP_ENV: "development" })).toBeNull();
  });

  it("refuses APP_ENV=production", () => {
    expect(resetBlockReason({ DATABASE_URL: DEV, APP_ENV: "production" })).toMatch(/production/);
  });

  it("refuses a missing DATABASE_URL", () => {
    expect(resetBlockReason({})).toMatch(/DATABASE_URL fehlt/);
  });

  it("refuses when DATABASE_URL is the production database", () => {
    expect(resetBlockReason({ DATABASE_URL: PROD, DATABASE_URL_PROD: PROD })).toMatch(/Production/);
  });
});
