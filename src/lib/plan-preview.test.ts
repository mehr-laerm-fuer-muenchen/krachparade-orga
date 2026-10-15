import { describe, expect, it } from "vitest";
import { countLate, formatBuffer, formatWeekdayShort, shortEditionName } from "./plan-preview";

describe("formatBuffer", () => {
  it("shows a sign and the unit", () => {
    expect(formatBuffer(5)).toBe("+5 T");
    expect(formatBuffer(0)).toBe("0 T");
    expect(formatBuffer(-2)).toBe("−2 T");
  });
});

describe("formatWeekdayShort", () => {
  it("shows the German weekday and day.month.", () => {
    expect(formatWeekdayShort("2026-12-09")).toBe("Mi 09.12.");
    expect(formatWeekdayShort("2027-05-08")).toBe("Sa 08.05.");
  });

  it("does not shift around the end of daylight saving time", () => {
    expect(formatWeekdayShort("2026-10-25")).toBe("So 25.10.");
    expect(formatWeekdayShort("2027-03-28")).toBe("So 28.03.");
  });

  it("rejects anything but YYYY-MM-DD", () => {
    expect(() => formatWeekdayShort("09.12.2026")).toThrow();
  });
});

describe("shortEditionName", () => {
  it("abbreviates Krachparade editions", () => {
    expect(shortEditionName("Krachparade 2027")).toBe("KP27");
  });

  it("keeps other names", () => {
    expect(shortEditionName("Sommerfest")).toBe("Sommerfest");
  });
});

describe("countLate", () => {
  it("counts only elements with status late", () => {
    expect(countLate([{ status: "late" }, { status: "warn" }, { status: "ok" }, { status: "done" }, { status: "late" }])).toBe(2);
  });

  it("is 0 without late elements", () => {
    expect(countLate([{ status: "ok" }, { status: "warn" }])).toBe(0);
    expect(countLate([])).toBe(0);
  });
});
