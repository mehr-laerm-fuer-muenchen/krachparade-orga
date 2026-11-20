import { daysUntil } from "../dday";

// Spec 031: all registrations of an edition are deleted three months after
// the Krachparade. Calendar days only, "today" is passed in.

export const RETENTION_MONTHS = 3;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/**
 * D-Day plus three months. A day that does not exist in the target month
 * falls back to its last day (2027-11-30 → 2028-02-29).
 */
export function retentionEnd(dDay: string): string {
  const match = ISO_DATE.exec(dDay);
  if (!match) throw new Error(`Kein Kalendertag (YYYY-MM-DD): ${dDay}`);
  const year = Number(match[1]);
  const month = Number(match[2]) - 1 + RETENTION_MONTHS;
  const day = Number(match[3]);
  const targetYear = year + Math.floor(month / 12);
  const targetMonth = month % 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  return `${targetYear}-${pad(targetMonth + 1)}-${pad(Math.min(day, lastDay))}`;
}

/** True from the retention end on (that day included). */
export function isPastRetention(dDay: string, today: string): boolean {
  return daysUntil(retentionEnd(dDay), today) <= 0;
}
