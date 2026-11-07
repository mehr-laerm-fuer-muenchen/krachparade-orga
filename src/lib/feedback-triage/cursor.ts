// Spec 022: the cursor of the feedback triage lives as an HTML comment in the
// newest daily issue, e.g. `<!-- triage-bis: 2026-11-06T05:45:00.000Z -->`.

const MARKER = /<!--\s*triage-bis:\s*(\S+?)\s*-->/g;
const ISO_MOMENT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

/** Parses a strict UTC ISO moment ("…Z"); anything else → null. */
export function parseMoment(value: string | null | undefined): Date | null {
  if (!value || !ISO_MOMENT.test(value)) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Evaluates the `--cursor` argument of fetch.ts. Missing, empty or only
 * whitespace → `null` (no cursor, first run: only open reports). A valid
 * moment (surrounding whitespace ignored) → that date. Anything else →
 * `"invalid"`.
 */
export function cursorFromArgument(value: string | null | undefined): Date | null | "invalid" {
  const trimmed = value?.trim() ?? "";
  if (trimmed === "") return null;
  return parseMoment(trimmed) ?? "invalid";
}

/**
 * Reads the cursor from an issue body. Missing or invalid → null. If the body
 * holds several markers, the last one counts (the report writes it at the end).
 */
export function readCursor(issueBody: string | null | undefined): Date | null {
  if (!issueBody) return null;
  const matches = [...issueBody.matchAll(MARKER)];
  const last = matches.at(-1);
  return last ? parseMoment(last[1]) : null;
}

/** The marker for the end of a daily report. */
export function writeCursor(date: Date): string {
  return `<!-- triage-bis: ${date.toISOString()} -->`;
}
