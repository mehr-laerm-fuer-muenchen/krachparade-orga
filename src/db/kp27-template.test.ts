import { describe, expect, it } from "vitest";
import { dateToDay, dayToDate } from "../lib/plan-days";
import { computePlan, type PlanElementInput, type PlanLinkInput } from "../lib/plan-engine";
import { KP27_PLAN, KP27_PLAN_NOTES, KP27_PLAN_TODOS } from "./kp27-template";
import { DEPARTMENTS, templatePlacement, WORKING_GROUPS } from "./seed";

const D_DAY = "2027-05-08";
const TODAY = "2026-10-17";

const elements: PlanElementInput[] = KP27_PLAN.map((element, index) => ({
  id: element.name,
  name: element.name,
  kind: element.kind,
  durationDays: element.durationDays ?? 0,
  placement: element.placement ?? templatePlacement(element),
  fixedDay: element.fixedDate ? dateToDay(element.fixedDate, D_DAY) : null,
  fixedOffsetDays: element.fixedOffsetDays ?? null,
  freeStartDay: element.freeStartDay ?? null,
  done: false,
  doneDay: null,
  wobbly: element.wobbly ?? false,
  sortOrder: index + 1,
}));
const links: PlanLinkInput[] = KP27_PLAN.flatMap((element) =>
  element.next.map((next) => ({ fromId: element.name, toId: next.to, lagDays: next.lag }))
);
const plan = computePlan(elements, links, dateToDay(TODAY, D_DAY));

function get(name: string) {
  const element = plan.elements.get(name);
  if (!element) throw new Error(`Element fehlt: ${name}`);
  return element;
}

function dates(name: string) {
  const element = get(name);
  return [dayToDate(element.plannedStart, D_DAY), dayToDate(element.plannedEnd, D_DAY)];
}

describe("KP27 template (test layout v5, spec 026)", () => {
  it("places the elements on the expected dates", () => {
    expect(dates("Voranmeldung geöffnet")).toEqual(["2026-12-21", "2026-12-21"]);
    expect(dates("Finale Zusage an Kollektive")).toEqual(["2027-02-17", "2027-02-17"]);
    expect(dates("Zahlungsfrist Kollektive")).toEqual(["2027-02-17", "2027-03-19"]);
    expect(get("Zahlungsfrist Kollektive").slack).toBe(50);
    expect(dates("Soundkopplung · Termin 1")).toEqual(["2027-02-24", "2027-02-24"]);
    expect(get("Soundkopplung · Termin 1").slack).toBe(70);
    expect(dates("Wagenpakete packen")).toEqual(["2027-04-24", "2027-04-28"]);
    expect(dates("Briefing Abschnittsleitungen")).toEqual(["2027-04-24", "2027-04-24"]);
    expect(dates("Gesamtbriefing Wagenverantwortliche")).toEqual(["2027-04-28", "2027-04-28"]);
  });

  it("uses the placements of test layout v5", () => {
    const fixed = {
      "Pressemitteilung Vorbericht": 60,
      "Finale Zusage an Kollektive": 80,
      "Briefing Abschnittsleitungen": 14,
      "Gesamtbriefing Wagenverantwortliche": 10,
      "Finales Vortreffen (Zoom)": 3,
      "Soundkopplung · Termin 3": 3,
    };
    for (const [name, offset] of Object.entries(fixed)) {
      expect(elements.find((element) => element.id === name), name).toMatchObject({
        placement: "fixed",
        fixedOffsetDays: offset,
      });
      expect(get(name).plannedStart, name).toBe(-offset);
    }
    const free = { Schildermalen: -34, "Soundkopplung · Termin 2": -28, "T-Shirt-Bestellung": -49 };
    for (const [name, start] of Object.entries(free)) expect(get(name).plannedStart, name).toBe(start);
    const asap = elements.filter((element) => element.placement === "asap").map((element) => element.id);
    expect(asap).toEqual(["Zahlungsfrist Kollektive", "Soundkopplung · Termin 1"]);
    expect(elements.filter((element) => element.placement === "alap")).toHaveLength(
      KP27_PLAN.length - Object.keys(fixed).length - Object.keys(free).length - asap.length
    );
  });

  it("has nothing late, early, critical or tight", () => {
    expect([...plan.elements.values()].filter((element) => element.status !== "ok")).toEqual([]);
    expect(plan.counts).toEqual({ critical: 0, tight: 0, late: 0, warn: 0 });
  });

  it("has no element without successor", () => {
    expect(KP27_PLAN.filter((element) => element.next.length === 0)).toEqual([]);
  });

  it("has the expected number of elements, links, to-dos and notes", () => {
    expect(KP27_PLAN).toHaveLength(24);
    expect(links).toHaveLength(27);
    expect(KP27_PLAN_TODOS).toHaveLength(32);
    expect(KP27_PLAN_TODOS.map((todo) => todo.text)).not.toContain("Wagenreihung");
    expect(KP27_PLAN_NOTES).toHaveLength(15);
  });

  it("only refers to known elements, working groups and departments", () => {
    const names = new Set(KP27_PLAN.map((element) => element.name));
    expect(names.size).toBe(KP27_PLAN.length);
    for (const link of links) {
      if (link.toId !== null) expect(names.has(link.toId), link.toId).toBe(true);
    }
    for (const entry of [...KP27_PLAN_TODOS, ...KP27_PLAN_NOTES]) {
      expect(names.has(entry.element), entry.element).toBe(true);
    }
    for (const element of KP27_PLAN) {
      const group = WORKING_GROUPS.find((candidate) => candidate.name === element.group);
      expect(group, element.group).toBeDefined();
      if (element.department) {
        expect(group?.departments, element.name).toContain(element.department);
        expect(DEPARTMENTS.map((department) => department.name)).toContain(element.department);
      }
    }
  });

  it("contains no people and no e-mail addresses", () => {
    expect(JSON.stringify([KP27_PLAN, KP27_PLAN_TODOS, KP27_PLAN_NOTES])).not.toContain("@");
    expect(KP27_PLAN.filter((element) => element.owner)).toEqual([]);
    expect(KP27_PLAN_TODOS.filter((todo) => todo.owner)).toEqual([]);
    expect(KP27_PLAN_NOTES.filter((note) => note.author)).toEqual([]);
    expect(KP27_PLAN.filter((element) => element.fixedDate || element.shiftDays)).toEqual([]);
  });
});
