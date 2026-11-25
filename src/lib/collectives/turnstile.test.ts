import { describe, expect, it, vi } from "vitest";
import { TURNSTILE_VERIFY_URL, turnstileMode, verifyTurnstile } from "./turnstile";

describe("turnstileMode", () => {
  it("is on with both keys", () => {
    expect(turnstileMode({ TURNSTILE_SITE_KEY: "site", TURNSTILE_SECRET_KEY: "secret" })).toEqual({
      mode: "on",
      siteKey: "site",
      secretKey: "secret",
    });
  });

  it("is off without keys outside production", () => {
    expect(turnstileMode({})).toEqual({ mode: "off" });
    expect(turnstileMode({ APP_ENV: "preview", TURNSTILE_SITE_KEY: "site" })).toEqual({ mode: "off" });
  });

  it("is misconfigured without keys in production", () => {
    expect(turnstileMode({ APP_ENV: "production" })).toEqual({ mode: "misconfigured" });
    expect(turnstileMode({ APP_ENV: "production", TURNSTILE_SECRET_KEY: " " })).toEqual({ mode: "misconfigured" });
  });
});

function answer(body: unknown, ok = true) {
  return vi.fn(async () => ({ ok, json: async () => body }) as Response);
}

describe("verifyTurnstile", () => {
  it("sends secret and token to Cloudflare", async () => {
    const fetcher = answer({ success: true });
    await expect(verifyTurnstile("token", "secret", fetcher)).resolves.toBe(true);
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(TURNSTILE_VERIFY_URL);
    expect(String(init.body)).toBe("secret=secret&response=token");
  });

  it("is false when Cloudflare says no or fails", async () => {
    await expect(verifyTurnstile("token", "secret", answer({ success: false }))).resolves.toBe(false);
    await expect(verifyTurnstile("token", "secret", answer({ success: "true" }))).resolves.toBe(false);
    await expect(verifyTurnstile("token", "secret", answer({}, false))).resolves.toBe(false);
    const broken = vi.fn(async () => {
      throw new Error("network");
    });
    await expect(verifyTurnstile("token", "secret", broken)).resolves.toBe(false);
  });

  it("does not ask Cloudflare for an implausible token", async () => {
    const fetcher = answer({ success: true });
    for (const token of [undefined, "", 42, "x".repeat(2049)]) {
      await expect(verifyTurnstile(token, "secret", fetcher)).resolves.toBe(false);
    }
    expect(fetcher).not.toHaveBeenCalled();
  });
});
