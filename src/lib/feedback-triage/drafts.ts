// Spec 022: checks for spec drafts (own issue) and spec sketches (comment in
// the topic issue). Both return a list of errors; empty = valid.

export const DRAFT_MAX = 20_000;
export const SKETCH_MAX = 12_000;

const DRAFT_TITLE = /^Entwurf: [a-z0-9-]{3,50}$/;
const DRAFT_SECTIONS = [
  "## Ziel",
  "## Nicht in dieser Spec",
  "## Umsetzung",
  "## Akzeptanzkriterien",
  "## Deploy",
  "## Neuigkeiten",
];
const SKETCH_SECTIONS = [
  "## Ziel",
  "## Was die Meldungen wollen",
  "## Befund im Code",
  "## Offene Fragen",
  "## Grober Schnitt",
  "## Risikoklasse (Schätzung)",
];
const APPROVED = /Freigabe Franz:\s*☑/;
const APPROVAL_LINE = /^\s*Freigabe Franz:/m;
const BRANCH_LINE = /^\s*Zweig:/m;
const RECOMMENDED = "(Empfohlen)";

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function missingSections(body: string, sections: string[]): string[] {
  return sections.filter((heading) => !new RegExp(`^${escapeRegExp(heading)}[ \\t]*$`, "m").test(body));
}

function normalizeNewlines(text: string): string {
  return text.replace(/\r\n?/g, "\n");
}

export function validateDraft({ title, body }: { title: string; body: string }): string[] {
  const text = normalizeNewlines(body);
  const errors: string[] = [];
  if (!DRAFT_TITLE.test(title)) errors.push(`Titel muss „Entwurf: <kurzname>“ sein (a-z, 0-9, -, 3–50 Zeichen)`);
  for (const heading of missingSections(text, DRAFT_SECTIONS)) errors.push(`Abschnitt „${heading}“ fehlt`);
  if (text.length > DRAFT_MAX) errors.push(`Text zu lang (${text.length} > ${DRAFT_MAX} Zeichen)`);
  if (APPROVED.test(text)) errors.push("Text enthält „Freigabe Franz: ☑“");
  return errors;
}

/** The lines of one `## ` section, without its heading. */
function sectionLines(text: string, heading: string): string[] {
  const lines = text.split("\n");
  const start = lines.findIndex((line) => line.trimEnd() === heading);
  if (start < 0) return [];
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => line.startsWith("## "));
  return end < 0 ? rest : rest.slice(0, end);
}

type Question = { text: string; options: string[] };

/**
 * Questions in „## Offene Fragen“: a numbered line (`1. …`) or a `### ` line
 * starts a question; list items (`- …` or `* …`) below it are its options.
 */
export function parseQuestions(body: string): Question[] {
  const questions: Question[] = [];
  for (const line of sectionLines(normalizeNewlines(body), "## Offene Fragen")) {
    if (/^(\d+\.\s+|###\s+)\S/.test(line)) {
      questions.push({ text: line.trim(), options: [] });
    } else if (/^\s*[-*]\s+\S/.test(line) && questions.length > 0) {
      questions[questions.length - 1].options.push(line.trim());
    }
  }
  return questions;
}

export function validateSketch(body: string): string[] {
  const text = normalizeNewlines(body);
  const errors: string[] = [];
  for (const heading of missingSections(text, SKETCH_SECTIONS)) errors.push(`Abschnitt „${heading}“ fehlt`);
  if (text.length > SKETCH_MAX) errors.push(`Text zu lang (${text.length} > ${SKETCH_MAX} Zeichen)`);
  if (APPROVED.test(text) || APPROVAL_LINE.test(text)) errors.push("Skizzen haben keinen Freigabe-Kopf");
  if (BRANCH_LINE.test(text)) errors.push("Skizzen haben keine Zeile „Zweig:“");

  const questions = parseQuestions(text);
  if (questions.length === 0) errors.push("„## Offene Fragen“ braucht mindestens eine Frage mit Optionen");
  questions.forEach((question, index) => {
    const label = `Frage ${index + 1}`;
    if (question.options.length < 2 || question.options.length > 4) {
      errors.push(`${label}: 2–4 Optionen nötig (sind ${question.options.length})`);
    }
    const recommended = question.options.filter((option) => option.includes(RECOMMENDED)).length;
    if (recommended !== 1) errors.push(`${label}: genau eine Option „${RECOMMENDED}“ nötig (sind ${recommended})`);
  });
  return errors;
}
