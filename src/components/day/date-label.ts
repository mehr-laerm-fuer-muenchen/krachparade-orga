// Relative import: the Gantt (rendered by Vitest) uses this via day-plan-link.tsx.
import { formatWeekdayShort } from "../../lib/plan-preview";

/** "2027-05-08" → "Sa 08.05.2027" (spec 030). */
export function dayDateLabel(dDay: string): string {
  return `${formatWeekdayShort(dDay)}${dDay.slice(0, 4)}`;
}
