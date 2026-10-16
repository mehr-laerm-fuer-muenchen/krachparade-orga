import { describe, expect, it } from "vitest";
import {
  akSummary,
  attentionItems,
  groupByDepartment,
  ongoingDisplayName,
  withoutOngoing,
  type AkDecisionInput,
  type AkElementInput,
  type AkMeetingTodoInput,
  type AkPlanTodoInput,
} from "./ak-workspace";
import { dateToDay } from "./plan-days";
import { computePlan, type PlanElementInput } from "./plan-engine";

const D_DAY = "2027-05-08";
const TODAY = "2027-02-17";
const day = (date: string) => dateToDay(date, D_DAY);
const T = day(TODAY);

function element(overrides: Partial<AkElementInput> & { id: string }): AkElementInput {
  return {
    name: overrides.id,
    kind: "milestone",
    departmentId: "route",
    done: false,
    status: "ok",
    start: T + 10,
    end: T + 10,
    ...overrides,
  };
}

function planTodo(overrides: Partial<AkPlanTodoInput> & { id: string; elementId: string }): AkPlanTodoInput {
  return { done: false, due: T + 5, ...overrides };
}

function meetingTodo(overrides: Partial<AkMeetingTodoInput> & { id: string }): AkMeetingTodoInput {
  return { departmentId: "route", done: false, dueDate: null, createdAt: new Date("2027-01-01T10:00:00Z"), ...overrides };
}

function decision(overrides: Partial<AkDecisionInput> & { id: string }): AkDecisionInput {
  return {
    departmentId: "route",
    meetingDate: "2027-01-10",
    meetingCreatedAt: new Date("2027-01-10T18:00:00Z"),
    sortOrder: 1,
    ...overrides,
  };
}

describe("ongoingDisplayName", () => {
  it("names the department", () => {
    expect(ongoingDisplayName("Route")).toBe("Laufende Aufgaben · Route");
  });
});

describe("withoutOngoing", () => {
  const base = (id: string, overrides: Partial<PlanElementInput> = {}) => ({
    id,
    kind: "task" as const,
    durationDays: 10,
    shiftDays: 0,
    fixedDay: null,
    done: false,
    wobbly: false,
    sortOrder: 1,
    isOngoing: false,
    ...overrides,
  });
  const plan = {
    elements: [base("a"), base("b", { durationDays: 20 }), base("c", { durationDays: 5 })],
    links: [
      { fromId: "a", toId: "b", lagDays: 0 },
      { fromId: "b", toId: null, lagDays: 0 },
      { fromId: "c", toId: null, lagDays: 3 },
    ],
  };

  it("leaves elements with is_ongoing and links to them out", () => {
    const ongoing = { ...base("x", { kind: "milestone", durationDays: 0 }), isOngoing: true };
    const result = withoutOngoing([...plan.elements, ongoing], [...plan.links, { fromId: "x", toId: "a", lagDays: 0 }]);
    expect(result.elements.map((element) => element.id)).toEqual(["a", "b", "c"]);
    expect(result.links).toEqual(plan.links);
  });

  it("gives the same critical path, buffers and status as without the ongoing element", () => {
    const ongoing = { ...base("x", { kind: "milestone", durationDays: 0, sortOrder: 0 }), isOngoing: true };
    const filtered = withoutOngoing([ongoing, ...plan.elements], plan.links);
    const today = day(TODAY);
    const withOngoing = computePlan(filtered.elements, filtered.links, today);
    const without = computePlan(plan.elements, plan.links, today);
    expect(withOngoing.criticalPath).toEqual(without.criticalPath);
    expect([...withOngoing.elements.entries()]).toEqual([...without.elements.entries()]);
    expect(withOngoing.elements.has("x")).toBe(false);
  });
});

describe("attentionItems", () => {
  it("is empty without late, wobbly or overdue entries", () => {
    expect(
      attentionItems(
        {
          dDay: D_DAY,
          elements: [element({ id: "e" })],
          planTodos: [planTodo({ id: "t", elementId: "e" })],
          meetingTodos: [meetingTodo({ id: "m", dueDate: TODAY })],
        },
        TODAY
      )
    ).toEqual([]);
  });

  it("lists late elements, then overdue to-dos by due day, then wobbly elements", () => {
    const items = attentionItems(
      {
        dDay: D_DAY,
        elements: [
          element({ id: "warn-late", status: "warn", start: T + 30, end: T + 30 }),
          element({ id: "warn-early", status: "warn", start: T + 3, end: T + 3 }),
          element({ id: "late-b", status: "late", kind: "task", start: T - 20, end: T - 1 }),
          element({ id: "late-a", status: "late", start: T - 5, end: T - 5 }),
          element({ id: "reached", done: true, status: "done" }),
          element({ id: "ok" }),
        ],
        planTodos: [
          planTodo({ id: "plan-old", elementId: "ok", due: T - 9 }),
          planTodo({ id: "plan-new", elementId: "ok", due: T - 1 }),
          planTodo({ id: "plan-done", elementId: "ok", due: T - 9, done: true }),
          planTodo({ id: "plan-reached", elementId: "reached", due: T - 9 }),
          planTodo({ id: "plan-today", elementId: "ok", due: T }),
          planTodo({ id: "plan-ongoing", elementId: "ongoing", due: null }),
        ],
        meetingTodos: [
          meetingTodo({ id: "meeting", dueDate: "2027-02-12" }),
          meetingTodo({ id: "meeting-done", dueDate: "2027-02-01", done: true }),
          meetingTodo({ id: "meeting-undated" }),
        ],
      },
      TODAY
    );
    expect(items.map((item) => (item.type === "element" ? item.element.id : item.todo.id))).toEqual([
      "late-a",
      "late-b",
      "plan-old",
      "meeting",
      "plan-new",
      "warn-early",
      "warn-late",
    ]);
  });
});

describe("groupByDepartment", () => {
  const departments = [
    { id: "wagen", name: "Wagenreihung", sortOrder: 3 },
    { id: "route", name: "Route", sortOrder: 2 },
  ];

  it("groups by department in their order, without an extra group when not needed", () => {
    const groups = groupByDepartment(departments, [], [], [], []);
    expect(groups.map((group) => group.key)).toEqual(["route", "wagen"]);
    expect(groups[0]).toMatchObject({
      openElements: [],
      reachedElements: [],
      ongoing: null,
      openMeetingTodos: [],
      decisions: [],
    });
  });

  it("splits open and reached elements by start, ongoing and protocol to-dos by state", () => {
    const ongoing = {
      id: "o",
      departmentId: "route",
      todos: [
        { id: "t1", done: false },
        { id: "t2", done: true },
      ],
    };
    const groups = groupByDepartment(
      departments,
      [
        element({ id: "later", start: T + 9 }),
        element({ id: "first", start: T + 1 }),
        element({ id: "done", done: true, status: "done" }),
      ],
      [ongoing],
      [
        meetingTodo({ id: "undated" }),
        meetingTodo({ id: "due", dueDate: "2027-03-01" }),
        meetingTodo({ id: "closed", done: true }),
        meetingTodo({ id: "other", departmentId: "wagen" }),
      ],
      []
    );
    const route = groups[0];
    expect(route.openElements.map((item) => item.id)).toEqual(["first", "later"]);
    expect(route.reachedElements.map((item) => item.id)).toEqual(["done"]);
    expect(route.ongoing?.openTodos.map((todo) => todo.id)).toEqual(["t1"]);
    expect(route.ongoing?.doneTodos.map((todo) => todo.id)).toEqual(["t2"]);
    expect(route.openMeetingTodos.map((todo) => todo.id)).toEqual(["due", "undated"]);
    expect(route.doneMeetingTodos.map((todo) => todo.id)).toEqual(["closed"]);
    expect(groups[1].openMeetingTodos.map((todo) => todo.id)).toEqual(["other"]);
  });

  it("puts elements without or with a foreign department into Ohne Aufgabenbereich", () => {
    const groups = groupByDepartment(
      departments,
      [element({ id: "none", departmentId: null }), element({ id: "foreign", departmentId: "buehne" })],
      [],
      [],
      []
    );
    expect(groups.map((group) => group.key)).toEqual(["route", "wagen", "none"]);
    expect(groups[2].department).toBeNull();
    expect(groups[2].openElements.map((item) => item.id)).toEqual(["foreign", "none"]);
  });

  it("orders decisions newest meeting first, within a meeting by item order", () => {
    const groups = groupByDepartment(
      departments,
      [],
      [],
      [],
      [
        decision({ id: "old", meetingDate: "2027-01-03", meetingCreatedAt: new Date("2027-01-03T10:00:00Z") }),
        decision({ id: "new-2", meetingDate: "2027-02-01", sortOrder: 2 }),
        decision({ id: "new-1", meetingDate: "2027-02-01", sortOrder: 1 }),
        decision({
          id: "same-day-later",
          meetingDate: "2027-01-03",
          meetingCreatedAt: new Date("2027-01-03T20:00:00Z"),
          sortOrder: 5,
        }),
      ]
    );
    expect(groups[0].decisions.map((item) => item.id)).toEqual(["new-1", "new-2", "same-day-later", "old"]);
  });
});

describe("akSummary", () => {
  const summary = (elements: AkElementInput[], extra: Partial<Parameters<typeof akSummary>[0]> = {}) =>
    akSummary({ dDay: D_DAY, elements, ongoingIds: [], planTodos: [], meetingTodos: [], ...extra }, TODAY);

  it("is all zero and without a next date for an empty working group", () => {
    expect(summary([])).toEqual({ late: 0, warn: 0, openTodos: 0, next: null });
  });

  it("counts late and wobbly elements", () => {
    const result = summary([
      element({ id: "a", status: "late", start: T - 3, end: T - 3 }),
      element({ id: "b", status: "warn" }),
      element({ id: "c", status: "warn" }),
    ]);
    expect(result).toMatchObject({ late: 1, warn: 2 });
  });

  it("counts open to-dos of elements not reached, of Laufende Aufgaben and from meetings", () => {
    const result = summary([element({ id: "open" }), element({ id: "reached", done: true, status: "done" })], {
      ongoingIds: ["ongoing"],
      planTodos: [
        { elementId: "open", done: false },
        { elementId: "open", done: true },
        { elementId: "reached", done: false },
        { elementId: "ongoing", done: false },
        { elementId: "ongoing", done: false },
      ],
      meetingTodos: [{ done: false }, { done: true }],
    });
    expect(result.openTodos).toBe(4);
    // Laufende Aufgaben never count as late or wobbly.
    expect(result).toMatchObject({ late: 0, warn: 0 });
  });

  it("finds the next date: milestone, starting task, running task", () => {
    expect(summary([element({ id: "m", start: T + 4, end: T + 4 })]).next).toEqual({
      elementId: "m",
      name: "m",
      day: T + 4,
      type: "milestone",
    });
    expect(summary([element({ id: "s", kind: "task", start: T + 2, end: T + 9 })]).next).toMatchObject({
      day: T + 2,
      type: "starts",
    });
    expect(summary([element({ id: "r", kind: "task", start: T - 5, end: T + 1 })]).next).toMatchObject({
      day: T + 1,
      type: "ends",
    });
    expect(
      summary([
        element({ id: "later", start: T + 8, end: T + 8 }),
        element({ id: "today", start: T, end: T }),
      ]).next
    ).toMatchObject({ elementId: "today", day: T });
  });

  it("has no next date when everything is reached or in the past", () => {
    expect(
      summary([
        element({ id: "done", done: true, status: "done" }),
        element({ id: "past", start: T - 1, end: T - 1, status: "late" }),
        element({ id: "task", kind: "task", start: T - 9, end: T - 2, status: "late" }),
      ]).next
    ).toBeNull();
  });
});
