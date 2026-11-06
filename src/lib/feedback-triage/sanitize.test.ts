import { describe, expect, it } from "vitest";
import { escapeHtml, maskSensitive, neutralizeMentions, quote, sanitize } from "./sanitize";

describe("maskSensitive", () => {
  it("masks phone numbers", () => {
    expect(maskSensitive("Ruf an: 0171 2345678")).toBe("Ruf an: [entfernt]");
    expect(maskSensitive("+49 89 1234567 bitte")).toBe("[entfernt] bitte");
    expect(maskSensitive("089/123-4567")).toBe("[entfernt]");
    expect(maskSensitive("Tel 01712345678.")).toBe("Tel [entfernt].");
  });

  it("keeps short numbers, dates and screen sizes", () => {
    expect(maskSensitive("Seite 3, 12 Aufgaben, 08.05.2027, 2027-05-08, 390 × 844")).toBe(
      "Seite 3, 12 Aufgaben, 08.05.2027, 2027-05-08, 390 × 844"
    );
    expect(maskSensitive("123456")).toBe("123456");
  });

  it("masks IBANs with and without spaces", () => {
    expect(maskSensitive("IBAN DE89 3704 0044 0532 0130 00 danke")).toBe("IBAN [entfernt] danke");
    expect(maskSensitive("DE89370400440532013000")).toBe("[entfernt]");
  });

  it("masks e-mail addresses", () => {
    expect(maskSensitive("Schreib an alex.rauch@example.org!")).toBe("Schreib an [entfernt]!");
  });
});

describe("neutralizeMentions", () => {
  it("replaces @ so nobody gets pinged", () => {
    expect(neutralizeMentions("Hallo @franz und @team-orga")).toBe("Hallo ＠franz und ＠team-orga");
    expect(neutralizeMentions("Preis @ 5 €")).toBe("Preis @ 5 €");
  });
});

describe("escapeHtml / sanitize", () => {
  it("stops HTML and fake markers", () => {
    expect(escapeHtml("<!-- meldungen: x --> <b>fett</b>")).toBe("&lt;!-- meldungen: x --> &lt;b>fett&lt;/b>");
    expect(escapeHtml("&lt;")).toBe("&amp;lt;");
    expect(escapeHtml("Tom & Jerry")).toBe("Tom & Jerry");
  });

  it("does all in one", () => {
    expect(sanitize("@franz: 0171 2345678, a@example.org <x>")).toBe("＠franz: [entfernt], [entfernt] &lt;x>");
  });
});

describe("quote", () => {
  it("quotes every line", () => {
    expect(quote("Zeile 1\r\n\r\nZeile 2", 100)).toBe("> Zeile 1\n>\n> Zeile 2");
  });

  it("shortens to max characters with …", () => {
    const result = quote("abcdefghij", 5);
    expect(result).toBe("> abcd…");
    expect(result.length - 2).toBe(5);
    expect(quote("abc", 5)).toBe("> abc");
  });
});
