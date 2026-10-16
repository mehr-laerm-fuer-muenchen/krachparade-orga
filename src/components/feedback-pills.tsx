import { kindLabel, type FeedbackKind } from "@/lib/feedback/kinds";
import { statusLabel, type FeedbackStatus } from "@/lib/feedback/status";

const PILL = "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold";

// Spec 014: colours from the plan statuses (Wackelt, On track, Erreicht).
const STATUS_CLASS: Record<FeedbackStatus, string> = {
  new: "bg-status-warn text-on-status-warn",
  in_progress: "bg-status-ok text-on-status-ok",
  done: "bg-status-done text-on-status-done",
  rejected: "bg-surface-2 text-muted",
};

/** Status of a feedback entry; separate from `StatusPill` (spec 003). */
export function FeedbackStatusPill({ status }: { status: FeedbackStatus }) {
  return <span className={`${PILL} ${STATUS_CLASS[status]}`}>{statusLabel(status)}</span>;
}

/** "Fehler" or "Wunsch", neutral. */
export function FeedbackKindPill({ kind }: { kind: FeedbackKind }) {
  return <span className={`${PILL} border border-line-strong text-muted`}>{kindLabel(kind)}</span>;
}
