/** Kinds of feedback (spec 014). Stored as text, checked with Zod. */
export const FEEDBACK_KINDS = ["bug", "wish"] as const;

export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];

const LABELS: Record<FeedbackKind, string> = {
  bug: "Fehler",
  wish: "Wunsch",
};

/** "bug" → "Fehler", "wish" → "Wunsch". */
export function kindLabel(kind: FeedbackKind): string {
  return LABELS[kind];
}

export function isFeedbackKind(value: unknown): value is FeedbackKind {
  return typeof value === "string" && (FEEDBACK_KINDS as readonly string[]).includes(value);
}
