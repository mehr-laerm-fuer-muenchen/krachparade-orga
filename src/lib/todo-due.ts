// Due date of a plan to-do as text (spec 023). Pure functions; the due day
// itself comes from todoDueDay in plan-engine.
import { dayToDate } from "./plan-days";

export type TodoAnchor = "start" | "end";

/** "zum Start", "1 Tag vor Start", "3 Tage vor Ende" */
export function todoDueOrigin(days: number, anchor: TodoAnchor): string {
  const point = anchor === "start" ? "Start" : "Ende";
  if (days === 0) return `zum ${point}`;
  return `${days} ${days === 1 ? "Tag" : "Tage"} vor ${point}`;
}

/** Day relative to the D-Day → "18.12." */
function dayMonth(day: number, dDay: string): string {
  const [, month, date] = dayToDate(day, dDay).split("-");
  return `${date}.${month}.`;
}

/**
 * "fällig 18.12. (3 Tage vor Start)"; with `overdue` "war fällig 18.12. (…)".
 * `dueDay` is relative to the D-Day `dDay` ("YYYY-MM-DD").
 */
export function formatTodoDue(
  days: number,
  anchor: TodoAnchor,
  dueDay: number,
  dDay: string,
  overdue = false
): string {
  return `${overdue ? "war fällig" : "fällig"} ${dayMonth(dueDay, dDay)} (${todoDueOrigin(days, anchor)})`;
}
