import { describe, expect, it } from "vitest";
import { NBSP } from "./dday";
import { reasonText, situationCounts, statusLabel } from "./plan-status";

const D_DAY = "2027-05-08";
const NAMES = new Map([["e1", "T-Shirt-Bestellung"]]);

describe("statusLabel", () => {
  it("names every status, „Zu früh“ apart from „Wackelt“", () => {
    expect(statusLabel("done", "done")).toBe("Erreicht");
    expect(statusLabel("ok", "ok")).toBe("On track");
    expect(statusLabel("warn", "wobbly")).toBe("Wackelt");
    expect(statusLabel("warn", "too_early")).toBe("Zu früh");
    expect(statusLabel("warn", "before_predecessor")).toBe("Zu früh");
    expect(statusLabel("late", "no_window")).toBe("Verzug");
  });
});

describe("situationCounts", () => {
  it("counts „wackelt“ only for the assessment and „zu früh“ apart", () => {
    expect(
      situationCounts([
        { status: "late", reason: "overdue" },
        { status: "warn", reason: "wobbly" },
        { status: "warn", reason: "too_early" },
        { status: "warn", reason: "before_predecessor" },
        { status: "ok", reason: "ok" },
        { status: "done", reason: "done" },
      ])
    ).toEqual({ late: 1, wobbly: 1, early: 2 });
  });
});

describe("reasonText", () => {
  const text = (reason: Parameters<typeof reasonText>[0]["reason"], reasonDetail = {}) =>
    reasonText({ reason, reasonDetail }, NAMES, D_DAY);

  it("explains every reason with dates and names", () => {
    expect(text("done", { day: -80 })).toBe("Erreicht am Mi 17.02.");
    expect(text("fixed_unreachable", { day: -145 })).toBe(
      "Vorgänger werden frühestens Mo 14.12. fertig – zu spät für den festen Termin"
    );
    expect(text("fixed_too_late", { day: -14 })).toBe(
      "Nachfolger brauchen es spätestens Sa 24.04. – der feste Termin ist zu spät"
    );
    expect(text("overdue", { day: -138 })).toBe("Überfällig seit Mo 21.12.");
    expect(text("no_window", { day: -117, latestDay: -118 })).toBe(
      "Kein Fenster mehr: frühestens Mo 11.01., spätestens So 10.01."
    );
    expect(text("too_late", { days: 5 })).toBe("Zu spät geplant: 5 Tage nach dem spätesten Start");
    expect(text("too_late", { days: 1 })).toBe("Zu spät geplant: 1 Tag nach dem spätesten Start");
    expect(text("too_early", { day: -73 })).toBe("Zu früh geplant: frühestens Mi 24.02.");
    expect(text("before_predecessor", { elementId: "e1", days: 21 })).toBe(
      `Liegt vor dem Ende von T-Shirt-Bestellung (mind. 21${NBSP}T danach)`
    );
    expect(text("wobbly")).toBe("Wackelt (Einschätzung)");
    expect(text("ok")).toBe("–");
  });

  it("never says D-Day", () => {
    expect(text("overdue", { day: -1 })).not.toMatch(/D-Day|D-\d/);
  });
});
