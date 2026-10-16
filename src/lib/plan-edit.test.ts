import { describe, expect, it } from "vitest";
import {
  changeSummaries,
  formatDateWithWeekday,
  reconnectOnDelete,
  reconnectSummary,
  snapshotOf,
  type EditLink,
  type ElementSnapshot,
} from "./plan-edit";

function link(id: string, fromId: string, toId: string | null, lagDays = 0): EditLink {
  return { id, fromId, toId, lagDays };
}

describe("reconnectOnDelete", () => {
  it("links predecessor and successor 1:1 with lag a + duration + b", () => {
    const links = [link("l1", "p", "x", 2), link("l2", "x", "s", 3), link("l3", "s", null, 0)];
    const result = reconnectOnDelete(links, { id: "x", durationDays: 10 });
    expect(result.create).toEqual([{ fromId: "p", toId: "s", lagDays: 15 }]);
    expect(result.update).toEqual([]);
    expect(result.remove.map((item) => item.id)).toEqual(["l1", "l2"]);
  });

  it("links every predecessor with every successor (2:2)", () => {
    const links = [
      link("l1", "p1", "x", 1),
      link("l2", "p2", "x", 2),
      link("l3", "x", "s1", 10),
      link("l4", "x", "s2", 20),
    ];
    const result = reconnectOnDelete(links, { id: "x", durationDays: 5 });
    expect(result.create).toEqual([
      { fromId: "p1", toId: "s1", lagDays: 16 },
      { fromId: "p1", toId: "s2", lagDays: 26 },
      { fromId: "p2", toId: "s1", lagDays: 17 },
      { fromId: "p2", toId: "s2", lagDays: 27 },
    ]);
    expect(result.remove).toHaveLength(4);
  });

  it("keeps the larger lag of an existing link", () => {
    const links = [
      link("l1", "p1", "x", 0),
      link("l2", "p2", "x", 0),
      link("l3", "x", "s", 0),
      link("l4", "p1", "s", 2),
      link("l5", "p2", "s", 30),
    ];
    const result = reconnectOnDelete(links, { id: "x", durationDays: 7 });
    expect(result.create).toEqual([]);
    expect(result.update).toEqual([{ id: "l4", lagDays: 7 }]);
  });

  it("reconnects to the D-Day", () => {
    const links = [link("l1", "p", "x", 4), link("l2", "x", null, 40)];
    const result = reconnectOnDelete(links, { id: "x", durationDays: 10 });
    expect(result.create).toEqual([{ fromId: "p", toId: null, lagDays: 54 }]);
  });

  it("uses duration 0 for a milestone", () => {
    const links = [link("l1", "c", "b", 3), link("l2", "b", "a", 0)];
    const result = reconnectOnDelete(links, { id: "b", durationDays: 0 });
    expect(result.create).toEqual([{ fromId: "c", toId: "a", lagDays: 3 }]);
  });

  it("creates nothing without predecessors or successors", () => {
    const links = [link("l1", "x", null, 0), link("l2", "y", null, 0)];
    const result = reconnectOnDelete(links, { id: "x", durationDays: 3 });
    expect(result).toEqual({ remove: [links[0]], create: [], update: [] });
  });
});

const BASE: ElementSnapshot = {
  name: "Anmeldung offen",
  kind: "task",
  durationDays: 21,
  shiftDays: 0,
  fixedDate: null,
  done: false,
  wobbly: false,
  workingGroupId: null,
  departmentId: null,
  ownerId: null,
  predecessors: [],
  successors: [],
};

const NAMES = new Map([
  ["g1", "Programm"],
  ["g2", "Finanzen"],
  ["d1", "Route"],
  ["m1", "Kim Brenner"],
  ["e1", "Anmeldung offen"],
  ["e2", "Finaler Crosscheck"],
]);

function summaries(after: Partial<ElementSnapshot>, before: Partial<ElementSnapshot> = {}, movedWith?: string) {
  return changeSummaries({ ...BASE, ...before }, { ...BASE, ...after }, NAMES, { movedWith });
}

describe("changeSummaries", () => {
  it("reports a new element", () => {
    expect(changeSummaries(null, BASE, NAMES)).toEqual(["Angelegt"]);
  });

  it("reports nothing without a change", () => {
    expect(summaries({})).toEqual([]);
  });

  it("reports moves with a sign", () => {
    expect(summaries({ shiftDays: 3 })).toEqual(["Verschoben um +3 T"]);
    expect(summaries({ shiftDays: -3 })).toEqual(["Verschoben um −3 T"]);
    expect(summaries({ shiftDays: 2 }, { shiftDays: 5 })).toEqual(["Verschoben um −3 T"]);
  });

  it("reports predecessors moved along", () => {
    expect(summaries({ shiftDays: 3 }, {}, "Finaler Crosscheck")).toEqual([
      "Mitverschoben um +3 T (mit Finaler Crosscheck)",
    ]);
    expect(summaries({ shiftDays: -2 }, {}, "X")).toEqual(["Mitverschoben um −2 T (mit X)"]);
  });

  it("reports a moved fixed date as a move", () => {
    expect(summaries({ fixedDate: "2027-04-11" }, { fixedDate: "2027-04-08" })).toEqual(["Verschoben um +3 T"]);
  });

  it("reports a new duration without the shift that keeps the start", () => {
    expect(summaries({ durationDays: 28, shiftDays: 7 })).toEqual(["Dauer 21 → 28 Tage"]);
  });

  it("reports fixed dates", () => {
    expect(summaries({ fixedDate: "2027-04-08" })).toEqual(["Fixtermin gesetzt: Do 08.04.2027"]);
    expect(summaries({ fixedDate: null, shiftDays: 0 }, { fixedDate: "2027-04-08", shiftDays: 4 })).toEqual([
      "Fixtermin entfernt",
    ]);
  });

  it("reports status changes", () => {
    expect(summaries({ done: true })).toEqual(["Erreicht"]);
    expect(summaries({ done: false }, { done: true })).toEqual(["Wieder offen"]);
    expect(summaries({ wobbly: true })).toEqual(["Wackelt"]);
    expect(summaries({ wobbly: false }, { wobbly: true })).toEqual(["Wackelt nicht mehr"]);
  });

  it("reports name, kind, working group, department and owner", () => {
    expect(summaries({ name: "Neu" })).toEqual(["Name geändert"]);
    expect(summaries({ kind: "task", durationDays: 7 }, { kind: "milestone", durationDays: 0 })).toEqual([
      "Meilenstein → Vorgang",
    ]);
    expect(summaries({ workingGroupId: "g2" }, { workingGroupId: "g1" })).toEqual(["AK: Programm → Finanzen"]);
    expect(summaries({ departmentId: "d1" })).toEqual(["Aufgabenbereich: Route"]);
    expect(summaries({ departmentId: null }, { departmentId: "d1" })).toEqual(["Aufgabenbereich entfernt"]);
    expect(summaries({ ownerId: "m1" })).toEqual(["Verantwortlich: Kim Brenner"]);
  });

  it("reports links", () => {
    expect(summaries({ predecessors: [{ id: "e1", lagDays: 0 }] })).toEqual([
      "Vorgänger verbunden: Anmeldung offen (0 T)",
    ]);
    expect(summaries({ successors: [] }, { successors: [{ id: null, lagDays: 0 }] })).toEqual([
      "Nachfolger gelöst: Krachparade",
    ]);
    expect(summaries({ successors: [{ id: "e2", lagDays: 10 }] }, { successors: [{ id: "e2", lagDays: 15 }] })).toEqual(
      ["Abstand zu Finaler Crosscheck: 15 → 10 T"]
    );
  });

  it("keeps texts within 300 characters", () => {
    const long = "x".repeat(400);
    const [text] = changeSummaries(BASE, BASE, NAMES).concat(reconnectSummary(long));
    expect(text.length).toBe(300);
  });
});

describe("snapshotOf", () => {
  it("splits links into predecessors and successors", () => {
    const { predecessors, successors } = snapshotOf({ ...BASE, id: "x" }, [
      { fromId: "p", toId: "x", lagDays: 1 },
      { fromId: "x", toId: null, lagDays: 2 },
      { fromId: "y", toId: null, lagDays: 3 },
    ]);
    expect(predecessors).toEqual([{ id: "p", lagDays: 1 }]);
    expect(successors).toEqual([{ id: null, lagDays: 2 }]);
  });
});

describe("formatDateWithWeekday", () => {
  it("adds weekday and year", () => {
    expect(formatDateWithWeekday("2027-05-08")).toBe("Sa 08.05.2027");
  });
});
