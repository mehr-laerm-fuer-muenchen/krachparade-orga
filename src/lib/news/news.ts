import type { NewsEntry } from "./entries";

/** localStorage key: id of the newest entry seen on this device. */
export const NEWS_SEEN_KEY = "kp-news-seen";

/** Id of the newest entry (the first one), or null without entries. */
export function latestNewsId(entries: readonly NewsEntry[]): string | null {
  return entries[0]?.id ?? null;
}

/** True if nothing was seen yet or the seen entry is not the newest one. */
export function hasUnread(entries: readonly NewsEntry[], seenId: string | null | undefined): boolean {
  const latest = latestNewsId(entries);
  if (latest === null) return false;
  return seenId !== latest;
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** "2026-10-16" → "16.10.2026". */
export function formatNewsDate(date: string): string {
  const match = ISO_DATE.exec(date);
  if (!match) {
    throw new Error(`Kein Kalendertag (YYYY-MM-DD): ${date}`);
  }
  const [, year, month, day] = match;
  return `${day}.${month}.${year}`;
}
