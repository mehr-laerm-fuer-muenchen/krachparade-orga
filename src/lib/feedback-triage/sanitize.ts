// Spec 022: every feedback text and every agent text goes through these
// functions before it lands in a GitHub issue.

export const REMOVED = "[entfernt]";

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;
const IBAN = /\b[A-Z]{2}\d{2}(?: ?[A-Z0-9]){10,30}\b/g;
// 7 or more digits, optionally separated by space, "/" or "-", optional "+".
const PHONE = /(?<![\w+])\+?\d(?:[ /-]?\d){6,}(?!\w)/g;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Masks phone-like numbers, IBAN-like strings and e-mail addresses. */
export function maskSensitive(text: string): string {
  return text
    .replace(EMAIL, REMOVED)
    .replace(IBAN, REMOVED)
    .replace(PHONE, (match) => (ISO_DATE.test(match) ? match : REMOVED));
}

/** `@name` → `＠name`, so GitHub pings nobody. */
export function neutralizeMentions(text: string): string {
  return text.replace(/@(?=[A-Za-z0-9_-])/g, "＠");
}

/**
 * Keeps user text from adding HTML to an issue: `<` becomes `&lt;`. That also
 * stops fake markers (`<!-- meldungen: … -->`, `<!-- triage-bis: … -->`).
 */
export function escapeHtml(text: string): string {
  return text.replace(/&(?=[#A-Za-z0-9]+;)/g, "&amp;").replace(/</g, "&lt;");
}

/** All of the above in one step, for any text from outside. */
export function sanitize(text: string): string {
  return escapeHtml(neutralizeMentions(maskSensitive(text)));
}

/** Shortens to `max` characters (with „…“) and puts every line in a quote block. */
export function quote(text: string, max: number): string {
  const clean = text.replace(/\r\n?/g, "\n").trim();
  const short = clean.length > max ? `${clean.slice(0, Math.max(0, max - 1)).trimEnd()}…` : clean;
  return short
    .split("\n")
    .map((line) => (line.trim() === "" ? ">" : `> ${line}`))
    .join("\n");
}
