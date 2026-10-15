import type { Metadata } from "next";
import { Suspense } from "react";
import { getCurrentMember } from "@/components/current-member";
import { PageTitle } from "@/components/placeholder";
import { PlanView, type PlanViewData } from "@/components/plan/plan-view";
import { getCurrentEdition } from "@/db/editions";
import { loadPlan, loadPlanDetails } from "@/db/plan";
import { listWorkingGroupMembers, listWorkingGroups } from "@/db/working-groups";
import { todayInBerlin } from "@/lib/dday";
import type { PlanNoteView, PlanTodoView, PlanViewElement } from "@/lib/gantt-layout";
import { dateToDay } from "@/lib/plan-days";
import { computePlan, PlanCycleError, todoDueDay, type ComputedPlan } from "@/lib/plan-engine";
import { shortEditionName } from "@/lib/plan-preview";
import { displayGroupName } from "@/lib/working-groups";

export const metadata: Metadata = {
  title: "Plan – Krachparade Orga",
};

const NOTICE = "rounded-md border border-line bg-surface px-4 py-3 text-muted";

export default function Home() {
  return (
    <div className="flex flex-col gap-4">
      <Suspense fallback={<p className="text-muted">Lade Plan …</p>}>
        <Plan />
      </Suspense>
    </div>
  );
}

function groupBy<T extends { elementId: string }>(items: T[]): Map<string, T[]> {
  const result = new Map<string, T[]>();
  for (const item of items) {
    const list = result.get(item.elementId) ?? [];
    list.push(item);
    result.set(item.elementId, list);
  }
  return result;
}

/**
 * The plan of the current edition (spec 007), read only. Loading and the plan
 * engine run here on the server; the client components only draw the result.
 * Names only, never e-mail addresses.
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
  const plan = await loadPlan(edition.id);
  if (plan.elements.length === 0) {
    return (
      <>
        <PageTitle>{title}</PageTitle>
        <p className={NOTICE}>Noch kein Plan. Die KP27-Vorlage kommt mit Spec 010.</p>
      </>
    );
  }

  const today = dateToDay(todayInBerlin(new Date()), plan.dDay);
  let computed: ComputedPlan;
  try {
    computed = computePlan(plan.elements, plan.links, today);
  } catch (error) {
    if (!(error instanceof PlanCycleError)) throw error;
    return (
      <>
        <PageTitle>{title}</PageTitle>
        <p role="alert" className="font-medium text-status-late">
          Der Plan lässt sich nicht berechnen: Die Verbindungen enthalten einen Kreis.
        </p>
      </>
    );
  }

  const [details, groups, memberships] = await Promise.all([
    loadPlanDetails(edition.id),
    listWorkingGroups(edition.id),
    listWorkingGroupMembers(edition.id),
  ]);
  const todosByElement = groupBy(details.todos);
  const notesByElement = groupBy(details.notes);

  const elements: PlanViewElement[] = plan.elements.map((element) => {
    const result = computed.elements.get(element.id)!;
    const todos: PlanTodoView[] = (todosByElement.get(element.id) ?? []).map((todo) => ({
      id: todo.id,
      text: todo.text,
      ownerName: todo.ownerName,
      anchor: todo.anchor,
      daysBefore: todo.daysBefore,
      due: todoDueDay(todo, result),
      done: todo.done,
    }));
    const notes: PlanNoteView[] = (notesByElement.get(element.id) ?? []).map((note) => ({
      id: note.id,
      authorName: note.authorName,
      date: todayInBerlin(note.createdAt),
      text: note.text,
    }));
    return {
      id: element.id,
      name: element.name,
      kind: element.kind,
      workingGroupId: element.workingGroupId,
      start: result.plannedStart,
      end: result.plannedEnd,
      latestEnd: result.latestFinish,
      latestStart: result.latestStart,
      buffer: result.buffer,
      status: result.status,
      reason: result.reason,
      done: element.done,
      fixed: element.fixedDay !== null,
      wobbly: element.wobbly,
      workingGroupName: element.workingGroupName === null ? null : displayGroupName(element.workingGroupName),
      departmentName: element.departmentName,
      ownerName: element.ownerName,
      todos,
      notes,
    };
  });

  const data: PlanViewData = {
    title,
    dDay: plan.dDay,
    today,
    elements,
    groups: groups.map((group) => ({ id: group.id, name: group.name, sortOrder: group.sortOrder })),
    links: plan.links,
    criticalPath: computed.criticalPath,
    latestProjectStart: computed.latestProjectStart,
    myGroupIds: memberships.filter((row) => row.memberId === member.id).map((row) => row.workingGroupId),
  };

  return <PlanView data={data} />;
}
