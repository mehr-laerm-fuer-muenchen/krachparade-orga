import type { Metadata } from "next";
import { Suspense } from "react";
import { getCurrentMember } from "@/components/current-member";
import { PageTitle } from "@/components/placeholder";
import { PlanView } from "@/components/plan/plan-view";
import { countDayPlan } from "@/db/day-plan";
import { getCurrentEdition } from "@/db/editions";
import { loadPlanView } from "@/db/plan-view";
import { todayInBerlin } from "@/lib/dday";
import { shortEditionName } from "@/lib/plan-preview";

export const metadata: Metadata = {
  title: "Plan – Krachparade Orga",
};

const NOTICE = "rounded-md border border-line bg-surface px-4 py-3 text-muted";

export default function Home() {
  // `data-wide-page`: the plan may use up to 1400 px on wide screens (see AppMain).
  return (
    <div data-wide-page className="flex flex-col gap-4">
      <Suspense fallback={<p className="text-muted">Lade Plan …</p>}>
        <Plan />
      </Suspense>
    </div>
  );
}

/**
 * The plan of the current edition (spec 007, editable from spec 008).
 * Loading and the plan engine run on the server (`loadPlanView`); the client
 * components draw the result and call the server actions.
 */
async function Plan() {
  const member = await getCurrentMember();
  const edition = await getCurrentEdition();
  if (!edition) {
    return (
      <>
        <PageTitle>Plan</PageTitle>
        <p className={NOTICE}>Noch keine aktuelle Ausgabe angelegt.</p>
      </>
    );
  }

  const title = `Plan ${shortEditionName(edition.name)}`;
  const [view, dayPlan] = await Promise.all([
    loadPlanView(edition, member.id, todayInBerlin(new Date())),
    countDayPlan(edition.id),
  ]);
  if (view.status === "empty") {
    return (
      <>
        <PageTitle>{title}</PageTitle>
        <p className={NOTICE}>Noch kein Plan. Die KP27-Vorlage kommt mit Spec 010.</p>
      </>
    );
  }
  if (view.status === "cycle") {
    return (
      <>
        <PageTitle>{title}</PageTitle>
        <p role="alert" className="font-medium text-status-late">
          Der Plan lässt sich nicht berechnen: Die Verbindungen enthalten einen Kreis.
        </p>
      </>
    );
  }

  return <PlanView data={view.data} dayPlan={dayPlan} />;
}
