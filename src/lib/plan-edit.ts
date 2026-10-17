// Editing the plan (spec 008): reconnecting links when an element is deleted
// and the short German texts for the change history. Pure functions, no
// database.
import type { PlanElementKind, PlanLinkInput, Placement } from "./plan-engine";
import { formatBuffer, formatWeekdayShort } from "./plan-preview";

/** Name shown for a link to the D-Day. */
export const D_DAY_NAME = "Krachparade";

/** History texts the server actions write directly. */
export const CREATED_SUMMARY = "Angelegt";
export const UNDO_SUMMARY = "Rückgängig gemacht";

/** `plan_changes.summary` holds at most 300 characters. */
const MAX_SUMMARY = 300;

export function reconnectSummary(deletedName: string): string {
  return limit(`Verbindung umgehängt (nach Löschen von ${deletedName})`);
}

function limit(text: string): string {
  return text.length <= MAX_SUMMARY ? text : `${text.slice(0, MAX_SUMMARY - 1)}…`;
}

// --- Reconnecting on delete -------------------------------------------------

export type EditLink = PlanLinkInput & { id: string };

export type ReconnectResult = {
  /** All links of the deleted element (they go with it). */
  remove: EditLink[];
  /** New links predecessor → successor. */
  create: PlanLinkInput[];
  /** Existing links predecessor → successor that need a larger lag. */
  update: { id: string; lagDays: number }[];
};

/**
 * Links that keep all dates when `element` is deleted: every predecessor P
 * (lag a) gets linked to every successor S or the D-Day (lag b) with lag
 * a + duration + b. An existing link P → S keeps the larger lag.
 */
export function reconnectOnDelete(
  links: readonly EditLink[],
  element: { id: string; durationDays: number }
): ReconnectResult {
  const incoming = links.filter((link) => link.toId === element.id);
  const outgoing = links.filter((link) => link.fromId === element.id);
  const remove = links.filter((link) => link.toId === element.id || link.fromId === element.id);
  const create: PlanLinkInput[] = [];
  const update: { id: string; lagDays: number }[] = [];

  for (const before of incoming) {
    for (const after of outgoing) {
      const lagDays = before.lagDays + element.durationDays + after.lagDays;
      const existing = links.find((link) => link.fromId === before.fromId && link.toId === after.toId);
      if (!existing) {
        create.push({ fromId: before.fromId, toId: after.toId, lagDays });
      } else if (existing.lagDays < lagDays) {
        update.push({ id: existing.id, lagDays });
      }
    }
  }
  return { remove, create, update };
}

// --- Change history ---------------------------------------------------------

/** The editable values of an element, as stored. */
export type ElementState = {
  name: string;
  kind: PlanElementKind;
  durationDays: number;
  placement: Placement;
  fixedOffsetDays: number | null;
  /** "YYYY-MM-DD" or null. */
  fixedDate: string | null;
  freeStartDay: number | null;
  done: boolean;
  wobbly: boolean;
  workingGroupId: string | null;
  departmentId: string | null;
  ownerId: string | null;
};

/** A link seen from one element; `id` null = the D-Day. */
export type LinkEnd = { id: string | null; lagDays: number };

export type ElementSnapshot = ElementState & {
  predecessors: LinkEnd[];
  successors: LinkEnd[];
};

/** An element's state plus its links, as `changeSummaries` compares them. */
export function snapshotOf(
  element: ElementState & { id: string },
  links: readonly PlanLinkInput[]
): ElementSnapshot {
  const { id, ...state } = element;
  return {
    ...state,
    predecessors: links
      .filter((link) => link.toId === id)
      .map((link) => ({ id: link.fromId, lagDays: link.lagDays })),
    successors: links
      .filter((link) => link.fromId === id)
      .map((link) => ({ id: link.toId, lagDays: link.lagDays })),
  };
}

/** "2027-04-08" → "Do 08.04.2027" */
export function formatDateWithWeekday(date: string): string {
  return `${formatWeekdayShort(date)}${date.slice(0, 4)}`;
}

const KIND_NAMES: Record<PlanElementKind, string> = { milestone: "Meilenstein", task: "Vorgang" };

/** Names of the placements in the interface (spec 025). */
export const PLACEMENT_NAMES: Record<Placement, string> = {
  fixed: "Fest",
  asap: "So früh wie möglich",
  alap: "So spät wie möglich",
  free: "Frei im Fenster",
};

/** "Fest: 60 T vor der Krachparade" or "Festes Datum: Do 08.04.2027"; null without a fixed value. */
function fixedText(state: ElementState): string | null {
  if (state.fixedOffsetDays !== null) return `Fest: ${state.fixedOffsetDays} T vor der ${D_DAY_NAME}`;
  if (state.fixedDate !== null) return `Festes Datum: ${formatDateWithWeekday(state.fixedDate)}`;
  return null;
}

/** "Do 08.04. → Mo 12.04.2027"; the first year only if it differs. */
function dateRange(before: string, after: string): string {
  const first = before.slice(0, 4) === after.slice(0, 4) ? formatWeekdayShort(before) : formatDateWithWeekday(before);
  return `${first} → ${formatDateWithWeekday(after)}`;
}

/** Texts for placement and position (spec 025). */
function positionChanges(
  before: ElementState,
  after: ElementState,
  options: { movedWith?: string; previousStart?: number }
): string[] {
  // A changed duration explains a changed start (the other edge stays).
  const sameDuration = before.durationDays === after.durationDays;
  if (before.placement !== after.placement) {
    if (
      after.placement === "free" &&
      after.freeStartDay !== null &&
      options.previousStart !== undefined &&
      sameDuration
    ) {
      const moved = after.freeStartDay - options.previousStart;
      if (moved !== 0) return [`Verschoben um ${formatBuffer(moved)} (Lage jetzt ${PLACEMENT_NAMES.free})`];
    }
    const result = [`Lage: ${PLACEMENT_NAMES[before.placement]} → ${PLACEMENT_NAMES[after.placement]}`];
    const fixed = after.placement === "fixed" ? fixedText(after) : null;
    if (fixed) result.push(fixed);
    return result;
  }
  if (after.placement === "fixed") {
    if (after.fixedOffsetDays !== null && before.fixedOffsetDays !== null) {
      return before.fixedOffsetDays === after.fixedOffsetDays
        ? []
        : [`Fest: ${before.fixedOffsetDays} → ${after.fixedOffsetDays} T vor der ${D_DAY_NAME}`];
    }
    if (after.fixedDate !== null && before.fixedDate !== null) {
      return before.fixedDate === after.fixedDate ? [] : [`Festes Datum: ${dateRange(before.fixedDate, after.fixedDate)}`];
    }
    const fixed = fixedText(after);
    return fixed ? [fixed] : [];
  }
  if (after.placement === "free" && sameDuration && before.freeStartDay !== null && after.freeStartDay !== null) {
    const moved = after.freeStartDay - before.freeStartDay;
    if (moved === 0) return [];
    return [
      options.movedWith === undefined
        ? `Verschoben um ${formatBuffer(moved)}`
        : `Mitgeschoben um ${formatBuffer(moved)} (mit ${options.movedWith})`,
    ];
  }
  return [];
}

function linkChanges(
  label: "Vorgänger" | "Nachfolger",
  before: readonly LinkEnd[],
  after: readonly LinkEnd[],
  nameOf: (id: string | null) => string
): string[] {
  const result: string[] = [];
  for (const link of after) {
    const old = before.find((candidate) => candidate.id === link.id);
    if (!old) {
      result.push(`${label} verbunden: ${nameOf(link.id)} (mind. ${link.lagDays} T)`);
    } else if (old.lagDays !== link.lagDays) {
      result.push(`Mindestabstand zu ${nameOf(link.id)}: ${old.lagDays} → ${link.lagDays} T`);
    }
  }
  for (const link of before) {
    if (!after.some((candidate) => candidate.id === link.id)) {
      result.push(`${label} gelöst: ${nameOf(link.id)}`);
    }
  }
  return result;
}

function reference(
  label: string,
  before: string | null,
  after: string | null,
  nameOf: (id: string | null) => string
): string[] {
  if (before === after) return [];
  if (after === null) return [`${label} entfernt`];
  if (before === null) return [`${label}: ${nameOf(after)}`];
  return [`${label}: ${nameOf(before)} → ${nameOf(after)}`];
}

/**
 * Short German texts for the change history of one element, e.g. "Dauer
 * 21 → 28 Tage". `names` maps ids of elements, working groups, departments
 * and members to their names. With `movedWith`, a move reads "Mitgeschoben
 * um +3 T (mit ‹movedWith›)" (a free neighbour pushed by that element). With
 * `previousStart` (the planned start before a move), a switch to "free"
 * reads "Verschoben um +3 T (Lage jetzt Frei im Fenster)".
 */
export function changeSummaries(
  before: ElementSnapshot | null,
  after: ElementSnapshot,
  names: ReadonlyMap<string, string>,
  options: { movedWith?: string; previousStart?: number } = {}
): string[] {
  if (before === null) return [CREATED_SUMMARY];
  const nameOf = (id: string | null) => (id === null ? D_DAY_NAME : (names.get(id) ?? "?"));
  const result: string[] = [];

  if (before.name !== after.name) result.push("Name geändert");
  if (before.kind !== after.kind) {
    result.push(`${KIND_NAMES[before.kind]} → ${KIND_NAMES[after.kind]}`);
  } else if (before.durationDays !== after.durationDays) {
    result.push(`Dauer ${before.durationDays} → ${after.durationDays} Tage`);
  }

  result.push(...positionChanges(before, after, options));

  if (before.done !== after.done) result.push(after.done ? "Erreicht" : "Wieder offen");
  if (before.wobbly !== after.wobbly) result.push(after.wobbly ? "Wackelt" : "Wackelt nicht mehr");
  result.push(...reference("AK", before.workingGroupId, after.workingGroupId, nameOf));
  result.push(...reference("Aufgabenbereich", before.departmentId, after.departmentId, nameOf));
  result.push(...reference("Verantwortlich", before.ownerId, after.ownerId, nameOf));
  result.push(...linkChanges("Vorgänger", before.predecessors, after.predecessors, nameOf));
  result.push(...linkChanges("Nachfolger", before.successors, after.successors, nameOf));
  return result.map(limit);
}
