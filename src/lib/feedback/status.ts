/** Status of a feedback entry (spec 014), freely selectable by admins. */
export const FEEDBACK_STATUSES = ["new", "in_progress", "done", "rejected"] as const;

export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

/** Statuses shown under "Offen". */
export const OPEN_FEEDBACK_STATUSES: readonly FeedbackStatus[] = ["new", "in_progress"];

const LABELS: Record<FeedbackStatus, string> = {
  new: "Neu",
  in_progress: "In Arbeit",
  done: "Erledigt",
  rejected: "Verworfen",
};

export function statusLabel(status: FeedbackStatus): string {
  return LABELS[status];
}

export function isOpenStatus(status: FeedbackStatus): boolean {
  return OPEN_FEEDBACK_STATUSES.includes(status);
}

export function isFeedbackStatus(value: unknown): value is FeedbackStatus {
  return typeof value === "string" && (FEEDBACK_STATUSES as readonly string[]).includes(value);
}
