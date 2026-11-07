// Spec 022: which feedback entries a triage run looks at. Pure functions,
// "now" is a parameter.

import { todayInBerlin } from "../dday";
import type { FeedbackKind } from "../feedback/kinds";
import type { FeedbackStatus } from "../feedback/status";

/** One row of the view `feedback_triage` (no people). */
export type TriageRow = {
  id: string;
  kind: FeedbackKind;
  message: string;
  pagePath: string;
  pageTitle: string | null;
  context: string | null;
  device: string | null;
  viewport: string | null;
  status: FeedbackStatus;
  reply: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type TriageSelection = {
  fresh: TriageRow[];
  restCount: number;
  stale: TriageRow[];
  newCursor: Date | null;
  statusById: Record<string, FeedbackStatus>;
};

export const FRESH_LIMIT = 40;
export const STALE_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

function byCreatedAt(a: TriageRow, b: TriageRow): number {
  return a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id);
}

/**
 * Picks the entries of one run:
 * - with a cursor: everything created after it; without (first run): only
 *   open entries (new, in progress). Oldest first, at most 40.
 * - the cursor moves to the newest picked entry, so the next run gets the rest.
 *   If the cut falls between entries of the same moment, those are left for
 *   the next run as a whole (otherwise `> cursor` would skip them).
 */
export function selectForTriage(rows: TriageRow[], cursor: Date | null, now: Date): TriageSelection {
  const candidates = rows
    .filter((row) =>
      cursor ? row.createdAt.getTime() > cursor.getTime() : row.status === "new" || row.status === "in_progress"
    )
    .sort(byCreatedAt);

  let fresh = candidates.slice(0, FRESH_LIMIT);
  const firstLeftOut = candidates[FRESH_LIMIT];
  if (firstLeftOut) {
    const tie = firstLeftOut.createdAt.getTime();
    const withoutTie = fresh.filter((row) => row.createdAt.getTime() !== tie);
    if (withoutTie.length > 0) fresh = withoutTie;
  }

  const freshIds = new Set(fresh.map((row) => row.id));
  const staleBefore = now.getTime() - STALE_DAYS * DAY_MS;
  const stale = rows
    .filter((row) => row.status === "new" && row.createdAt.getTime() < staleBefore && !freshIds.has(row.id))
    .sort(byCreatedAt);

  const newest = fresh.at(-1);
  const statusById: Record<string, FeedbackStatus> = {};
  for (const row of rows) statusById[row.id] = row.status;

  return {
    fresh,
    restCount: candidates.length - fresh.length,
    stale,
    newCursor: newest ? newest.createdAt : cursor,
    statusById,
  };
}

/** Monday in Europe/Berlin at the moment `now`. */
export function isMondayInBerlin(now: Date): boolean {
  return new Date(`${todayInBerlin(now)}T00:00:00Z`).getUTCDay() === 1;
}

/** A daily report is due with new entries, or on Mondays with stale ones. */
export function shouldReport(selection: Pick<TriageSelection, "fresh" | "stale">, now: Date): boolean {
  return selection.fresh.length > 0 || (isMondayInBerlin(now) && selection.stale.length > 0);
}

/** The short id shown in reports: the first 8 characters of the id. */
export function shortId(id: string): string {
  return id.slice(0, 8);
}
