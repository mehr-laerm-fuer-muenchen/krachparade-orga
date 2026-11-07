import { describe, expect, it } from "vitest";
import { findSecretPatterns } from "./secrets";

describe("findSecretPatterns", () => {
  it("finds every pattern", () => {
    const cases: [string, string][] = [
      ["postgres://user:pw@example.org/db", "postgres://"],
      ["PostgreSQL://user:pw@host", "postgres://"],
      ["Token sk-ant-oat01-abc", "sk-ant-"],
      ["ghs_abc123", "ghs_"],
      ["ghp_abc123", "ghp_"],
      ["github_pat_11ABC", "github_pat_"],
      ["-----BEGIN RSA PRIVATE KEY-----", "-----BEGIN"],
      ["CLAUDE_CODE_OAUTH_TOKEN=x", "OAUTH"],
    ];
    for (const [text, name] of cases) {
      expect(findSecretPatterns(text), text).toContain(name);
    }
  });

  it("names all hits, never the match", () => {
    const hits = findSecretPatterns("postgresql://a:b@c und ghp_x");
    expect(hits).toEqual(["postgres://", "ghp_"]);
    expect(hits.join(" ")).not.toContain("a:b@c");
  });

  it("leaves normal texts alone", () => {
    for (const text of [
      "Login mit Google (OAuth) klappt am iPhone nicht.",
      "Die Datenbank ist Postgres bei Neon.",
      "Abschnitt BEGIN des Plans, ghost_ mode, Desk-Antwort",
      "",
    ]) {
      expect(findSecretPatterns(text), text).toEqual([]);
    }
  });
});
