import { describe, expect, it } from "vitest";
import { DRAFT_MAX, SKETCH_MAX, parseQuestions, validateDraft, validateSketch } from "./drafts";

const DRAFT = `# SPEC NNN – Abhaken springt

Freigabe Franz: ☐
Zweig: \`spec/NNN-abhaken-springt\`

## Ziel

Die Liste bleibt stehen.

## Nicht in dieser Spec

Nichts.

## Umsetzung

### Vorab: Abgleich mit dem Code

…

## Neuigkeiten

keiner

## Akzeptanzkriterien

1. Klicktest.

## Deploy

Klasse A.

Entstanden aus: aaaaaaaa
`;

const SKETCH = `## Ziel

Export der Aufgaben.

## Was die Meldungen wollen

PDF.

## Befund im Code

src/lib/protocol-export.ts

## Offene Fragen

1. Welches Format?
   - PDF (Empfohlen) – lässt sich drucken.
   - CSV
2. Wo ist der Knopf?
   - Kopfleiste
   - Menü (Empfohlen) – weniger Unruhe.
   - Beides

## Grober Schnitt

Teil A, Teil B.

## Risikoklasse (Schätzung)

B
`;

describe("validateDraft", () => {
  it("accepts a valid draft", () => {
    expect(validateDraft({ title: "Entwurf: abhaken-springt", body: DRAFT })).toEqual([]);
  });

  it("rejects a wrong title", () => {
    expect(validateDraft({ title: "023-abhaken", body: DRAFT })).toHaveLength(1);
    expect(validateDraft({ title: "Entwurf: Abhaken Springt", body: DRAFT })).toHaveLength(1);
  });

  it("rejects the approval tick", () => {
    const body = DRAFT.replace("Freigabe Franz: ☐", "Freigabe Franz: ☑");
    expect(validateDraft({ title: "Entwurf: abhaken-springt", body })).toEqual(["Text enthält „Freigabe Franz: ☑“"]);
    expect(validateDraft({ title: "Entwurf: abhaken-springt", body: DRAFT + "\nFreigabe Franz:☑" })).toHaveLength(1);
  });

  it("rejects a draft that is too long", () => {
    const body = DRAFT + "x".repeat(DRAFT_MAX);
    expect(validateDraft({ title: "Entwurf: abhaken-springt", body })[0]).toMatch(/^Text zu lang/);
  });

  it("names missing sections; a heading must be its own line", () => {
    const body = DRAFT.replace("## Deploy", "## Deployment").replace("## Ziel\n", "## Ziele\n");
    expect(validateDraft({ title: "Entwurf: abhaken-springt", body })).toEqual([
      "Abschnitt „## Ziel“ fehlt",
      "Abschnitt „## Deploy“ fehlt",
    ]);
  });

  it("copes with Windows line endings", () => {
    expect(validateDraft({ title: "Entwurf: abhaken-springt", body: DRAFT.replace(/\n/g, "\r\n") })).toEqual([]);
  });
});

describe("validateSketch", () => {
  it("accepts a valid sketch", () => {
    expect(validateSketch(SKETCH)).toEqual([]);
    expect(parseQuestions(SKETCH).map((q) => q.options.length)).toEqual([2, 3]);
  });

  it("rejects a question without recommendation", () => {
    const body = SKETCH.replace("PDF (Empfohlen) – lässt sich drucken.", "PDF");
    expect(validateSketch(body)).toEqual(["Frage 1: genau eine Option „(Empfohlen)“ nötig (sind 0)"]);
  });

  it("rejects two recommendations and too few or too many options", () => {
    expect(validateSketch(SKETCH.replace("   - CSV", "   - CSV (Empfohlen)"))).toContain(
      "Frage 1: genau eine Option „(Empfohlen)“ nötig (sind 2)"
    );
    expect(validateSketch(SKETCH.replace("   - CSV\n", ""))).toContain("Frage 1: 2–4 Optionen nötig (sind 1)");
    expect(validateSketch(SKETCH.replace("   - Beides", "   - Beides\n   - Keins\n   - Später"))).toContain(
      "Frage 2: 2–4 Optionen nötig (sind 5)"
    );
  });

  it("rejects a sketch without questions", () => {
    const body = SKETCH.replace(/## Offene Fragen[\s\S]*?## Grober Schnitt/, "## Offene Fragen\n\nKeine.\n\n## Grober Schnitt");
    expect(validateSketch(body)).toContain("„## Offene Fragen“ braucht mindestens eine Frage mit Optionen");
  });

  it("rejects a branch line and an approval head", () => {
    expect(validateSketch(`Zweig: \`spec/030-export\`\n\n${SKETCH}`)).toEqual(["Skizzen haben keine Zeile „Zweig:“"]);
    expect(validateSketch(`Freigabe Franz: ☐\n\n${SKETCH}`)).toEqual(["Skizzen haben keinen Freigabe-Kopf"]);
    expect(validateSketch(`${SKETCH}\nFreigabe Franz: ☑`)).toEqual(["Skizzen haben keinen Freigabe-Kopf"]);
  });

  it("rejects a sketch that is too long or misses sections", () => {
    expect(validateSketch(SKETCH + "x".repeat(SKETCH_MAX))[0]).toMatch(/^Text zu lang/);
    expect(validateSketch(SKETCH.replace("## Grober Schnitt", "## Schnitt"))).toEqual([
      "Abschnitt „## Grober Schnitt“ fehlt",
    ]);
  });

  it("options below the next section do not count", () => {
    const body = SKETCH.replace("Teil A, Teil B.", "- Teil A (Empfohlen)\n- Teil B");
    expect(parseQuestions(body).map((q) => q.options.length)).toEqual([2, 3]);
  });
});
