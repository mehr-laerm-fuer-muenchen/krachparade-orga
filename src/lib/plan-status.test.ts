import { describe, expect, it } from "vitest";
import { NBSP } from "./dday";
import {
  barLabel,
  causeText,
  reasonText,
  situationCounts,
  slackShort,
  statusLabel,
  windowText,
} from "./plan-status";

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

describe("causeText", () => {
  it("names the element and the kind of cause", () => {
    const name = "Kooperationsgespräch KVR/Polizei";
    expect(causeText({ elementId: "k", kind: "fixed_late" }, name)).toBe(
      "wegen Kooperationsgespräch KVR/Polizei (fester Termin zu spät)"
    );
    expect(causeText({ elementId: "k", kind: "overdue" }, "Voranmeldung")).toBe("wegen Voranmeldung (überfällig)");
    expect(causeText({ elementId: "k", kind: "placed_late" }, "T-Shirt")).toBe("wegen T-Shirt (zu spät gelegt)");
    expect(causeText({ elementId: "k", kind: "done_late" }, "Voranmeldung")).toBe("wegen Voranmeldung (spät erreicht)");
  });
});

describe("windowText and barLabel", () => {
  const open = { kind: "task", placement: "asap", fixedDay: null, fixedOffsetDays: null, freeStartDay: null } as const;
  const milestone = { ...open, kind: "milestone" } as const;
  // Zahlungsfrist Kollektive (30 days, so früh wie möglich) in the KP27 template.
  const zahlungsfrist = {
    status: "ok",
    earliestStart: -80,
    latestStart: -30,
    latestFinish: 0,
    plannedStart: -80,
    plannedEnd: -50,
    slack: 50,
  } as const;
  const soundkopplung = { ...zahlungsfrist, latestStart: -3, latestFinish: -3, plannedStart: -73, plannedEnd: -73, slack: 70 };
  const fixed = { ...zahlungsfrist, plannedStart: -60, plannedEnd: -60 };

  it("shows the window from earliest start to latest finish with its slack", () => {
    expect(windowText(zahlungsfrist, open, D_DAY)).toBe(`Fenster 17.02.–08.05. · Luft 50${NBSP}T`);
    expect(windowText({ ...zahlungsfrist, slack: 0 }, open, D_DAY)).toBe("Fenster 17.02.–08.05. · keine Luft");
    expect(windowText({ ...zahlungsfrist, earliestStart: -117, latestStart: -118 }, open, D_DAY)).toBe(
      "kein Fenster mehr"
    );
  });

  it("shows fixed and reached elements without a window", () => {
    expect(windowText(fixed, { ...milestone, placement: "fixed", fixedOffsetDays: 60 }, D_DAY)).toBe(
      `fest · 60${NBSP}T vorher`
    );
    expect(windowText(fixed, { ...milestone, placement: "fixed", fixedDay: -60 }, D_DAY)).toBe("festes Datum");
    expect(windowText({ ...zahlungsfrist, status: "done", plannedEnd: -80 }, milestone, D_DAY)).toBe(
      "Erreicht am Mi 17.02."
    );
  });

  it("labels Gantt bars with dates, slack and to-dos", () => {
    expect(barLabel(zahlungsfrist, open, D_DAY, "3/5")).toBe(`17.02.–19.03. · Luft 50${NBSP}T · 3/5`);
    expect(barLabel(soundkopplung, milestone, D_DAY)).toBe(`24.02. · Luft 70${NBSP}T`);
    expect(barLabel({ ...soundkopplung, slack: 0 }, milestone, D_DAY)).toBe("24.02. · keine Luft");
    expect(barLabel(fixed, { ...milestone, placement: "fixed", fixedOffsetDays: 60 }, D_DAY)).toBe(
      `09.03. · fest · 60${NBSP}T vorher`
    );
    expect(barLabel(fixed, { ...milestone, placement: "fixed", fixedDay: -60 }, D_DAY)).toBe("09.03. · fest");
    expect(barLabel({ ...zahlungsfrist, status: "done", plannedEnd: -80 }, milestone, D_DAY, "5/5 ✓")).toBe(
      "17.02. · erreicht · 5/5 ✓"
    );
  });

  it("gives the short slack for element cards", () => {
    expect(slackShort(zahlungsfrist, open)).toBe(`Luft 50${NBSP}T`);
    expect(slackShort({ ...zahlungsfrist, slack: 0 }, open)).toBe("keine Luft");
    expect(slackShort({ ...zahlungsfrist, slack: -10 }, open)).toBe("keine Luft");
    expect(slackShort(fixed, { ...milestone, placement: "fixed", fixedOffsetDays: 60 })).toBe("fest");
    expect(slackShort(fixed, { ...milestone, placement: "fixed", fixedDay: -60 })).toBe("fest");
    expect(slackShort({ ...zahlungsfrist, status: "done" }, open)).toBeNull();
  });

  it("never says D-Day", () => {
    expect(windowText(fixed, { ...milestone, placement: "fixed", fixedOffsetDays: 60 }, D_DAY)).not.toMatch(
      /D-Day|D-\d/
    );
    expect(barLabel(fixed, { ...milestone, placement: "fixed", fixedOffsetDays: 60 }, D_DAY)).not.toMatch(
      /D-Day|D-\d/
    );
  });
});
