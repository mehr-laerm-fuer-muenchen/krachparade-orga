import type { Metadata } from "next";
import { Suspense } from "react";
import { getCurrentMember } from "@/components/current-member";
import { PageTitle } from "@/components/placeholder";
import { loadDayPlan } from "@/db/day-plan";
import { getCurrentEdition } from "@/db/editions";
import { checkProgress, formatEntryTime, groupByHour } from "@/lib/day-plan";
import { formatProgress } from "@/lib/todo-progress";

export const metadata: Metadata = {
  title: "Krachparade – Krachparade Orga",
};

const NOTICE = "rounded-md border border-line bg-surface px-4 py-3 text-muted";

export default function KrachparadePage() {
  return (
    <div className="flex flex-col gap-4">
      <Suspense
        fallback={
          <>
            <PageTitle>Krachparade</PageTitle>
            <p className="text-muted">Lade Ablauf …</p>
          </>
        }
      >
        <DayPlan />
      </Suspense>
    </div>
  );
}

/**
 * Spec 030, part A: the day plan as a simple list by time, only so that the
 * data can be checked. Part B replaces it with the day plan and the roles.
 */
async function DayPlan() {
  await getCurrentMember();
  const edition = await getCurrentEdition();
  if (!edition) {
    return (
      <>
        <PageTitle>Krachparade</PageTitle>
        <p className={NOTICE}>Noch keine aktuelle Ausgabe angelegt.</p>
      </>
    );
  }

  const plan = await loadDayPlan(edition.id);
  const trackNames = new Map(plan.tracks.map((track) => [track.id, track.name]));
  const groups = groupByHour(plan.entries);

  return (
    <>
      <PageTitle>Krachparade · Ablauf</PageTitle>
      <p className="text-sm text-muted">
        {plan.entries.length} Einträge · {plan.tracks.length} Spalten · {plan.roles.length} Rollen
      </p>
      {groups.length === 0 ? <p className={NOTICE}>Noch keine Einträge.</p> : null}
      {groups.map((group) => (
        <section key={group.key} aria-label={group.label} className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">{group.label}</h2>
          <ul className="flex flex-col gap-2">
            {group.entries.map((entry) => {
              const progress = formatProgress(checkProgress(entry.checks));
              const meta = [entry.place, entry.person?.label].filter(Boolean).join(" · ");
              return (
                <li key={entry.id} className="flex flex-col gap-0.5 rounded-md border border-line bg-surface px-4 py-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <span className="font-semibold tabular-nums">{formatEntryTime(entry)}</span>
                    <span className="text-xs text-muted">{trackNames.get(entry.trackId)}</span>
                  </div>
                  <span className="font-medium break-words">{entry.title}</span>
                  {meta ? <span className="text-sm text-muted">{meta}</span> : null}
                  {progress ? <span className="text-sm text-muted tabular-nums">Checkliste {progress}</span> : null}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </>
  );
}
