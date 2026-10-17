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
  placement: "alap",
  fixedOffsetDays: null,
  fixedDate: null,
  freeStartDay: null,
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

function summaries(
  after: Partial<ElementSnapshot>,
  before: Partial<ElementSnapshot> = {},
  options: { movedWith?: string; previousStart?: number } = {}
) {
  return changeSummaries({ ...BASE, ...before }, { ...BASE, ...after }, NAMES, options);
}

const FREE = { placement: "free" as const };
const offset = (days: number) => ({ placement: "fixed" as const, fixedOffsetDays: days });
const dated = (date: string) => ({ placement: "fixed" as const, fixedDate: date });

describe("changeSummaries", () => {
  it("reports a new element", () => {
    expect(changeSummaries(null, BASE, NAMES)).toEqual(["Angelegt"]);
  });

  it("reports nothing without a change", () => {
    expect(summaries({})).toEqual([]);
  });

  it("reports every change of the placement with its names", () => {
    const names = {
      fixed: "Fest",
      asap: "So früh wie möglich",
      alap: "So spät wie möglich",
      free: "Frei im Fenster",
    } as const;
    for (const from of ["asap", "alap", "free"] as const) {
      for (const to of ["asap", "alap", "free"] as const) {
        if (from === to) continue;
        const values = (placement: typeof from) => ({ placement, freeStartDay: placement === "free" ? -30 : null });
        expect(summaries(values(to), values(from))).toEqual([`Lage: ${names[from]} → ${names[to]}`]);
      }
    }
    expect(summaries({ placement: "alap" }, offset(60))).toEqual(["Lage: Fest → So spät wie möglich"]);
  });

  it("reports fixed values", () => {
    expect(summaries(offset(60))).toEqual(["Lage: So spät wie möglich → Fest", "Fest: 60 T vor der Krachparade"]);
    expect(summaries(dated("2027-04-08"))).toEqual([
      "Lage: So spät wie möglich → Fest",
      "Festes Datum: Do 08.04.2027",
    ]);
    expect(summaries(offset(55), offset(60))).toEqual(["Fest: 60 → 55 T vor der Krachparade"]);
    expect(summaries(dated("2027-04-12"), dated("2027-04-08"))).toEqual([
      "Festes Datum: Do 08.04. → Mo 12.04.2027",
    ]);
    expect(summaries(dated("2027-04-08"), offset(30))).toEqual(["Festes Datum: Do 08.04.2027"]);
    expect(summaries(offset(30), dated("2027-04-08"))).toEqual(["Fest: 30 T vor der Krachparade"]);
  });

  it("reports a move that makes the element free", () => {
    expect(summaries({ ...FREE, freeStartDay: -27 }, {}, { previousStart: -30 })).toEqual([
      "Verschoben um +3 T (Lage jetzt Frei im Fenster)",
    ]);
  });

  it("reports moves of a free element with a sign", () => {
    expect(summaries({ ...FREE, freeStartDay: -27 }, { ...FREE, freeStartDay: -30 })).toEqual(["Verschoben um +3 T"]);
    expect(summaries({ ...FREE, freeStartDay: -33 }, { ...FREE, freeStartDay: -30 })).toEqual(["Verschoben um −3 T"]);
  });

  it("reports free neighbours pushed along", () => {
    expect(
      summaries({ ...FREE, freeStartDay: -27 }, { ...FREE, freeStartDay: -30 }, { movedWith: "Finaler Crosscheck" })
    ).toEqual(["Mitgeschoben um +3 T (mit Finaler Crosscheck)"]);
  });

  it("reports a new duration without the move that keeps the end", () => {
    expect(summaries({ ...FREE, durationDays: 28, freeStartDay: -37 }, { ...FREE, freeStartDay: -30 })).toEqual([
      "Dauer 21 → 28 Tage",
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
      "Vorgänger verbunden: Anmeldung offen (mind. 0 T)",
    ]);
    expect(summaries({ successors: [] }, { successors: [{ id: null, lagDays: 0 }] })).toEqual([
      "Nachfolger gelöst: Krachparade",
    ]);
    expect(summaries({ successors: [{ id: "e2", lagDays: 10 }] }, { successors: [{ id: "e2", lagDays: 15 }] })).toEqual(
      ["Mindestabstand zu Finaler Crosscheck: 15 → 10 T"]
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
