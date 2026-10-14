export type Status = "done" | "ok" | "warn" | "late";

const STATUS: Record<Status, { label: string; className: string }> = {
  done: { label: "Erreicht", className: "bg-status-done text-on-status-done" },
  ok: { label: "On track", className: "bg-status-ok text-on-status-ok" },
  warn: { label: "Wackelt", className: "bg-status-warn text-on-status-warn" },
  late: { label: "Verzug", className: "bg-status-late text-on-status-late" },
};

/** Status of a milestone or department (used from R1 on). */
export function StatusPill({
  status,
  assessment = false,
}: {
  status: Status;
  /** Adds "· Einschätzung" when the status is a manual assessment. */
  assessment?: boolean;
}) {
  const { label, className } = STATUS[status];
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${className}`}
    >
      {label}
      {assessment ? " · Einschätzung" : null}
    </span>
  );
}
