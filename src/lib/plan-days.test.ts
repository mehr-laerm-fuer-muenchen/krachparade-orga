import { describe, expect, it } from "vitest";
import { dateToDay, dayToDate } from "./plan-days";

const D_DAY = "2027-05-08";

describe("dateToDay / dayToDate", () => {
  it("maps the D-Day itself to 0", () => {
    expect(dateToDay(D_DAY, D_DAY)).toBe(0);
    expect(dayToDate(0, D_DAY)).toBe(D_DAY);
  });

  it("counts days before and after the D-Day", () => {
    expect(dateToDay("2027-02-17", D_DAY)).toBe(-80);
    expect(dayToDate(-80, D_DAY)).toBe("2027-02-17");
    expect(dateToDay("2027-05-12", D_DAY)).toBe(4);
    expect(dayToDate(4, D_DAY)).toBe("2027-05-12");
  });

  it("works across a change of month", () => {
    expect(dateToDay("2027-04-30", D_DAY)).toBe(-8);
    expect(dayToDate(-8, D_DAY)).toBe("2027-04-30");
    expect(dayToDate(-9, "2027-03-01")).toBe("2027-02-20");
  });

  it("works across the turn of the year 2026/27", () => {
    expect(dateToDay("2026-12-31", D_DAY)).toBe(-128);
    expect(dayToDate(-128, D_DAY)).toBe("2026-12-31");
    expect(dayToDate(-127, D_DAY)).toBe("2027-01-01");
    expect(dayToDate(-138, D_DAY)).toBe("2026-12-21");
  });

  it("is not shifted by a day around the daylight saving change in March 2027", () => {
    expect(dateToDay("2027-03-31", D_DAY)).toBe(-38);
    expect(dayToDate(-38, D_DAY)).toBe("2027-03-31");
    expect(dayToDate(-41, D_DAY)).toBe("2027-03-28");
    expect(dayToDate(-42, D_DAY)).toBe("2027-03-27");
  });

  it("round-trips every day of the planning year", () => {
    for (let day = -400; day <= 30; day++) {
      expect(dateToDay(dayToDate(day, D_DAY), D_DAY)).toBe(day);
    }
  });

  it("rejects values that are not calendar days or whole days", () => {
    expect(() => dateToDay("2027-05-08T00:00:00Z", D_DAY)).toThrow();
    expect(() => dayToDate(1.5, D_DAY)).toThrow();
  });
});
