import { describe, expect, it } from "vitest";
import { TEST_PLAN } from "../db/seed";
import { dateToDay, dayToDate } from "./plan-days";
import {
  computePlan,
  moveElement,
  PlanCycleError,
  resizeFromEnd,
  resizeFromStart,
  todoDueDay,
  wouldCreateCycle,
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
    kind: "milestone",
    durationDays: 0,
    shiftDays: 0,
    fixedDay: null,
    done: false,
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

  it("moves all predecessors earlier when a task gets longer, successors stay", () => {
    const elements = [milestone("a"), task("b", 10), milestone("c")];
    const links = [link("a", "b", 2), link("b", "c", 3), link("c", null, 5)];
    const before = computePlan(elements, links, EARLY);
    const after = computePlan(
      elements.map((element) => (element.id === "b" ? { ...element, durationDays: 17 } : element)),
      links,
      EARLY
    );
    expect(after.elements.get("a")!.latestStart).toBe(before.elements.get("a")!.latestStart - 7);
    expect(after.elements.get("b")!.latestStart).toBe(before.elements.get("b")!.latestStart - 7);
    expect(after.elements.get("b")!.latestFinish).toBe(before.elements.get("b")!.latestFinish);
    expect(after.elements.get("c")).toEqual(before.elements.get("c"));
  });

  it("takes the earliest of several successors", () => {
    const elements = [milestone("a"), milestone("b"), milestone("c")];
    const links = [link("a", "b", 0), link("a", "c", 0), link("b", null, 10), link("c", null, 30)];
    expect(computePlan(elements, links, EARLY).elements.get("a")!.latestFinish).toBe(-30);
  });

  it("schedules predecessors from a fixed date that is too late", () => {
    const elements = [milestone("before"), milestone("fix", { fixedDay: -8 }), milestone("after")];
    const links = [link("before", "fix", 5), link("fix", "after", 0), link("after", null, 10)];
    const plan = computePlan(elements, links, EARLY);
    expect(plan.elements.get("fix")).toMatchObject({
      latestStart: -10,
      plannedStart: -8,
      buffer: -2,
      status: "late",
      reason: "fixed_too_late",
    });
    expect(plan.elements.get("before")).toMatchObject({ latestFinish: -13, plannedStart: -13, buffer: 0 });
  });

  it("turns a negative shift into buffer and a positive shift into delay", () => {
    const early = computePlan([milestone("m", { shiftDays: -10 })], [link("m", null, 20)], EARLY);
    expect(early.elements.get("m")).toMatchObject({ plannedStart: -30, buffer: 10, status: "ok" });
    const late = computePlan([milestone("m", { shiftDays: 3 })], [link("m", null, 20)], EARLY);
    expect(late.elements.get("m")).toMatchObject({
      plannedStart: -17,
      buffer: -3,
      status: "late",
      reason: "negative_buffer",
    });
  });

  describe("status", () => {
    const run = (extra: Partial<PlanElementInput>, today: number) =>
      computePlan([task("t", 5, extra)], [link("t", null, 10)], today).elements.get("t")!;

    it("is overdue when the planned end was yesterday", () => {
      expect(run({}, -9)).toMatchObject({ plannedEnd: -10, status: "late", reason: "overdue" });
    });

    it("is not overdue when the planned end is today", () => {
      expect(run({}, -10)).toMatchObject({ status: "ok", reason: "ok" });
    });

    it("lets done win over everything", () => {
      expect(run({ done: true, shiftDays: 4, wobbly: true }, 0)).toMatchObject({ status: "done", reason: "done" });
    });

    it("shows wobbly as warn, but late goes first", () => {
      expect(run({ wobbly: true }, EARLY)).toMatchObject({ status: "warn", reason: "wobbly" });
      expect(run({ wobbly: true }, 0)).toMatchObject({ status: "late", reason: "overdue" });
      expect(run({ wobbly: true, shiftDays: 1 }, EARLY)).toMatchObject({ status: "late", reason: "negative_buffer" });
    });
  });

  it("throws PlanCycleError for a cycle", () => {
    const elements = [milestone("a"), milestone("b"), milestone("c")];
    expect(() => computePlan(elements, [link("a", "b"), link("b", "c"), link("c", "a")], EARLY)).toThrow(
      PlanCycleError
    );
  });

  it("throws PlanCycleError for a cycle through a fixed date", () => {
    const elements = [milestone("a"), milestone("b", { fixedDay: -5 })];
    expect(() => computePlan(elements, [link("a", "b"), link("b", "a")], EARLY)).toThrow(PlanCycleError);
  });

  it("returns an empty critical path for an empty plan", () => {
    expect(computePlan([], [], EARLY)).toMatchObject({ criticalPath: [], latestProjectStart: 0 });
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
  // first → second → fix (fixed) → target → D-Day; pre → target
  const plan: PlanInput = {
    elements: [
      milestone("first", { shiftDays: 1 }),
      milestone("second"),
      milestone("fix", { fixedDay: -40 }),
      milestone("pre"),
      task("target", 10, { shiftDays: -2 }),
      task("fixedTask", 10, { fixedDay: -30 }),
      milestone("tail"),
    ],
    links: [
      link("first", "second", 3),
      link("second", "fix", 0),
      link("fix", "target", 0),
      link("pre", "target", 0),
      link("target", null, 5),
      link("fixedTask", "tail", 0),
      link("tail", null, 0),
    ],
  };
  const sorted = <T extends { id: string }>(changes: T[]) => [...changes].sort((a, b) => a.id.localeCompare(b.id));
  const planned = (input: PlanInput, id: string) =>
    computePlan(input.elements, input.links, EARLY).elements.get(id)!;
  const apply = (input: PlanInput, changes: ReturnType<typeof moveElement>): PlanInput => ({
    ...input,
    elements: input.elements.map((element) => ({ ...element, ...changes.find((change) => change.id === element.id) })),
  });

  describe("moveElement", () => {
    it("moves the element and its predecessors, but not a fixed predecessor or what lies before it", () => {
      expect(sorted(moveElement(plan, "target", 4))).toEqual([
        { id: "pre", shiftDays: 4 },
        { id: "target", shiftDays: 2 },
      ]);
    });

    it("moves only the fixed date of a fixed element", () => {
      expect(moveElement(plan, "fix", -3)).toEqual([{ id: "fix", fixedDay: -43 }]);
    });

    it("keeps planned distances between moved elements", () => {
      const moved = apply(plan, moveElement(plan, "second", -6));
      expect(planned(moved, "second").plannedStart).toBe(planned(plan, "second").plannedStart - 6);
      expect(planned(moved, "first").plannedStart).toBe(planned(plan, "first").plannedStart - 6);
    });
  });

  describe("resizeFromEnd", () => {
    it("keeps the start and moves the predecessors along", () => {
      const changes = resizeFromEnd(plan, "target", 3);
      expect(sorted(changes)).toEqual([
        { id: "pre", shiftDays: 3 },
        { id: "target", shiftDays: 1, durationDays: 13 },
      ]);
      const resized = apply(plan, changes);
      expect(planned(resized, "target").plannedStart).toBe(planned(plan, "target").plannedStart);
      expect(planned(resized, "target").plannedEnd).toBe(planned(plan, "target").plannedEnd + 3);
      expect(planned(resized, "pre").plannedStart).toBe(planned(plan, "pre").plannedStart);
    });

    it("clamps the duration to 1 and 365", () => {
      expect(resizeFromEnd(plan, "target", -50)).toContainEqual({ id: "target", shiftDays: -11, durationDays: 1 });
      expect(resizeFromEnd(plan, "target", 1000)).toContainEqual({
        id: "target",
        shiftDays: 353,
        durationDays: 365,
      });
    });

    it("changes only the duration of a fixed task", () => {
      expect(resizeFromEnd(plan, "fixedTask", 5)).toEqual([{ id: "fixedTask", durationDays: 15 }]);
    });

    it("returns nothing for a milestone", () => {
      expect(resizeFromEnd(plan, "second", 5)).toEqual([]);
    });
  });

  describe("resizeFromStart", () => {
    it("keeps the end, shift stays the same", () => {
      const changes = resizeFromStart(plan, "target", -4);
      expect(changes).toEqual([{ id: "target", durationDays: 14 }]);
      const resized = apply(plan, changes);
      expect(planned(resized, "target").plannedEnd).toBe(planned(plan, "target").plannedEnd);
      expect(planned(resized, "target").plannedStart).toBe(planned(plan, "target").plannedStart - 4);
    });

    it("clamps the duration to 1 and 365", () => {
      expect(resizeFromStart(plan, "target", 50)).toEqual([{ id: "target", durationDays: 1 }]);
      expect(resizeFromStart(plan, "target", -1000)).toEqual([{ id: "target", durationDays: 365 }]);
    });

    it("moves the fixed date of a fixed task so its end stays", () => {
      const changes = resizeFromStart(plan, "fixedTask", 3);
      expect(changes).toEqual([{ id: "fixedTask", durationDays: 7, fixedDay: -27 }]);
      expect(planned(apply(plan, changes), "fixedTask").plannedEnd).toBe(planned(plan, "fixedTask").plannedEnd);
    });

    it("returns nothing for a milestone", () => {
      expect(resizeFromStart(plan, "second", 5)).toEqual([]);
    });
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
});

describe("KP27 example plan", () => {
  function kp27(dDay: string) {
    const elements: PlanElementInput[] = TEST_PLAN.map((element, index) => ({
      id: element.name,
      kind: element.kind,
      durationDays: element.durationDays ?? 0,
      shiftDays: element.shiftDays ?? 0,
      fixedDay: element.fixedDate ? dateToDay(element.fixedDate, dDay) : null,
      done: false,
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

  it("finds the critical path", () => {
    expect(plan.criticalPath).toEqual([
      "Budget KP27 beschlossen",
      "Voranmeldung geöffnet",
      "Vortreffen Kollektive",
      "Anmeldung offen",
      "Auswahlkommission",
      "Finale Zusage an Kollektive",
      "Zahlungsfrist Kollektive",
    ]);
    expect(plan.latestProjectStart).toBe(-150);
    expect(dayToDate(plan.latestProjectStart, D_DAY)).toBe("2026-12-09");
  });

  it("shows shifts as buffer and the wobbly order as warn", () => {
    expect(plan.elements.get("Social-Media-Plan")!.buffer).toBe(10);
    expect(plan.elements.get("Teaser veröffentlicht")!.buffer).toBe(5);
    expect(plan.elements.get("T-Shirts bestellt")!.status).toBe("warn");
  });

  it("moves everything relative with a new D-Day, fixed dates stay absolute", () => {
    const later = kp27("2027-05-15");
    // The fixed date and everything scheduled from it lie 7 days earlier relative to the D-Day.
    const fromFixed = [
      "Kooperationsgespräch KVR/Polizei",
      "Versammlungsanzeige beim KVR",
      "Route & Aufstellung ausarbeiten",
    ];
    for (const [id, element] of plan.elements) {
      const moved = later.elements.get(id)!;
      expect(moved.plannedStart).toBe(element.plannedStart - (fromFixed.includes(id) ? 7 : 0));
    }
    expect(later.elements.get("Kooperationsgespräch KVR/Polizei")!.buffer).toBe(5);
    expect(dayToDate(later.elements.get("Kooperationsgespräch KVR/Polizei")!.plannedStart, "2027-05-15")).toBe(
      "2027-04-08"
    );
    expect(later.elements.get("Voranmeldung geöffnet")!.plannedStart).toBe(-138);
  });
});
