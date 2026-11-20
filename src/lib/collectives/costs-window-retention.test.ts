import { describe, expect, it } from "vitest";
import { formatEuro, registrationCosts } from "./costs";
import { emptyShirtOrder } from "./options";
import { isPastRetention, retentionEnd } from "./retention";
import {
  ERROR_WINDOW_AFTER_DDAY,
  ERROR_WINDOW_ORDER,
  registrationState,
  windowError,
} from "./window";

describe("registrationCosts", () => {
  it("charges the deposit for everyone, TÜV and shirts on top", () => {
    const shirts = emptyShirtOrder();
    shirts.standard.M = 2;
    expect(registrationCosts({ tuev: true, shirts })).toEqual({
      deposit: 150,
      tuev: 100,
      shirtsStandard: 60,
      shirtsSoli: 0,
      total: 310,
    });
  });

  it("charges the deposit without a motor, too", () => {
    const shirts = emptyShirtOrder();
    shirts.soli.S = 1;
    shirts.soli.XXL = 2;
    expect(registrationCosts({ tuev: null, shirts })).toEqual({
      deposit: 150,
      tuev: 0,
      shirtsStandard: 0,
      shirtsSoli: 120,
      total: 270,
    });
  });

  it("formats euros the German way", () => {
    expect(formatEuro(1310)).toBe("1.310 €");
    expect(formatEuro(0)).toBe("0 €");
  });
});

describe("registrationState", () => {
  const window = { opensOn: "2027-01-17", closesOn: "2027-02-07" };

  it("is not configured without both dates", () => {
    expect(registrationState({ opensOn: null, closesOn: null }, "2027-01-20")).toBe("not_configured");
    expect(registrationState({ opensOn: "2027-01-17", closesOn: null }, "2027-01-20")).toBe("not_configured");
  });

  it("includes both limits", () => {
    expect(registrationState(window, "2027-01-16")).toBe("upcoming");
    expect(registrationState(window, "2027-01-17")).toBe("open");
    expect(registrationState(window, "2027-02-07")).toBe("open");
    expect(registrationState(window, "2027-02-08")).toBe("closed");
  });

  it("checks windows set by admins", () => {
    expect(windowError("2027-01-17", "2027-02-07", "2027-05-08")).toBeNull();
    expect(windowError("2027-01-17", "2027-01-17", "2027-05-08")).toBeNull();
    expect(windowError("2027-02-07", "2027-01-17", "2027-05-08")).toBe(ERROR_WINDOW_ORDER);
    expect(windowError("2027-04-01", "2027-05-09", "2027-05-08")).toBe(ERROR_WINDOW_AFTER_DDAY);
    expect(windowError("2027-04-01", "2027-05-08", "2027-05-08")).toBeNull();
  });
});

describe("retention", () => {
  it("ends three months after the Krachparade", () => {
    expect(retentionEnd("2027-05-08")).toBe("2027-08-08");
  });

  it("falls back to the last day of shorter months and crosses years", () => {
    expect(retentionEnd("2027-05-31")).toBe("2027-08-31");
    expect(retentionEnd("2027-11-30")).toBe("2028-02-29");
    expect(retentionEnd("2026-11-30")).toBe("2027-02-28");
    expect(retentionEnd("2027-10-15")).toBe("2028-01-15");
  });

  it("is past retention from that day on", () => {
    expect(isPastRetention("2027-05-08", "2027-08-07")).toBe(false);
    expect(isPastRetention("2027-05-08", "2027-08-08")).toBe(true);
    expect(isPastRetention("2027-05-08", "2027-12-01")).toBe(true);
  });
});
