"use client";

import Link from "next/link";
import { useId } from "react";
import { joinWorkingGroup, leaveWorkingGroup } from "@/actions/working-groups";
import type { AkOverviewCard } from "@/db/ak-workspace";
import type { AkNext, AkProgress } from "@/lib/ak-workspace";
import { dayToDate } from "@/lib/plan-days";
import { formatWeekdayShort } from "@/lib/plan-preview";
import { ErrorMessage, useAction } from "./board";

// Overview of /arbeitskreise (spec 018): one card per working group with its
// situation; the upper part opens the workspace.

const PRIMARY_BUTTON =
  "min-h-11 shrink-0 rounded-md bg-primary px-4 font-semibold text-on-primary disabled:opacity-50";
const SECONDARY_BUTTON =
  "min-h-11 shrink-0 rounded-md border border-line-strong bg-surface px-3 font-medium text-text hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-surface";
const PILL = "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold";

/** "n Verzug", "n wackelt", or "Alles im Plan" (spec 018). */
export function SituationPills({ late, warn, calm = "Alles im Plan" }: { late: number; warn: number; calm?: string | null }) {
  if (late === 0 && warn === 0) {
    return calm ? <span className={`${PILL} bg-status-ok text-on-status-ok`}>{calm}</span> : null;
  }
  return (
    <>
      {late > 0 ? <span className={`${PILL} bg-status-late text-on-status-late`}>{late} Verzug</span> : null}
      {warn > 0 ? <span className={`${PILL} bg-status-warn text-on-status-warn`}>{warn} wackelt</span> : null}
    </>
  );
}

/** "‹Name› · startet Mi 17.02." */
export function nextText(next: AkNext, dDay: string): string {
  const date = formatWeekdayShort(dayToDate(next.day, dDay));
  const verb = next.type === "starts" ? "startet " : next.type === "ends" ? "endet " : "";
  return `${next.name} · ${verb}${date}`;
}

/** Bar in the colours of the Gantt's progress line; the width and height come from `className`. */
export function ProgressBar({ done, total, className }: { done: number; total: number; className: string }) {
  return (
    <span aria-hidden className={`block overflow-hidden rounded-full bg-progress-track ${className}`}>
      <span
        className="block h-full rounded-full bg-progress-fill"
        style={{ width: `${total > 0 ? (done / total) * 100 : 0}%` }}
      />
    </span>
  );
}

/** "3/10 To-dos erledigt" with a bar and "1/4 Plan-Elemente erreicht" (spec 024). */
function CardProgress({ progress }: { progress: AkProgress }) {
  if (progress.todosTotal + progress.elementsTotal === 0) {
    return <span className="text-sm text-muted">Noch nichts geplant</span>;
  }
  return (
    <span className="flex flex-col gap-1">
      <span className={`text-sm tabular-nums ${progress.allDone ? "font-semibold text-progress-fill" : ""}`}>
        {`${progress.todosDone}/${progress.todosTotal} To-dos erledigt`}
      </span>
      <ProgressBar done={progress.todosDone} total={progress.todosTotal} className="h-1 w-full" />
      <span className="text-xs text-muted tabular-nums">
        {`${progress.elementsDone}/${progress.elementsTotal} Plan-Elemente erreicht`}
      </span>
    </span>
  );
}

export function AkOverviewCardView({ card, viewerId, dDay }: { card: AkOverviewCard; viewerId: string; dDay: string }) {
  const headingId = useId();
  const { pending, error, run } = useAction();
  const joined = card.members.some((person) => person.id === viewerId);
  const { summary } = card;

  return (
    <section aria-labelledby={headingId} className="flex min-w-0 flex-col overflow-hidden rounded-md border border-line bg-surface">
      <Link href={`/arbeitskreise/${card.id}`} className="flex flex-col gap-2 p-4 hover:bg-surface-2">
        <h2 id={headingId} className="flex items-start justify-between gap-2 text-lg font-semibold">
          <span className="min-w-0 break-words [overflow-wrap:anywhere]">{card.title}</span>
          <span aria-hidden className="text-primary">
            →
          </span>
        </h2>
        <span className="flex flex-wrap gap-2">
          <SituationPills late={summary.late} warn={summary.warn} />
        </span>
        <CardProgress progress={card.progress} />
        <span className="text-sm break-words">
          <span className="text-muted">Nächster Termin: </span>
          {summary.next ? nextText(summary.next, dDay) : "–"}
        </span>
        <span className="text-sm break-words text-muted">
          Bereiche: {card.departments.length > 0 ? card.departments.join(", ") : "–"}
        </span>
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-2">
        <p className="min-w-0 text-sm break-words">
          {card.members.length === 0 ? (
            <span className="text-muted">Noch niemand</span>
          ) : (
            card.members.map((person, index) => (
              <span key={person.id} className={person.active ? "" : "text-muted opacity-70"}>
                {index > 0 ? ", " : ""}
                {person.name}
              </span>
            ))
          )}
        </p>
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => (joined ? leaveWorkingGroup : joinWorkingGroup)(card.id, viewerId))}
          className={joined ? SECONDARY_BUTTON : PRIMARY_BUTTON}
        >
          {joined ? "Austreten" : "Mach ich mit"}
        </button>
      </div>
      {error ? (
        <div className="px-4 pb-2">
          <ErrorMessage error={error} />
        </div>
      ) : null}
    </section>
  );
}
