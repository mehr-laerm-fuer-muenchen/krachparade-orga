import { REGISTRATION_STATUS_LABELS, type RegistrationStatus } from "@/lib/collectives/options";

const PILL = "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold";

// Spec 031: colours of the plan statuses, like the feedback pills.
const STATUS_CLASS: Record<RegistrationStatus, string> = {
  new: "bg-status-warn text-on-status-warn",
  accepted: "bg-status-done text-on-status-done",
  waitlist: "bg-status-ok text-on-status-ok",
  rejected: "bg-surface-2 text-muted",
};

export function RegistrationStatusPill({ status }: { status: RegistrationStatus }) {
  return <span className={`${PILL} ${STATUS_CLASS[status]}`}>{REGISTRATION_STATUS_LABELS[status]}</span>;
}
