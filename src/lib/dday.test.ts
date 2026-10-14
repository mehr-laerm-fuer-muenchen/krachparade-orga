import { describe, expect, it } from "vitest";
import { daysUntil, formatDLabel, formatGermanDate, todayInBerlin } from "./dday";

describe("daysUntil", () => {
  it("counts calendar days to the D-Day", () => {
    expect(daysUntil("2027-05-08", "2026-10-14")).toBe(206);
    expect(daysUntil("2027-05-08", "2027-05-07")).toBe(1);
    expect(daysUntil("2027-05-08", "2027-05-08")).toBe(0);
    expect(daysUntil("2027-05-08", "2027-05-12")).toBe(-4);
  });

  it("is not affected by daylight saving changes", () => {
    // Berlin switches to summer time on 2027-03-28, to winter time on 2026-10-25.
    expect(daysUntil("2027-03-29", "2027-03-27")).toBe(2);
    expect(daysUntil("2026-10-26", "2026-10-24")).toBe(2);
  });

  it("works across the turn of the year", () => {
    expect(daysUntil("2027-01-01", "2026-12-31")).toBe(1);
    expect(daysUntil("2027-05-08", "2026-12-31")).toBe(128);
  });

  it("rejects values that are not calendar days", () => {
    expect(() => daysUntil("2027-05-08T00:00:00Z", "2026-10-14")).toThrow();
  });
});

describe("formatDLabel", () => {
  it("shows D-n before, D-Day on and D+n after the day", () => {
    expect(formatDLabel("2026-10-14", "2027-05-08")).toBe("D-206");
    expect(formatDLabel("2027-05-08", "2027-05-08")).toBe("D-Day");
    expect(formatDLabel("2027-05-12", "2027-05-08")).toBe("D+4");
  });
});

describe("todayInBerlin", () => {
  it("uses the Berlin day between midnight and 2 am (UTC is still the day before)", () => {
    // Summer time (UTC+2)
    expect(todayInBerlin(new Date("2026-10-14T23:30:00Z"))).toBe("2026-10-15");
    expect(todayInBerlin(new Date("2026-10-14T21:59:00Z"))).toBe("2026-10-14");
    expect(todayInBerlin(new Date("2026-10-14T22:00:00Z"))).toBe("2026-10-15");
    // Winter time (UTC+1)
    expect(todayInBerlin(new Date("2026-11-14T22:59:00Z"))).toBe("2026-11-14");
    expect(todayInBerlin(new Date("2026-11-14T23:00:00Z"))).toBe("2026-11-15");
  });

  it("handles the switch to summer time at the end of March", () => {
    // 2027-03-28: clocks go from 02:00 CET to 03:00 CEST.
    expect(todayInBerlin(new Date("2027-03-27T22:59:00Z"))).toBe("2027-03-27");
    expect(todayInBerlin(new Date("2027-03-27T23:00:00Z"))).toBe("2027-03-28");
    expect(todayInBerlin(new Date("2027-03-28T21:59:00Z"))).toBe("2027-03-28");
    expect(todayInBerlin(new Date("2027-03-28T22:00:00Z"))).toBe("2027-03-29");
  });

  it("handles the switch to winter time at the end of October", () => {
    // 2026-10-25: clocks go from 03:00 CEST back to 02:00 CET.
    expect(todayInBerlin(new Date("2026-10-24T21:59:00Z"))).toBe("2026-10-24");
    expect(todayInBerlin(new Date("2026-10-24T22:00:00Z"))).toBe("2026-10-25");
    expect(todayInBerlin(new Date("2026-10-25T22:59:00Z"))).toBe("2026-10-25");
    expect(todayInBerlin(new Date("2026-10-25T23:00:00Z"))).toBe("2026-10-26");
  });

  it("handles the turn of the year", () => {
    expect(todayInBerlin(new Date("2026-12-31T22:59:00Z"))).toBe("2026-12-31");
    expect(todayInBerlin(new Date("2026-12-31T23:00:00Z"))).toBe("2027-01-01");
  });
});

describe("formatGermanDate", () => {
  it("formats a calendar day as DD.MM.YYYY", () => {
    expect(formatGermanDate("2027-05-08")).toBe("08.05.2027");
  });
});
