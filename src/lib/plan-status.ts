// Status names and reasons of plan elements (spec 025), the one place for
// these texts: panel and sheet, week list, "/meine", AK workspace and cards.
// Pure functions.
import { NBSP } from "./dday";
import { dayToDate } from "./plan-days";
import type { PlanStatusReason, ReasonDetail, Status } from "./plan-engine";
import { formatWeekdayShort } from "./plan-preview";

/** Erreicht · On track · Wackelt · Zu früh · Verzug */
export function statusLabel(status: Status, reason: PlanStatusReason): string {
  switch (status) {
    case "done":
      return "Erreicht";
    case "ok":
      return "On track";
    case "late":
      return "Verzug";
    default:
      return reason === "too_early" || reason === "before_predecessor" ? "Zu früh" : "Wackelt";
  }
}

export type SituationCounts = { late: number; wobbly: number; early: number };

/**
 * Counts for "n Verzug", "n wackelt" and "n zu früh" (spec 025): "wackelt"
 * only counts the assessment, "zu früh" the elements before their window.
 */
export function situationCounts(
  elements: readonly { status: Status; reason: PlanStatusReason }[]
): SituationCounts {
  const counts: SituationCounts = { late: 0, wobbly: 0, early: 0 };
  for (const { status, reason } of elements) {
    if (status === "late") counts.late++;
    else if (status === "warn") {
      if (statusLabel(status, reason) === "Zu früh") counts.early++;
      else counts.wobbly++;
    }
  }
  return counts;
}

/** "3 T" with a non-breaking space, so it never wraps. */
export function daysShort(days: number): string {
  return `${days}${NBSP}T`;
}

function plural(days: number): string {
  return days === 1 ? "1 Tag" : `${days} Tage`;
}

/**
 * Why an element has its status, as in the status table of spec 025 ("–"
 * for "ok"). `names` maps element ids to names, `dDay` = "YYYY-MM-DD".
 */
export function reasonText(
  result: { reason: PlanStatusReason; reasonDetail: ReasonDetail },
  names: ReadonlyMap<string, string>,
  dDay: string
): string {
  const { day, latestDay, days, elementId } = result.reasonDetail;
  const date = (value: number | undefined) => (value === undefined ? "?" : formatWeekdayShort(dayToDate(value, dDay)));
  switch (result.reason) {
    case "done":
      return `Erreicht am ${date(day)}`;
    case "fixed_unreachable":
      return `Vorgänger werden frühestens ${date(day)} fertig – zu spät für den festen Termin`;
    case "fixed_too_late":
      return `Nachfolger brauchen es spätestens ${date(day)} – der feste Termin ist zu spät`;
    case "overdue":
      return `Überfällig seit ${date(day)}`;
    case "no_window":
      return `Kein Fenster mehr: frühestens ${date(day)}, spätestens ${date(latestDay)}`;
    case "too_late":
      return `Zu spät geplant: ${plural(days ?? 0)} nach dem spätesten Start`;
    case "too_early":
      return `Zu früh geplant: frühestens ${date(day)}`;
    case "before_predecessor":
      return `Liegt vor dem Ende von ${(elementId && names.get(elementId)) ?? "?"} (mind. ${daysShort(days ?? 0)} danach)`;
    case "wobbly":
      return "Wackelt (Einschätzung)";
    default:
      return "–";
  }
}
