// Editing the plan (spec 008): reconnecting links when an element is deleted
// and the short German texts for the change history. Pure functions, no
// database.
import type { PlanElementKind, PlanLinkInput } from "./plan-engine";
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
  shiftDays: number;
  /** "YYYY-MM-DD" or null. */
  fixedDate: string | null;
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

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

const KIND_NAMES: Record<PlanElementKind, string> = { milestone: "Meilenstein", task: "Vorgang" };

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
      result.push(`${label} verbunden: ${nameOf(link.id)} (${link.lagDays} T)`);
    } else if (old.lagDays !== link.lagDays) {
      result.push(`Abstand zu ${nameOf(link.id)}: ${old.lagDays} → ${link.lagDays} T`);
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
 * and members to their names. With `movedWith`, a shift reads "Mitverschoben
 * um +3 T (mit ‹movedWith›)" (a predecessor moved along with that element).
 */
export function changeSummaries(
  before: ElementSnapshot | null,
  after: ElementSnapshot,
  names: ReadonlyMap<string, string>,
  options: { movedWith?: string } = {}
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

  // A changed duration explains a changed shift (the start stays), so only
  // moves without a new duration are reported as such.
  let moved = 0;
  if (before.fixedDate === null && after.fixedDate !== null) {
    result.push(`Fixtermin gesetzt: ${formatDateWithWeekday(after.fixedDate)}`);
  } else if (before.fixedDate !== null && after.fixedDate === null) {
    result.push("Fixtermin entfernt");
  } else if (before.durationDays === after.durationDays) {
    moved =
      before.fixedDate !== null && after.fixedDate !== null
        ? daysBetween(before.fixedDate, after.fixedDate)
        : after.shiftDays - before.shiftDays;
  }
  if (moved !== 0) {
    result.push(
      options.movedWith === undefined
        ? `Verschoben um ${formatBuffer(moved)}`
        : `Mitverschoben um ${formatBuffer(moved)} (mit ${options.movedWith})`
    );
  }

  if (before.done !== after.done) result.push(after.done ? "Erreicht" : "Wieder offen");
  if (before.wobbly !== after.wobbly) result.push(after.wobbly ? "Wackelt" : "Wackelt nicht mehr");
  result.push(...reference("AK", before.workingGroupId, after.workingGroupId, nameOf));
  result.push(...reference("Aufgabenbereich", before.departmentId, after.departmentId, nameOf));
  result.push(...reference("Verantwortlich", before.ownerId, after.ownerId, nameOf));
  result.push(...linkChanges("Vorgänger", before.predecessors, after.predecessors, nameOf));
  result.push(...linkChanges("Nachfolger", before.successors, after.successors, nameOf));
  return result.map(limit);
}
