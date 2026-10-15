import type { Metadata } from "next";
import { Suspense } from "react";
import { getCurrentMember } from "@/components/current-member";
import { MyTasksView } from "@/components/my-tasks/my-tasks-view";
import { PageTitle } from "@/components/placeholder";
import { getCurrentEdition } from "@/db/editions";
import { loadMyAgenda } from "@/db/my-tasks";
import { loadPlanView } from "@/db/plan-view";
import { todayInBerlin } from "@/lib/dday";
import { PlanCycleError } from "@/lib/plan-engine";

export const metadata: Metadata = {
  title: "Meine Aufgaben – Krachparade Orga",
};

const NOTICE = "rounded-md border border-line bg-surface px-4 py-3 text-muted";

export default function MyTasksPage() {
  return (
    <div className="flex flex-col gap-4">
      <Suspense
        fallback={
          <>
            <PageTitle>Meine Aufgaben</PageTitle>
            <p className="text-muted">Lade Aufgaben …</p>
          </>
        }
      >
        <MyTasks />
      </Suspense>
    </div>
  );
}

/**
 * "Meine Aufgaben" (spec 009). "Today" and all computing on the server; the
 * plan is loaded as on the start page for the detail panel.
 */
async function MyTasks() {
  const member = await getCurrentMember();
  const edition = await getCurrentEdition();
  if (!edition) {
    return (
      <>
        <PageTitle>Meine Aufgaben</PageTitle>
        <p className={NOTICE}>Noch keine aktuelle Ausgabe angelegt.</p>
      </>
    );
  }

  const today = todayInBerlin(new Date());
  let loaded: Awaited<ReturnType<typeof loadMyAgenda>>;
  let view: Awaited<ReturnType<typeof loadPlanView>>;
  try {
    [loaded, view] = await Promise.all([
      loadMyAgenda(member.id, today),
      loadPlanView(edition, member.id, today),
    ]);
  } catch (error) {
    if (!(error instanceof PlanCycleError)) throw error;
    view = { status: "cycle" };
    loaded = null;
  }
  if (view.status === "cycle") {
    return (
      <>
        <PageTitle>Meine Aufgaben</PageTitle>
        <p role="alert" className="font-medium text-status-late">
          Der Plan lässt sich nicht berechnen: Die Verbindungen enthalten einen Kreis. Deine Aufgaben erscheinen
          wieder, sobald der Kreis im Plan aufgelöst ist.
        </p>
      </>
    );
  }
  if (!loaded) {
    return (
      <>
        <PageTitle>Meine Aufgaben</PageTitle>
        <p className={NOTICE}>Noch keine aktuelle Ausgabe angelegt.</p>
      </>
    );
  }

  return (
    <MyTasksView
      data={{
        agenda: loaded.agenda,
        recentlyDone: loaded.recentlyDone,
        today: loaded.today,
        hasGroups: loaded.myGroupIds.length > 0,
        plan: view.status === "ok" ? view.data : null,
      }}
    />
  );
}
