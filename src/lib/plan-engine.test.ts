import { describe, expect, it } from "vitest";
import { TEST_PLAN } from "../db/seed";
import { dateToDay, dayToDate } from "./plan-days";
import {
  computePlan,
  moveElement,
  PlanCycleError,
  resizeFromEnd,
  resizeFromStart,
  setPlacementValues,
  TIGHT_SLACK_DAYS,
  todoDueDay,
  wouldCreateCycle,
  type PlanElementChange,
  type PlanElementInput,
  type PlanInput,
  type PlanLinkInput,
} from "./plan-engine";

// Far before every element, so nothing is overdue unless a test says so.
const EARLY = -1000;

let nextSortOrder = 1;
function milestone(id: string, extra: Partial<PlanElementInput> = {}): PlanElementInput {
  return {
    id,
    name: id,
    kind: "milestone",
    durationDays: 0,
    placement: "alap",
    fixedDay: null,
    fixedOffsetDays: null,
    freeStartDay: null,
    done: false,
    doneDay: null,
    wobbly: false,
    sortOrder: nextSortOrder++,
    ...extra,
  };
}
function task(id: string, durationDays: number, extra: Partial<PlanElementInput> = {}): PlanElementInput {
  return milestone(id, { kind: "task", durationDays, ...extra });
}
function link(fromId: string, toId: string | null, lagDays = 0): PlanLinkInput {
  return { fromId, toId, lagDays };
}
const fixedOffset = (days: number) => ({ placement: "fixed" as const, fixedOffsetDays: days });
const fixedDate = (day: number) => ({ placement: "fixed" as const, fixedDay: day });
const free = (day: number) => ({ placement: "free" as const, freeStartDay: day });

function apply(input: PlanInput, changes: PlanElementChange[]): PlanInput {
  return {
    ...input,
    elements: input.elements.map((element) => ({ ...element, ...changes.find((change) => change.id === element.id) })),
  };
}
const sorted = <T extends { id: string }>(changes: T[]) => [...changes].sort((a, b) => a.id.localeCompare(b.id));
const planned = (input: PlanInput, id: string, today = EARLY) =>
  computePlan(input.elements, input.links, today).elements.get(id)!;

describe("computePlan", () => {
  it("places a single milestone 10 days before the D-Day", () => {
    const plan = computePlan([milestone("m")], [link("m", null, 10)], EARLY);
    expect(plan.elements.get("m")).toMatchObject({
      latestFinish: -10,
      latestStart: -10,
      plannedStart: -10,
      plannedEnd: -10,
      buffer: 0,
      status: "ok",
      reason: "ok",
    });
  });

  it("uses 0 as latest finish without outgoing links", () => {
    const plan = computePlan([task("t", 5)], [], EARLY);
    expect(plan.elements.get("t")).toMatchObject({ latestFinish: 0, latestStart: -5, plannedEnd: 0 });
  });

  it("takes the earliest of several successors", () => {
    const elements = [milestone("a"), milestone("b"), milestone("c")];
    const links = [link("a", "b", 0), link("a", "c", 0), link("b", null, 10), link("c", null, 30)];
    expect(computePlan(elements, links, EARLY).elements.get("a")!.latestFinish).toBe(-30);
  });

  it("computes the window and the slack", () => {
    const plan = computePlan([milestone("a"), task("b", 5)], [link("a", "b", 3), link("b", null, 10)], -100);
    expect(plan.elements.get("b")).toMatchObject({
      earliestStart: -97,
      earliestFinish: -92,
      latestStart: -15,
      latestFinish: -10,
      slack: 82,
    });
  });

  it("schedules predecessors from a fixed date that is too late", () => {
    const elements = [milestone("before"), milestone("fix", fixedDate(-8)), milestone("after")];
    const links = [link("before", "fix", 5), link("fix", "after", 0), link("after", null, 10)];
    const plan = computePlan(elements, links, EARLY);
    expect(plan.elements.get("fix")).toMatchObject({
      latestStart: -8,
      plannedStart: -8,
      buffer: -2,
      status: "late",
      reason: "fixed_too_late",
      reasonDetail: { day: -10 },
      critical: true,
    });
    expect(plan.elements.get("before")).toMatchObject({ plannedStart: -13, latestStart: -13 });
  });

  it("puts a fixed element N days before the D-Day", () => {
    const plan = computePlan([task("t", 4, fixedOffset(20))], [link("t", null, 0)], EARLY);
    expect(plan.elements.get("t")).toMatchObject({ plannedStart: -20, plannedEnd: -16, status: "ok" });
  });

  it("starts „so früh“ without predecessors today", () => {
    const plan = computePlan([task("t", 3, { placement: "asap" })], [link("t", null, 10)], -50);
    expect(plan.elements.get("t")).toMatchObject({ plannedStart: -50, earliestStart: -50, slack: 37 });
  });

  it("lets „so spät“ fall to the latest start of a „so früh“ successor", () => {
    const elements = [milestone("a"), milestone("b", { placement: "asap" })];
    const plan = computePlan(elements, [link("a", "b", 2), link("b", null, 10)], -50);
    // a: latest start of b (-10) − 2; b then starts right after a.
    expect(plan.elements.get("a")!.plannedStart).toBe(-12);
    expect(plan.elements.get("b")).toMatchObject({ plannedStart: -10, latestStart: -10 });
  });

  it("lets „so spät“ follow a successor that lies earlier", () => {
    const elements = [milestone("a"), milestone("b", free(-30))];
    const plan = computePlan(elements, [link("a", "b", 2), link("b", null, 10)], EARLY);
    expect(plan.elements.get("a")).toMatchObject({ plannedStart: -32, status: "ok" });
  });

  it("computes an invalid placement like „so spät“", () => {
    const expected = computePlan([milestone("m")], [link("m", null, 10)], EARLY).elements.get("m")!;
    for (const extra of [
      { placement: "fixed" as const },
      { placement: "fixed" as const, fixedDay: -3, fixedOffsetDays: 3 },
      { placement: "free" as const },
    ]) {
      const plan = computePlan([milestone("m", extra)], [link("m", null, 10)], EARLY);
      expect(plan.elements.get("m")).toMatchObject({ plannedStart: expected.plannedStart, status: "ok" });
    }
  });

  it("freezes a done element on the day it was ticked off", () => {
    const elements = [task("a", 5, { done: true, doneDay: -40 }), milestone("b")];
    const plan = computePlan(elements, [link("a", "b", 3), link("b", null, 10)], -30);
    expect(plan.elements.get("a")).toMatchObject({
      plannedStart: -45,
      plannedEnd: -40,
      earliestStart: -45,
      latestStart: -45,
      status: "done",
      critical: false,
      tight: false,
    });
    expect(plan.elements.get("b")).toMatchObject({ earliestStart: -30, plannedStart: -10 });
  });

  it("counts critical, tight, late and warn", () => {
    const elements = [
      milestone("late", free(-5)),
      milestone("tight"),
      milestone("wobbly", { wobbly: true }),
    ];
    const links = [link("late", null, 10), link("tight", null, 10 + TIGHT_SLACK_DAYS), link("wobbly", null, 0)];
    const plan = computePlan(elements, links, -24);
    expect(plan.elements.get("tight")).toMatchObject({ slack: 7, tight: true });
    expect(plan.counts).toEqual({ critical: 1, tight: 1, late: 1, warn: 1 });
  });

  describe("status", () => {
    const run = (extra: Partial<PlanElementInput>, today: number) =>
      computePlan([task("t", 5, extra)], [link("t", null, 10)], today).elements.get("t")!;

    it("is overdue when the planned end was yesterday", () => {
      expect(run({}, -9)).toMatchObject({ plannedEnd: -10, status: "late", reason: "overdue", reasonDetail: { day: -10 } });
    });

    it("is not overdue when the planned end is today", () => {
      expect(run({}, -10)).toMatchObject({ status: "ok", reason: "ok" });
    });

    it("is running, not late, between start and end", () => {
      expect(run({}, -12)).toMatchObject({ running: true, earliestStart: -15, status: "ok" });
    });

    it("lets done win over everything", () => {
      expect(run({ done: true, doneDay: 4, wobbly: true }, 0)).toMatchObject({ status: "done", reason: "done" });
    });

    it("is too late after the latest start and too early before the earliest", () => {
      expect(run(free(-13), EARLY)).toMatchObject({ status: "late", reason: "too_late", reasonDetail: { days: 2 } });
    });

    it("is too early before the end of a fixed predecessor", () => {
      const plan = computePlan(
        [milestone("fix", fixedDate(-20)), task("t", 5, free(-40))],
        [link("fix", "t", 0), link("t", null, 10)],
        EARLY
      );
      expect(plan.elements.get("t")).toMatchObject({ status: "warn", reason: "too_early", reasonDetail: { day: -20 } });
    });

    it("lies before its predecessor when only the planned dates clash", () => {
      const plan = computePlan(
        [milestone("p", free(-10)), milestone("s", free(-15))],
        [link("p", "s", 0), link("s", null, 0)],
        EARLY
      );
      expect(plan.elements.get("s")).toMatchObject({
        status: "warn",
        reason: "before_predecessor",
        reasonDetail: { elementId: "p", days: 0 },
      });
    });

    it("shows wobbly as warn, but late goes first", () => {
      expect(run({ wobbly: true }, EARLY)).toMatchObject({ status: "warn", reason: "wobbly" });
      expect(run({ wobbly: true }, 0)).toMatchObject({ status: "late", reason: "overdue" });
    });
  });

  it("throws PlanCycleError for a cycle", () => {
    const elements = [milestone("a"), milestone("b"), milestone("c")];
    expect(() => computePlan(elements, [link("a", "b"), link("b", "c"), link("c", "a")], EARLY)).toThrow(
      PlanCycleError
    );
  });

  it("throws PlanCycleError for a cycle through a fixed date", () => {
    const elements = [milestone("a"), milestone("b", fixedDate(-5))];
    expect(() => computePlan(elements, [link("a", "b"), link("b", "a")], EARLY)).toThrow(PlanCycleError);
  });

  it("counts nothing for an empty plan", () => {
    expect(computePlan([], [], EARLY)).toMatchObject({ counts: { critical: 0, tight: 0, late: 0, warn: 0 } });
  });
});

describe("wouldCreateCycle", () => {
  const links = [link("a", "b"), link("b", "c"), link("c", null, 4)];

  it("detects a self link", () => {
    expect(wouldCreateCycle(links, "a", "a")).toBe(true);
  });

  it("detects a direct and an indirect link back", () => {
    expect(wouldCreateCycle(links, "b", "a")).toBe(true);
    expect(wouldCreateCycle(links, "c", "a")).toBe(true);
  });

  it("allows links in the same direction and to other elements", () => {
    expect(wouldCreateCycle(links, "a", "c")).toBe(false);
    expect(wouldCreateCycle(links, "d", "a")).toBe(false);
  });

  it("never sees a cycle with the D-Day as target", () => {
    expect(wouldCreateCycle(links, "c", null)).toBe(false);
    expect(wouldCreateCycle(links, "a", null)).toBe(false);
  });
});

describe("editing", () => {
  describe("moveElement", () => {
    const plan: PlanInput = {
      elements: [
        milestone("offset", fixedOffset(40)),
        milestone("date", fixedDate(-40)),
        task("late", 5),
        milestone("done", { done: true, doneDay: -50 }),
      ],
      links: [link("offset", null), link("date", null), link("late", null, 10), link("done", null)],
    };

    it("changes N of „fest N T vorher“", () => {
      expect(moveElement(plan, "offset", 3, EARLY)).toEqual([{ id: "offset", fixedOffsetDays: 37 }]);
    });

    it("changes the fixed date", () => {
      expect(moveElement(plan, "date", -3, EARLY)).toEqual([{ id: "date", fixedDay: -43 }]);
    });

    it("turns any other placement into „frei“", () => {
      expect(moveElement(plan, "late", -4, EARLY)).toEqual([{ id: "late", placement: "free", freeStartDay: -19 }]);
    });

    it("never moves the end after the D-Day", () => {
      expect(moveElement(plan, "late", 20, EARLY)).toEqual([{ id: "late", placement: "free", freeStartDay: -5 }]);
    });

    it("never changes a done element", () => {
      expect(moveElement(plan, "done", 3, EARLY)).toEqual([]);
    });
  });

  describe("pushing free neighbours", () => {
    // pp → p → x → s → D-Day, alap → x
    const plan: PlanInput = {
      elements: [
        milestone("pp", free(-22)),
        milestone("p", free(-20)),
        milestone("alap"),
        milestone("doneFree", { ...free(-10), done: true, doneDay: -10 }),
        milestone("x"),
        milestone("s", free(-5)),
      ],
      links: [
        link("pp", "p"),
        link("p", "x"),
        link("alap", "x"),
        link("doneFree", "x"),
        link("x", "s"),
        link("s", null),
      ],
    };

    it("pushes free predecessors transitively, never other placements or done elements", () => {
      expect(sorted(moveElement(plan, "x", -20, EARLY))).toEqual([
        { id: "p", freeStartDay: -25 },
        { id: "pp", freeStartDay: -25 },
        { id: "x", placement: "free", freeStartDay: -25 },
      ]);
    });

    it("pushes a free successor", () => {
      expect(sorted(moveElement(plan, "x", 3, EARLY))).toEqual([
        { id: "s", freeStartDay: -2 },
        { id: "x", placement: "free", freeStartDay: -2 },
      ]);
    });

    it("pushes nothing while the order holds", () => {
      expect(moveElement(plan, "x", -4, EARLY)).toEqual([{ id: "x", placement: "free", freeStartDay: -9 }]);
    });
  });

  describe("resizeFromEnd", () => {
    const plan: PlanInput = {
      elements: [task("t", 10), task("fixedTask", 10, fixedOffset(30)), milestone("m"), task("d", 3, { done: true, doneDay: -4 })],
      links: [link("t", null, 5), link("fixedTask", null), link("m", null), link("d", null)],
    };

    it("keeps the start and becomes „frei“", () => {
      const changes = resizeFromEnd(plan, "t", 3, EARLY);
      expect(changes).toEqual([{ id: "t", placement: "free", freeStartDay: -15, durationDays: 13 }]);
      expect(planned(apply(plan, changes), "t")).toMatchObject({ plannedStart: -15, plannedEnd: -2 });
    });

    it("clamps the duration to 1 and 365", () => {
      expect(resizeFromEnd(plan, "t", -50, EARLY)[0]).toMatchObject({ durationDays: 1 });
      expect(resizeFromEnd(plan, "t", 1000, EARLY)[0]).toMatchObject({ durationDays: 365 });
    });

    it("changes only the duration of a fixed task", () => {
      expect(resizeFromEnd(plan, "fixedTask", 5, EARLY)).toEqual([{ id: "fixedTask", durationDays: 15 }]);
    });

    it("returns nothing for a milestone or a done task", () => {
      expect(resizeFromEnd(plan, "m", 5, EARLY)).toEqual([]);
      expect(resizeFromEnd(plan, "d", 5, EARLY)).toEqual([]);
    });
  });

  describe("resizeFromStart", () => {
    const plan: PlanInput = {
      elements: [task("t", 10), task("fixedTask", 10, fixedOffset(30)), task("dated", 10, fixedDate(-30)), milestone("m")],
      links: [link("t", null, 5), link("fixedTask", null), link("dated", null), link("m", null)],
    };

    it("keeps the end and becomes „frei“", () => {
      const changes = resizeFromStart(plan, "t", -4, EARLY);
      expect(changes).toEqual([{ id: "t", placement: "free", freeStartDay: -19, durationDays: 14 }]);
      expect(planned(apply(plan, changes), "t")).toMatchObject({ plannedStart: -19, plannedEnd: -5 });
    });

    it("clamps the duration to 1 and 365", () => {
      expect(resizeFromStart(plan, "t", 50, EARLY)[0]).toMatchObject({ durationDays: 1, freeStartDay: -6 });
      expect(resizeFromStart(plan, "t", -1000, EARLY)[0]).toMatchObject({ durationDays: 365 });
    });

    it("keeps a fixed task fixed and its end where it is", () => {
      expect(resizeFromStart(plan, "fixedTask", 3, EARLY)).toEqual([
        { id: "fixedTask", fixedOffsetDays: 27, durationDays: 7 },
      ]);
      expect(resizeFromStart(plan, "dated", 3, EARLY)).toEqual([{ id: "dated", fixedDay: -27, durationDays: 7 }]);
    });

    it("returns nothing for a milestone", () => {
      expect(resizeFromStart(plan, "m", 5, EARLY)).toEqual([]);
    });
  });

  describe("setPlacementValues", () => {
    const plan: PlanInput = {
      elements: [task("t", 5), milestone("f", free(-30)), milestone("d", { done: true, doneDay: -3 })],
      links: [link("t", null, 10), link("f", null), link("d", null)],
    };

    it("puts „fest“ on the planned start, in both variants", () => {
      expect(setPlacementValues(plan, "t", "fixed", "offset", EARLY)).toEqual([
        { id: "t", placement: "fixed", fixedOffsetDays: 15 },
      ]);
      expect(setPlacementValues(plan, "t", "fixed", "date", EARLY)).toEqual([
        { id: "t", placement: "fixed", fixedDay: -15 },
      ]);
    });

    it("puts „frei“ on the planned start", () => {
      expect(setPlacementValues(plan, "t", "free", undefined, EARLY)).toEqual([
        { id: "t", placement: "free", freeStartDay: -15 },
      ]);
    });

    it("clears the values for „so früh“ and „so spät“", () => {
      expect(setPlacementValues(plan, "f", "asap", undefined, EARLY)).toEqual([
        { id: "f", placement: "asap", freeStartDay: null },
      ]);
      expect(setPlacementValues(plan, "f", "alap", undefined, EARLY)).toEqual([
        { id: "f", placement: "alap", freeStartDay: null },
      ]);
    });

    it("changes nothing for a done element or the same placement", () => {
      expect(setPlacementValues(plan, "d", "free", undefined, EARLY)).toEqual([]);
      expect(setPlacementValues(plan, "t", "alap", undefined, EARLY)).toEqual([]);
    });
  });
});

describe("new date of the edition", () => {
  // Stored values: fixed dates and done days are calendar days, the rest is relative.
  function plan(dDay: string) {
    const elements = [
      milestone("dated", fixedDate(dateToDay("2027-04-08", dDay))),
      milestone("offset", fixedOffset(20)),
      milestone("free", free(-15)),
      milestone("asap", { placement: "asap" }),
      milestone("alap"),
      milestone("done", { done: true, doneDay: dateToDay("2027-04-01", dDay) }),
    ];
    const links = [
      link("dated", null),
      link("offset", "asap", 2),
      link("asap", null),
      link("free", null),
      link("alap", null, 5),
      link("done", null),
    ];
    return computePlan(elements, links, dateToDay("2026-10-17", dDay));
  }

  it("keeps relative placements, fixed dates and done elements move 7 days earlier", () => {
    const before = plan("2027-05-08");
    const after = plan("2027-05-15");
    const start = (computed: ReturnType<typeof plan>, id: string) => computed.elements.get(id)!.plannedStart;
    for (const id of ["offset", "free", "asap", "alap"]) expect(start(after, id), id).toBe(start(before, id));
    for (const id of ["dated", "done"]) expect(start(after, id), id).toBe(start(before, id) - 7);
  });
});

describe("todoDueDay", () => {
  const computed = { plannedStart: -20, plannedEnd: -10 };

  it("counts back from the planned start", () => {
    expect(todoDueDay({ anchor: "start", daysBefore: 2 }, computed)).toBe(-22);
  });

  it("counts back from the planned end", () => {
    expect(todoDueDay({ anchor: "end", daysBefore: 0 }, computed)).toBe(-10);
  });

  it("uses the frozen dates of a done element", () => {
    const element = computePlan([task("t", 5, { done: true, doneDay: -10 })], [link("t", null, 30)], 0)
      .elements.get("t")!;
    expect(todoDueDay({ anchor: "start", daysBefore: 1 }, element)).toBe(-16);
    expect(todoDueDay({ anchor: "end", daysBefore: 0 }, element)).toBe(-10);
  });
});

describe("KP27 example plan", () => {
  function kp27(dDay: string) {
    const elements: PlanElementInput[] = TEST_PLAN.map((element, index) => ({
      id: element.name,
      name: element.name,
      kind: element.kind,
      durationDays: element.durationDays ?? 0,
      placement: element.placement ?? (element.fixedDate ? "fixed" : "alap"),
      fixedDay: element.fixedDate ? dateToDay(element.fixedDate, dDay) : null,
      fixedOffsetDays: null,
      freeStartDay: element.freeStartDay ?? null,
      done: false,
      doneDay: null,
      wobbly: element.wobbly ?? false,
      sortOrder: index + 1,
    }));
    const links = TEST_PLAN.flatMap((element) =>
      element.next.map((next) => link(element.name, next.to, next.lag))
    );
    return computePlan(elements, links, dateToDay("2026-10-15", dDay));
  }

  const D_DAY = "2027-05-08";
  const plan = kp27(D_DAY);
  const start = (name: string) => dayToDate(plan.elements.get(name)!.plannedStart, D_DAY);

  it("places the milestones on their dates", () => {
    expect(plan.elements.get("Voranmeldung geöffnet")!.plannedStart).toBe(-138);
    expect(start("Voranmeldung geöffnet")).toBe("2026-12-21");
    expect(plan.elements.get("Finale Zusage an Kollektive")!.plannedStart).toBe(-80);
    expect(start("Finale Zusage an Kollektive")).toBe("2027-02-17");
  });

  it("shows the fixed meeting with KVR/Polizei 2 days too late", () => {
    expect(plan.elements.get("Kooperationsgespräch KVR/Polizei")).toMatchObject({
      buffer: -2,
      status: "late",
      reason: "fixed_too_late",
    });
    expect(start("Kooperationsgespräch KVR/Polizei")).toBe("2027-04-08");
  });

  it("keeps the earlier dates of the free elements and the wobbly order as warn", () => {
    expect(plan.elements.get("Social-Media-Plan")).toMatchObject({ plannedStart: -90, buffer: 10 });
    expect(plan.elements.get("Teaser veröffentlicht")).toMatchObject({ plannedStart: -26, buffer: 5 });
    expect(plan.elements.get("T-Shirts bestellt")!.status).toBe("warn");
  });
});
