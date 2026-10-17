// Takeover of the plan data into placements (spec 025): the old computation
// of spec 006 and the placements that keep every open date. Pure functions,
// no database; used once per database by scripts/plan-lage-uebernahme.ts.
import { computePlan, PlanCycleError, type PlanElementInput, type PlanLinkInput, type Placement } from "./plan-engine";

/** An element as stored before spec 025 (`shiftDays`, `fixedDay`), plus what the new engine needs. */
export type LegacyElement = Omit<PlanElementInput, "placement" | "fixedOffsetDays" | "freeStartDay"> & {
  shiftDays: number;
};

/**
 * Planned start in the old model (spec 006): latest date from the
 * successors (a fixed successor counts with its fixed day, the D-Day with 0),
 * then the fixed day or latest start + shift. `done` plays no role.
 */
export function legacyPlannedStart(
  elements: readonly Pick<LegacyElement, "id" | "durationDays" | "shiftDays" | "fixedDay">[],
  links: readonly PlanLinkInput[]
): Map<string, number> {
  const byId = new Map(elements.map((element) => [element.id, element]));
  const outgoing = new Map<string, PlanLinkInput[]>();
  for (const link of links) outgoing.set(link.fromId, [...(outgoing.get(link.fromId) ?? []), link]);
  const latest = new Map<string, number>();
  const visiting = new Set<string>();

  const latestStartOf = (id: string): number => {
    const known = latest.get(id);
    if (known !== undefined) return known;
    if (visiting.has(id)) throw new PlanCycleError(id);
    visiting.add(id);
    const element = byId.get(id)!;
    const ownLinks = outgoing.get(id) ?? [];
    const reference = (toId: string | null) => (toId === null ? 0 : (byId.get(toId)!.fixedDay ?? latestStartOf(toId)));
    const finish = ownLinks.length === 0 ? 0 : Math.min(...ownLinks.map((link) => reference(link.toId) - link.lagDays));
    visiting.delete(id);
    latest.set(id, finish - element.durationDays);
    return finish - element.durationDays;
  };

  return new Map(
    elements.map((element) => [element.id, element.fixedDay ?? latestStartOf(element.id) + element.shiftDays])
  );
}

/** Why an element gets its placement. */
export type LegacyReason = "fixed" | "shift" | "follow" | "default";

export type LegacyPlacementResult = {
  id: string;
  placement: Placement;
  /** Kept for "fixed" (variant "fixed date"). */
  fixedDay: number | null;
  freeStartDay: number | null;
  reason: LegacyReason;
  done: boolean;
  /** Planned start in the old model. */
  oldStart: number;
  /** Planned start with the new placements. */
  newStart: number;
};

/**
 * Placements that keep all open dates: 1) a fixed date stays "fixed",
 * 2) a shift becomes "free" on the old start, 3) the rest "alap", 4) every
 * open element whose new start differs becomes "free" on its old start,
 * 5) repeat 4 until nothing differs. Done elements stay where they were
 * ticked off. Throws `PlanCycleError` for a cycle.
 */
export function legacyToPlacement(
  elements: readonly LegacyElement[],
  links: readonly PlanLinkInput[],
  today: number
): { elements: LegacyPlacementResult[]; doneMoved: { id: string; oldStart: number; newStart: number }[] } {
  const oldStarts = legacyPlannedStart(elements, links);
  const state = new Map<string, Pick<LegacyPlacementResult, "placement" | "freeStartDay" | "reason">>();
  for (const element of elements) {
    if (element.fixedDay !== null) state.set(element.id, { placement: "fixed", freeStartDay: null, reason: "fixed" });
    else if (element.shiftDays !== 0) {
      state.set(element.id, { placement: "free", freeStartDay: oldStarts.get(element.id)!, reason: "shift" });
    } else state.set(element.id, { placement: "alap", freeStartDay: null, reason: "default" });
  }

  const compute = () =>
    computePlan(
      elements.map((element) => ({
        id: element.id,
        name: element.name,
        kind: element.kind,
        durationDays: element.durationDays,
        placement: state.get(element.id)!.placement,
        fixedDay: element.fixedDay,
        fixedOffsetDays: null,
        freeStartDay: state.get(element.id)!.freeStartDay,
        done: element.done,
        doneDay: element.doneDay,
        wobbly: element.wobbly,
        sortOrder: element.sortOrder,
      })),
      [...links],
      today
    );

  let computed = compute();
  for (;;) {
    const differing = elements.filter(
      (element) =>
        !element.done &&
        state.get(element.id)!.placement !== "free" &&
        computed.elements.get(element.id)!.plannedStart !== oldStarts.get(element.id)
    );
    if (differing.length === 0) break;
    for (const element of differing) {
      state.set(element.id, { placement: "free", freeStartDay: oldStarts.get(element.id)!, reason: "follow" });
    }
    computed = compute();
  }

  const result = elements.map((element) => ({
    id: element.id,
    ...state.get(element.id)!,
    fixedDay: element.fixedDay,
    done: element.done,
    oldStart: oldStarts.get(element.id)!,
    newStart: computed.elements.get(element.id)!.plannedStart,
  }));
  return {
    elements: result,
    doneMoved: result
      .filter((element) => element.done && element.oldStart !== element.newStart)
      .map(({ id, oldStart, newStart }) => ({ id, oldStart, newStart })),
  };
}
