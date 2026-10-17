import type { PlanViewData } from "@/components/plan/plan-view";
import { todayInBerlin } from "@/lib/dday";
import type { PlanNoteView, PlanTodoView, PlanViewElement } from "@/lib/gantt-layout";
import { dateToDay } from "@/lib/plan-days";
import { computePlan, PlanCycleError, resolvePlacement, todoDueDay, type ComputedPlan } from "@/lib/plan-engine";
import { shortEditionName } from "@/lib/plan-preview";
import { displayGroupName } from "@/lib/working-groups";
import { loadPlan, loadPlanDetails, loadPlanOptions } from "./plan";
import { listWorkingGroupMembers, listWorkingGroups } from "./working-groups";

/** The plan of an edition for the plan view; `empty` without elements, `cycle` if it cannot be computed. */
export type LoadedPlanView = { status: "empty" } | { status: "cycle" } | { status: "ok"; data: PlanViewData };

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
 * Everything the plan view and its detail panel need (spec 007/008), shared
 * by the start page and "/meine" (spec 009). Loading and the plan engine run
 * on the server. Names only, never e-mail addresses. `today` = "YYYY-MM-DD"
 * in Europe/Berlin.
 */
export async function loadPlanView(
  edition: { id: string; name: string },
  memberId: string,
  today: string
): Promise<LoadedPlanView> {
  const title = `Plan ${shortEditionName(edition.name)}`;
  const plan = await loadPlan(edition.id);
  if (plan.elements.length === 0) return { status: "empty" };

  const todayDay = dateToDay(today, plan.dDay);
  let computed: ComputedPlan;
  try {
    computed = computePlan(plan.elements, plan.links, todayDay);
  } catch (error) {
    if (!(error instanceof PlanCycleError)) throw error;
    return { status: "cycle" };
  }

  const [details, groups, memberships, options] = await Promise.all([
    loadPlanDetails(edition.id),
    listWorkingGroups(edition.id),
    listWorkingGroupMembers(edition.id),
    loadPlanOptions(edition.id),
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
      own: note.authorId === memberId,
      edited: note.updatedAt.getTime() > note.createdAt.getTime(),
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
      earliestStart: result.earliestStart,
      slack: result.slack,
      running: result.running,
      buffer: result.buffer,
      status: result.status,
      reason: result.reason,
      reasonDetail: result.reasonDetail,
      done: element.done,
      fixed: resolvePlacement(element).mode === "fixed",
      critical: result.critical,
      tight: result.tight,
      wobbly: element.wobbly,
      workingGroupName: element.workingGroupName === null ? null : displayGroupName(element.workingGroupName),
      departmentName: element.departmentName,
      ownerName: element.ownerName,
      todos,
      notes,
      updatedAt: element.updatedAt.toISOString(),
      durationDays: element.durationDays,
      placement: element.placement,
      fixedDay: element.fixedDay,
      fixedOffsetDays: element.fixedOffsetDays,
      fixedDate: element.fixedDate,
      freeStartDay: element.freeStartDay,
      doneDay: element.doneDay,
      sortOrder: element.sortOrder,
      departmentId: element.departmentId,
      ownerId: element.ownerId,
    };
  });

  return {
    status: "ok",
    data: {
      title,
      dDay: plan.dDay,
      today: todayDay,
      elements,
      groups: groups.map((group) => ({ id: group.id, name: group.name, sortOrder: group.sortOrder })),
      links: plan.links,
      counts: computed.counts,
      myGroupIds: memberships.filter((row) => row.memberId === memberId).map((row) => row.workingGroupId),
      departments: options.departments,
      members: options.members,
    },
  };
}
