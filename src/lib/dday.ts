// Calendar days only ("YYYY-MM-DD"), no time of day. "Today" is always passed
// in and determined on the server via todayInBerlin().
import { D_DAY_NAME } from "./plan-edit";

const DAY_MS = 24 * 60 * 60 * 1000;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function toUtcDays(date: string): number {
  const match = ISO_DATE.exec(date);
  if (!match) {
    throw new Error(`Kein Kalendertag (YYYY-MM-DD): ${date}`);
  }
  const [, year, month, day] = match;
  return Date.UTC(Number(year), Number(month) - 1, Number(day)) / DAY_MS;
}

/** Days from `today` to `dDay`: positive before, 0 on the day, negative after. */
export function daysUntil(dDay: string, today: string): number {
  return toUtcDays(dDay) - toUtcDays(today);
}

// Non-breaking space between number and "T", so the label never wraps.
export const NBSP = String.fromCharCode(0xa0);

/**
 * Header countdown: "noch 206 T" before, "heute!" on the day, "vorbei" after;
 * `ariaLabel` spells it out for screen readers.
 */
export function formatCountdown(today: string, dDay: string): { label: string; ariaLabel: string } {
  const days = daysUntil(dDay, today);
  if (days > 0) {
    return {
      label: `noch ${days}${NBSP}T`,
      ariaLabel: `Noch ${days} ${days === 1 ? "Tag" : "Tage"} bis zur ${D_DAY_NAME}`,
    };
  }
  if (days === 0) {
    return { label: "heute!", ariaLabel: `Heute ist ${D_DAY_NAME}` };
  }
  return { label: "vorbei", ariaLabel: `${D_DAY_NAME} ist vorbei` };
}

/** A date relative to the D-Day: "80 T vorher", "Krachparade" on the day, "3 T danach". */
export function formatRelativeDay(date: string, dDay: string): string {
  const days = daysUntil(dDay, date);
  if (days > 0) {
    return `${days}${NBSP}T vorher`;
  }
  if (days === 0) {
    return D_DAY_NAME;
  }
  return `${-days}${NBSP}T danach`;
}

const berlinDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Berlin",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** The calendar day in Europe/Berlin at the moment `now`. */
export function todayInBerlin(now: Date): string {
  const parts = Object.fromEntries(
    berlinDate.formatToParts(now).map((part) => [part.type, part.value])
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/** "2027-05-08" → "08.05.2027" */
export function formatGermanDate(date: string): string {
  const match = ISO_DATE.exec(date);
  if (!match) {
    throw new Error(`Kein Kalendertag (YYYY-MM-DD): ${date}`);
  }
  const [, year, month, day] = match;
  return `${day}.${month}.${year}`;
}
