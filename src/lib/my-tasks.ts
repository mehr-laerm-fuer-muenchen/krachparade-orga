// "Meine Aufgaben" (spec 009): what the signed-in member has to do by when,
// from the plan and from the minutes, as one time list. Days are whole
// numbers relative to the D-Day as in the plan engine. Pure functions, no
// database, no clock: "today" is passed in.
import type { Status } from "@/components/status-pill";
import { todayInBerlin } from "./dday";
import { ongoingDisplayName } from "./ak-workspace";
import { formatDayMonth, lateText, mondayOf, weekday, weekHeading } from "./gantt-layout";
import { dateToDay, dayToDate } from "./plan-days";
import { todoDueDay, type PlanElementKind, type PlanStatusReason } from "./plan-engine";
import { isOverdue } from "./protocol-rules";
import { displayGroupName } from "./working-groups";

/** A plan element with its computed dates (loadPlan + computePlan). */
export type MyElementInput = {
  id: string;
  name: string;
  kind: PlanElementKind;
  /** Stored name of the working group, without "AK". */
  workingGroupName: string | null;
  workingGroupId: string | null;
  ownerId: string | null;
  done: boolean;
  doneAt: Date | null;
  start: number;
  end: number;
  buffer: number;
  status: Status;
  reason: PlanStatusReason;
};

export type MyPlanTodoInput = {
  id: string;
  elementId: string;
  text: string;
  ownerId: string | null;
  anchor: "start" | "end";
  daysBefore: number;
  done: boolean;
  doneAt: Date | null;
};

export type MyMeetingTodoInput = {
  id: string;
  meetingId: string;
  /** "YYYY-MM-DD" */
  meetingDate: string;
  text: string;
  ownerId: string | null;
  /** Free-text owner without an account. */
  ownerName: string | null;
  /** "YYYY-MM-DD" or null. */
  dueDate: string | null;
  departmentId: string | null;
  done: boolean;
  doneAt: Date | null;
};

/** A "Laufende Aufgaben" element (spec 018): its to-dos have no date. */
export type MyOngoingInput = {
  id: string;
  departmentName: string;
  workingGroupId: string | null;
  /** Stored name of the working group, without "AK". */
  workingGroupName: string | null;
};

/** Department → working group (stored name, without "AK"). */
export type DepartmentGroup = { id: string; workingGroupId: string | null; workingGroupName: string | null };

export type MyTaskKind = "element" | "plan_todo" | "meeting_todo";

type MyTaskBase = {
  /** Unique within the lists, e.g. "element-‹id›". */
  key: string;
  id: string;
  title: string;
  /** "Meilenstein · Mi 17.02.", "fällig Mo 12.10." … */
  text: string;
  /** Due day (relative to the D-Day); null = no date. */
  day: number | null;
  /** Display name "AK ‹Name›". */
  workingGroupName: string | null;
  /** A to-do without owner on an element that belongs to me. */
  onOwnElement: boolean;
};

export type MyTask =
  | (MyTaskBase & {
      kind: "element";
      elementKind: PlanElementKind;
      status: Status;
      reason: PlanStatusReason;
      buffer: number;
    })
  | (MyTaskBase & {
      kind: "plan_todo";
      elementId: string;
      elementName: string;
      anchor: "start" | "end";
      /** `start` → "Voraussetzung", `end` → "To-do". */
      anchorLabel: "Voraussetzung" | "To-do";
      /**
       * Set for a to-do of "Laufende Aufgaben" (spec 018): opens the AK
       * workspace of this working group instead of the panel (null = no AK).
       */
      ongoing?: { workingGroupId: string | null };
    })
  | (MyTaskBase & { kind: "meeting_todo"; meetingId: string; meetingDate: string });

export type MyWeek = {
  monday: number;
  /** "Diese Woche", "Nächste Woche" or "KW n". */
  title: string;
  /** "TT.MM.–TT.MM. · D-x" */
  range: string;
  entries: MyTask[];
};

export type MyAgenda = {
  overdue: MyTask[];
  /** The current week (always) and the following weeks with entries, within `weeks` weeks. */
  weeks: MyWeek[];
  /** Everything after these weeks, by week. */
  later: MyWeek[];
  /** Own protocol to-dos without a due date and own to-dos of "Laufende Aufgaben" (spec 018). */
  undated: MyTask[];
  /** "Aus meinen AKs – noch niemand eingetragen". */
  unassigned: MyTask[];
};

export type MyTasksInput = {
  /** Plan elements with their computed dates. */
  computed: readonly MyElementInput[];
  todos: readonly MyPlanTodoInput[];
  meetingTodos: readonly MyMeetingTodoInput[];
  /** "Laufende Aufgaben" elements (spec 018); their to-dos are in `todos`. */
  ongoing?: readonly MyOngoingInput[];
  meId: string;
  /** Working groups the member takes part in (spec 005). */
  myGroupIds: readonly string[];
  departmentGroups: readonly DepartmentGroup[];
  /** Today, relative to the D-Day. */
  today: number;
  dDay: string;
};

const KIND_RANK: Record<MyTaskKind, number> = { element: 0, plan_todo: 1, meeting_todo: 2 };

/** By date (without date last), then elements, plan to-dos, protocol to-dos, then title. */
function byDayKindTitle(a: MyTask, b: MyTask): number {
  if (a.day !== b.day) {
    if (a.day === null) return 1;
    if (b.day === null) return -1;
    return a.day - b.day;
  }
  return KIND_RANK[a.kind] - KIND_RANK[b.kind] || a.title.localeCompare(b.title, "de");
}

function groupLabel(name: string | null | undefined): string | null {
  return name ? displayGroupName(name) : null;
}

/** The to-do belongs to me: my name on it, or no name and the element is mine. */
function ownsTodo(todo: MyPlanTodoInput, element: MyElementInput, meId: string): boolean {
  return todo.ownerId === meId || (todo.ownerId === null && element.ownerId === meId);
}

/** Builds the entries; `text` is set by the caller. */
class Builder {
  private readonly elementsById: Map<string, MyElementInput>;
  private readonly ongoingById: Map<string, MyOngoingInput>;
  private readonly departments: Map<string, DepartmentGroup>;

  constructor(private readonly input: MyTasksInput) {
    this.elementsById = new Map(input.computed.map((element) => [element.id, element]));
    this.ongoingById = new Map((input.ongoing ?? []).map((element) => [element.id, element]));
    this.departments = new Map(input.departmentGroups.map((department) => [department.id, department]));
  }

  elementOf(todo: MyPlanTodoInput): MyElementInput | undefined {
    return this.elementsById.get(todo.elementId);
  }

  ongoingOf(todo: MyPlanTodoInput): MyOngoingInput | undefined {
    return this.ongoingById.get(todo.elementId);
  }

  departmentOf(todo: MyMeetingTodoInput): DepartmentGroup | undefined {
    return todo.departmentId === null ? undefined : this.departments.get(todo.departmentId);
  }

  element(element: MyElementInput, day: number | null, text: string): MyTask {
    return {
      kind: "element",
      key: `element-${element.id}`,
      id: element.id,
      title: element.name,
      text,
      day,
      workingGroupName: groupLabel(element.workingGroupName),
      onOwnElement: false,
      elementKind: element.kind,
      status: element.status,
      reason: element.reason,
      buffer: element.buffer,
    };
  }

  planTodo(todo: MyPlanTodoInput, element: MyElementInput, day: number | null, text: string): MyTask {
    return {
      kind: "plan_todo",
      key: `plan_todo-${todo.id}`,
      id: todo.id,
      title: todo.text,
      text,
      day,
      workingGroupName: groupLabel(element.workingGroupName),
      onOwnElement: todo.ownerId === null && element.ownerId === this.input.meId,
      elementId: element.id,
      elementName: element.name,
      anchor: todo.anchor,
      anchorLabel: todo.anchor === "start" ? "Voraussetzung" : "To-do",
    };
  }

  /** A to-do of "Laufende Aufgaben": no date, "Laufende Aufgaben · ‹Bereich›" as origin. */
  ongoingTodo(todo: MyPlanTodoInput, ongoing: MyOngoingInput, day: number | null, text: string): MyTask {
    return {
      kind: "plan_todo",
      key: `plan_todo-${todo.id}`,
      id: todo.id,
      title: todo.text,
      text,
      day,
      workingGroupName: groupLabel(ongoing.workingGroupName),
      onOwnElement: false,
      elementId: ongoing.id,
      elementName: ongoingDisplayName(ongoing.departmentName),
      anchor: todo.anchor,
      anchorLabel: "To-do",
      ongoing: { workingGroupId: ongoing.workingGroupId },
    };
  }

  meetingTodo(todo: MyMeetingTodoInput, day: number | null, text: string): MyTask {
    return {
      kind: "meeting_todo",
      key: `meeting_todo-${todo.id}`,
      id: todo.id,
      title: todo.text,
      text,
      day,
      workingGroupName: groupLabel(this.departmentOf(todo)?.workingGroupName),
      onOwnElement: false,
      meetingId: todo.meetingId,
      meetingDate: todo.meetingDate,
    };
  }
}

/** An open entry before it is sorted into the lists. */
type Placed = { task: MyTask; overdue: boolean };

/** Texts and placement of open entries (shared by my list and the unassigned list). */
function describeOpen(input: MyTasksInput, builder: Builder) {
  const { today, dDay } = input;
  const currentMonday = mondayOf(today, dDay);
  const todayDate = dayToDate(today, dDay);
  const meetingLabel = (todo: MyMeetingTodoInput) =>
    `aus Treffen ${formatDayMonth(dateToDay(todo.meetingDate, dDay), dDay)}`;

  return {
    element(element: MyElementInput): Placed {
      if (element.status === "late") {
        return { task: builder.element(element, element.end, lateText(element)), overdue: true };
      }
      if (element.kind === "milestone") {
        return {
          task: builder.element(element, element.start, `Meilenstein · ${weekday(element.start, dDay)}`),
          overdue: false,
        };
      }
      // A task that started before this week shows up in the current week as running.
      const text =
        element.start >= currentMonday
          ? `startet ${weekday(element.start, dDay)} · ${element.end - element.start} Tage`
          : `läuft bis ${weekday(element.end, dDay)}`;
      return { task: builder.element(element, element.start, text), overdue: false };
    },

    planTodo(todo: MyPlanTodoInput, element: MyElementInput): Placed {
      const due = todoDueDay(todo, { plannedStart: element.start, plannedEnd: element.end });
      if (due < today) {
        const text = `für ${element.name} · war fällig ${weekday(due, dDay)}`;
        return { task: builder.planTodo(todo, element, due, text), overdue: true };
      }
      return { task: builder.planTodo(todo, element, due, `fällig ${weekday(due, dDay)}`), overdue: false };
    },

    meetingTodo(todo: MyMeetingTodoInput): Placed {
      if (todo.dueDate === null) {
        return { task: builder.meetingTodo(todo, null, meetingLabel(todo)), overdue: false };
      }
      const due = dateToDay(todo.dueDate, dDay);
      if (isOverdue({ kind: "todo", done: todo.done, dueDate: todo.dueDate }, todayDate)) {
        const text = `${meetingLabel(todo)} · war fällig ${weekday(due, dDay)}`;
        return { task: builder.meetingTodo(todo, due, text), overdue: true };
      }
      return { task: builder.meetingTodo(todo, due, `fällig ${weekday(due, dDay)}`), overdue: false };
    },
  };
}

/**
 * "Meine Aufgaben": overdue and late entries first, then the current week
 * (always) and the following weeks with entries up to `weeks` weeks in all,
 * then everything later by week, own protocol to-dos without a date and the
 * open entries of my working groups that belong to nobody yet.
 */
export function myAgenda(input: MyTasksInput & { weeks?: number }): MyAgenda {
  const { meId, today, dDay, weeks = 6 } = input;
  const builder = new Builder(input);
  const describe = describeOpen(input, builder);
  const myGroups = new Set(input.myGroupIds);
  const inMyGroups = (groupId: string | null | undefined) => groupId != null && myGroups.has(groupId);

  const mine: Placed[] = [];
  const unassigned: MyTask[] = [];

  for (const element of input.computed) {
    if (element.done) continue;
    if (element.ownerId === meId) mine.push(describe.element(element));
    else if (element.ownerId === null && inMyGroups(element.workingGroupId)) {
      unassigned.push(describe.element(element).task);
    }
  }
  for (const todo of input.todos) {
    if (todo.done) continue;
    const ongoing = builder.ongoingOf(todo);
    if (ongoing) {
      // No date: "Ohne Datum", never overdue (spec 018).
      const task = builder.ongoingTodo(todo, ongoing, null, ongoingDisplayName(ongoing.departmentName));
      if (todo.ownerId === meId) mine.push({ task, overdue: false });
      else if (todo.ownerId === null && inMyGroups(ongoing.workingGroupId)) unassigned.push(task);
      continue;
    }
    const element = builder.elementOf(todo);
    if (!element) continue;
    if (ownsTodo(todo, element, meId)) mine.push(describe.planTodo(todo, element));
    else if (todo.ownerId === null && element.ownerId === null && inMyGroups(element.workingGroupId)) {
      unassigned.push(describe.planTodo(todo, element).task);
    }
  }
  for (const todo of input.meetingTodos) {
    if (todo.done) continue;
    if (todo.ownerId === meId) mine.push(describe.meetingTodo(todo));
    else if (todo.ownerId === null && !todo.ownerName && inMyGroups(builder.departmentOf(todo)?.workingGroupId)) {
      unassigned.push(describe.meetingTodo(todo).task);
    }
  }

  const overdue: MyTask[] = [];
  const undated: MyTask[] = [];
  const byWeek = new Map<number, MyTask[]>();
  const current = mondayOf(today, dDay);
  for (const { task, overdue: late } of mine) {
    if (late) overdue.push(task);
    else if (task.day === null) undated.push(task);
    else {
      // Running tasks (and anything else before this week) belong to the current week.
      const monday = Math.max(mondayOf(task.day, dDay), current);
      byWeek.set(monday, [...(byWeek.get(monday) ?? []), task]);
    }
  }

  const toWeek = (monday: number): MyWeek => ({
    monday,
    ...weekHeading(monday, current, dDay),
    entries: (byWeek.get(monday) ?? []).sort(byDayKindTitle),
  });
  const lastMonday = current + 7 * (weeks - 1);
  const mondays = [...byWeek.keys()].sort((a, b) => a - b);
  return {
    overdue: overdue.sort(byDayKindTitle),
    weeks: [current, ...mondays.filter((monday) => monday > current && monday <= lastMonday)].map(toWeek),
    later: mondays.filter((monday) => monday > lastMonday).map(toWeek),
    undated: undated.sort(byDayKindTitle),
    unassigned: unassigned.sort(byDayKindTitle),
  };
}

/**
 * My elements, plan to-dos (same rule as in `myAgenda`) and protocol to-dos
 * ticked off in the last `days` days (Berlin date, today included), newest first.
 */
export function recentlyDone(input: MyTasksInput & { days?: number }): MyTask[] {
  const { meId, today, dDay, days = 14 } = input;
  const builder = new Builder(input);
  const found: { task: MyTask; doneAt: Date }[] = [];

  const recentDay = (doneAt: Date | null): number | null => {
    if (doneAt === null) return null;
    const day = dateToDay(todayInBerlin(doneAt), dDay);
    return day <= today && day > today - days ? day : null;
  };
  const doneText = (day: number) => `erledigt ${weekday(day, dDay)}`;

  for (const element of input.computed) {
    const day = element.done && element.ownerId === meId ? recentDay(element.doneAt) : null;
    if (day !== null) found.push({ task: builder.element(element, day, doneText(day)), doneAt: element.doneAt! });
  }
  for (const todo of input.todos) {
    const ongoing = builder.ongoingOf(todo);
    if (ongoing) {
      const day = todo.done && todo.ownerId === meId ? recentDay(todo.doneAt) : null;
      if (day !== null) {
        found.push({ task: builder.ongoingTodo(todo, ongoing, day, doneText(day)), doneAt: todo.doneAt! });
      }
      continue;
    }
    const element = builder.elementOf(todo);
    const day = todo.done && element && ownsTodo(todo, element, meId) ? recentDay(todo.doneAt) : null;
    if (day !== null) {
      found.push({ task: builder.planTodo(todo, element!, day, doneText(day)), doneAt: todo.doneAt! });
    }
  }
  for (const todo of input.meetingTodos) {
    const day = todo.done && todo.ownerId === meId ? recentDay(todo.doneAt) : null;
    if (day !== null) found.push({ task: builder.meetingTodo(todo, day, doneText(day)), doneAt: todo.doneAt! });
  }

  return found
    .sort((a, b) => b.doneAt.getTime() - a.doneAt.getTime() || a.task.title.localeCompare(b.task.title, "de"))
    .map(({ task }) => task);
}
