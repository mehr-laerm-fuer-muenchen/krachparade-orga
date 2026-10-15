// Display helpers for the plan preview on the start page (spec 006).
import type { Status } from "@/components/status-pill";

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

const weekday = new Intl.DateTimeFormat("de-DE", { weekday: "short", timeZone: "UTC" });

/** 5 → "+5 T", 0 → "0 T", -2 → "−2 T" (typographic minus). */
export function formatBuffer(days: number): string {
  if (days > 0) {
    return `+${days} T`;
  }
  if (days < 0) {
    return `−${-days} T`;
  }
  return "0 T";
}

/** "2026-12-09" → "Mi 09.12." */
export function formatWeekdayShort(date: string): string {
  const match = ISO_DATE.exec(date);
  if (!match) {
    throw new Error(`Kein Kalendertag (YYYY-MM-DD): ${date}`);
  }
  const [, year, month, day] = match;
  const name = weekday.format(new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))).replace(".", "");
  return `${name} ${day}.${month}.`;
}

/** "Krachparade 2027" → "KP27"; other names stay as they are. */
export function shortEditionName(name: string): string {
  const match = /^Krachparade (\d{2})(\d{2})$/.exec(name.trim());
  return match ? `KP${match[2]}` : name;
}

/** Elements with status "late" (negative buffer or overdue), for "x in Verzug". */
export function countLate(elements: Iterable<{ status: Status }>): number {
  let count = 0;
  for (const element of elements) {
    if (element.status === "late") count += 1;
  }
  return count;
}
