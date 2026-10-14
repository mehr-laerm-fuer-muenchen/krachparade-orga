// Risk class of a change (spec 001, taken over from schladming2go): pure function + small CLI.
// The rules live in agents/risikoklassen.json (machine-readable AGENTS.md §5).
//
// CLI (run with `pnpm exec tsx scripts/risikoklasse.ts …`):
//   <file> <file> …        classify a list of paths (no line info → content rules count as C)
//   --base <ref>           classify `git diff <ref> HEAD`, including changed lines
//   --claude-settings      print Claude Code settings that forbid edits to class C paths
// Output is JSON on stdout.

import { execFileSync } from "node:child_process";
import regelnJson from "../agents/risikoklassen.json";

export type Klasse = "A" | "B" | "C";

export type Inhaltsregel = {
  muster: string;
  klasse: Klasse;
  /** "zeilen-entfernt": any removed line makes the file class C. */
  cWenn?: "zeilen-entfernt";
  /** Regex (case-insensitive): an added or removed line matching it makes the file class C. */
  cWennZeile?: string;
  grund: string;
};

export type Regeln = {
  C: string[];
  inhalt: Inhaltsregel[];
  B: string[];
  db: string[];
};

export type Aenderung = {
  pfad: string;
  /** Changed lines; without them content rules cannot be checked and count as C. */
  zeilen?: { hinzu: string[]; entfernt: string[] };
};

export type Ergebnis = { klasse: Klasse; db: boolean; gruende: string[] };

export const standardRegeln: Regeln = regelnJson as Regeln;

const RANG: Record<Klasse, number> = { A: 0, B: 1, C: 2 };

/** Glob → RegExp. `**` spans folders, `*` and `?` stay inside one path segment. */
export function globZuRegex(muster: string): RegExp {
  let re = "";
  for (let i = 0; i < muster.length; i++) {
    const zeichen = muster[i];
    if (zeichen === "*" && muster[i + 1] === "*") {
      if (muster[i + 2] === "/") {
        re += "(?:.*/)?";
        i += 2;
      } else {
        re += ".*";
        i += 1;
      }
    } else if (zeichen === "*") {
      re += "[^/]*";
    } else if (zeichen === "?") {
      re += "[^/]";
    } else {
      re += zeichen.replace(/[.+^${}()|[\]\\]/g, "\\$&");
    }
  }
  return new RegExp(`^${re}$`);
}

function passt(pfad: string, muster: string[]): string | undefined {
  return muster.find((m) => globZuRegex(m).test(pfad));
}

function normalisiere(pfad: string): string {
  return pfad.trim().replace(/^\.\//, "");
}

function klassifiziereDatei(
  aenderung: Aenderung,
  regeln: Regeln,
): { klasse: Klasse; grund?: string } {
  const pfad = normalisiere(aenderung.pfad);

  // Unknown shapes (absolute, outside the repo) count as stricter.
  if (pfad.startsWith("/") || pfad.split("/").includes("..")) {
    return { klasse: "C", grund: `C: ${pfad} – Pfad außerhalb des Repos` };
  }

  const cMuster = passt(pfad, regeln.C);
  if (cMuster) return { klasse: "C", grund: `C: ${pfad} (Muster ${cMuster})` };

  const regel = regeln.inhalt.find((r) => globZuRegex(r.muster).test(pfad));
  if (regel) {
    if (!aenderung.zeilen) {
      return { klasse: "C", grund: `C: ${pfad} – Inhalt nicht geprüft (${regel.grund})` };
    }
    const { hinzu, entfernt } = aenderung.zeilen;
    const nichtLeer = (zeile: string) => zeile.trim() !== "";
    if (regel.cWenn === "zeilen-entfernt" && entfernt.some(nichtLeer)) {
      return { klasse: "C", grund: `C: ${pfad} – Zeilen entfernt/geändert (${regel.grund})` };
    }
    if (regel.cWennZeile) {
      const re = new RegExp(regel.cWennZeile, "i");
      if ([...hinzu, ...entfernt].some((zeile) => re.test(zeile))) {
        return { klasse: "C", grund: `C: ${pfad} – Zeile passt zu /${regel.cWennZeile}/ (${regel.grund})` };
      }
    }
    return regel.klasse === "A"
      ? { klasse: "A" }
      : { klasse: regel.klasse, grund: `${regel.klasse}: ${pfad} (${regel.grund})` };
  }

  const bMuster = passt(pfad, regeln.B);
  if (bMuster) return { klasse: "B", grund: `B: ${pfad} (Muster ${bMuster})` };

  return { klasse: "A" };
}

/** Highest class of all changed files wins; an empty list is class A. */
export function bestimmeRisikoklasse(
  aenderungen: (string | Aenderung)[],
  regeln: Regeln = standardRegeln,
): Ergebnis {
  let klasse: Klasse = "A";
  let db = false;
  const gruende: string[] = [];

  for (const eintrag of aenderungen) {
    const aenderung = typeof eintrag === "string" ? { pfad: eintrag } : eintrag;
    if (normalisiere(aenderung.pfad) === "") continue;

    const datei = klassifiziereDatei(aenderung, regeln);
    if (RANG[datei.klasse] > RANG[klasse]) klasse = datei.klasse;
    if (datei.grund) gruende.push(datei.grund);

    const pfad = normalisiere(aenderung.pfad);
    const dbMuster = passt(pfad, regeln.db);
    if (dbMuster) {
      db = true;
      gruende.push(`db: ${pfad}`);
    }
  }

  if (gruende.length === 0) gruende.push("A: keine Datei der Klasse B oder C");
  return { klasse, db, gruende };
}

/** Claude Code settings for the build/fix agent: no edits to class C paths, no .env, no push. */
export function claudeSettings(regeln: Regeln = standardRegeln) {
  const schreibVerbote = regeln.C.flatMap((m) => [`Edit(${m})`, `Write(${m})`]);
  return {
    permissions: {
      deny: [
        ...schreibVerbote,
        "Read(.env*)",
        "Read(**/.env*)",
        "Bash(git push:*)",
        "Bash(curl:*)",
        "Bash(wget:*)",
        "WebFetch",
        "WebSearch",
      ],
    },
  };
}

// ---------- CLI ----------

function git(args: string[]): string {
  return execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}

/** Changed files between <base> and HEAD, with added/removed lines for content-rule files. */
function aenderungenAusGit(base: string, regeln: Regeln): Aenderung[] {
  const pfade = git(["diff", "--no-renames", "--name-only", base, "HEAD"])
    .split("\n")
    .filter((p) => p.trim() !== "");

  return pfade.map((pfad) => {
    const hatInhaltsregel = regeln.inhalt.some((r) => globZuRegex(r.muster).test(pfad));
    if (!hatInhaltsregel) return { pfad };

    const hinzu: string[] = [];
    const entfernt: string[] = [];
    const diff = git(["diff", "--no-renames", "--unified=0", base, "HEAD", "--", pfad]);
    for (const zeile of diff.split("\n")) {
      if (zeile.startsWith("+++") || zeile.startsWith("---")) continue;
      if (zeile.startsWith("+")) hinzu.push(zeile.slice(1));
      else if (zeile.startsWith("-")) entfernt.push(zeile.slice(1));
    }
    return { pfad, zeilen: { hinzu, entfernt } };
  });
}

function main(argv: string[]) {
  if (argv[0] === "--claude-settings") {
    console.log(JSON.stringify(claudeSettings()));
    return;
  }
  if (argv[0] === "--base") {
    const base = argv[1];
    if (!base) throw new Error("--base braucht eine Git-Referenz");
    console.log(JSON.stringify(bestimmeRisikoklasse(aenderungenAusGit(base, standardRegeln))));
    return;
  }
  console.log(JSON.stringify(bestimmeRisikoklasse(argv)));
}

if (process.argv[1]?.endsWith("risikoklasse.ts")) {
  main(process.argv.slice(2));
}
