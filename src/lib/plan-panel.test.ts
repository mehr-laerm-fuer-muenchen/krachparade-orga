import { describe, expect, it } from "vitest";
import { defaultGroupId, predecessorCandidates, reasonText, successorCandidates } from "./plan-panel";

const ELEMENTS = [
  { id: "a", name: "A" },
  { id: "b", name: "B" },
  { id: "c", name: "C" },
  { id: "d", name: "D" },
];
// C → B → A → D-Day; D unconnected.
const LINKS = [
  { fromId: "a", toId: null, lagDays: 40 },
  { fromId: "b", toId: "a", lagDays: 0 },
  { fromId: "c", toId: "b", lagDays: 3 },
];

describe("reasonText", () => {
  it("explains the status", () => {
    expect(reasonText({ reason: "fixed_too_late", buffer: -3 })).toBe(
      "Fixtermin liegt 3 Tage zu spät für die Nachfolger."
    );
    expect(reasonText({ reason: "too_late", buffer: -1 })).toBe("Zu spät geplant: 1 Tag nach dem spätesten Termin.");
    expect(reasonText({ reason: "too_early", buffer: 4 })).toBe("Zu früh geplant: liegt vor dem frühesten Termin.");
    expect(reasonText({ reason: "ok", buffer: 2 })).toBe("Im Plan.");
  });
});

describe("link candidates", () => {
  it("leaves out linked elements and cycles for predecessors", () => {
    // A and B depend on C already: as predecessors of C they would close a cycle.
    expect(predecessorCandidates(ELEMENTS, LINKS, "c").map((item) => item.id)).toEqual(["d"]);
    expect(predecessorCandidates(ELEMENTS, LINKS, "a").map((item) => item.id)).toEqual(["c", "d"]);
  });

  it("offers the D-Day only when it is not linked yet", () => {
    expect(successorCandidates(ELEMENTS, LINKS, "a").map((item) => item.id)).toEqual(["d"]);
    expect(successorCandidates(ELEMENTS, LINKS, "c").map((item) => item.id)).toEqual([null, "a", "d"]);
    expect(successorCandidates(ELEMENTS, LINKS, "a").some((item) => item.id === "c")).toBe(false);
  });
});

describe("defaultGroupId", () => {
  const groups = [{ id: "g1" }, { id: "g2" }, { id: "g3" }];
  it("prefers the selected element's group, then an own one, then the first", () => {
    expect(defaultGroupId(groups, "g3", ["g2"])).toBe("g3");
    expect(defaultGroupId(groups, null, ["g2"])).toBe("g2");
    expect(defaultGroupId(groups, undefined, [])).toBe("g1");
    expect(defaultGroupId([], null, [])).toBeNull();
  });
});
