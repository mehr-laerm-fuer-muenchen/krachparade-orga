import type { Metadata } from "next";
import { Suspense } from "react";
import { getCurrentMember } from "@/components/current-member";
import { DayHeader } from "@/components/day/day-header";
import { DayRoles } from "@/components/day/day-roles";
import { PageTitle } from "@/components/placeholder";
import { loadDayOptions, loadDayPlan } from "@/db/day-plan";
import { getCurrentEdition } from "@/db/editions";

export const metadata: Metadata = {
  title: "Krachparade · Rollen – Krachparade Orga",
};

const NOTICE = "rounded-md border border-line bg-surface px-4 py-3 text-muted";

export default function KrachparadeRolesPage() {
  return (
    <div data-wide-page className="flex flex-col gap-4">
      <Suspense
        fallback={
          <>
            <PageTitle>Krachparade</PageTitle>
            <p className="text-muted">Lade Rollen …</p>
          </>
        }
      >
        <Roles />
      </Suspense>
    </div>
  );
}

/** Spec 030: who does what on the day. */
async function Roles() {
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
      <DayHeader dDay={edition.dDay} plan={plan} active="rollen" />
      <DayRoles roles={plan.roles} people={options.people} groups={options.groups} />
    </>
  );
}
