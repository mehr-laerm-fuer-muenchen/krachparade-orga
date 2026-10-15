// Plan engine (spec 006): backward scheduling from the D-Day in calendar days.
// All days are whole numbers relative to the D-Day (0 = D-Day, -80 = 80 days
// before). Every element sits on its latest date unless it is shifted
// (`shiftDays`) or fixed (`fixedDay`). Pure functions, no database.
import type { Status } from "@/components/status-pill";

export type PlanElementKind = "milestone" | "task";

export type PlanElementInput = {
  id: string;
  kind: PlanElementKind;
  durationDays: number;
  shiftDays: number;
  /** Fixed date already converted to a day; while set, `shiftDays` is ignored. */
  fixedDay: number | null;
  done: boolean;
  wobbly: boolean;
  sortOrder: number;
};

/** End of `fromId` → start of `toId`; `toId` null = the D-Day. */
export type PlanLinkInput = {
  fromId: string;
  toId: string | null;
  lagDays: number;
};

export type PlanInput = {
  elements: PlanElementInput[];
  links: PlanLinkInput[];
};

export type PlanStatusReason = "done" | "fixed_too_late" | "negative_buffer" | "overdue" | "wobbly" | "ok";

export type ComputedElement = {
  id: string;
  latestFinish: number;
  latestStart: number;
  plannedStart: number;
  plannedEnd: number;
  /** Negative = too late. */
  buffer: number;
  status: Status;
  reason: PlanStatusReason;
};

export type ComputedPlan = {
  elements: Map<string, ComputedElement>;
  /** Element ids from the start of the longest chain towards the D-Day. */
  criticalPath: string[];
  /** Smallest latest start of all elements, 0 for an empty plan. */
  latestProjectStart: number;
};

/** Changed values only, as returned by the editing functions. */
export type PlanElementChange = {
  id: string;
  shiftDays?: number;
  fixedDay?: number;
  durationDays?: number;
};

export class PlanCycleError extends Error {
  constructor(public readonly elementId: string) {
    super("Die Verbindungen im Plan enthalten einen Kreis.");
    this.name = "PlanCycleError";
  }
}

export const MIN_TASK_DAYS = 1;
export const MAX_TASK_DAYS = 365;

function indexById(elements: PlanElementInput[]): Map<string, PlanElementInput> {
  return new Map(elements.map((element) => [element.id, element]));
}

function outgoingLinks(links: PlanLinkInput[]): Map<string, PlanLinkInput[]> {
  const result = new Map<string, PlanLinkInput[]>();
  for (const link of links) {
    const list = result.get(link.fromId) ?? [];
    list.push(link);
    result.set(link.fromId, list);
  }
  return result;
}

function bySortOrder(a: PlanElementInput, b: PlanElementInput): number {
  return a.sortOrder - b.sortOrder || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

function statusOf(
  element: PlanElementInput,
  buffer: number,
  plannedEnd: number,
  today: number
): Pick<ComputedElement, "status" | "reason"> {
  if (element.done) return { status: "done", reason: "done" };
  if (buffer < 0) {
    return { status: "late", reason: element.fixedDay !== null ? "fixed_too_late" : "negative_buffer" };
  }
  if (plannedEnd < today) return { status: "late", reason: "overdue" };
  if (element.wobbly) return { status: "warn", reason: "wobbly" };
  return { status: "ok", reason: "ok" };
}

/**
 * Start, end, latest dates, buffer and status of every element, plus the
 * critical path. Throws `PlanCycleError` if the links contain a cycle.
 */
export function computePlan(elements: PlanElementInput[], links: PlanLinkInput[], today: number): ComputedPlan {
  const byId = indexById(elements);
  const outgoing = outgoingLinks(links);
  for (const link of links) {
    if (!byId.has(link.fromId) || (link.toId !== null && !byId.has(link.toId))) {
      throw new Error("Verbindung zu einem unbekannten Plan-Element.");
    }
  }

  const latestStarts = new Map<string, number>();
  const latestFinishes = new Map<string, number>();
  const visiting = new Set<string>();

  // Day the successor of a link starts at, as seen from its predecessor.
  const referenceDay = (link: PlanLinkInput): number => {
    if (link.toId === null) return 0;
    const successor = byId.get(link.toId)!;
    return successor.fixedDay ?? latestStartOf(successor);
  };

  function latestStartOf(element: PlanElementInput): number {
    const known = latestStarts.get(element.id);
    if (known !== undefined) return known;
    if (visiting.has(element.id)) throw new PlanCycleError(element.id);
    visiting.add(element.id);
    let latestFinish = 0;
    const ownLinks = outgoing.get(element.id) ?? [];
    if (ownLinks.length > 0) {
      latestFinish = Math.min(...ownLinks.map((link) => referenceDay(link) - link.lagDays));
    }
    visiting.delete(element.id);
    latestFinishes.set(element.id, latestFinish);
    const latestStart = latestFinish - element.durationDays;
    latestStarts.set(element.id, latestStart);
    return latestStart;
  }

  // A fixed successor does not need its own latest start, so cycles running
  // through it would go unnoticed above: check the links on their own.
  assertNoCycle(elements, outgoing);

  const computed = new Map<string, ComputedElement>();
  for (const element of elements) {
    const latestStart = latestStartOf(element);
    const latestFinish = latestFinishes.get(element.id)!;
    const plannedStart = element.fixedDay ?? latestStart + element.shiftDays;
    const plannedEnd = plannedStart + element.durationDays;
    const buffer = latestStart - plannedStart;
    computed.set(element.id, {
      id: element.id,
      latestFinish,
      latestStart,
      plannedStart,
      plannedEnd,
      buffer,
      ...statusOf(element, buffer, plannedEnd, today),
    });
  }

  const criticalPath: string[] = [];
  const [first] = [...elements].sort(
    (a, b) => computed.get(a.id)!.latestStart - computed.get(b.id)!.latestStart || bySortOrder(a, b)
  );
  let current = first;
  while (current) {
    criticalPath.push(current.id);
    const latestFinish = computed.get(current.id)!.latestFinish;
    // Links "without air"; an element successor goes before the D-Day.
    const [next] = (outgoing.get(current.id) ?? [])
      .filter((link) => link.toId !== null && referenceDay(link) - link.lagDays === latestFinish)
      .map((link) => byId.get(link.toId!)!)
      .sort(bySortOrder);
    current = next;
  }

  return {
    elements: computed,
    criticalPath,
    latestProjectStart: first ? computed.get(first.id)!.latestStart : 0,
  };
}

function assertNoCycle(elements: PlanElementInput[], outgoing: Map<string, PlanLinkInput[]>) {
  const done = new Set<string>();
  const visiting = new Set<string>();
  const visit = (id: string) => {
    if (done.has(id)) return;
    if (visiting.has(id)) throw new PlanCycleError(id);
    visiting.add(id);
    for (const link of outgoing.get(id) ?? []) {
      if (link.toId !== null) visit(link.toId);
    }
    visiting.delete(id);
    done.add(id);
  };
  for (const element of elements) visit(element.id);
}

/**
 * Would a new link `fromId` → `toId` close a cycle? True for a self link or
 * if `fromId` already depends (directly or indirectly) on `toId`. A link to
 * the D-Day (`toId` null) never does.
 */
export function wouldCreateCycle(links: PlanLinkInput[], fromId: string, toId: string | null): boolean {
  if (toId === null) return false;
  if (fromId === toId) return true;
  const outgoing = outgoingLinks(links);
  const seen = new Set<string>([toId]);
  const queue = [toId];
  while (queue.length > 0) {
    const id = queue.shift()!;
    for (const link of outgoing.get(id) ?? []) {
      if (link.toId === null || seen.has(link.toId)) continue;
      if (link.toId === fromId) return true;
      seen.add(link.toId);
      queue.push(link.toId);
    }
  }
  return false;
}

/** All direct and indirect predecessors of `id`, stopping at fixed dates. */
function movablePredecessors(plan: PlanInput, id: string): PlanElementInput[] {
  const byId = indexById(plan.elements);
  const incoming = new Map<string, string[]>();
  for (const link of plan.links) {
    if (link.toId === null) continue;
    incoming.set(link.toId, [...(incoming.get(link.toId) ?? []), link.fromId]);
  }
  const result: PlanElementInput[] = [];
  const seen = new Set<string>([id]);
  const queue = [id];
  while (queue.length > 0) {
    for (const predecessorId of incoming.get(queue.shift()!) ?? []) {
      if (seen.has(predecessorId)) continue;
      seen.add(predecessorId);
      const predecessor = byId.get(predecessorId);
      // Elements before a fixed date are scheduled from that date and stay.
      if (!predecessor || predecessor.fixedDay !== null) continue;
      result.push(predecessor);
      queue.push(predecessorId);
    }
  }
  return result;
}

function findElement(plan: PlanInput, id: string): PlanElementInput {
  const element = plan.elements.find((candidate) => candidate.id === id);
  if (!element) throw new Error("Unbekanntes Plan-Element.");
  return element;
}

function shiftWithPredecessors(plan: PlanInput, element: PlanElementInput, delta: number): PlanElementChange[] {
  return [element, ...movablePredecessors(plan, element.id)].map((item) => ({
    id: item.id,
    shiftDays: item.shiftDays + delta,
  }));
}

function clampDuration(days: number): number {
  return Math.max(MIN_TASK_DAYS, Math.min(MAX_TASK_DAYS, days));
}

/**
 * Moves an element by `delta` days. A fixed date only moves itself; any other
 * element takes all its predecessors (except fixed dates) along.
 */
export function moveElement(plan: PlanInput, id: string, delta: number): PlanElementChange[] {
  const element = findElement(plan, id);
  if (delta === 0) return [];
  if (element.fixedDay !== null) return [{ id, fixedDay: element.fixedDay + delta }];
  return shiftWithPredecessors(plan, element, delta);
}

/** Drags the end of a task by `delta` days; its start stays where it is. */
export function resizeFromEnd(plan: PlanInput, id: string, delta: number): PlanElementChange[] {
  const element = findElement(plan, id);
  if (element.kind !== "task") return [];
  const durationDays = clampDuration(element.durationDays + delta);
  const change = durationDays - element.durationDays;
  if (change === 0) return [];
  if (element.fixedDay !== null) return [{ id, durationDays }];
  // A longer task starts earlier when scheduled backwards: shift it (and its
  // predecessors) later by the same amount so the start stays.
  return shiftWithPredecessors(plan, element, change).map((item) =>
    item.id === id ? { ...item, durationDays } : item
  );
}

/** Drags the start of a task by `delta` days; its end stays where it is. */
export function resizeFromStart(plan: PlanInput, id: string, delta: number): PlanElementChange[] {
  const element = findElement(plan, id);
  if (element.kind !== "task") return [];
  const durationDays = clampDuration(element.durationDays - delta);
  const change = durationDays - element.durationDays;
  if (change === 0) return [];
  if (element.fixedDay !== null) return [{ id, durationDays, fixedDay: element.fixedDay - change }];
  // The predecessors follow by themselves through the backward scheduling.
  return [{ id, durationDays }];
}

/** Due day of a to-do: `daysBefore` the planned start or end of its element. */
export function todoDueDay(
  todo: { anchor: "start" | "end"; daysBefore: number },
  computed: Pick<ComputedElement, "plannedStart" | "plannedEnd">
): number {
  return (todo.anchor === "start" ? computed.plannedStart : computed.plannedEnd) - todo.daysBefore;
}
