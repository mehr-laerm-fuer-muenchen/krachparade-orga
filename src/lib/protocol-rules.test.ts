import { describe, expect, it } from "vitest";
import { canDeleteMeeting, groupByTopic, isOverdue, sortTodos } from "./protocol-rules";

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
