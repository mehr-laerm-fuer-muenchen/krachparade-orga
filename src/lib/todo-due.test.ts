import { describe, expect, it } from "vitest";
import { formatTodoDue, todoDueOrigin } from "./todo-due";

const D_DAY = "2027-05-08";

describe("todoDueOrigin", () => {
  it("says zum Start / zum Ende at 0", () => {
    expect(todoDueOrigin(0, "start")).toBe("zum Start");
    expect(todoDueOrigin(0, "end")).toBe("zum Ende");
  });

  it("uses Tag for 1 and Tage for more", () => {
    expect(todoDueOrigin(1, "start")).toBe("1 Tag vor Start");
    expect(todoDueOrigin(1, "end")).toBe("1 Tag vor Ende");
    expect(todoDueOrigin(3, "start")).toBe("3 Tage vor Start");
    expect(todoDueOrigin(14, "end")).toBe("14 Tage vor Ende");
  });
});

describe("formatTodoDue", () => {
  it("writes the date and the origin", () => {
    // -141 days before 08.05.2027 is 18.12.2026.
    expect(formatTodoDue(3, "start", -141, D_DAY)).toBe("fällig 18.12. (3 Tage vor Start)");
    expect(formatTodoDue(0, "start", -138, D_DAY)).toBe("fällig 21.12. (zum Start)");
    expect(formatTodoDue(1, "end", -1, D_DAY)).toBe("fällig 07.05. (1 Tag vor Ende)");
    expect(formatTodoDue(0, "end", 0, D_DAY)).toBe("fällig 08.05. (zum Ende)");
  });

  it("says war fällig when overdue", () => {
    expect(formatTodoDue(2, "end", -80, D_DAY, true)).toBe("war fällig 17.02. (2 Tage vor Ende)");
  });
});
