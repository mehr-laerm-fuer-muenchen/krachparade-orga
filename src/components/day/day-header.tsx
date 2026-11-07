import Link from "next/link";
import type { DayPlanView } from "@/db/day-plan";
import { dayDateLabel } from "./date-label";

const TABS = [
  { key: "ablauf", href: "/krachparade", label: "Ablauf" },
  { key: "rollen", href: "/krachparade/rollen", label: "Rollen" },
] as const;

/**
 * Head of the Krachparade pages (spec 030): date of the edition, numbers and
 * the switch "Ablauf | Rollen" as links that replace the history entry.
 */
export function DayHeader({ dDay, plan, active }: { dDay: string; plan: DayPlanView; active: "ablauf" | "rollen" }) {
  const checks = plan.entries.flatMap((entry) => entry.checks);
  const done = checks.filter((check) => check.done).length;
  const unfilled = plan.roles.filter((role) => role.people.length === 0).length;

  return (
    <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Krachparade · {dayDateLabel(dDay)}</h1>
        <p data-testid="day-summary" className="text-muted">
          {plan.entries.length} {plan.entries.length === 1 ? "Eintrag" : "Einträge"} · Checklisten {done}/{checks.length} ·{" "}
          {plan.roles.length} {plan.roles.length === 1 ? "Rolle" : "Rollen"}
          {unfilled > 0 ? (
            <>
              , <span className="font-semibold text-status-late">{unfilled} unbesetzt</span>
            </>
          ) : null}
        </p>
      </div>
      <nav aria-label="Ansicht" className="flex overflow-hidden rounded-md border border-line bg-surface">
        {TABS.map((tab, index) => {
          const current = tab.key === active;
          return (
            <Link
              key={tab.key}
              href={tab.href}
              replace
              aria-current={current ? "page" : undefined}
              className={`flex min-h-11 items-center px-4 font-medium ${index > 0 ? "border-l border-line" : ""} ${
                current ? "bg-primary text-on-primary" : "hover:bg-surface-2"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
