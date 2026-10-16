import { describe, expect, it } from "vitest";
import { formatGermanDateTime } from "./date-time";

describe("formatGermanDateTime", () => {
  it("shows day, month name, year and time in Berlin (summer time)", () => {
    expect(formatGermanDateTime(new Date("2026-10-16T12:05:00Z"))).toBe("16. Oktober 2026, 14:05");
  });

  it("uses winter time and a single-digit day", () => {
    expect(formatGermanDateTime(new Date("2027-01-03T08:07:00Z"))).toBe("3. Januar 2027, 09:07");
  });

  it("switches the day at midnight in Berlin, not in UTC", () => {
    expect(formatGermanDateTime(new Date("2026-12-31T23:30:00Z"))).toBe("1. Januar 2027, 00:30");
  });
});
