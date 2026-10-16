import { describe, expect, it } from "vitest";
import {
  myAgenda,
  recentlyDone,
  type MyElementInput,
  type MyMeetingTodoInput,
  type MyPlanTodoInput,
  type MyTask,
  type MyTasksInput,
} from "./my-tasks";
import { NBSP } from "./dday";
import { dateToDay } from "./plan-days";

const D_DAY = "2027-05-08"; // a Saturday
const day = (date: string) => dateToDay(date, D_DAY);
const ME = "me";
const OTHER = "other";
// Wednesday, 2027-02-17; the week runs from Mo 15.02. to Su 21.02.
const TODAY = day("2027-02-17");

function element(overrides: Partial<MyElementInput> & { id: string }): MyElementInput {
  return {
    name: overrides.id,
    kind: "milestone",
    workingGroupName: "Demo & Route",
    workingGroupId: "demo",
    ownerId: ME,
    done: false,
    doneAt: null,
    start: TODAY + 1,
    end: TODAY + 1,
    buffer: 5,
    status: "ok",
    reason: "ok",
    ...overrides,
  };
}

function todo(overrides: Partial<MyPlanTodoInput> & { id: string; elementId: string }): MyPlanTodoInput {
  return {
    text: overrides.id,
    ownerId: ME,
    anchor: "start",
    daysBefore: 0,
    done: false,
    doneAt: null,
    ...overrides,
  };
}

function meetingTodo(overrides: Partial<MyMeetingTodoInput> & { id: string }): MyMeetingTodoInput {
  return {
    meetingId: "meeting",
    meetingDate: "2027-02-10",
    text: overrides.id,
    ownerId: ME,
    ownerName: null,
    dueDate: "2027-02-19",
    departmentId: "dep-demo",
    done: false,
    doneAt: null,
    ...overrides,
  };
}

function input(overrides: Partial<MyTasksInput>): MyTasksInput {
  return {
    computed: [],
    todos: [],
    meetingTodos: [],
    meId: ME,
    myGroupIds: ["demo"],
    departmentGroups: [
      { id: "dep-demo", workingGroupId: "demo", workingGroupName: "Demo & Route" },
      { id: "dep-fin", workingGroupId: "fin", workingGroupName: "Finanzen" },
    ],
    today: TODAY,
    dDay: D_DAY,
    ...overrides,
  };
}

const keys = (tasks: readonly MyTask[]) => tasks.map((task) => task.key);
const allKeys = (agenda: ReturnType<typeof myAgenda>) => [
  ...keys(agenda.overdue),
  ...agenda.weeks.flatMap((week) => keys(week.entries)),
  ...agenda.later.flatMap((week) => keys(week.entries)),
  ...keys(agenda.undated),
];

describe("myAgenda: what is mine", () => {
  it("takes my elements, to-dos with my name and to-dos without a name on my elements", () => {
    const agenda = myAgenda(
      input({
        computed: [element({ id: "own" }), element({ id: "foreign", ownerId: OTHER })],
        todos: [
          todo({ id: "t-mine", elementId: "foreign" }),
          todo({ id: "t-nobody", elementId: "own", ownerId: null }),
          todo({ id: "t-other", elementId: "own", ownerId: OTHER }),
          todo({ id: "t-nobody-foreign", elementId: "foreign", ownerId: null }),
        ],
      })
    );
    expect(allKeys(agenda).sort()).toEqual(["element-own", "plan_todo-t-mine", "plan_todo-t-nobody"]);
    const nobody = agenda.weeks[0].entries.find((task) => task.id === "t-nobody")!;
    expect(nobody.onOwnElement).toBe(true);
    expect(agenda.weeks[0].entries.find((task) => task.id === "t-mine")!.onOwnElement).toBe(false);
  });

  it("keeps open to-dos of done elements, but not done elements and done to-dos", () => {
    const agenda = myAgenda(
      input({
        computed: [element({ id: "done", done: true, status: "done", reason: "done" })],
        todos: [
          todo({ id: "open", elementId: "done", ownerId: null }),
          todo({ id: "ticked", elementId: "done", done: true }),
        ],
      })
    );
    expect(allKeys(agenda)).toEqual(["plan_todo-open"]);
  });

  it("carries AK name, anchor and meeting of each entry", () => {
    const agenda = myAgenda(
      input({
        computed: [element({ id: "e", name: "Route steht" })],
        todos: [todo({ id: "t", elementId: "e", anchor: "end" })],
        meetingTodos: [meetingTodo({ id: "m" })],
      })
    );
    const [entryE, entryT, entryM] = agenda.weeks[0].entries;
    expect(entryE).toMatchObject({ kind: "element", workingGroupName: "AK Demo & Route", status: "ok", buffer: 5 });
    expect(entryT).toMatchObject({
      kind: "plan_todo",
      elementId: "e",
      elementName: "Route steht",
      anchor: "end",
      anchorLabel: "To-do",
    });
    expect(entryM).toMatchObject({
      kind: "meeting_todo",
      meetingId: "meeting",
      meetingDate: "2027-02-10",
      workingGroupName: "AK Demo & Route",
    });
  });
});

describe("myAgenda: weeks", () => {
  it("always shows the current week, empty if nothing is due", () => {
    const agenda = myAgenda(input({}));
    expect(agenda.weeks).toHaveLength(1);
    expect(agenda.weeks[0]).toMatchObject({ title: "Diese Woche", range: `15.02.–21.02. · 82${NBSP}T vorher`, entries: [] });
  });

  it("puts Sunday into the current week and Monday into the next", () => {
    const agenda = myAgenda(
      input({
        computed: [
          element({ id: "sun", start: day("2027-02-21"), end: day("2027-02-21") }),
          element({ id: "mon", start: day("2027-02-22"), end: day("2027-02-22") }),
        ],
      })
    );
    expect(agenda.weeks.map((week) => [week.title, keys(week.entries)])).toEqual([
      ["Diese Woche", ["element-sun"]],
      ["Nächste Woche", ["element-mon"]],
    ]);
    expect(agenda.weeks[0].entries[0].text).toBe("Meilenstein · So 21.02.");
  });

  it("shows starting tasks in their week and running tasks only in the current week", () => {
    const agenda = myAgenda(
      input({
        computed: [
          element({ id: "starts", kind: "task", start: day("2027-03-01"), end: day("2027-03-06") }),
          element({ id: "running", kind: "task", start: day("2027-02-01"), end: day("2027-03-20") }),
        ],
      })
    );
    expect(agenda.weeks.map((week) => [week.title, keys(week.entries)])).toEqual([
      ["Diese Woche", ["element-running"]],
      ["KW 9", ["element-starts"]],
    ]);
    expect(agenda.weeks[0].entries[0].text).toBe("läuft bis Sa 20.03.");
    expect(agenda.weeks[1].entries[0].text).toBe("startet Mo 01.03. · 5 Tage");
  });

  it("shows due to-dos with their weekday", () => {
    const agenda = myAgenda(
      input({
        computed: [element({ id: "e", start: day("2027-03-01"), end: day("2027-03-01") })],
        todos: [todo({ id: "t", elementId: "e", daysBefore: 10 })],
        meetingTodos: [meetingTodo({ id: "m", dueDate: "2027-02-19" })],
      })
    );
    expect(agenda.weeks[0].entries.map((task) => [task.key, task.text])).toEqual([
      ["plan_todo-t", "fällig Fr 19.02."],
      ["meeting_todo-m", "fällig Fr 19.02."],
    ]);
  });

  it("sorts a day by elements, plan to-dos, protocol to-dos, then name", () => {
    const agenda = myAgenda(
      input({
        computed: [
          element({ id: "b", start: TODAY + 2, end: TODAY + 2 }),
          element({ id: "a", start: TODAY + 2, end: TODAY + 2 }),
          element({ id: "early", start: TODAY + 3, end: TODAY + 3 }),
        ],
        todos: [todo({ id: "t", elementId: "early", daysBefore: 1 })],
        meetingTodos: [meetingTodo({ id: "m", dueDate: "2027-02-19" })],
      })
    );
    expect(keys(agenda.weeks[0].entries)).toEqual([
      "element-a",
      "element-b",
      "plan_todo-t",
      "meeting_todo-m",
      "element-early",
    ]);
  });

  it("shows six weeks in all and puts the rest into 'later' by week", () => {
    const agenda = myAgenda(
      input({
        computed: [
          element({ id: "week6", start: day("2027-03-27"), end: day("2027-03-27") }),
          element({ id: "week7", start: day("2027-03-29"), end: day("2027-03-29") }),
          element({ id: "week9", start: day("2027-04-12"), end: day("2027-04-12") }),
        ],
      })
    );
    expect(agenda.weeks.map((week) => keys(week.entries))).toEqual([[], ["element-week6"]]);
    expect(agenda.later.map((week) => [week.title, keys(week.entries)])).toEqual([
      ["KW 13", ["element-week7"]],
      ["KW 15", ["element-week9"]],
    ]);
    expect(agenda.later[0].range).toBe(`29.03.–04.04. · 40${NBSP}T vorher`);
  });

  it("follows the number of weeks it is given", () => {
    const agenda = myAgenda({
      ...input({ computed: [element({ id: "next", start: day("2027-02-22"), end: day("2027-02-22") })] }),
      weeks: 1,
    });
    expect(agenda.weeks.map((week) => week.title)).toEqual(["Diese Woche"]);
    expect(agenda.later.map((week) => week.title)).toEqual(["Nächste Woche"]);
  });
});

describe("myAgenda: overdue & late", () => {
  it("lists late elements, overdue plan and protocol to-dos first, only once, sorted by date", () => {
    const agenda = myAgenda(
      input({
        computed: [
          element({
            id: "late",
            name: "Anzeige",
            start: TODAY + 20,
            end: TODAY + 20,
            buffer: -3,
            status: "late",
            reason: "negative_buffer",
          }),
          element({ id: "e", name: "Route steht", start: TODAY + 1, end: TODAY + 1 }),
        ],
        todos: [todo({ id: "t", elementId: "e", daysBefore: 3 })],
        meetingTodos: [meetingTodo({ id: "m", meetingDate: "2027-02-03", dueDate: "2027-02-10" })],
      })
    );
    expect(agenda.overdue.map((task) => [task.key, task.text])).toEqual([
      ["meeting_todo-m", "aus Treffen 03.02. · war fällig Mi 10.02."],
      ["plan_todo-t", "für Route steht · war fällig Mo 15.02."],
      ["element-late", "Puffer negativ"],
    ]);
    expect(allKeys(agenda).filter((key) => key === "element-late")).toHaveLength(1);
    expect(keys(agenda.weeks[0].entries)).toEqual(["element-e"]);
  });

  it("says why an element is late", () => {
    const agenda = myAgenda(
      input({
        computed: [
          element({ id: "fixed", buffer: -4, status: "late", reason: "fixed_too_late" }),
          element({ id: "past", start: TODAY - 2, end: TODAY - 2, buffer: 0, status: "late", reason: "overdue" }),
        ],
      })
    );
    expect(agenda.overdue.map((task) => task.text)).toEqual([
      "Termin vorbei, nicht abgehakt",
      "Fixtermin liegt 4 Tage zu spät",
    ]);
  });

  it("does not count a protocol to-do due today as overdue", () => {
    const agenda = myAgenda(input({ meetingTodos: [meetingTodo({ id: "m", dueDate: "2027-02-17" })] }));
    expect(agenda.overdue).toEqual([]);
    expect(keys(agenda.weeks[0].entries)).toEqual(["meeting_todo-m"]);
  });
});

describe("myAgenda: undated and unassigned", () => {
  it("puts my protocol to-dos without a date into 'undated'", () => {
    const agenda = myAgenda(input({ meetingTodos: [meetingTodo({ id: "m", dueDate: null })] }));
    expect(agenda.undated.map((task) => [task.key, task.day, task.text])).toEqual([
      ["meeting_todo-m", null, "aus Treffen 10.02."],
    ]);
    expect(agenda.weeks[0].entries).toEqual([]);
  });

  it("collects open entries of my AKs without anyone, by date and undated last", () => {
    const agenda = myAgenda(
      input({
        computed: [
          element({ id: "free", ownerId: null, start: TODAY + 5, end: TODAY + 5 }),
          element({ id: "taken", ownerId: OTHER }),
          element({ id: "other-ak", ownerId: null, workingGroupId: "fin" }),
          element({ id: "no-ak", ownerId: null, workingGroupId: null, workingGroupName: null }),
          element({ id: "free-done", ownerId: null, done: true, status: "done", reason: "done" }),
        ],
        todos: [
          todo({ id: "t-free", elementId: "free", ownerId: null, daysBefore: 2 }),
          todo({ id: "t-taken-element", elementId: "taken", ownerId: null }),
          todo({ id: "t-no-ak", elementId: "no-ak", ownerId: null }),
          todo({ id: "t-named", elementId: "free", ownerId: OTHER }),
        ],
        meetingTodos: [
          meetingTodo({ id: "m-free", ownerId: null, dueDate: "2027-02-18" }),
          meetingTodo({ id: "m-undated", ownerId: null, dueDate: null }),
          meetingTodo({ id: "m-guest", ownerId: null, ownerName: "Gast Beispiel" }),
          meetingTodo({ id: "m-other-ak", ownerId: null, departmentId: "dep-fin" }),
          meetingTodo({ id: "m-no-department", ownerId: null, departmentId: null }),
        ],
      })
    );
    expect(keys(agenda.unassigned)).toEqual([
      "meeting_todo-m-free",
      "plan_todo-t-free",
      "element-free",
      "meeting_todo-m-undated",
    ]);
    expect(agenda.unassigned.every((task) => !task.onOwnElement)).toBe(true);
    expect(allKeys(agenda)).toEqual([]);
  });

  it("has no unassigned entries without AK memberships", () => {
    const agenda = myAgenda(
      input({ myGroupIds: [], computed: [element({ id: "free", ownerId: null })] })
    );
    expect(agenda.unassigned).toEqual([]);
  });
});

describe("recentlyDone", () => {
  // 2027-02-17 00:30 in Berlin is still 2027-02-16 in UTC.
  const at = (iso: string) => new Date(iso);

  it("shows my done entries of the last 14 days (Berlin date), newest first", () => {
    const tasks = recentlyDone(
      input({
        computed: [
          element({ id: "today", done: true, doneAt: at("2027-02-16T23:30:00Z") }),
          element({ id: "day14", done: true, doneAt: at("2027-02-04T10:00:00Z") }),
          element({ id: "day15", done: true, doneAt: at("2027-02-03T10:00:00Z") }),
          element({ id: "foreign", done: true, ownerId: OTHER, doneAt: at("2027-02-16T10:00:00Z") }),
          element({ id: "open" }),
        ],
        todos: [
          todo({ id: "t-nobody", elementId: "open", ownerId: null, done: true, doneAt: at("2027-02-15T10:00:00Z") }),
          todo({ id: "t-other", elementId: "open", ownerId: OTHER, done: true, doneAt: at("2027-02-15T10:00:00Z") }),
        ],
        meetingTodos: [meetingTodo({ id: "m", done: true, doneAt: at("2027-02-10T10:00:00Z") })],
      })
    );
    expect(tasks.map((task) => [task.key, task.text])).toEqual([
      ["element-today", "erledigt Mi 17.02."],
      ["plan_todo-t-nobody", "erledigt Mo 15.02."],
      ["meeting_todo-m", "erledigt Mi 10.02."],
      ["element-day14", "erledigt Do 04.02."],
    ]);
  });

  it("follows the number of days it is given", () => {
    const tasks = recentlyDone({
      ...input({ computed: [element({ id: "yesterday", done: true, doneAt: at("2027-02-16T10:00:00Z") })] }),
      days: 1,
    });
    expect(tasks).toEqual([]);
  });
});
