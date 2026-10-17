// Franz' examples for spec 025 ("KP27 Beispiele", plan names only): D-Day
// 08.05.2027, today = -203 (17.10.2026) unless a case says otherwise.
import { describe, expect, it } from "vitest";
import { dayToDate } from "./plan-days";
import { computePlan, type PlanElementInput, type PlanLinkInput, type Placement } from "./plan-engine";

const D_DAY = "2027-05-08";
const TODAY = -203;

type Row = {
  name: string;
  duration?: number;
  placement: Placement;
  offset?: number;
  free?: number;
  next: [string | null, number][];
};

const ROWS: Row[] = [
  { name: "Voranmeldung geöffnet", placement: "alap", next: [["Vortreffen Kollektive", 20]] },
  { name: "Vortreffen Kollektive", placement: "alap", next: [["Anmeldung offen", 7]] },
  { name: "Anmeldung offen", duration: 21, placement: "alap", next: [["Auswahlkommission", 0]] },
  { name: "Auswahlkommission", duration: 10, placement: "alap", next: [["Finale Zusage", 0]] },
  {
    name: "Finale Zusage",
    placement: "fixed",
    offset: 80,
    next: [["Zahlungsfrist Kollektive", 0], ["Soundkopplung 1", 7], ["Wagenreihung steht", 0]],
  },
  { name: "Zahlungsfrist Kollektive", duration: 30, placement: "asap", next: [[null, 0]] },
  { name: "Soundkopplung 1", placement: "asap", next: [["Soundkopplung 2", 0]] },
  { name: "Soundkopplung 2", placement: "free", free: -28, next: [["Soundkopplung 3", 0]] },
  { name: "Soundkopplung 3", placement: "fixed", offset: 3, next: [[null, 0]] },
  { name: "Pressemitteilung Vorbericht", placement: "fixed", offset: 60, next: [["PR fertig", 0]] },
  { name: "PR fertig", placement: "alap", next: [["Finaler Crosscheck", 0]] },
  { name: "Schildermalen", duration: 1, placement: "free", free: -34, next: [[null, 0]] },
  { name: "Wagenreihung steht", placement: "alap", next: [["Wagenpakete packen", 0], ["Programm fertig", 0]] },
  { name: "Programm fertig", placement: "alap", next: [["Finaler Crosscheck", 0]] },
  { name: "T-Shirt-Bestellung", placement: "free", free: -49, next: [["Wagenpakete packen", 21]] },
  { name: "Wagenpakete packen", duration: 4, placement: "alap", next: [["Gesamtbriefing", 0]] },
  { name: "Finaler Planungscheck", placement: "alap", next: [["Finaler Crosscheck", 7]] },
  { name: "Rechtliches fertig", placement: "alap", next: [["Finaler Crosscheck", 0]] },
  { name: "Sicherheitskonzept fertig", placement: "alap", next: [["Finaler Crosscheck", 0]] },
  { name: "Logistik fertig", placement: "alap", next: [["Finaler Crosscheck", 0]] },
  { name: "Finaler Crosscheck", placement: "alap", next: [["Briefing Abschnittsleitungen", 3]] },
  { name: "Briefing Abschnittsleitungen", placement: "fixed", offset: 14, next: [["Gesamtbriefing", 4]] },
  { name: "Gesamtbriefing", placement: "fixed", offset: 10, next: [[null, 0]] },
  { name: "Finales Vortreffen", placement: "fixed", offset: 3, next: [[null, 0]] },
];

const LINKS: PlanLinkInput[] = ROWS.flatMap((row) =>
  row.next.map(([toId, lagDays]) => ({ fromId: row.name, toId, lagDays }))
);

function elements(): PlanElementInput[] {
  return ROWS.map((row, index) => ({
    id: row.name,
    name: row.name,
    kind: row.duration ? "task" : "milestone",
    durationDays: row.duration ?? 0,
    placement: row.placement,
    fixedDay: null,
    fixedOffsetDays: row.offset ?? null,
    freeStartDay: row.free ?? null,
    done: false,
    doneDay: null,
    wobbly: false,
    sortOrder: index + 1,
  }));
}

/** The plan with changed elements and done days (end of the element). */
function compute(
  options: {
    today?: number;
    change?: Record<string, Partial<PlanElementInput>>;
    done?: Record<string, number>;
  } = {}
) {
  const input = elements().map((element) => {
    const doneDay = options.done?.[element.id];
    return {
      ...element,
      ...options.change?.[element.id],
      ...(doneDay !== undefined && { done: true, doneDay }),
    };
  });
  const plan = computePlan(input, LINKS, options.today ?? TODAY);
  return (name: string) => {
    const element = plan.elements.get(name);
    if (!element) throw new Error(`Unbekannt: ${name}`);
    return element;
  };
}

/** Start · earliest · latest · slack. */
function window(element: ReturnType<ReturnType<typeof compute>>) {
  return [element.plannedStart, element.earliestStart, element.latestStart, element.slack];
}

const DONE_TO_ZUSAGE = {
  "Voranmeldung geöffnet": -138,
  "Vortreffen Kollektive": -118,
  "Anmeldung offen": -90,
  Auswahlkommission: -80,
  "Finale Zusage": -80,
};

describe("KP27 Beispiele (spec 025)", () => {
  it("Grundfall heute −203: Fenster, Luft, alles ok", () => {
    const get = compute();
    expect(window(get("Voranmeldung geöffnet"))).toEqual([-138, -203, -138, 65]);
    expect(dayToDate(get("Voranmeldung geöffnet").plannedStart, D_DAY)).toBe("2026-12-21");
    expect(window(get("Anmeldung offen"))).toEqual([-111, -176, -111, 65]);
    expect(window(get("Auswahlkommission"))).toEqual([-90, -155, -90, 65]);
    expect(window(get("Zahlungsfrist Kollektive"))).toEqual([-80, -80, -30, 50]);
    expect(get("Zahlungsfrist Kollektive").plannedEnd).toBe(-50);
    expect(dayToDate(-80, D_DAY)).toBe("2027-02-17");
    expect(dayToDate(-50, D_DAY)).toBe("2027-03-19");
    expect(window(get("Soundkopplung 1"))).toEqual([-73, -73, -3, 70]);
    expect(dayToDate(-73, D_DAY)).toBe("2027-02-24");
    expect(window(get("Soundkopplung 2"))).toEqual([-28, -73, -3, 70]);
    expect(window(get("Schildermalen"))).toEqual([-34, -203, -1, 202]);
    expect(window(get("T-Shirt-Bestellung"))).toEqual([-49, -203, -35, 168]);
    expect(window(get("Wagenreihung steht"))).toEqual([-17, -80, -17, 63]);
    expect(window(get("Wagenpakete packen"))).toEqual([-14, -80, -14, 66]);
    expect(get("Wagenpakete packen").plannedEnd).toBe(-10);
    expect(dayToDate(-14, D_DAY)).toBe("2027-04-24");
    expect(dayToDate(-10, D_DAY)).toBe("2027-04-28");
    expect(window(get("Finaler Crosscheck"))).toEqual([-17, -60, -17, 43]);
    const fixed = {
      "Finale Zusage": -80,
      "Pressemitteilung Vorbericht": -60,
      "Briefing Abschnittsleitungen": -14,
      Gesamtbriefing: -10,
      "Finales Vortreffen": -3,
      "Soundkopplung 3": -3,
    };
    for (const [name, day] of Object.entries(fixed)) expect(get(name).plannedStart).toBe(day);
    for (const row of ROWS) {
      expect(get(row.name), row.name).toMatchObject({ status: "ok", reason: "ok", critical: false, tight: false });
    }
  });

  it("T-Shirt frei −30: zu spät und kritisch, Wagenpakete liegt vor dem Vorgänger", () => {
    const get = compute({ change: { "T-Shirt-Bestellung": { freeStartDay: -30 } } });
    expect(get("T-Shirt-Bestellung")).toMatchObject({ status: "late", reason: "too_late", latestStart: -35, critical: true });
    expect(get("Wagenpakete packen")).toMatchObject({
      plannedStart: -14,
      status: "warn",
      reason: "before_predecessor",
      reasonDetail: { elementId: "T-Shirt-Bestellung", days: 21 },
    });
  });

  it("Soundkopplung 2 frei −80: zu früh", () => {
    const get = compute({ change: { "Soundkopplung 2": { freeStartDay: -80 } } });
    expect(get("Soundkopplung 2")).toMatchObject({ status: "warn", reason: "too_early", reasonDetail: { day: -73 } });
    expect(get("Soundkopplung 1")).toMatchObject({ status: "ok" });
  });

  it("Zusage fest 60 statt 80: Nachfolger und Vorgänger rücken mit", () => {
    const get = compute({ change: { "Finale Zusage": { fixedOffsetDays: 60 } } });
    expect(get("Auswahlkommission").plannedStart).toBe(-70);
    expect(get("Zahlungsfrist Kollektive")).toMatchObject({ plannedStart: -60, slack: 30 });
    expect(get("Soundkopplung 1")).toMatchObject({ plannedStart: -53, slack: 50 });
  });

  it("Zusage fest 150: nicht erreichbar, Auswahlkommission ohne Fenster", () => {
    const get = compute({ change: { "Finale Zusage": { fixedOffsetDays: 150 } } });
    expect(get("Finale Zusage")).toMatchObject({
      status: "late",
      reason: "fixed_unreachable",
      reasonDetail: { day: -145 },
      critical: true,
    });
    expect(get("Auswahlkommission")).toMatchObject({
      plannedStart: -160,
      earliestStart: -155,
      status: "late",
      reason: "no_window",
      critical: true,
    });
  });

  it("Briefing Abschnittsleitungen fest 5: zu spät, Crosscheck rückt mit", () => {
    const get = compute({ change: { "Briefing Abschnittsleitungen": { fixedOffsetDays: 5 } } });
    expect(get("Briefing Abschnittsleitungen")).toMatchObject({
      status: "late",
      reason: "fixed_too_late",
      reasonDetail: { day: -14 },
      critical: true,
    });
    expect(get("Finaler Crosscheck").plannedStart).toBe(-8);
  });

  it("Finaler Crosscheck frei −30: so-spät-Vorgänger rücken mit, kein „Zu früh“", () => {
    const get = compute({ change: { "Finaler Crosscheck": { placement: "free", freeStartDay: -30 } } });
    for (const name of [
      "PR fertig",
      "Programm fertig",
      "Wagenreihung steht",
      "Rechtliches fertig",
      "Sicherheitskonzept fertig",
      "Logistik fertig",
    ]) {
      expect(get(name), name).toMatchObject({ plannedStart: -30, status: "ok" });
    }
    expect(get("Finaler Planungscheck")).toMatchObject({ plannedStart: -37, status: "ok" });
    expect(get("Finaler Crosscheck")).toMatchObject({ status: "ok" });
  });

  it("Wagenreihung frei −40: Nachfolger bleiben", () => {
    const get = compute({ change: { "Wagenreihung steht": { placement: "free", freeStartDay: -40 } } });
    expect(get("Programm fertig")).toMatchObject({ plannedStart: -17, status: "ok" });
    expect(get("Wagenpakete packen")).toMatchObject({ plannedStart: -14, status: "ok" });
    expect(get("Wagenreihung steht")).toMatchObject({ status: "ok" });
  });

  it("heute −150, Voranmeldung erreicht am −140: knapp", () => {
    const get = compute({ today: -150, done: { "Voranmeldung geöffnet": -140 } });
    expect(get("Voranmeldung geöffnet")).toMatchObject({ status: "done", plannedStart: -140 });
    expect(get("Vortreffen Kollektive")).toMatchObject({ earliestStart: -120, slack: 2, tight: true, critical: false });
    expect(get("Anmeldung offen")).toMatchObject({ slack: 2, tight: true });
  });

  it("heute −150, nichts erreicht: Luft 12, nicht knapp", () => {
    const get = compute({ today: -150 });
    for (const name of ["Voranmeldung geöffnet", "Vortreffen Kollektive", "Anmeldung offen"]) {
      expect(get(name), name).toMatchObject({ slack: 12, status: "ok", tight: false, critical: false });
    }
  });

  it("heute −137, Voranmeldung nicht erreicht: überfällig, Vortreffen ohne Fenster", () => {
    const get = compute({ today: -137 });
    expect(get("Voranmeldung geöffnet")).toMatchObject({ status: "late", reason: "overdue", critical: true });
    expect(get("Vortreffen Kollektive")).toMatchObject({
      status: "late",
      reason: "no_window",
      earliestStart: -117,
      latestStart: -118,
      critical: true,
    });
  });

  const reached = { "Voranmeldung geöffnet": -138, "Vortreffen Kollektive": -118, "Anmeldung offen": -90 };

  it("heute −95: Auswahlkommission ohne Luft, kritisch", () => {
    const get = compute({ today: -95, done: reached });
    expect(get("Auswahlkommission")).toMatchObject({
      plannedStart: -90,
      slack: 0,
      status: "ok",
      critical: true,
    });
  });

  it("heute −85: Auswahlkommission läuft", () => {
    const get = compute({ today: -85, done: reached });
    expect(get("Auswahlkommission")).toMatchObject({
      running: true,
      plannedStart: -90,
      earliestStart: -90,
      status: "ok",
      critical: true,
    });
  });

  it("heute −40, erreicht bis Zusage: offene frühe Termine überfällig", () => {
    const get = compute({ today: -40, done: DONE_TO_ZUSAGE });
    for (const name of ["Pressemitteilung Vorbericht", "Zahlungsfrist Kollektive", "Soundkopplung 1"]) {
      expect(get(name), name).toMatchObject({ status: "late", reason: "overdue" });
    }
    expect(get("Zahlungsfrist Kollektive").plannedEnd).toBe(-50);
  });

  it("heute −24: überfällig, kritisch und knapp", () => {
    const get = compute({
      today: -24,
      done: {
        ...DONE_TO_ZUSAGE,
        "Zahlungsfrist Kollektive": -50,
        "Soundkopplung 1": -73,
        "Pressemitteilung Vorbericht": -60,
        "T-Shirt-Bestellung": -49,
      },
    });
    expect(get("Schildermalen")).toMatchObject({ status: "late", reason: "overdue" });
    expect(get("Soundkopplung 2")).toMatchObject({ status: "late", reason: "overdue" });
    expect(get("Finaler Planungscheck")).toMatchObject({ slack: 0, critical: true });
    expect(get("Finaler Crosscheck")).toMatchObject({ slack: 0, critical: true });
    expect(get("Wagenreihung steht")).toMatchObject({ slack: 7, tight: true });
    expect(get("Programm fertig")).toMatchObject({ slack: 7, tight: true });
    expect(get("Wagenpakete packen")).toMatchObject({ slack: 10, tight: false, critical: false });
  });
});
