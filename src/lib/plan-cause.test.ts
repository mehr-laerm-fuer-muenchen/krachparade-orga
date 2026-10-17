import { describe, expect, it } from "vitest";
import { KP27_PLAN } from "../db/kp27-template";
import { TEST_PLAN, templatePlacement, type PlanTemplateElement } from "../db/seed";
import { findCause } from "./plan-cause";
import { dateToDay } from "./plan-days";
import { computePlan, type PlanElementInput, type PlanLinkInput } from "./plan-engine";

const D_DAY = "2027-05-08";
/** 17.10.2026 */
const TODAY = -203;

function build(
  template: PlanTemplateElement[],
  options: { today?: number; change?: Record<string, Partial<PlanElementInput>> } = {}
) {
  const elements: PlanElementInput[] = template.map((element, index) => ({
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
    ...options.change?.[element.name],
  }));
  const links: PlanLinkInput[] = template.flatMap((element) =>
    element.next.map((next) => ({ fromId: element.name, toId: next.to, lagDays: next.lag }))
  );
  const result = computePlan(elements, links, options.today ?? TODAY);
  return {
    result,
    cause: (id: string) => findCause(result, elements, links, id),
  };
}

describe("findCause", () => {
  it("dev seed: crosscheck and both briefings are late because of the fixed meeting", () => {
    const { result, cause } = build(TEST_PLAN);
    for (const name of ["Finaler Crosscheck", "Briefing Abschnittsleitungen", "Gesamtbriefing Wagenverantwortliche"]) {
      expect(result.elements.get(name), name).toMatchObject({ status: "late", reason: "no_window" });
      expect(cause(name), name).toEqual({ elementId: "Kooperationsgespräch KVR/Polizei", kind: "fixed_late" });
    }
  });

  it("Zusage fest 150: Auswahlkommission because of the fixed Zusage", () => {
    const { cause } = build(KP27_PLAN, { change: { "Finale Zusage an Kollektive": { fixedOffsetDays: 150 } } });
    expect(cause("Auswahlkommission")).toEqual({ elementId: "Finale Zusage an Kollektive", kind: "fixed_late" });
  });

  it("T-Shirt frei −30: Wagenpakete because of the T-shirt order placed too late", () => {
    const { result, cause } = build(KP27_PLAN, { change: { "T-Shirt-Bestellung": { freeStartDay: -30 } } });
    expect(result.elements.get("Wagenpakete packen")).toMatchObject({ status: "warn", reason: "before_predecessor" });
    expect(cause("Wagenpakete packen")).toEqual({ elementId: "T-Shirt-Bestellung", kind: "placed_late" });
  });

  it("heute −137: Vortreffen because of the overdue Voranmeldung", () => {
    const { cause } = build(KP27_PLAN, { today: -137 });
    expect(cause("Vortreffen Kollektive")).toEqual({ elementId: "Voranmeldung geöffnet", kind: "overdue" });
  });

  it("reached late: Vortreffen because of the Voranmeldung reached 8 days late", () => {
    const { result, cause } = build(KP27_PLAN, {
      today: -125,
      change: { "Voranmeldung geöffnet": { done: true, doneDay: -130 } },
    });
    expect(result.elements.get("Vortreffen Kollektive")).toMatchObject({ status: "late", reason: "no_window" });
    expect(cause("Vortreffen Kollektive")).toEqual({ elementId: "Voranmeldung geöffnet", kind: "done_late" });
  });

  it("has no cause without a delay", () => {
    const { cause } = build(KP27_PLAN);
    expect(cause("Finaler Crosscheck")).toBeNull();
    expect(cause("Zahlungsfrist Kollektive")).toBeNull();
  });

  it("stops at elements it has already visited and finds no cause if today alone is the reason", () => {
    // P (asap, 15 days) starts today and ends after the D-Day; X has no window.
    const template: PlanTemplateElement[] = [
      { name: "P", group: "", kind: "task", durationDays: 15, placement: "asap", next: [{ to: "X", lag: 0 }] },
      { name: "X", group: "", kind: "milestone", next: [{ to: null, lag: 0 }] },
    ];
    const { result, cause } = build(template, { today: -10 });
    expect(result.elements.get("X")).toMatchObject({ status: "late", reason: "no_window" });
    expect(result.elements.get("P")).toMatchObject({ status: "late", reason: "no_window" });
    expect(cause("X")).toBeNull();
    expect(cause("P")).toBeNull();
  });
});
