import { describe, expect, it } from "vitest";
import { defaultView, readModel, resolveView, summaryCounter, type ReadItem } from "./protocol-read";

const names = new Map([
  ["kim", "Kim Brenner"],
  ["alex", "Alex Rauch"],
]);

const departments = [
  { id: "fin", name: "Finanzen", group: "AK Finanzen" },
  { id: "press", name: "Pressearbeit", group: null },
];

let counter = 0;

function item(overrides: Partial<ReadItem>): ReadItem {
  counter += 1;
  return {
    id: `item-${counter}`,
    topic: "Route",
    kind: "info",
    text: "Text",
    ownerId: null,
    ownerName: null,
    dueDate: null,
    departmentId: null,
    done: false,
    createdAt: new Date(Date.UTC(2026, 9, 14, 18, counter)),
    ...overrides,
  };
}

describe("defaultView", () => {
  it("opens drafts for editing and final minutes for reading", () => {
    expect(defaultView("entwurf")).toBe("bearbeiten");
    expect(defaultView("final")).toBe("lesen");
  });
});

describe("resolveView", () => {
  it("follows ?ansicht= for both statuses", () => {
    expect(resolveView("lesen", "entwurf")).toBe("lesen");
    expect(resolveView("bearbeiten", "entwurf")).toBe("bearbeiten");
    expect(resolveView("lesen", "final")).toBe("lesen");
    expect(resolveView("bearbeiten", "final")).toBe("bearbeiten");
  });

  it("treats unknown and missing values like missing", () => {
    expect(resolveView("unsinn", "entwurf")).toBe("bearbeiten");
    expect(resolveView("unsinn", "final")).toBe("lesen");
    expect(resolveView("", "final")).toBe("lesen");
    expect(resolveView(undefined, "entwurf")).toBe("bearbeiten");
    expect(resolveView(undefined, "final")).toBe("lesen");
  });
});

describe("summaryCounter", () => {
  it("shows the counter only from 1 800 characters on", () => {
    expect(summaryCounter(0)).toBeNull();
    expect(summaryCounter(1799)).toBeNull();
    expect(summaryCounter(1800)).toBe("1 800 / 2 000");
    expect(summaryCounter(2000)).toBe("2 000 / 2 000");
  });
});

describe("readModel", () => {
  it("lists decisions in the order of TOPs and items, with TOP and department", () => {
    const items = [
      item({ topic: "Route", kind: "entscheidung", text: "Start bleibt" }),
      item({ topic: "Finanzen", kind: "entscheidung", text: "Soli-Party", departmentId: "fin" }),
      item({ topic: "Route", kind: "entscheidung", text: "Ende bleibt", departmentId: "press" }),
    ];
    expect(readModel(items, departments, names).decisions).toEqual([
      { id: items[0].id, text: "Start bleibt", topic: "Route", department: null },
      { id: items[2].id, text: "Ende bleibt", topic: "Route", department: "Pressearbeit" },
      { id: items[1].id, text: "Soli-Party", topic: "Finanzen", department: "Finanzen · AK Finanzen" },
    ]);
  });

  it("puts open to-dos first by due date and done ones last", () => {
    const items = [
      item({ kind: "todo", text: "Erledigt früh", dueDate: "2026-10-01", done: true }),
      item({ kind: "todo", text: "Ohne Datum" }),
      item({ kind: "todo", text: "Später", dueDate: "2026-11-01" }),
      item({ kind: "todo", text: "Früher", dueDate: "2026-10-20" }),
    ];
    expect(readModel(items, departments, names).todos.map((todo) => [todo.text, todo.done])).toEqual([
      ["Früher", false],
      ["Später", false],
      ["Ohne Datum", false],
      ["Erledigt früh", true],
    ]);
  });

  it("names a member or a person without an account", () => {
    const items = [
      item({ kind: "todo", text: "Mitglied", ownerId: "alex", dueDate: "2026-10-20", departmentId: "fin" }),
      item({ kind: "todo", text: "Gast", ownerName: " Gast Beispiel ", dueDate: "2026-10-21" }),
      item({ kind: "todo", text: "Niemand", dueDate: "2026-10-22" }),
    ];
    const { todos } = readModel(items, departments, names);
    expect(todos[0]).toEqual({
      id: items[0].id,
      text: "Mitglied",
      owner: { name: "Alex Rauch", withoutAccount: false },
      dueDate: "2026-10-20",
      department: "Finanzen · AK Finanzen",
      done: false,
    });
    expect(todos[1].owner).toEqual({ name: "Gast Beispiel", withoutAccount: true });
    expect(todos[2].owner).toBeNull();
  });

  it("groups infos and discussions per TOP and leaves out TOPs without them", () => {
    const items = [
      item({ topic: "Route", kind: "info", text: "Vorlage da" }),
      item({ topic: "Route", kind: "diskussion", text: "Länger?" }),
      item({ topic: "Presse", kind: "todo", text: "Fotos" }),
      item({ topic: "Finanzen", kind: "diskussion", text: "Spenden?" }),
      item({ topic: "Route", kind: "info", text: "Karte folgt", departmentId: "press" }),
    ];
    const { topics } = readModel(items, departments, names);
    expect(topics.map((entry) => entry.topic)).toEqual(["Route", "Finanzen"]);
    expect(topics[0].infos.map((note) => [note.text, note.department])).toEqual([
      ["Vorlage da", null],
      ["Karte folgt", "Pressearbeit"],
    ]);
    expect(topics[0].discussions.map((note) => note.text)).toEqual(["Länger?"]);
    expect(topics[1].infos).toEqual([]);
    expect(topics[1].discussions.map((note) => note.text)).toEqual(["Spenden?"]);
  });

  it("returns empty sections for a meeting without items", () => {
    expect(readModel([], departments, names)).toEqual({ decisions: [], todos: [], topics: [] });
  });

  it("never contains e-mail addresses", () => {
    const items = [item({ kind: "todo", text: "Mitglied", ownerId: "kim" })];
    expect(JSON.stringify(readModel(items, departments, names))).not.toMatch(/@/);
  });
});
