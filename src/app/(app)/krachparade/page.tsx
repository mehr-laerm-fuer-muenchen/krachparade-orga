import type { Metadata } from "next";
import { Suspense } from "react";
import { getCurrentMember } from "@/components/current-member";
import { DayHeader } from "@/components/day/day-header";
import { DayView } from "@/components/day/day-view";
import { PageTitle } from "@/components/placeholder";
import { loadDayOptions, loadDayPlan } from "@/db/day-plan";
import { getCurrentEdition } from "@/db/editions";

export const metadata: Metadata = {
  title: "Krachparade – Krachparade Orga",
};

const NOTICE = "rounded-md border border-line bg-surface px-4 py-3 text-muted";

export default function KrachparadePage() {
  // `data-wide-page`: the day plan uses up to 1400 px next to the panel (see AppMain).
  return (
    <div data-wide-page className="flex flex-col gap-4">
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

/** Spec 030: the day plan of the Krachparade ("Ablauf"). */
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

  const [plan, options] = await Promise.all([loadDayPlan(edition.id), loadDayOptions(edition.id)]);
  return (
    <>
      <DayHeader dDay={edition.dDay} plan={plan} active="ablauf" />
      <DayView plan={plan} people={options.people} groups={options.groups} />
    </>
  );
}
