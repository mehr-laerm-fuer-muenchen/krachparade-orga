import { describe, expect, it } from "vitest";
import { isDevLoginEnabled } from "./dev-login";

describe("isDevLoginEnabled", () => {
  it("is on locally", () => {
    expect(isDevLoginEnabled({ NODE_ENV: "development" })).toBe(true);
  });

  it("is on in a Vercel preview with the flag", () => {
    expect(
      isDevLoginEnabled({ NODE_ENV: "production", VERCEL_ENV: "preview", ENABLE_DEV_LOGIN: "1" })
    ).toBe(true);
  });

  it.each([undefined, "", "0", "true"])("is off in a Vercel preview with flag %s", (flag) => {
    expect(
      isDevLoginEnabled({ NODE_ENV: "production", VERCEL_ENV: "preview", ENABLE_DEV_LOGIN: flag })
    ).toBe(false);
  });

  it("is off in production with the flag", () => {
    expect(
      isDevLoginEnabled({ NODE_ENV: "production", VERCEL_ENV: "production", ENABLE_DEV_LOGIN: "1" })
    ).toBe(false);
  });

  it("is off in production without the flag", () => {
    expect(isDevLoginEnabled({ NODE_ENV: "production", VERCEL_ENV: "production" })).toBe(false);
  });

  it("is off in a production build outside Vercel with the flag", () => {
    expect(isDevLoginEnabled({ NODE_ENV: "production", ENABLE_DEV_LOGIN: "1" })).toBe(false);
  });

  it("is off in a production build outside Vercel without the flag", () => {
    expect(isDevLoginEnabled({ NODE_ENV: "production" })).toBe(false);
  });
});
