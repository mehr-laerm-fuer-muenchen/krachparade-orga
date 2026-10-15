// The plan engine counts whole calendar days relative to the D-Day (0 = D-Day,
// -80 = 80 days before). Conversion from and to "YYYY-MM-DD" only happens
// here, in UTC, so local time zones and daylight saving never shift a day.
import { daysUntil } from "./dday";

const DAY_MS = 24 * 60 * 60 * 1000;

/** "2027-02-17" with D-Day "2027-05-08" → -80 */
export function dateToDay(date: string, dDay: string): number {
  return daysUntil(date, dDay);
}

/** -80 with D-Day "2027-05-08" → "2027-02-17" */
export function dayToDate(day: number, dDay: string): string {
  if (!Number.isInteger(day)) {
    throw new Error(`Kein ganzer Tag: ${day}`);
  }
  // daysUntil validates dDay; the epoch day of dDay is its distance to 1970-01-01.
  const epochDay = daysUntil(dDay, "1970-01-01");
  return new Date((epochDay + day) * DAY_MS).toISOString().slice(0, 10);
}
