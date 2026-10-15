import { describe, expect, it } from "vitest";
import { dateToDay, dayToDate } from "../lib/plan-days";
import { computePlan, type PlanElementInput, type PlanLinkInput } from "../lib/plan-engine";
import { KP27_PLAN, KP27_PLAN_NOTES, KP27_PLAN_TODOS } from "./kp27-template";
import { DEPARTMENTS, WORKING_GROUPS } from "./seed";

const D_DAY = "2027-05-08";
const TODAY = "2026-10-15";

const elements: PlanElementInput[] = KP27_PLAN.map((element, index) => ({
  id: element.name,
  kind: element.kind,
  durationDays: element.durationDays ?? 0,
  shiftDays: element.shiftDays ?? 0,
  fixedDay: element.fixedDate ? dateToDay(element.fixedDate, D_DAY) : null,
  done: false,
  wobbly: element.wobbly ?? false,
  sortOrder: index + 1,
}));
const links: PlanLinkInput[] = KP27_PLAN.flatMap((element) =>
  element.next.map((next) => ({ fromId: element.name, toId: next.to, lagDays: next.lag }))
);
const plan = computePlan(elements, links, dateToDay(TODAY, D_DAY));

function days(name: string) {
  const element = plan.elements.get(name);
  if (!element) throw new Error(`Element fehlt: ${name}`);
  return [element.plannedStart, element.plannedEnd];
}

describe("KP27 template", () => {
  it("places every element on its D-day", () => {
    expect(days("Voranmeldung geöffnet")).toEqual([-138, -138]);
    expect(dayToDate(days("Voranmeldung geöffnet")[0], D_DAY)).toBe("2026-12-21");
    expect(days("Vortreffen Kollektive")).toEqual([-118, -118]);
    expect(days("Anmeldung offen")).toEqual([-111, -90]);
    expect(days("Auswahlkommission")).toEqual([-90, -80]);
    expect(days("Finale Zusage an Kollektive")).toEqual([-80, -80]);
    expect(dayToDate(days("Finale Zusage an Kollektive")[0], D_DAY)).toBe("2027-02-17");
    expect(days("Zahlungsfrist Kollektive")).toEqual([-80, -57]);
    expect(days("Soundkopplung · Termin 1")).toEqual([-73, -73]);
    expect(days("Soundkopplung · Termin 2")).toEqual([-28, -28]);
    expect(days("Soundkopplung · Termin 3")).toEqual([-3, -3]);
    expect(days("Pressemitteilung Vorbericht")).toEqual([-60, -60]);
    expect(days("T-Shirt-Bestellung")).toEqual([-49, -49]);
    expect(days("Schildermalen")).toEqual([-34, -34]);
    expect(days("Finaler Planungscheck")).toEqual([-24, -24]);
    for (const name of [
      "Rechtliches fertig",
      "Sicherheitskonzept fertig",
      "Programm fertig",
      "Logistik fertig",
      "PR fertig",
      "Finaler Crosscheck",
    ]) {
      expect(days(name), name).toEqual([-17, -17]);
    }
    expect(days("Briefing Abschnittsleitungen")).toEqual([-14, -14]);
    expect(days("Wagenpakete packen")).toEqual([-14, -10]);
    expect(days("Gesamtbriefing Wagenverantwortliche")).toEqual([-10, -10]);
    expect(days("Finales Vortreffen (Zoom)")).toEqual([-3, -3]);
  });

  it("finds the critical path from D-138", () => {
    expect(plan.criticalPath).toEqual([
      "Voranmeldung geöffnet",
      "Vortreffen Kollektive",
      "Anmeldung offen",
      "Auswahlkommission",
      "Finale Zusage an Kollektive",
      "Zahlungsfrist Kollektive",
    ]);
    expect(plan.latestProjectStart).toBe(-138);
  });

  it("has no cycle, no element without successor and only status ok", () => {
    expect(KP27_PLAN.filter((element) => element.next.length === 0)).toEqual([]);
    expect([...plan.elements.values()].filter((element) => element.status !== "ok")).toEqual([]);
  });

  it("has the expected number of elements, links, to-dos and notes", () => {
    expect(KP27_PLAN).toHaveLength(23);
    // The spec text says 25, its table has 24; the table counts (Franz, 15.10.2026).
    expect(links).toHaveLength(24);
    expect(KP27_PLAN_TODOS).toHaveLength(33);
    expect(KP27_PLAN_NOTES).toHaveLength(10);
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
