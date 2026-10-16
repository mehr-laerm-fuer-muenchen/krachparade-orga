import { describe, expect, it } from "vitest";
import { formatProgress, reachedWithOpenText, todoProgress } from "./todo-progress";

const todos = (done: number, open: number) => [
  ...Array.from({ length: done }, () => ({ done: true })),
  ...Array.from({ length: open }, () => ({ done: false })),
];

describe("todoProgress", () => {
  it("is empty without to-dos", () => {
    expect(todoProgress([])).toEqual({ done: 0, total: 0, complete: false });
  });

  it("counts partly done to-dos", () => {
    expect(todoProgress(todos(3, 7))).toEqual({ done: 3, total: 10, complete: false });
    expect(todoProgress(todos(0, 2))).toEqual({ done: 0, total: 2, complete: false });
  });

  it("is complete when all are done", () => {
    expect(todoProgress(todos(10, 0))).toEqual({ done: 10, total: 10, complete: true });
  });
});

describe("formatProgress", () => {
  it("formats empty, partial and complete progress", () => {
    expect(formatProgress(todoProgress([]))).toBe("");
    expect(formatProgress(todoProgress(todos(3, 7)))).toBe("3/10");
    expect(formatProgress(todoProgress(todos(0, 2)))).toBe("0/2");
    expect(formatProgress(todoProgress(todos(10, 0)))).toBe("10/10 ✓");
  });
});

describe("reachedWithOpenText", () => {
  it("names the open to-dos in singular and plural", () => {
    expect(reachedWithOpenText(0)).toBe("Erreicht");
    expect(reachedWithOpenText(1)).toBe("Erreicht · 1 To-do noch offen");
    expect(reachedWithOpenText(7)).toBe("Erreicht · 7 To-dos noch offen");
  });
});
