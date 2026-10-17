// AK workspace (spec 018): what a working group has to look at, grouped by
// department, and the "Laufende Aufgaben" rules. Days are whole numbers
// relative to the D-Day as in the plan engine; protocol dates stay
// "YYYY-MM-DD". Pure functions, no database, no clock: "today" is passed in.
import type { Status } from "@/components/status-pill";
import { dateToDay } from "./plan-days";
import type { PlanElementKind } from "./plan-engine";
import { isOverdue, sortTodos } from "./protocol-rules";

export const ONGOING_NAME = "Laufende Aufgaben";
export const ONGOING_LOCKED = "Laufende Aufgaben lassen sich nicht im Plan bearbeiten.";
export const DEPARTMENT_HAS_ONGOING = "Hat laufende Aufgaben oder Notizen – stattdessen umbenennen oder verschieben.";

/** "Laufende Aufgaben · ‹Bereich›" */
export function ongoingDisplayName(departmentName: string): string {
  return `${ONGOING_NAME} · ${departmentName}`;
}

/**
 * The plan without "Laufende Aufgaben": only elements with `isOngoing` false
 * and only links whose ends are among them (the D-Day, `toId` null, always
 * is). Runs before the engine computes, so the plan stays as without them.
 */
export function withoutOngoing<
  E extends { id: string; isOngoing: boolean },
  L extends { fromId: string; toId: string | null },
>(elements: readonly E[], links: readonly L[]): { elements: E[]; links: L[] } {
  const kept = elements.filter((element) => !element.isOngoing);
  const ids = new Set(kept.map((element) => element.id));
  return {
    elements: kept,
    links: links.filter((link) => ids.has(link.fromId) && (link.toId === null || ids.has(link.toId))),
  };
}

/** A computed plan element of the working group (never a "Laufende Aufgaben" element). */
export type AkElementInput = {
  id: string;
  name: string;
  kind: PlanElementKind;
  departmentId: string | null;
  done: boolean;
  status: Status;
  start: number;
  end: number;
};

/** A plan to-do; `due` is null at "Laufende Aufgaben". */
export type AkPlanTodoInput = { id: string; elementId: string; done: boolean; due: number | null };

/** A protocol to-do; `dueDate` "YYYY-MM-DD" or null. */
export type AkMeetingTodoInput = {
  id: string;
  departmentId: string | null;
  done: boolean;
  dueDate: string | null;
  createdAt: Date;
};

/** A decision ("Beschluss") of a meeting. */
export type AkDecisionInput = {
  id: string;
  departmentId: string | null;
  /** "YYYY-MM-DD" */
  meetingDate: string;
  meetingCreatedAt: Date;
  sortOrder: number;
};

/** The day an element is due: a milestone's day, a task's end. */
export function termDay(element: Pick<AkElementInput, "kind" | "start" | "end">): number {
  return element.kind === "milestone" ? element.start : element.end;
}

export type AttentionItem<E, P, M> =
  | { type: "element"; element: E }
  | { type: "plan_todo"; todo: P; element: E; due: number }
  | { type: "meeting_todo"; todo: M; due: number };

/**
 * "Braucht Aufmerksamkeit": late elements (by date), overdue open to-dos of
 * elements not reached and of the departments' meetings (by due day), then
 * wobbly elements (by date). `today` = "YYYY-MM-DD".
 */
export function attentionItems<E extends AkElementInput, P extends AkPlanTodoInput, M extends AkMeetingTodoInput>(
  input: { dDay: string; elements: readonly E[]; planTodos: readonly P[]; meetingTodos: readonly M[] },
  today: string
): AttentionItem<E, P, M>[] {
  const todayDay = dateToDay(today, input.dDay);
  const byTerm = (a: E, b: E) => termDay(a) - termDay(b) || a.name.localeCompare(b.name, "de");
  const elementsById = new Map(input.elements.map((element) => [element.id, element]));

  const late = input.elements.filter((element) => element.status === "late").sort(byTerm);
  const warn = input.elements.filter((element) => element.status === "warn").sort(byTerm);

  const todos: (AttentionItem<E, P, M> & { due: number })[] = [];
  for (const todo of input.planTodos) {
    const element = elementsById.get(todo.elementId);
    if (todo.done || !element || element.done || todo.due === null || todo.due >= todayDay) continue;
    todos.push({ type: "plan_todo", todo, element, due: todo.due });
  }
  for (const todo of input.meetingTodos) {
    if (todo.dueDate === null || !isOverdue({ kind: "todo", done: todo.done, dueDate: todo.dueDate }, today)) continue;
    todos.push({ type: "meeting_todo", todo, due: dateToDay(todo.dueDate, input.dDay) });
  }
  // Stable: the same due day keeps plan to-dos before protocol to-dos.
  todos.sort((a, b) => a.due - b.due);

  return [
    ...late.map((element) => ({ type: "element" as const, element })),
    ...todos,
    ...warn.map((element) => ({ type: "element" as const, element })),
  ];
}

export type AkOngoingInput = { id: string; departmentId: string | null; todos: readonly { done: boolean }[] };

export type AkDepartmentGroup<E, O extends AkOngoingInput, M, D> = {
  /** Department id, or "none" for "Ohne Aufgabenbereich". */
  key: string;
  department: { id: string; name: string } | null;
  openElements: E[];
  reachedElements: E[];
  ongoing: { element: O; openTodos: O["todos"][number][]; doneTodos: O["todos"][number][] } | null;
  openMeetingTodos: M[];
  doneMeetingTodos: M[];
  decisions: D[];
};

/**
 * One group per department of the working group (in `sortOrder`), then
 * "Ohne Aufgabenbereich" for elements without a department or with one of
 * another working group, only if there are any (plan only).
 */
export function groupByDepartment<
  E extends AkElementInput,
  O extends AkOngoingInput,
  M extends AkMeetingTodoInput,
  D extends AkDecisionInput,
>(
  departments: readonly { id: string; name: string; sortOrder: number }[],
  elements: readonly E[],
  ongoing: readonly O[],
  meetingTodos: readonly M[],
  decisions: readonly D[]
): AkDepartmentGroup<E, O, M, D>[] {
  const byStart = (a: E, b: E) => a.start - b.start || a.name.localeCompare(b.name, "de");
  const newestFirst = (a: D, b: D) =>
    (a.meetingDate === b.meetingDate ? 0 : a.meetingDate < b.meetingDate ? 1 : -1) ||
    b.meetingCreatedAt.getTime() - a.meetingCreatedAt.getTime() ||
    a.sortOrder - b.sortOrder;
  const known = new Set(departments.map((department) => department.id));

  const planOf = (list: E[]) => ({
    openElements: list.filter((element) => !element.done).sort(byStart),
    reachedElements: list.filter((element) => element.done).sort(byStart),
  });

  const groups: AkDepartmentGroup<E, O, M, D>[] = [...departments]
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "de"))
    .map((department) => {
      const element = ongoing.find((candidate) => candidate.departmentId === department.id);
      const todos = sortTodos(meetingTodos.filter((todo) => todo.departmentId === department.id));
      return {
        key: department.id,
        department: { id: department.id, name: department.name },
        ...planOf(elements.filter((candidate) => candidate.departmentId === department.id)),
        ongoing: element
          ? {
              element,
              openTodos: element.todos.filter((todo) => !todo.done),
              doneTodos: element.todos.filter((todo) => todo.done),
            }
          : null,
        openMeetingTodos: todos.filter((todo) => !todo.done),
        doneMeetingTodos: todos.filter((todo) => todo.done),
        decisions: decisions.filter((decision) => decision.departmentId === department.id).sort(newestFirst),
      };
    });

  const rest = elements.filter((element) => element.departmentId === null || !known.has(element.departmentId));
  if (rest.length > 0) {
    groups.push({
      key: "none",
      department: null,
      ...planOf(rest),
      ongoing: null,
      openMeetingTodos: [],
      doneMeetingTodos: [],
      decisions: [],
    });
  }
  return groups;
}

/** Done and all to-dos and reached and all plan elements (spec 024). */
export type AkProgress = {
  todosDone: number;
  todosTotal: number;
  elementsDone: number;
  elementsTotal: number;
  /** At least one entry, every to-do done and every element reached. */
  allDone: boolean;
};

type Ticked = { done: boolean };
type ElementWithTodos = { done: boolean; todos: readonly Ticked[] };

function progressOf(elements: readonly ElementWithTodos[], otherTodos: readonly Ticked[]): AkProgress {
  const todos = [...elements.flatMap((element) => element.todos), ...otherTodos];
  const todosDone = todos.filter((todo) => todo.done).length;
  const elementsDone = elements.filter((element) => element.done).length;
  return {
    todosDone,
    todosTotal: todos.length,
    elementsDone,
    elementsTotal: elements.length,
    allDone:
      todos.length + elements.length > 0 && todosDone === todos.length && elementsDone === elements.length,
  };
}

/**
 * Progress of a department group: to-dos of its plan elements (reached ones
 * included), of its "Laufende Aufgaben" and its protocol to-dos; elements are
 * its plan elements ("Laufende Aufgaben" are never among them).
 */
export function areaProgress(area: {
  openElements: readonly ElementWithTodos[];
  reachedElements: readonly ElementWithTodos[];
  ongoing: { openTodos: readonly Ticked[]; doneTodos: readonly Ticked[] } | null;
  openMeetingTodos: readonly Ticked[];
  doneMeetingTodos: readonly Ticked[];
}): AkProgress {
  return progressOf(
    [...area.openElements, ...area.reachedElements],
    [
      ...(area.ongoing?.openTodos ?? []),
      ...(area.ongoing?.doneTodos ?? []),
      ...area.openMeetingTodos,
      ...area.doneMeetingTodos,
    ]
  );
}

/** Progress of a working group: all its plan elements, to-dos of its "Laufende Aufgaben" and protocol to-dos. */
export function akProgress(ak: {
  elements: readonly ElementWithTodos[];
  ongoingTodos: readonly Ticked[];
  meetingTodos: readonly Ticked[];
}): AkProgress {
  return progressOf(ak.elements, [...ak.ongoingTodos, ...ak.meetingTodos]);
}

export type AkNext = { elementId: string; name: string; day: number; type: "milestone" | "starts" | "ends" };

export type AkSummary = { late: number; warn: number; openTodos: number; next: AkNext | null };

/**
 * Overview card of a working group: late and wobbly elements, open to-dos
 * (plan to-dos of elements not reached, "Laufende Aufgaben" included, and
 * protocol to-dos of its departments) and the next date from today on.
 */
export function akSummary(
  input: {
    dDay: string;
    elements: readonly AkElementInput[];
    ongoingIds: readonly string[];
    planTodos: readonly Pick<AkPlanTodoInput, "elementId" | "done">[];
    meetingTodos: readonly Pick<AkMeetingTodoInput, "done">[];
  },
  today: string
): AkSummary {
  const todayDay = dateToDay(today, input.dDay);
  const open = new Set([
    ...input.elements.filter((element) => !element.done).map((element) => element.id),
    ...input.ongoingIds,
  ]);

  let next: AkNext | null = null;
  for (const element of input.elements) {
    if (element.done) continue;
    let candidate: AkNext | null = null;
    const base = { elementId: element.id, name: element.name };
    if (element.kind === "milestone") {
      if (element.start >= todayDay) candidate = { ...base, day: element.start, type: "milestone" };
    } else if (element.start >= todayDay) {
      candidate = { ...base, day: element.start, type: "starts" };
    } else if (element.end >= todayDay) {
      candidate = { ...base, day: element.end, type: "ends" };
    }
    if (
      candidate &&
      (!next || candidate.day < next.day || (candidate.day === next.day && candidate.name.localeCompare(next.name, "de") < 0))
    ) {
      next = candidate;
    }
  }

  return {
    late: input.elements.filter((element) => element.status === "late").length,
    warn: input.elements.filter((element) => element.status === "warn").length,
    openTodos:
      input.planTodos.filter((todo) => !todo.done && open.has(todo.elementId)).length +
      input.meetingTodos.filter((todo) => !todo.done).length,
    next,
  };
}
