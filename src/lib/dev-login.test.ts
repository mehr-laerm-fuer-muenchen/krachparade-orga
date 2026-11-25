import { describe, expect, it } from "vitest";
import { isDevLoginEmail, isDevLoginEnabled } from "./dev-login";

describe("isDevLoginEmail", () => {
  it("accepts made-up @example.org addresses", () => {
    expect(isDevLoginEmail("kim.brenner@example.org")).toBe(true);
    expect(isDevLoginEmail("Kim.Brenner@Example.org")).toBe(true);
  });

  it.each(["kim@example.net", "kim@example.org.example.net", "kim@sub.example.org", "@example.org", ""])(
    "refuses %s",
    (email) => {
      expect(isDevLoginEmail(email)).toBe(false);
    }
  );
});

describe("isDevLoginEnabled", () => {
  it("is on locally", () => {
    expect(isDevLoginEnabled({ NODE_ENV: "development" })).toBe(true);
  });

  it("is on in a preview (APP_ENV=preview) with the flag", () => {
    expect(
      isDevLoginEnabled({ NODE_ENV: "production", APP_ENV: "preview", ENABLE_DEV_LOGIN: "1" })
    ).toBe(true);
  });

  it.each([undefined, "", "0", "true"])("is off in a preview (APP_ENV=preview) with flag %s", (flag) => {
    expect(
      isDevLoginEnabled({ NODE_ENV: "production", APP_ENV: "preview", ENABLE_DEV_LOGIN: flag })
    ).toBe(false);
  });

  it("is off in production with the flag", () => {
    expect(
      isDevLoginEnabled({ NODE_ENV: "production", APP_ENV: "production", ENABLE_DEV_LOGIN: "1" })
    ).toBe(false);
  });

  it("is off in production without the flag", () => {
    expect(isDevLoginEnabled({ NODE_ENV: "production", APP_ENV: "production" })).toBe(false);
  });

  it("is off in a production build without APP_ENV with the flag", () => {
    expect(isDevLoginEnabled({ NODE_ENV: "production", ENABLE_DEV_LOGIN: "1" })).toBe(false);
  });

  it("is off in a production build without APP_ENV without the flag", () => {
    expect(isDevLoginEnabled({ NODE_ENV: "production" })).toBe(false);
  });
});
