import { describe, expect, it } from "vitest";
import { publicRequestUrl } from "./forwarded-url";

const INTERNAL = "https://localhost:3000/api/auth/callback/google?code=abc&state=xyz";

describe("publicRequestUrl", () => {
  it("uses X-Forwarded-Host and -Proto from the proxy", () => {
    const headers = new Headers({
      host: "localhost:3000",
      "x-forwarded-host": "krachparade-orga.de",
      "x-forwarded-proto": "https",
    });
    expect(publicRequestUrl(INTERNAL, headers)).toBe(
      "https://krachparade-orga.de/api/auth/callback/google?code=abc&state=xyz",
    );
  });

  it("keeps the preview address of a pull request", () => {
    const headers = new Headers({ "x-forwarded-host": "11.preview.krachparade-orga.de", "x-forwarded-proto": "https" });
    expect(publicRequestUrl("http://localhost:3000/api/auth/session", headers)).toBe(
      "https://11.preview.krachparade-orga.de/api/auth/session",
    );
  });

  it("takes the first entry of a comma separated list", () => {
    const headers = new Headers({ "x-forwarded-host": "krachparade-orga.de, other.example.org", "x-forwarded-proto": "https,http" });
    expect(publicRequestUrl(INTERNAL, headers)).toMatch(/^https:\/\/krachparade-orga\.de\//);
  });

  it("falls back to Host and the request's protocol (local development)", () => {
    const headers = new Headers({ host: "localhost:3000" });
    expect(publicRequestUrl("http://localhost:3000/api/auth/session", headers)).toBe(
      "http://localhost:3000/api/auth/session",
    );
  });

  it("rejects hosts with a path, user info or spaces", () => {
    for (const host of ["evil.example.org/x", "user@evil.example.org", "a b", ""]) {
      expect(publicRequestUrl(INTERNAL, new Headers({ "x-forwarded-host": host, host: "" }))).toBeNull();
    }
  });

  it("rejects protocols other than http and https", () => {
    const headers = new Headers({ "x-forwarded-host": "krachparade-orga.de", "x-forwarded-proto": "javascript" });
    expect(publicRequestUrl(INTERNAL, headers)).toBeNull();
  });
});
