import { describe, expect, it } from "vitest";
import { applyChanges, dragChanges, dragDays, isDrag, previewPlan } from "./plan-drag";
import type { PlanElementInput, PlanInput } from "./plan-engine";

function element(id: string, extra: Partial<PlanElementInput> = {}): PlanElementInput {
  return {
    id,
    kind: "task",
    durationDays: 10,
    shiftDays: 0,
    fixedDay: null,
    done: false,
    wobbly: false,
    sortOrder: 1,
    ...extra,
  };
}

// C (5 T) → B (milestone) → A (10 T) → D-Day with 40 T.
const PLAN: PlanInput = {
  elements: [element("a"), element("b", { kind: "milestone", durationDays: 0 }), element("c", { durationDays: 5 })],
  links: [
    { fromId: "a", toId: null, lagDays: 40 },
    { fromId: "b", toId: "a", lagDays: 0 },
    { fromId: "c", toId: "b", lagDays: 3 },
  ],
};

describe("isDrag / dragDays", () => {
  it("counts presses below 4 px as clicks", () => {
    expect(isDrag(3, -3)).toBe(false);
    expect(isDrag(4, 0)).toBe(true);
    expect(isDrag(0, -4)).toBe(true);
  });

  it("rounds to whole days at the zoom", () => {
    expect(dragDays(30, 6)).toBe(5);
    expect(dragDays(-8, 6)).toBe(-1);
    expect(dragDays(2, 6)).toBe(0);
    expect(Object.is(dragDays(-1, 6), 0)).toBe(true);
  });
});

describe("previewPlan", () => {
  it("moves an element with its predecessors", () => {
    const before = previewPlan(PLAN, [], -1000)!;
    const after = previewPlan(PLAN, dragChanges(PLAN, "a", "move", 5), -1000)!;
    expect(after.get("a")!.start).toBe(before.get("a")!.start + 5);
    expect(after.get("a")!.buffer).toBe(-5);
    expect(after.get("b")!.start).toBe(before.get("b")!.start + 5);
    expect(after.get("c")!.start).toBe(before.get("c")!.start + 5);
  });

  it("keeps the start when the end is dragged and the end when the start is dragged", () => {
    const before = previewPlan(PLAN, [], -1000)!.get("a")!;
    const end = previewPlan(PLAN, dragChanges(PLAN, "a", "end", 4), -1000)!.get("a")!;
    expect(end.start).toBe(before.start);
    expect(end.end).toBe(before.end + 4);
    const start = previewPlan(PLAN, dragChanges(PLAN, "a", "start", -3), -1000)!.get("a")!;
    expect(start.end).toBe(before.end);
    expect(start.start).toBe(before.start - 3);
  });

  it("has no handles for milestones", () => {
    expect(dragChanges(PLAN, "b", "end", 3)).toEqual([]);
  });

  it("returns null for a plan with a cycle", () => {
    const cyclic = { ...PLAN, links: [...PLAN.links, { fromId: "a", toId: "c", lagDays: 0 }] };
    expect(previewPlan(cyclic, [], 0)).toBeNull();
  });
});

describe("applyChanges", () => {
  it("changes only the given values", () => {
    const [a, b] = applyChanges(PLAN.elements, [{ id: "a", durationDays: 12 }]);
    expect(a).toMatchObject({ durationDays: 12, shiftDays: 0, fixedDay: null });
    expect(b).toBe(PLAN.elements[1]);
  });
});
