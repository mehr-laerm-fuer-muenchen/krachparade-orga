import { describe, expect, it } from "vitest";
import { bestimmeRisikoklasse, claudeSettings, globZuRegex } from "./risikoklasse";

describe("bestimmeRisikoklasse", () => {
  it("only styles, components, pure functions → A", () => {
    const ergebnis = bestimmeRisikoklasse([
      "src/app/globals.css",
      "src/components/Kopfleiste.tsx",
      "src/lib/termine.ts",
      "docs/lernjournal.md",
    ]);
    expect(ergebnis).toMatchObject({ klasse: "A", db: false });
  });

  it("new route → B", () => {
    expect(bestimmeRisikoklasse(["src/app/aufgaben/page.tsx"]).klasse).toBe("B");
    expect(bestimmeRisikoklasse(["src/app/page.tsx"]).klasse).toBe("B");
    expect(bestimmeRisikoklasse(["src/app/api/ping/route.ts"]).klasse).toBe("B");
  });

  it("server action → B", () => {
    expect(bestimmeRisikoklasse(["src/actions/aufgaben.ts"]).klasse).toBe("B");
  });

  it("src/proxy.ts → C", () => {
    const ergebnis = bestimmeRisikoklasse(["src/proxy.ts"]);
    expect(ergebnis.klasse).toBe("C");
    expect(ergebnis.gruende[0]).toContain("src/proxy.ts");
  });

  it(".github/… → C", () => {
    expect(bestimmeRisikoklasse([".github/workflows/pruefungen.yml"]).klasse).toBe("C");
  });

  it("the rules and the classifier themselves → C", () => {
    expect(bestimmeRisikoklasse(["agents/risikoklassen.json"]).klasse).toBe("C");
    expect(bestimmeRisikoklasse(["scripts/risikoklasse.ts"]).klasse).toBe("C");
  });

  it("login, dev login, db reset, env files and config → C", () => {
    for (const pfad of [
      "src/auth.ts",
      "src/app/api/auth/[...nextauth]/route.ts",
      "src/app/dev/login/page.tsx",
      "src/lib/dev-login.test.ts",
      "src/db/index.ts",
      "src/db/reset-dev.ts",
      "src/lib/db-reset.ts",
      ".env.example",
      "src/.env.local",
      "drizzle.prod.config.ts",
      "package.json",
      "next.config.ts",
      "AGENTS.md",
      "CLAUDE.md",
      ".claude/settings.json",
    ]) {
      expect(bestimmeRisikoklasse([pfad]).klasse, pfad).toBe("C");
    }
  });

  it("schema file → db: true", () => {
    const ergebnis = bestimmeRisikoklasse([
      { pfad: "src/db/schema.ts", zeilen: { hinzu: ["  note: text(\"note\"),"], entfernt: [] } },
    ]);
    expect(ergebnis).toMatchObject({ klasse: "B", db: true });
  });

  it("schema with removed lines → C", () => {
    const ergebnis = bestimmeRisikoklasse([
      { pfad: "src/db/schema.ts", zeilen: { hinzu: [], entfernt: ["  value: text(\"value\"),"] } },
    ]);
    expect(ergebnis).toMatchObject({ klasse: "C", db: true });
  });

  it("content rules without line info count as C", () => {
    expect(bestimmeRisikoklasse(["src/db/schema.ts"]).klasse).toBe("C");
    expect(bestimmeRisikoklasse(["src/app/layout.tsx"]).klasse).toBe("C");
  });

  it("seed: prod part → C, otherwise B", () => {
    const seed = (zeile: string) =>
      bestimmeRisikoklasse([{ pfad: "src/db/seed.ts", zeilen: { hinzu: [zeile], entfernt: [] } }]);
    expect(seed("  { name: \"Test Person\", email: \"test@example.org\" },")).toMatchObject({
      klasse: "B",
      db: true,
    });
    expect(seed("if (process.argv.includes(\"--prod\")) {").klasse).toBe("C");
  });

  it("layout: robots entry → C, other lines → A", () => {
    const layout = (zeile: string) =>
      bestimmeRisikoklasse([{ pfad: "src/app/layout.tsx", zeilen: { hinzu: [zeile], entfernt: [] } }]);
    expect(layout("  themeColor: \"#123456\",").klasse).toBe("A");
    expect(layout("  robots: { index: true },").klasse).toBe("C");
  });

  it("spec text → A, Freigabe line → C", () => {
    const spec = (zeile: string) =>
      bestimmeRisikoklasse([{ pfad: "docs/specs/002-login.md", zeilen: { hinzu: [zeile], entfernt: [] } }]);
    expect(spec("## Ziel").klasse).toBe("A");
    expect(spec("Freigabe Franz: ☑").klasse).toBe("C");
  });

  it("empty list → A", () => {
    expect(bestimmeRisikoklasse([])).toMatchObject({ klasse: "A", db: false });
  });

  it("mixed list → highest class wins", () => {
    expect(
      bestimmeRisikoklasse(["src/app/globals.css", "src/app/aufgaben/page.tsx"]).klasse,
    ).toBe("B");
    const gemischt = bestimmeRisikoklasse([
      "src/components/Kopfleiste.tsx",
      "src/app/aufgaben/page.tsx",
      "src/proxy.ts",
    ]);
    expect(gemischt.klasse).toBe("C");
    expect(gemischt.gruende).toHaveLength(2);
  });

  it("paths outside the repo → C", () => {
    expect(bestimmeRisikoklasse(["../evil.ts"]).klasse).toBe("C");
    expect(bestimmeRisikoklasse(["/etc/passwd"]).klasse).toBe("C");
  });
});

describe("globZuRegex", () => {
  it("* stays in one folder, ** spans folders", () => {
    expect(globZuRegex("src/*.ts").test("src/a.ts")).toBe(true);
    expect(globZuRegex("src/*.ts").test("src/x/a.ts")).toBe(false);
    expect(globZuRegex("src/**").test("src/x/y/a.ts")).toBe(true);
    expect(globZuRegex("src/app/**/page.tsx").test("src/app/page.tsx")).toBe(true);
    expect(globZuRegex("drizzle*.config.*").test("drizzle.prod.config.ts")).toBe(true);
  });
});

describe("claudeSettings", () => {
  it("forbids edits to class C paths and git push", () => {
    const { deny } = claudeSettings().permissions;
    expect(deny).toContain("Edit(src/proxy.ts)");
    expect(deny).toContain("Write(.github/**)");
    expect(deny).toContain("Read(.env*)");
    expect(deny).toContain("Bash(git push:*)");
  });
});
