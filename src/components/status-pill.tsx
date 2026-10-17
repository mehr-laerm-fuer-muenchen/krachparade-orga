import type { PlanStatusReason, Status } from "@/lib/plan-engine";
import { statusLabel } from "@/lib/plan-status";

export type { Status };

const STATUS_CLASS: Record<Status, string> = {
  done: "bg-status-done text-on-status-done",
  ok: "bg-status-ok text-on-status-ok",
  // "Wackelt" and "Zu früh" (spec 025) share the yellow.
  warn: "bg-status-warn text-on-status-warn",
  late: "bg-status-late text-on-status-late",
};

/** Status of a milestone or department (used from R1 on). */
export function StatusPill({
  status,
  reason,
  assessment = false,
}: {
  status: Status;
  /** Spec 025: names "warn" as "Zu früh" or "Wackelt"; without it "warn" reads "Wackelt". */
  reason?: PlanStatusReason;
  /** Adds "· Einschätzung" when the status is a manual assessment. */
  assessment?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_CLASS[status]}`}
    >
      {statusLabel(status, reason ?? "wobbly")}
      {assessment ? " · Einschätzung" : null}
    </span>
  );
}
