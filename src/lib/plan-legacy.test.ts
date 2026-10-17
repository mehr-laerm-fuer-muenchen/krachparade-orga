import { describe, expect, it } from "vitest";
import type { PlanLinkInput } from "./plan-engine";
import { legacyPlannedStart, legacyToPlacement, type LegacyElement } from "./plan-legacy";

const EARLY = -1000;

let nextSortOrder = 1;
function milestone(id: string, extra: Partial<LegacyElement> = {}): LegacyElement {
  return {
    id,
    name: id,
    kind: "milestone",
    durationDays: 0,
    shiftDays: 0,
    fixedDay: null,
    done: false,
    doneDay: null,
    wobbly: false,
    sortOrder: nextSortOrder++,
    ...extra,
  };
}
function link(fromId: string, toId: string | null, lagDays = 0): PlanLinkInput {
  return { fromId, toId, lagDays };
}

/** The result as id → [placement, freeStartDay, reason]. */
function placements(result: ReturnType<typeof legacyToPlacement>) {
  return Object.fromEntries(result.elements.map((element) => [element.id, [element.placement, element.freeStartDay, element.reason]]));
}

describe("legacyPlannedStart", () => {
  it("computes the old model: latest date, fixed successors, shifts", () => {
    const elements = [
      milestone("a"),
      milestone("fix", { fixedDay: -40 }),
      { ...milestone("t", { kind: "task", durationDays: 5 }), shiftDays: -3 },
    ];
    const starts = legacyPlannedStart(elements, [link("a", "fix", 5), link("fix", "t"), link("t", null, 10)]);
    expect(starts).toEqual(new Map([["a", -45], ["fix", -40], ["t", -18]]));
  });
});

describe("legacyToPlacement", () => {
  it("keeps a fixed date as „fest“", () => {
    const result = legacyToPlacement([milestone("fix", { fixedDay: -30 })], [link("fix", null, 10)], EARLY);
    expect(result.elements[0]).toMatchObject({ placement: "fixed", fixedDay: -30, oldStart: -30, newStart: -30 });
  });

  it("makes a shifted element and its shifted predecessors free on the same dates", () => {
    const elements = [milestone("p", { shiftDays: -4 }), milestone("s", { shiftDays: -4 })];
    const result = legacyToPlacement(elements, [link("p", "s", 2), link("s", null, 10)], EARLY);
    expect(placements(result)).toEqual({ p: ["free", -16, "shift"], s: ["free", -14, "shift"] });
    for (const element of result.elements) expect(element.newStart).toBe(element.oldStart);
  });

  it("makes an unshifted predecessor of an earlier element free on its old date", () => {
    // Old model: p stays on the latest date from s (−12), although s lies earlier (−20).
    const elements = [milestone("p"), milestone("s", { shiftDays: -10 }), milestone("q")];
    const result = legacyToPlacement(elements, [link("p", "s", 2), link("s", null, 10), link("q", null, 3)], EARLY);
    expect(placements(result)).toEqual({
      p: ["free", -12, "follow"],
      s: ["free", -20, "shift"],
      q: ["alap", null, "default"],
    });
    for (const element of result.elements) expect(element.newStart).toBe(element.oldStart);
  });

  it("puts done elements on the day they were ticked off and lists them", () => {
    const elements = [milestone("d", { done: true, doneDay: -15 }), milestone("before")];
    const result = legacyToPlacement(elements, [link("before", "d", 1), link("d", null, 10)], -12);
    expect(result.doneMoved).toEqual([{ id: "d", oldStart: -10, newStart: -15 }]);
    // The open predecessor keeps its old date.
    expect(placements(result).before).toEqual(["free", -11, "follow"]);
    expect(result.elements.find((element) => element.id === "before")!.newStart).toBe(-11);
  });

  it("changes nothing in a second run", () => {
    const elements = [milestone("p"), milestone("s", { shiftDays: -10 })];
    const links = [link("p", "s", 2), link("s", null, 10)];
    const first = legacyToPlacement(elements, links, EARLY);
    const second = legacyToPlacement(elements, links, EARLY);
    expect(second).toEqual(first);
  });
});
