// Plan engine (spec 006, time windows since spec 025) in calendar days. All
// days are whole numbers relative to the D-Day (0 = D-Day, -80 = 80 days
// before). Every element has a window (earliest–latest start) and a
// placement that decides where it lies in it; lags are minimum lags. Pure
// functions, no database.

export type Status = "done" | "ok" | "warn" | "late";

export type PlanElementKind = "milestone" | "task";

export type Placement = "fixed" | "asap" | "alap" | "free";

export const PLACEMENTS: readonly Placement[] = ["fixed", "asap", "alap", "free"];

/** Variant of `placement` "fixed": N days before the D-Day or a fixed date. */
export type FixedVariant = "offset" | "date";

export type PlanElementInput = {
  id: string;
  name: string;
  kind: PlanElementKind;
  durationDays: number;
  placement: Placement;
  /** Fixed date already converted to a day (variant "date"). */
  fixedDay: number | null;
  /** Variant "N days before the D-Day": start = -N. */
  fixedOffsetDays: number | null;
  /** Start of a "free" element. */
  freeStartDay: number | null;
  done: boolean;
  /** Day it was ticked off (end of the element), relative to the D-Day. */
  doneDay: number | null;
  wobbly: boolean;
  sortOrder: number;
};

/** End of `fromId` → start of `toId` with a minimum lag; `toId` null = the D-Day. */
export type PlanLinkInput = {
  fromId: string;
  toId: string | null;
  lagDays: number;
};

export type PlanInput = {
  elements: PlanElementInput[];
  links: PlanLinkInput[];
};

export type PlanStatusReason =
  | "done"
  | "fixed_unreachable"
  | "fixed_too_late"
  | "overdue"
  | "no_window"
  | "too_late"
  | "too_early"
  | "before_predecessor"
  | "wobbly"
  | "ok";

/** Days and the element behind a reason, for the texts. */
export type ReasonDetail = {
  /** The day the text names (e.g. "frühestens ‹day›"). */
  day?: number;
  /** "no_window": the latest start. */
  latestDay?: number;
  /** "too_late": days after the latest start; "before_predecessor": the lag. */
  days?: number;
  /** "before_predecessor": the predecessor. */
  elementId?: string;
};

export type ComputedElement = {
  id: string;
  earliestStart: number;
  earliestFinish: number;
  latestStart: number;
  latestFinish: number;
  plannedStart: number;
  plannedEnd: number;
  /** `latestStart` − `earliestStart`; not shown for fixed and done elements. */
  slack: number;
  /**
   * Latest start as computed from the successors − planned start (for the
   * Gantt until spec 026, as before); negative = too late.
   */
  buffer: number;
  /** Not done, started before today and not yet ended. */
  running: boolean;
  status: Status;
  reason: PlanStatusReason;
  reasonDetail: ReasonDetail;
  critical: boolean;
  tight: boolean;
};

export type PlanCounts = { critical: number; tight: number; late: number; warn: number };

export type ComputedPlan = {
  elements: Map<string, ComputedElement>;
  counts: PlanCounts;
};

/** Changed values only, as returned by the editing functions. */
export type PlanElementChange = {
  id: string;
  placement?: Placement;
  fixedOffsetDays?: number | null;
  fixedDay?: number | null;
  freeStartDay?: number | null;
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
/** "Knapp": at most this many days of slack. */
export const TIGHT_SLACK_DAYS = 7;
export const MIN_FIXED_OFFSET = 0;
export const MAX_FIXED_OFFSET = 365;
export const MIN_FREE_START = -730;
export const MAX_FREE_START = 0;

/** A stored placement; anything unknown counts as "alap". */
export function toPlacement(value: string): Placement {
  return (PLACEMENTS as readonly string[]).includes(value) ? (value as Placement) : "alap";
}

type Resolved =
  | { mode: "done"; start: number }
  | { mode: "fixed"; start: number; variant: FixedVariant }
  | { mode: "free"; start: number }
  | { mode: "asap" }
  | { mode: "alap" };

/** Done elements, then the placement; an invalid combination counts as "alap". */
function resolve(element: PlanElementInput): Resolved {
  if (element.done && element.doneDay !== null) return { mode: "done", start: element.doneDay - element.durationDays };
  return resolvePlacement(element);
}

/** The placement as it counts, without "done"; null values that do not fit make it "alap". */
export function resolvePlacement(
  element: Pick<PlanElementInput, "placement" | "fixedDay" | "fixedOffsetDays" | "freeStartDay">
): Exclude<Resolved, { mode: "done" }> {
  switch (element.placement) {
    case "fixed":
      if (element.fixedDay !== null && element.fixedOffsetDays === null) {
        return { mode: "fixed", start: element.fixedDay, variant: "date" };
      }
      if (element.fixedOffsetDays !== null && element.fixedDay === null) {
        return { mode: "fixed", start: -element.fixedOffsetDays, variant: "offset" };
      }
      return { mode: "alap" };
    case "free":
      return element.freeStartDay === null ? { mode: "alap" } : { mode: "free", start: element.freeStartDay };
    case "asap":
      return { mode: "asap" };
    default:
      return { mode: "alap" };
  }
}

function groupLinks(links: PlanLinkInput[], key: "fromId" | "toId"): Map<string, PlanLinkInput[]> {
  const result = new Map<string, PlanLinkInput[]>();
  for (const link of links) {
    const id = link[key];
    if (id === null) continue;
    const list = result.get(id) ?? [];
    list.push(link);
    result.set(id, list);
  }
  return result;
}

function bySortOrder(a: PlanElementInput, b: PlanElementInput): number {
  return a.sortOrder - b.sortOrder || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

/** Elements so that every predecessor comes before its successors; throws on a cycle. */
function topologicalOrder(elements: PlanElementInput[], outgoing: Map<string, PlanLinkInput[]>): PlanElementInput[] {
  const byId = new Map(elements.map((element) => [element.id, element]));
  const done = new Set<string>();
  const visiting = new Set<string>();
  const reversed: PlanElementInput[] = [];
  const visit = (element: PlanElementInput) => {
    if (done.has(element.id)) return;
    if (visiting.has(element.id)) throw new PlanCycleError(element.id);
    visiting.add(element.id);
    for (const link of outgoing.get(element.id) ?? []) {
      if (link.toId !== null) visit(byId.get(link.toId)!);
    }
    visiting.delete(element.id);
    done.add(element.id);
    reversed.push(element);
  };
  for (const element of [...elements].sort(bySortOrder)) visit(element);
  return reversed.reverse();
}

/**
 * Window, planned dates, slack, status and reason of every element.
 * Order: latest dates backwards, planned starts of fixed, free, done and
 * "alap" backwards, then "asap" and the earliest dates forwards. Throws
 * `PlanCycleError` if the links contain a cycle.
 */
export function computePlan(elements: PlanElementInput[], links: PlanLinkInput[], today: number): ComputedPlan {
  const byId = new Map(elements.map((element) => [element.id, element]));
  for (const link of links) {
    if (!byId.has(link.fromId) || (link.toId !== null && !byId.has(link.toId))) {
      throw new Error("Verbindung zu einem unbekannten Plan-Element.");
    }
  }
  const outgoing = groupLinks(links, "fromId");
  const incoming = groupLinks(links, "toId");
  const order = topologicalOrder(elements, outgoing);
  const backwards = [...order].reverse();
  const resolved = new Map(elements.map((element) => [element.id, resolve(element)]));

  // 1. Latest dates.
  const latestStart = new Map<string, number>();
  const computedLatestStart = new Map<string, number>();
  for (const element of backwards) {
    const ownLinks = outgoing.get(element.id) ?? [];
    const finish =
      ownLinks.length === 0
        ? 0
        : Math.min(...ownLinks.map((link) => (link.toId === null ? 0 : latestStart.get(link.toId)!) - link.lagDays));
    const computed = finish - element.durationDays;
    computedLatestStart.set(element.id, computed);
    const own = resolved.get(element.id)!;
    latestStart.set(element.id, own.mode === "done" || own.mode === "fixed" ? own.start : computed);
  }

  // 2. Planned starts that only depend on successors.
  const plannedStart = new Map<string, number>();
  for (const element of backwards) {
    const own = resolved.get(element.id)!;
    if (own.mode === "asap") continue;
    if (own.mode !== "alap") {
      plannedStart.set(element.id, own.start);
      continue;
    }
    const ownLinks = outgoing.get(element.id) ?? [];
    const reference = (toId: string | null): number => {
      if (toId === null) return 0;
      const latest = latestStart.get(toId)!;
      if (resolved.get(toId)!.mode === "asap") return latest;
      return Math.min(plannedStart.get(toId)!, latest);
    };
    const end = ownLinks.length === 0 ? 0 : Math.min(...ownLinks.map((link) => reference(link.toId) - link.lagDays));
    plannedStart.set(element.id, end - element.durationDays);
  }

  // 3. "asap", running and the earliest dates, forwards.
  const earliestFinish = new Map<string, number>();
  const earliestPred = new Map<string, number>();
  const earliestStart = new Map<string, number>();
  const running = new Map<string, boolean>();
  for (const element of order) {
    const own = resolved.get(element.id)!;
    const ownLinks = incoming.get(element.id) ?? [];
    if (own.mode === "asap") {
      const start =
        ownLinks.length === 0
          ? today
          : Math.max(
              ...ownLinks.map((link) => plannedStart.get(link.fromId)! + byId.get(link.fromId)!.durationDays + link.lagDays)
            );
      plannedStart.set(element.id, start);
    }
    const start = plannedStart.get(element.id)!;
    const end = start + element.durationDays;
    const isRunning = !element.done && start < today && today <= end;
    running.set(element.id, isRunning);
    const fromPredecessors =
      ownLinks.length === 0
        ? -Infinity
        : Math.max(...ownLinks.map((link) => earliestFinish.get(link.fromId)! + link.lagDays));
    earliestPred.set(element.id, fromPredecessors);
    const earliest =
      own.mode === "fixed" || own.mode === "done" ? own.start : isRunning ? start : Math.max(today, fromPredecessors);
    earliestStart.set(element.id, earliest);
    earliestFinish.set(element.id, earliest + element.durationDays);
  }

  // 4. Status, reason, critical, tight.
  const computed = new Map<string, ComputedElement>();
  const counts: PlanCounts = { critical: 0, tight: 0, late: 0, warn: 0 };
  for (const element of elements) {
    const own = resolved.get(element.id)!;
    const start = plannedStart.get(element.id)!;
    const end = start + element.durationDays;
    const latest = latestStart.get(element.id)!;
    const computedLatest = computedLatestStart.get(element.id)!;
    const earliest = earliestStart.get(element.id)!;
    const slack = latest - earliest;
    const { status, reason, reasonDetail } = statusOf(element, own, {
      start,
      end,
      latest,
      earliest,
      computedLatest,
      earliestPred: earliestPred.get(element.id)!,
      today,
      predecessorEnd: (incoming.get(element.id) ?? []).map((link) => ({
        id: link.fromId,
        lag: link.lagDays,
        end: plannedStart.get(link.fromId)! + byId.get(link.fromId)!.durationDays,
      })),
    });
    const open = !element.done;
    const fixed = own.mode === "fixed";
    const critical = open && (fixed ? status === "late" : slack <= 0 || status === "late");
    const tight = open && !critical && !fixed && slack > 0 && slack <= TIGHT_SLACK_DAYS;
    if (critical) counts.critical++;
    if (tight) counts.tight++;
    if (status === "late") counts.late++;
    if (status === "warn") counts.warn++;
    computed.set(element.id, {
      id: element.id,
      earliestStart: earliest,
      earliestFinish: earliestFinish.get(element.id)!,
      latestStart: latest,
      // As computed from the successors (a fixed start does not change it).
      latestFinish: (own.mode === "done" ? latest : computedLatest) + element.durationDays,
      plannedStart: start,
      plannedEnd: end,
      slack,
      // Same meaning as before spec 025, also for fixed elements.
      buffer: (own.mode === "done" ? latest : computedLatest) - start,
      running: running.get(element.id)!,
      status,
      reason,
      reasonDetail,
      critical,
      tight,
    });
  }
  return { elements: computed, counts };
}

type StatusFacts = {
  start: number;
  end: number;
  latest: number;
  earliest: number;
  computedLatest: number;
  earliestPred: number;
  today: number;
  predecessorEnd: { id: string; lag: number; end: number }[];
};

/** The first matching row of the status table (spec 025). */
function statusOf(
  element: PlanElementInput,
  own: Resolved,
  facts: StatusFacts
): Pick<ComputedElement, "status" | "reason" | "reasonDetail"> {
  const { start, end, latest, earliest } = facts;
  if (element.done) return { status: "done", reason: "done", reasonDetail: { day: end } };
  if (own.mode === "fixed") {
    if (facts.earliestPred > own.start) {
      return { status: "late", reason: "fixed_unreachable", reasonDetail: { day: facts.earliestPred } };
    }
    if (own.start > facts.computedLatest) {
      return { status: "late", reason: "fixed_too_late", reasonDetail: { day: facts.computedLatest } };
    }
  }
  if (end < facts.today) return { status: "late", reason: "overdue", reasonDetail: { day: end } };
  if (earliest > latest) {
    return { status: "late", reason: "no_window", reasonDetail: { day: earliest, latestDay: latest } };
  }
  if (start > latest) return { status: "late", reason: "too_late", reasonDetail: { days: start - latest } };
  if (start < earliest) return { status: "warn", reason: "too_early", reasonDetail: { day: earliest } };
  if (own.mode !== "fixed") {
    const blocking = facts.predecessorEnd.find((predecessor) => predecessor.end + predecessor.lag > start);
    if (blocking) {
      return {
        status: "warn",
        reason: "before_predecessor",
        reasonDetail: { elementId: blocking.id, days: blocking.lag },
      };
    }
  }
  if (element.wobbly) return { status: "warn", reason: "wobbly", reasonDetail: {} };
  return { status: "ok", reason: "ok", reasonDetail: {} };
}

/**
 * Would a new link `fromId` → `toId` close a cycle? True for a self link or
 * if `fromId` already depends (directly or indirectly) on `toId`. A link to
 * the D-Day (`toId` null) never does.
 */
export function wouldCreateCycle(links: PlanLinkInput[], fromId: string, toId: string | null): boolean {
  if (toId === null) return false;
  if (fromId === toId) return true;
  const outgoing = groupLinks(links, "fromId");
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

// --- Editing ----------------------------------------------------------------

function findElement(plan: PlanInput, id: string): PlanElementInput {
  const element = plan.elements.find((candidate) => candidate.id === id);
  if (!element) throw new Error("Unbekanntes Plan-Element.");
  return element;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function clampDuration(days: number): number {
  return clamp(days, MIN_TASK_DAYS, MAX_TASK_DAYS);
}

function clampFreeStart(day: number): number {
  return clamp(day, MIN_FREE_START, MAX_FREE_START);
}

type PlacementValues = Required<Omit<PlanElementChange, "id" | "durationDays">> & { durationDays?: number };

/** Only the values that differ from `element`; null if nothing changes. */
function diffChange(element: PlanElementInput, values: Partial<PlacementValues>): PlanElementChange | null {
  const change: PlanElementChange = { id: element.id };
  let changed = false;
  for (const key of ["placement", "fixedOffsetDays", "fixedDay", "freeStartDay", "durationDays"] as const) {
    const value = values[key];
    if (value !== undefined && value !== element[key]) {
      (change as Record<string, unknown>)[key] = value;
      changed = true;
    }
  }
  return changed ? change : null;
}

function freeAt(start: number): Partial<PlacementValues> {
  return { placement: "free", freeStartDay: clampFreeStart(start), fixedOffsetDays: null, fixedDay: null };
}

/** Values that put a fixed element on `start`, keeping its variant. */
function fixedAt(variant: FixedVariant, start: number): Partial<PlacementValues> {
  return variant === "offset"
    ? { fixedOffsetDays: clamp(-start, MIN_FIXED_OFFSET, MAX_FIXED_OFFSET) }
    : { fixedDay: start };
}

function startAfter(element: PlanElementInput, values: Partial<PlacementValues>, fallback: number): number {
  const own = resolvePlacement({ ...element, ...values });
  return own.mode === "fixed" || own.mode === "free" ? own.start : fallback;
}

/**
 * Pushes "free" neighbours (not done) only where the order would be broken
 * after `id` now lies on `start`–`end`; transitively, every element at most
 * once. Other placements follow through the computation.
 */
function pushFreeNeighbours(plan: PlanInput, computed: ComputedPlan, id: string, start: number, end: number) {
  const byId = new Map(plan.elements.map((element) => [element.id, element]));
  const outgoing = groupLinks(plan.links, "fromId");
  const incoming = groupLinks(plan.links, "toId");
  const changes: PlanElementChange[] = [];
  const seen = new Set<string>([id]);
  const queue = [{ id, start, end }];
  const isPushable = (element: PlanElementInput) =>
    !element.done && !seen.has(element.id) && resolvePlacement(element).mode === "free";

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const link of incoming.get(current.id) ?? []) {
      const predecessor = byId.get(link.fromId)!;
      if (!isPushable(predecessor)) continue;
      if (computed.elements.get(predecessor.id)!.plannedEnd + link.lagDays <= current.start) continue;
      const newStart = clampFreeStart(current.start - link.lagDays - predecessor.durationDays);
      seen.add(predecessor.id);
      changes.push({ id: predecessor.id, freeStartDay: newStart });
      queue.push({ id: predecessor.id, start: newStart, end: newStart + predecessor.durationDays });
    }
    for (const link of outgoing.get(current.id) ?? []) {
      if (link.toId === null) continue;
      const successor = byId.get(link.toId)!;
      if (!isPushable(successor)) continue;
      if (computed.elements.get(successor.id)!.plannedStart >= current.end + link.lagDays) continue;
      const newStart = clampFreeStart(Math.min(current.end + link.lagDays, -successor.durationDays));
      seen.add(successor.id);
      changes.push({ id: successor.id, freeStartDay: newStart });
      queue.push({ id: successor.id, start: newStart, end: newStart + successor.durationDays });
    }
  }
  return changes;
}

/** The change of `element` plus the pushed neighbours. */
function withPushed(
  plan: PlanInput,
  computed: ComputedPlan,
  element: PlanElementInput,
  values: Partial<PlacementValues>,
  plannedStart: number
): PlanElementChange[] {
  const change = diffChange(element, values);
  if (!change) return [];
  const start = startAfter(element, values, plannedStart);
  const duration = values.durationDays ?? element.durationDays;
  return [change, ...pushFreeNeighbours(plan, computed, element.id, start, start + duration)];
}

/**
 * Moves an element by `delta` days: "fixed" changes N or the date, every
 * other placement becomes "free" (its end never after the D-Day). Done
 * elements never change.
 */
export function moveElement(plan: PlanInput, id: string, delta: number, today: number): PlanElementChange[] {
  const element = findElement(plan, id);
  if (delta === 0 || element.done) return [];
  const computed = computePlan(plan.elements, plan.links, today);
  const plannedStart = computed.elements.get(id)!.plannedStart;
  const own = resolvePlacement(element);
  const values =
    own.mode === "fixed"
      ? fixedAt(own.variant, own.start + delta)
      : freeAt(Math.min(plannedStart + delta, -element.durationDays));
  return withPushed(plan, computed, element, values, plannedStart);
}

/** Drags the end of a task by `delta` days; its start stays where it is. */
export function resizeFromEnd(plan: PlanInput, id: string, delta: number, today: number): PlanElementChange[] {
  const element = findElement(plan, id);
  if (element.kind !== "task" || element.done) return [];
  const durationDays = clampDuration(element.durationDays + delta);
  if (durationDays === element.durationDays) return [];
  const computed = computePlan(plan.elements, plan.links, today);
  const plannedStart = computed.elements.get(id)!.plannedStart;
  const own = resolvePlacement(element);
  const values = own.mode === "fixed" ? { durationDays } : { ...freeAt(plannedStart), durationDays };
  return withPushed(plan, computed, element, values, plannedStart);
}

/** Drags the start of a task by `delta` days; its end stays where it is. */
export function resizeFromStart(plan: PlanInput, id: string, delta: number, today: number): PlanElementChange[] {
  const element = findElement(plan, id);
  if (element.kind !== "task" || element.done) return [];
  const durationDays = clampDuration(element.durationDays - delta);
  if (durationDays === element.durationDays) return [];
  const computed = computePlan(plan.elements, plan.links, today);
  const start = computed.elements.get(id)!.plannedEnd - durationDays;
  const own = resolvePlacement(element);
  const values = own.mode === "fixed" ? { ...fixedAt(own.variant, start), durationDays } : { ...freeAt(start), durationDays };
  return withPushed(plan, computed, element, values, start);
}

/**
 * Values for a new placement (spec 025, "Lage"): "fixed" and "free" start on
 * the current planned start, "asap"/"alap" clear all three values. Done
 * elements have no placement (empty list).
 */
export function setPlacementValues(
  plan: PlanInput,
  id: string,
  placement: Placement,
  variant: FixedVariant | undefined,
  today: number
): PlanElementChange[] {
  const element = findElement(plan, id);
  if (element.done) return [];
  const plannedStart = computePlan(plan.elements, plan.links, today).elements.get(id)!.plannedStart;
  let values: Partial<PlacementValues>;
  if (placement === "fixed") {
    values =
      variant === "date"
        ? { placement, fixedDay: plannedStart, fixedOffsetDays: null, freeStartDay: null }
        : {
            placement,
            fixedOffsetDays: clamp(-plannedStart, MIN_FIXED_OFFSET, MAX_FIXED_OFFSET),
            fixedDay: null,
            freeStartDay: null,
          };
  } else if (placement === "free") {
    values = freeAt(plannedStart);
  } else {
    values = { placement, fixedOffsetDays: null, fixedDay: null, freeStartDay: null };
  }
  const change = diffChange(element, values);
  return change ? [change] : [];
}

/** Due day of a to-do: `daysBefore` the planned start or end of its element. */
export function todoDueDay(
  todo: { anchor: "start" | "end"; daysBefore: number },
  computed: Pick<ComputedElement, "plannedStart" | "plannedEnd">
): number {
  return (todo.anchor === "start" ? computed.plannedStart : computed.plannedEnd) - todo.daysBefore;
}
