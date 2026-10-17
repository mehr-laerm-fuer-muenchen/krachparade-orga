// Cause of a follow-on delay (spec 026): which element further up or down the
// binding links makes an element late or early. Pure function, no database.
import type { ComputedPlan, PlanElementInput, PlanLinkInput } from "./plan-engine";

export type CauseKind = "fixed_late" | "overdue" | "placed_late" | "done_late";

export type PlanCause = { elementId: string; kind: CauseKind };

/**
 * Direction of the search: "early" follows the predecessors that set the
 * earliest start, "planned" those whose planned end sets the planned start,
 * "late" the successors that set the latest finish.
 */
type Side = "early" | "planned" | "late";

/**
 * The nearest element with a reason of its own on the binding links, for a
 * not done element that is late without a window or too late, or early
 * before its predecessor. Breadth-first over both sides; at the same
 * distance the early side comes first. Every element at most once; null if
 * there is none.
 */
export function findCause(
  result: ComputedPlan,
  elements: readonly PlanElementInput[],
  links: readonly PlanLinkInput[],
  id: string
): PlanCause | null {
  const byId = new Map(elements.map((element) => [element.id, element]));
  const start = result.elements.get(id);
  const element = byId.get(id);
  if (!start || !element || element.done) return null;

  const computed = (elementId: string) => result.elements.get(elementId)!;
  const incoming = (elementId: string) => links.filter((link) => link.toId === elementId);
  const outgoing = (elementId: string) => links.filter((link) => link.fromId === elementId);

  /** Latest finish as the successors need it (also for done elements). */
  const neededFinish = (elementId: string) => {
    const own = outgoing(elementId);
    if (own.length === 0) return 0;
    return Math.min(...own.map((link) => (link.toId === null ? 0 : computed(link.toId).latestStart) - link.lagDays));
  };

  const kindOf = (elementId: string): PlanCause["kind"] | null => {
    const node = computed(elementId);
    if (byId.get(elementId)!.done) return node.plannedEnd >= neededFinish(elementId) + 1 ? "done_late" : null;
    switch (node.reason) {
      case "fixed_too_late":
      case "fixed_unreachable":
        return "fixed_late";
      case "overdue":
        return "overdue";
      case "too_late":
        return "placed_late";
      default:
        return null;
    }
  };

  const next = (elementId: string, side: Side): string[] => {
    const node = computed(elementId);
    const sorted = (ids: string[]) =>
      ids.sort((a, b) => byId.get(a)!.sortOrder - byId.get(b)!.sortOrder || (a < b ? -1 : a > b ? 1 : 0));
    if (side === "late") {
      return sorted(
        outgoing(elementId)
          .filter((link) => link.toId !== null && computed(link.toId).latestStart - link.lagDays === node.latestFinish)
          .map((link) => link.toId!)
      );
    }
    return sorted(
      incoming(elementId)
        .filter((link) => {
          const from = computed(link.fromId);
          return side === "early"
            ? from.earliestFinish + link.lagDays === node.earliestStart
            : from.plannedEnd + link.lagDays === node.plannedStart;
        })
        .map((link) => link.fromId)
    );
  };

  let first: { ids: string[]; side: Side }[];
  if (start.status === "late" && start.reason === "no_window") {
    first = [
      { ids: next(id, "early"), side: "early" },
      { ids: next(id, "late"), side: "late" },
    ];
  } else if (start.status === "late" && start.reason === "too_late") {
    first = [
      { ids: next(id, "planned"), side: "planned" },
      { ids: next(id, "late"), side: "late" },
    ];
  } else if (start.status === "warn" && start.reason === "before_predecessor" && start.reasonDetail.elementId) {
    first = [{ ids: [start.reasonDetail.elementId], side: "planned" }];
  } else {
    return null;
  }

  const visited = new Set([id]);
  const queue: { id: string; side: Side }[] = [];
  const enqueue = (ids: string[], side: Side) => {
    for (const following of ids) {
      if (visited.has(following)) continue;
      visited.add(following);
      queue.push({ id: following, side });
    }
  };
  for (const { ids, side } of first) enqueue(ids, side);
  while (queue.length > 0) {
    const { id: current, side } = queue.shift()!;
    const kind = kindOf(current);
    if (kind) return { elementId: current, kind };
    enqueue(next(current, side), side);
  }
  return null;
}
