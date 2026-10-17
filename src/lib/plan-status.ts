// Status names and reasons of plan elements (spec 025), the one place for
// these texts: panel and sheet, week list, "/meine", AK workspace and cards.
// Pure functions.
import { NBSP } from "./dday";
import type { PlanCause } from "./plan-cause";
import { dayToDate } from "./plan-days";
import {
  resolvePlacement,
  type ComputedElement,
  type PlanElementInput,
  type PlanStatusReason,
  type ReasonDetail,
  type Status,
} from "./plan-engine";
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

const CAUSE_NAMES: Record<PlanCause["kind"], string> = {
  fixed_late: "fester Termin zu spät",
  overdue: "überfällig",
  placed_late: "zu spät gelegt",
  done_late: "spät erreicht",
};

/** "wegen Kooperationsgespräch KVR/Polizei (fester Termin zu spät)" (spec 026). */
export function causeText(cause: PlanCause, name: string): string {
  return `wegen ${name} (${CAUSE_NAMES[cause.kind]})`;
}

type WindowResult = Pick<
  ComputedElement,
  "status" | "earliestStart" | "latestStart" | "latestFinish" | "plannedStart" | "plannedEnd" | "slack"
>;

type WindowElement = Pick<PlanElementInput, "kind" | "placement" | "fixedDay" | "fixedOffsetDays" | "freeStartDay">;

/** "17.02." */
function dayMonth(day: number, dDay: string): string {
  const [, month, date] = dayToDate(day, dDay).split("-");
  return `${date}.${month}.`;
}

/** "Luft 50 T" or "keine Luft". */
function slackText(slack: number): string {
  return slack > 0 ? `Luft ${daysShort(slack)}` : "keine Luft";
}

/** "fest · 60 T vorher" for N days before the D-Day, "fest" for a fixed date; null if not fixed. */
function fixedText(element: WindowElement): string | null {
  const resolved = resolvePlacement(element);
  if (resolved.mode !== "fixed") return null;
  return resolved.variant === "offset" ? `fest · ${daysShort(-resolved.start)} vorher` : "fest";
}

/**
 * Short slack on element cards (week list and AK workspace): "Luft 50 T",
 * "keine Luft", "fest" for fixed dates, null for reached elements.
 */
export function slackShort(result: Pick<ComputedElement, "status" | "slack">, element: WindowElement): string | null {
  if (result.status === "done") return null;
  return fixedText(element) ? "fest" : slackText(result.slack);
}

/**
 * Window line of the week list (spec 026): "Fenster 17.02.–08.05. · Luft 50 T"
 * (earliest start to latest finish), "kein Fenster mehr", "fest · 60 T
 * vorher", "festes Datum" or "Erreicht am Mi 17.02.". `dDay` = "YYYY-MM-DD".
 */
export function windowText(result: WindowResult, element: WindowElement, dDay: string): string {
  if (result.status === "done") return `Erreicht am ${formatWeekdayShort(dayToDate(result.plannedEnd, dDay))}`;
  const fixed = fixedText(element);
  if (fixed) return fixed === "fest" ? "festes Datum" : fixed;
  if (result.earliestStart > result.latestStart) return "kein Fenster mehr";
  return `Fenster ${dayMonth(result.earliestStart, dDay)}–${dayMonth(result.latestFinish, dDay)} · ${slackText(result.slack)}`;
}

/**
 * Label of a Gantt bar (spec 026): "17.02.–19.03. · Luft 50 T · 3/5",
 * milestone "24.02. · Luft 70 T", fixed "09.03. · fest · 60 T vorher" or
 * "09.03. · fest", reached "17.02. · erreicht"; `progress` ("3/5", "" without
 * to-dos) at the end.
 */
export function barLabel(result: WindowResult, element: WindowElement, dDay: string, progress = ""): string {
  const dates =
    element.kind === "milestone"
      ? dayMonth(result.plannedStart, dDay)
      : `${dayMonth(result.plannedStart, dDay)}–${dayMonth(result.plannedEnd, dDay)}`;
  const state = result.status === "done" ? "erreicht" : (fixedText(element) ?? slackText(result.slack));
  return [dates, state, progress].filter(Boolean).join(" · ");
}
