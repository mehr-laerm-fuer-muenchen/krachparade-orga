// Day plan of the Krachparade (spec 030). Pure functions without database.
// Times are minutes since 0:00 of the D-Day (0–1439); the day itself is the
// date of the edition, so there is no date and no time zone here.
import { todoProgress, type TodoProgress } from "./todo-progress";

/** Last minute of the day (23:59). */
export const LAST_MINUTE = 1439;
/** Grid for dragging and moving. */
export const SNAP_MINUTES = 5;
/** Shortest duration of an entry with an end. */
export const MIN_DURATION = 5;
/** Points in time (no end) take this much room in the plan. */
export const POINT_MINUTES = 20;
/** Default range of the plan: 08:00–24:00. */
export const DEFAULT_RANGE = { start: 8 * 60, end: 24 * 60 } as const;

export const TRACK_NAME_MAX = 40;
export const ENTRY_TITLE_MAX = 120;
export const PLACE_MAX = 120;
export const PERSON_TEXT_MAX = 80;
export const NOTE_MAX = 2000;
export const CHECK_TEXT_MAX = 200;
export const ROLE_TITLE_MAX = 80;
export const ROLE_TASK_MAX = 500;
export const ROLE_MARK_MAX = 40;

export type EntryTime = { startMinute: number | null; endMinute: number | null; approx?: boolean };

const TIME = /^([01]?\d|2[0-3]):([0-5]\d)$/;

/** "11:15" → 675; null for anything that is no time of day. */
export function timeToMinutes(value: string): number | null {
  const match = TIME.exec(value.trim());
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

/** 675 → "11:15" */
export function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

/** Rounds to the nearest multiple of `step`. */
export function snapMinutes(minutes: number, step: number = SNAP_MINUTES): number {
  return Math.round(minutes / step) * step;
}

/** "11:00–11:15", "ca. 19:45", "09:00" or "ohne Uhrzeit". */
export function formatEntryTime(entry: EntryTime): string {
  if (entry.startMinute === null) return "ohne Uhrzeit";
  const time =
    entry.endMinute === null
      ? minutesToTime(entry.startMinute)
      : `${minutesToTime(entry.startMinute)}–${minutesToTime(entry.endMinute)}`;
  return entry.approx ? `ca. ${time}` : time;
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/**
 * Moves start and end together, the duration stays. At the edges of the day
 * the entry stops without changing its duration. Entries without a time stay.
 */
export function moveEntry(entry: EntryTime, deltaMinutes: number): { startMinute: number | null; endMinute: number | null } {
  if (entry.startMinute === null) return { startMinute: null, endMinute: entry.endMinute };
  const duration = entry.endMinute === null ? 0 : entry.endMinute - entry.startMinute;
  const start = clamp(entry.startMinute + deltaMinutes, 0, LAST_MINUTE - duration);
  return { startMinute: start, endMinute: entry.endMinute === null ? null : start + duration };
}

/**
 * New end of an entry: at least start + 5, at most 23:59. Null if the entry has
 * no time or starts too late for any end.
 */
export function resizeEntry(entry: EntryTime, newEnd: number): number | null {
  if (entry.startMinute === null) return null;
  const min = entry.startMinute + MIN_DURATION;
  if (min > LAST_MINUTE) return entry.startMinute < LAST_MINUTE ? LAST_MINUTE : null;
  return clamp(newEnd, min, LAST_MINUTE);
}

/** End in the plan: points in time take `POINT_MINUTES`. */
function visualEnd(entry: { startMinute: number; endMinute: number | null }): number {
  return entry.endMinute ?? entry.startMinute + POINT_MINUTES;
}

export type Laned<T> = { entry: T; lane: number; laneCount: number };

/**
 * Entries of one column side by side: overlapping entries get their own lane
 * (`lane` from 0), `laneCount` is the number of lanes of their group of
 * overlapping entries. Entries without a time are left out.
 */
export function layoutLanes<T extends EntryTime>(entries: readonly T[]): Laned<T>[] {
  const timed = entries
    .filter((entry): entry is T & { startMinute: number } => entry.startMinute !== null)
    .sort((a, b) => a.startMinute - b.startMinute || visualEnd(a) - visualEnd(b));

  const result: Laned<T>[] = [];
  let group: Laned<T>[] = [];
  let laneEnds: number[] = [];
  let groupEnd = -1;
  const closeGroup = () => {
    for (const item of group) item.laneCount = laneEnds.length;
    group = [];
    laneEnds = [];
  };

  for (const entry of timed) {
    if (entry.startMinute >= groupEnd) closeGroup();
    let lane = laneEnds.findIndex((end) => end <= entry.startMinute);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(0);
    }
    laneEnds[lane] = visualEnd(entry);
    groupEnd = Math.max(groupEnd, visualEnd(entry));
    const item = { entry, lane, laneCount: 1 };
    group.push(item);
    result.push(item);
  }
  closeGroup();
  return result;
}

/**
 * Range of the plan in minutes: 08:00–24:00, widened to the full hour before
 * the earliest and after the latest entry.
 */
export function timelineRange(entries: readonly EntryTime[]): { start: number; end: number } {
  let start: number = DEFAULT_RANGE.start;
  let end: number = DEFAULT_RANGE.end;
  for (const entry of entries) {
    if (entry.startMinute === null) continue;
    start = Math.min(start, Math.floor(entry.startMinute / 60) * 60);
    end = Math.max(end, Math.ceil(visualEnd({ startMinute: entry.startMinute, endMinute: entry.endMinute }) / 60) * 60);
  }
  // The day ends at 24:00, even if a late point in time would reach beyond.
  return { start, end: Math.min(end, 24 * 60) };
}

/** Sorts by start, then end; points in time before entries with the same start; without time last. */
export function compareEntries(a: EntryTime, b: EntryTime): number {
  if (a.startMinute === null || b.startMinute === null) {
    return (a.startMinute === null ? 1 : 0) - (b.startMinute === null ? 1 : 0);
  }
  return a.startMinute - b.startMinute || (a.endMinute ?? a.startMinute) - (b.endMinute ?? b.startMinute);
}

export type HourGroup<T> = { key: string; label: string; entries: T[] };

/** Groups for the phone list: "09 Uhr", …, "Ohne Uhrzeit" at the end. */
export function groupByHour<T extends EntryTime>(entries: readonly T[]): HourGroup<T>[] {
  const groups = new Map<string, HourGroup<T>>();
  for (const entry of [...entries].sort(compareEntries)) {
    const key = entry.startMinute === null ? "none" : String(Math.floor(entry.startMinute / 60)).padStart(2, "0");
    const label = key === "none" ? "Ohne Uhrzeit" : `${key} Uhr`;
    const group = groups.get(key) ?? { key, label, entries: [] };
    group.entries.push(entry);
    groups.set(key, group);
  }
  return [...groups.values()];
}

/** Ticked-off and all checkpoints, in the format of `formatProgress`. */
export function checkProgress(checks: readonly { done: boolean }[]): TodoProgress {
  return todoProgress(checks);
}

// --- Template ---------------------------------------------------------------

/** A person in the dev seed: a member by e-mail or a name without an account. Never in production. */
export type DayTemplatePerson = { email: string } | { name: string };

export type DayTemplateCheck = string | { text: string; person?: DayTemplatePerson };

export type DayTemplateEntry = {
  /** Name of the column. */
  track: string;
  title: string;
  /** "HH:MM", null = without time. */
  start: string | null;
  /** "HH:MM", missing = point in time. */
  end?: string;
  approx?: boolean;
  place?: string;
  /** Working group by name; missing in the edition = empty. */
  group?: string;
  person?: DayTemplatePerson;
  note?: string;
  checks?: DayTemplateCheck[];
};

export type DayTemplateRole = {
  title: string;
  task?: string;
  mark?: string;
  group?: string;
  people?: DayTemplatePerson[];
};

export type DayTemplate = { tracks: string[]; entries: DayTemplateEntry[]; roles: DayTemplateRole[] };

export function checkText(check: DayTemplateCheck): string {
  return typeof check === "string" ? check : check.text;
}

const tooLong = (value: string | undefined, max: number) => value !== undefined && value.length > max;

/** Problems of a template (empty = valid): columns present, times in order, lengths as in the database. */
export function validateDayTemplate(template: DayTemplate): string[] {
  const problems: string[] = [];
  const tracks = new Set(template.tracks);
  if (tracks.size !== template.tracks.length) problems.push("Spalten doppelt");
  for (const track of template.tracks) {
    if (track.length < 1 || track.length > TRACK_NAME_MAX) problems.push(`Spalte „${track}“: Name`);
  }
  for (const entry of template.entries) {
    const label = `Eintrag „${entry.title}“`;
    if (!tracks.has(entry.track)) problems.push(`${label}: Spalte „${entry.track}“ fehlt`);
    if (entry.title.length < 1 || entry.title.length > ENTRY_TITLE_MAX) problems.push(`${label}: Titel`);
    const start = entry.start === null ? null : timeToMinutes(entry.start);
    if (entry.start !== null && start === null) problems.push(`${label}: Start`);
    if (entry.end !== undefined) {
      const end = timeToMinutes(entry.end);
      if (start === null || end === null || end <= start) problems.push(`${label}: Ende`);
    }
    if (tooLong(entry.place, PLACE_MAX)) problems.push(`${label}: Ort`);
    if (tooLong(entry.note, NOTE_MAX)) problems.push(`${label}: Notiz`);
    if (entry.person && "name" in entry.person && tooLong(entry.person.name, PERSON_TEXT_MAX)) {
      problems.push(`${label}: Person`);
    }
    for (const check of entry.checks ?? []) {
      const text = checkText(check);
      if (text.length < 1 || text.length > CHECK_TEXT_MAX) problems.push(`${label}: Checkpunkt „${text}“`);
    }
  }
  for (const role of template.roles) {
    const label = `Rolle „${role.title}“`;
    if (role.title.length < 1 || role.title.length > ROLE_TITLE_MAX) problems.push(`${label}: Titel`);
    if (tooLong(role.task, ROLE_TASK_MAX)) problems.push(`${label}: Aufgabe`);
    if (tooLong(role.mark, ROLE_MARK_MAX)) problems.push(`${label}: Kennzeichen`);
  }
  return problems;
}
