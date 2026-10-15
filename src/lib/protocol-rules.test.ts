import { describe, expect, it } from "vitest";
import {
  canDeleteMeeting,
  filterDecisions,
  filterTodos,
  groupByTopic,
  isOverdue,
  sortTodos,
  WITHOUT_ACCOUNT,
} from "./protocol-rules";

describe("isOverdue", () => {
  const todo = (dueDate: string | null, done = false) => ({ kind: "todo", done, dueDate });

  it("marks open to-dos due before today", () => {
    expect(isOverdue(todo("2026-10-13"), "2026-10-14")).toBe(true);
  });

  it("is not overdue on or before the due date", () => {
    expect(isOverdue(todo("2026-10-14"), "2026-10-14")).toBe(false);
    expect(isOverdue(todo("2026-10-15"), "2026-10-14")).toBe(false);
  });

  it("ignores done to-dos, to-dos without date and other kinds", () => {
    expect(isOverdue(todo("2026-10-13", true), "2026-10-14")).toBe(false);
    expect(isOverdue(todo(null), "2026-10-14")).toBe(false);
    expect(isOverdue({ kind: "info", done: false, dueDate: "2026-10-13" }, "2026-10-14")).toBe(false);
  });

  it("works across the turn of the year", () => {
    expect(isOverdue(todo("2026-12-31"), "2027-01-01")).toBe(true);
  });
});

describe("canDeleteMeeting", () => {
  const meeting = { createdBy: "creator" };

  it("allows admins", () => {
    expect(canDeleteMeeting({ id: "admin", active: true, isAdmin: true }, meeting)).toBe(true);
  });

  it("allows the creator", () => {
    expect(canDeleteMeeting({ id: "creator", active: true, isAdmin: false }, meeting)).toBe(true);
  });

  it("refuses other members", () => {
    expect(canDeleteMeeting({ id: "other", active: true, isAdmin: false }, meeting)).toBe(false);
  });

  it("refuses deactivated admins and creators", () => {
    expect(canDeleteMeeting({ id: "admin", active: false, isAdmin: true }, meeting)).toBe(false);
    expect(canDeleteMeeting({ id: "creator", active: false, isAdmin: false }, meeting)).toBe(false);
  });

  it("refuses a missing actor", () => {
    expect(canDeleteMeeting(undefined, meeting)).toBe(false);
  });
});

describe("sortTodos", () => {
  it("sorts by due date, without date last, then by creation time", () => {
    const items = [
      { id: "none-late", dueDate: null, createdAt: new Date("2026-10-14T12:00:00Z") },
      { id: "nov", dueDate: "2026-11-01", createdAt: new Date("2026-10-14T10:00:00Z") },
      { id: "none-early", dueDate: null, createdAt: new Date("2026-10-14T09:00:00Z") },
      { id: "oct-b", dueDate: "2026-10-20", createdAt: new Date("2026-10-14T11:00:00Z") },
      { id: "oct-a", dueDate: "2026-10-20", createdAt: new Date("2026-10-14T08:00:00Z") },
    ];
    expect(sortTodos(items).map((item) => item.id)).toEqual([
      "oct-a",
      "oct-b",
      "nov",
      "none-early",
      "none-late",
    ]);
  });

  it("does not change the input", () => {
    const items = [
      { dueDate: "2026-11-01", createdAt: new Date(0) },
      { dueDate: "2026-10-01", createdAt: new Date(0) },
    ];
    sortTodos(items);
    expect(items[0].dueDate).toBe("2026-11-01");
  });
});

describe("groupByTopic", () => {
  it("keeps the order of the first item of each TOP", () => {
    const groups = groupByTopic([
      { topic: "B", id: 1 },
      { topic: "A", id: 2 },
      { topic: "B", id: 3 },
    ]);
    expect(groups.map((group) => [group.topic, group.items.map((item) => item.id)])).toEqual([
      ["B", [1, 3]],
      ["A", [2]],
    ]);
  });
});

describe("filterDecisions", () => {
  const items = [
    { id: 1, text: "Start am Odeonsplatz", departmentId: "route" },
    { id: 2, text: "Budget für Bühne", departmentId: "finanzen" },
    { id: 3, text: "Kein Referat, aber BÜHNE", departmentId: null },
  ];

  it("searches the text ignoring case", () => {
    expect(filterDecisions(items, { query: "bühne" }).map((item) => item.id)).toEqual([2, 3]);
    expect(filterDecisions(items, { query: "  ODEON " }).map((item) => item.id)).toEqual([1]);
  });

  it("filters by department", () => {
    expect(filterDecisions(items, { departmentId: "finanzen" }).map((item) => item.id)).toEqual([2]);
    expect(filterDecisions(items, { departmentId: "finanzen", query: "start" })).toEqual([]);
  });

  it("returns everything without filters", () => {
    expect(filterDecisions(items, {})).toHaveLength(3);
  });
});

describe("filterTodos", () => {
  const items = [
    { id: 1, done: false, ownerId: "alex", ownerName: null, departmentId: "finanzen" },
    { id: 2, done: false, ownerId: null, ownerName: "Gast Beispiel", departmentId: null },
    { id: 3, done: true, ownerId: "alex", ownerName: null, departmentId: null },
    { id: 4, done: false, ownerId: null, ownerName: null, departmentId: "finanzen" },
  ];
  const ids = (list: { id: number }[]) => list.map((item) => item.id);

  it("separates open and done", () => {
    expect(ids(filterTodos(items, { done: false }))).toEqual([1, 2, 4]);
    expect(ids(filterTodos(items, { done: true }))).toEqual([3]);
  });

  it("filters by member and by people without an account", () => {
    expect(ids(filterTodos(items, { done: false, person: "alex" }))).toEqual([1]);
    expect(ids(filterTodos(items, { done: false, person: WITHOUT_ACCOUNT }))).toEqual([2]);
  });

  it("filters by department", () => {
    expect(ids(filterTodos(items, { done: false, departmentId: "finanzen" }))).toEqual([1, 4]);
  });
});
