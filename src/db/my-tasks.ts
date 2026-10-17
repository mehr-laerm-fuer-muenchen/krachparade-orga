import { cache } from "react";
import { dateToDay } from "@/lib/plan-days";
import { computePlan } from "@/lib/plan-engine";
import { myAgenda, recentlyDone, type MyAgenda, type MyTask, type MyTasksInput } from "@/lib/my-tasks";
import { getCurrentEdition } from "./editions";
import { listEditionItems } from "./meetings";
import { loadOngoingElements, loadPlan, loadPlanDetails, loadPlanOptions } from "./plan";
import { listWorkingGroupMembers, listWorkingGroups } from "./working-groups";

export type LoadedMyAgenda = {
  dDay: string;
  /** Today, relative to the D-Day. */
  today: number;
  /** Ids of the working groups the member takes part in. */
  myGroupIds: string[];
  agenda: MyAgenda;
  recentlyDone: MyTask[];
};

/**
 * "Meine Aufgaben" of a member in the current edition (spec 009): the plan as
 * on the start page, plan to-dos, protocol to-dos, AK memberships and the
 * working group of each department. Once per request (React `cache`), so the
 * layout (count) and the page share it. Null without a current edition.
 * Throws `PlanCycleError` if the plan cannot be computed.
 */
export const loadMyAgenda = cache(async (memberId: string, today: string): Promise<LoadedMyAgenda | null> => {
  const edition = await getCurrentEdition();
  if (!edition) return null;

  const [plan, ongoing, details, meetingTodos, memberships, groups, options] = await Promise.all([
    loadPlan(edition.id),
    loadOngoingElements(edition.id),
    loadPlanDetails(edition.id),
    listEditionItems(edition.id, "todo"),
    listWorkingGroupMembers(edition.id),
    listWorkingGroups(edition.id),
    loadPlanOptions(edition.id),
  ]);

  const todayDay = dateToDay(today, plan.dDay);
  const computed = computePlan(plan.elements, plan.links, todayDay);
  const groupNames = new Map(groups.map((group) => [group.id, group.name]));
  const myGroupIds = memberships.filter((row) => row.memberId === memberId).map((row) => row.workingGroupId);

  const input: MyTasksInput = {
    computed: plan.elements.map((element) => {
      const result = computed.elements.get(element.id)!;
      return {
        id: element.id,
        name: element.name,
        kind: element.kind,
        workingGroupId: element.workingGroupId,
        workingGroupName: element.workingGroupName,
        ownerId: element.ownerId,
        done: element.done,
        doneAt: element.doneAt,
        start: result.plannedStart,
        end: result.plannedEnd,
        buffer: result.buffer,
        status: result.status,
        reason: result.reason,
        reasonDetail: result.reasonDetail,
      };
    }),
    todos: details.todos,
    ongoing: ongoing.map((element) => ({
      id: element.id,
      departmentName: element.departmentName ?? "",
      workingGroupId: element.workingGroupId,
      workingGroupName: element.workingGroupName,
    })),
    meetingTodos: meetingTodos.map((item) => ({
      id: item.id,
      meetingId: item.meetingId,
      meetingDate: item.meetingDate,
      text: item.text,
      ownerId: item.ownerId,
      ownerName: item.ownerName,
      dueDate: item.dueDate,
      departmentId: item.departmentId,
      done: item.done,
      doneAt: item.doneAt,
    })),
    meId: memberId,
    myGroupIds,
    departmentGroups: options.departments.map((department) => ({
      id: department.id,
      workingGroupId: department.workingGroupId,
      workingGroupName:
        department.workingGroupId === null ? null : (groupNames.get(department.workingGroupId) ?? null),
    })),
    today: todayDay,
    dDay: plan.dDay,
  };

  return {
    dDay: plan.dDay,
    today: todayDay,
    myGroupIds,
    agenda: myAgenda(input),
    recentlyDone: recentlyDone(input),
  };
});

/** Number of entries under "Überfällig & Verzug" (count at "Meine" in the navigation). */
export async function countMyOverdue(memberId: string, today: string): Promise<number> {
  const loaded = await loadMyAgenda(memberId, today);
  return loaded?.agenda.overdue.length ?? 0;
}
