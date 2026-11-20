import { describe, expect, it } from "vitest";
import { addressOf, mailConfig } from "./config";

const GMAIL = {
  SMTP_HOST: "smtp.example.org",
  SMTP_PORT: "465",
  SMTP_USER: "orga@example.org",
  SMTP_PASSWORD: "abcd efgh ijkl mnop",
  MAIL_FROM: "Krachparade Orga <orga@example.org>",
};

describe("mailConfig", () => {
  it("reads a complete setup, removes spaces from the app password", () => {
    expect(mailConfig({ ...GMAIL, VERCEL_ENV: "production" })).toEqual({
      ok: true,
      config: {
        host: "smtp.example.org",
        port: 465,
        secure: true,
        auth: { user: "orga@example.org", pass: "abcdefghijklmnop" },
        from: "Krachparade Orga <orga@example.org>",
      },
    });
  });

  it("works without login for the local Mailpit", () => {
    const result = mailConfig({ SMTP_HOST: "localhost", SMTP_PORT: "1025", MAIL_FROM: "orga@example.org" });
    expect(result).toMatchObject({ ok: true, config: { secure: false, auth: null } });
  });

  it("sends nothing when a variable is missing", () => {
    expect(mailConfig({})).toEqual({ ok: false, reason: "not_configured" });
    expect(mailConfig({ ...GMAIL, MAIL_FROM: " " })).toEqual({ ok: false, reason: "not_configured" });
    expect(mailConfig({ ...GMAIL, SMTP_PORT: "abc" })).toEqual({ ok: false, reason: "not_configured" });
    expect(mailConfig({ ...GMAIL, SMTP_PASSWORD: "" })).toEqual({ ok: false, reason: "not_configured" });
  });

  it("sends nothing in Vercel previews unless MAIL_ENABLED=1", () => {
    expect(mailConfig({ ...GMAIL, VERCEL_ENV: "preview" })).toEqual({ ok: false, reason: "disabled" });
    expect(mailConfig({ ...GMAIL, VERCEL_ENV: "development" })).toEqual({ ok: false, reason: "disabled" });
    expect(mailConfig({ ...GMAIL, VERCEL_ENV: "preview", MAIL_ENABLED: "1" }).ok).toBe(true);
  });
});

describe("addressOf", () => {
  it("takes the address out of a display name", () => {
    expect(addressOf("Krachparade Orga <orga@example.org>")).toBe("orga@example.org");
    expect(addressOf("orga@example.org")).toBe("orga@example.org");
  });
});
