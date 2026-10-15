// Display logic for the Gantt view (spec 007): time axis, weeks and rows.
// Days are whole numbers relative to the D-Day as in the plan engine
// (0 = D-Day, -80 = 80 days before). Pure functions, no database, no clock.
import type { Status } from "@/components/status-pill";
import { formatDLabel } from "./dday";
import { dayToDate } from "./plan-days";
import type { PlanElementKind, PlanStatusReason } from "./plan-engine";
import { formatWeekdayShort } from "./plan-preview";
import { displayGroupName } from "./working-groups";

/** A computed plan element as the Gantt draws it (from loadPlan + computePlan). */
export type GanttElement = {
  id: string;
  name: string;
  kind: PlanElementKind;
  workingGroupId: string | null;
  /** Planned start; for a milestone its day. */
  start: number;
  /** Planned end; equals `start` for a milestone. */
  end: number;
  /** Latest end that keeps all successors on time. */
  latestEnd: number;
  /** Negative = too late. */
  buffer: number;
  status: Status;
  done: boolean;
  fixed: boolean;
};

export type GanttGroup = { id: string; name: string; sortOrder: number };

export type GanttLink = { fromId: string; toId: string | null; lagDays: number };

export type TimeRange = { start: number; end: number };

export type Zoom = "quarter" | "month" | "week";

/** Pixels per day for each zoom level. */
export const ZOOM_PX: Record<Zoom, number> = { quarter: 3, month: 6, week: 12 };

/** Lane key of elements without a working group. */
export const NO_GROUP_KEY = "none";

const DAY_MS = 24 * 60 * 60 * 1000;
const MONTHS = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

function utcDate(day: number, dDay: string): Date {
  return new Date(`${dayToDate(day, dDay)}T00:00:00Z`);
}

/** 0 = Monday … 6 = Sunday. */
function weekdayIndex(day: number, dDay: string): number {
  return (utcDate(day, dDay).getUTCDay() + 6) % 7;
}

/** Monday of the week (Mo–Su) that contains `day`. */
export function mondayOf(day: number, dDay: string): number {
  return day - weekdayIndex(day, dDay);
}

/** ISO calendar week of `day` (week 1 holds the first Thursday of the year). */
export function isoWeek(day: number, dDay: string): number {
  const date = utcDate(day, dDay);
  const thursday = new Date(date.getTime() + (3 - weekdayIndex(day, dDay)) * DAY_MS);
  const januaryFirst = Date.UTC(thursday.getUTCFullYear(), 0, 1);
  return 1 + Math.floor((thursday.getTime() - januaryFirst) / DAY_MS / 7);
}

/**
 * Visible days: from the Monday before (earliest start or today, whichever
 * is earlier, minus a week) to three weeks after the D-Day.
 */
export function timeRange(elements: readonly Pick<GanttElement, "start">[], today: number, dDay: string): TimeRange {
  const earliest = Math.min(today, ...elements.map((element) => element.start));
  return { start: mondayOf(earliest - 7, dDay), end: 21 };
}

/** Left edge of `day` in pixels. */
export function xOf(day: number, range: TimeRange, pxPerDay: number): number {
  return (day - range.start) * pxPerDay;
}

export type Tick = { day: number; label: string };

/** Every first of a month in the range, labelled "Mär 27". */
export function monthTicks(range: TimeRange, dDay: string): Tick[] {
  const ticks: Tick[] = [];
  for (let day = range.start; day <= range.end; day++) {
    const date = utcDate(day, dDay);
    if (date.getUTCDate() === 1) {
      const year = String(date.getUTCFullYear() % 100).padStart(2, "0");
      ticks.push({ day, label: `${MONTHS[date.getUTCMonth()]} ${year}` });
    }
  }
  return ticks;
}

/** Every Monday in the range, labelled "KW n". */
export function weekTicks(range: TimeRange, dDay: string): Tick[] {
  const ticks: Tick[] = [];
  let day = mondayOf(range.start, dDay);
  if (day < range.start) day += 7;
  for (; day <= range.end; day += 7) {
    ticks.push({ day, label: `KW ${isoWeek(day, dDay)}` });
  }
  return ticks;
}

export type LaneSummary = { start: number; end: number; status: Status };

const STATUS_RANK: Record<Exclude<Status, "done">, number> = { ok: 0, warn: 1, late: 2 };

/** Earliest start, latest end and the worst status of the open elements (all done → done). */
export function laneSummary(elements: readonly GanttElement[]): LaneSummary | null {
  if (elements.length === 0) return null;
  let worst: Exclude<Status, "done"> | null = null;
  for (const element of elements) {
    if (element.done || element.status === "done") continue;
    if (worst === null || STATUS_RANK[element.status] > STATUS_RANK[worst]) worst = element.status;
  }
  return {
    start: Math.min(...elements.map((element) => element.start)),
    end: Math.max(...elements.map((element) => element.end)),
    status: worst ?? "done",
  };
}

export type LaneRow = {
  type: "lane";
  key: string;
  groupId: string | null;
  name: string;
  visibleCount: number;
  totalCount: number;
  collapsed: boolean;
  /** Collective bar over the visible elements; null if none is visible. */
  summary: LaneSummary | null;
};

export type ElementRow = { type: "element"; key: string; laneKey: string; element: GanttElement };

export type GanttRow = LaneRow | ElementRow;

export type RowOptions = {
  /** Lane keys (working group ids, `NO_GROUP_KEY`) that are collapsed. */
  collapsed: ReadonlySet<string>;
  criticalOnly: boolean;
  openOnly: boolean;
  criticalPath: readonly string[];
};

function byStartEndName(a: GanttElement, b: GanttElement): number {
  return a.start - b.start || a.end - b.end || a.name.localeCompare(b.name, "de");
}

/**
 * One lane per working group in AK order, each followed (unless collapsed) by
 * its visible elements sorted by start, end and name. Elements without a
 * (known) group go into a lane "Ohne AK" at the end, only if there are any.
 * Lanes stay even when the filters hide all their elements.
 */
export function buildRows(
  elements: readonly GanttElement[],
  groups: readonly GanttGroup[],
  options: RowOptions
): GanttRow[] {
  const critical = new Set(options.criticalPath);
  const visible = (element: GanttElement) =>
    (!options.criticalOnly || critical.has(element.id)) && (!options.openOnly || !element.done);

  const known = new Set(groups.map((group) => group.id));
  const laneKeyOf = (element: GanttElement) =>
    element.workingGroupId !== null && known.has(element.workingGroupId) ? element.workingGroupId : NO_GROUP_KEY;

  const lanes: { key: string; groupId: string | null; name: string }[] = [...groups]
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "de"))
    .map((group) => ({ key: group.id, groupId: group.id, name: displayGroupName(group.name) }));
  if (elements.some((element) => laneKeyOf(element) === NO_GROUP_KEY)) {
    lanes.push({ key: NO_GROUP_KEY, groupId: null, name: "Ohne AK" });
  }

  const rows: GanttRow[] = [];
  for (const lane of lanes) {
    const all = elements.filter((element) => laneKeyOf(element) === lane.key);
    const shown = all.filter(visible).sort(byStartEndName);
    const collapsed = options.collapsed.has(lane.key);
    rows.push({
      type: "lane",
      ...lane,
      visibleCount: shown.length,
      totalCount: all.length,
      collapsed,
      summary: laneSummary(shown),
    });
    if (!collapsed) {
      for (const element of shown) {
        rows.push({ type: "element", key: element.id, laneKey: lane.key, element });
      }
    }
  }
  return rows;
}

/** Row heights in pixels (test layout v4). */
export const HEADER_HEIGHT = 40;
export const LANE_ROW_HEIGHT = 34;
export const ELEMENT_ROW_HEIGHT = 30;

export type RowPosition = { top: number; height: number };

/** Top and height of each row below the header, plus the total body height. */
export function rowPositions(rows: readonly GanttRow[]): { positions: RowPosition[]; height: number } {
  let top = 0;
  const positions = rows.map((row) => {
    const height = row.type === "lane" ? LANE_ROW_HEIGHT : ELEMENT_ROW_HEIGHT;
    const position = { top, height };
    top += height;
    return position;
  });
  return { positions, height: top };
}

/**
 * Right-angled arrow path from the end of a predecessor (x1, y1) to the start
 * of a successor (x2, y2). Goes round the back if the successor starts too
 * close to or before the predecessor's end.
 */
export function elbowPath(x1: number, y1: number, x2: number, y2: number): string {
  const gap = 8;
  if (y1 === y2 && x2 >= x1) return `M${x1},${y1} H${x2}`;
  if (x2 - x1 >= 2 * gap) {
    const xm = x2 - gap;
    return `M${x1},${y1} H${xm} V${y2} H${x2}`;
  }
  const ym = y1 + (y2 - y1) / 2;
  return `M${x1},${y1} H${x1 + gap} V${ym} H${x2 - gap} V${y2} H${x2}`;
}

/** "17.02." */
export function formatDayMonth(day: number, dDay: string): string {
  const [, month, date] = dayToDate(day, dDay).split("-");
  return `${date}.${month}.`;
}

// ---------------------------------------------------------------------------
// Week list "Was steht an" and detail panel (spec 007, part B).

/** A to-do of a plan element; `due` is computed on the server (todoDueDay). */
export type PlanTodoView = {
  id: string;
  text: string;
  ownerName: string | null;
  anchor: "start" | "end";
  daysBefore: number;
  due: number;
  done: boolean;
};

/** A note on a plan element; `date` is the calendar day in Europe/Berlin. */
export type PlanNoteView = { id: string; authorName: string; date: string; text: string };

/** Everything the plan page shows of an element, computed on the server. */
export type PlanViewElement = GanttElement & {
  latestStart: number;
  reason: PlanStatusReason;
  wobbly: boolean;
  /** Display name "AK ‹Name›". */
  workingGroupName: string | null;
  departmentName: string | null;
  ownerName: string | null;
  todos: PlanTodoView[];
  /** Newest first. */
  notes: PlanNoteView[];
};

export type AgendaElement = GanttElement & {
  reason: PlanStatusReason;
  /** Display name "AK ‹Name›". */
  workingGroupName: string | null;
  ownerName: string | null;
  todos: readonly Pick<PlanTodoView, "id" | "text" | "ownerName" | "anchor" | "due" | "done">[];
};

export type AgendaTodo = AgendaElement["todos"][number];

export type AgendaEntry =
  | { type: "element"; key: string; day: number; element: AgendaElement; text: string }
  | { type: "todo"; key: string; day: number; element: AgendaElement; todo: AgendaTodo; text: string };

export type AgendaWeek = {
  monday: number;
  /** "Diese Woche", "Nächste Woche" or "KW n". */
  title: string;
  /** "TT.MM.–TT.MM. · D-x" */
  range: string;
  entries: AgendaEntry[];
};

export type Agenda = { overdue: AgendaEntry[]; weeks: AgendaWeek[]; hasMore: boolean };

export type AgendaOptions = {
  /** Number of weeks to show at most (the current week counts). */
  weeks: number;
  /** Only elements of these working groups; null = all (also without AK). */
  myGroupIds: readonly string[] | null;
};

function weekday(day: number, dDay: string): string {
  return formatWeekdayShort(dayToDate(day, dDay));
}

function lateText(element: AgendaElement): string {
  if (element.reason === "fixed_too_late") return `Fixtermin liegt ${-element.buffer} Tage zu spät`;
  if (element.reason === "overdue") return "Termin vorbei, nicht abgehakt";
  return "Puffer negativ";
}

function todoText(element: AgendaElement, todo: AgendaTodo, dDay: string, overdue: boolean): string {
  if (overdue) return `für ${element.name} · war fällig ${weekday(todo.due, dDay)}`;
  const parts = [`für ${element.name}`, `fällig ${weekday(todo.due, dDay)}`];
  if (todo.ownerName) parts.push(todo.ownerName);
  return parts.join(" · ");
}

function byDayThenName(a: AgendaEntry, b: AgendaEntry): number {
  const nameA = a.type === "todo" ? a.todo.text : a.element.name;
  const nameB = b.type === "todo" ? b.todo.text : b.element.name;
  return a.day - b.day || nameA.localeCompare(nameB, "de");
}

/**
 * "Was steht an": overdue and late items first, then weeks (Mo–Su) from the
 * current week on. The current week is always there, further weeks only with
 * entries, until `weeks` weeks are shown or the week of the D-Day is over.
 */
export function weekAgenda(
  plan: { dDay: string; elements: readonly AgendaElement[] },
  today: number,
  options: AgendaOptions
): Agenda {
  const { dDay } = plan;
  const mine = options.myGroupIds === null ? null : new Set(options.myGroupIds);
  const elements = plan.elements.filter(
    (element) => mine === null || (element.workingGroupId !== null && mine.has(element.workingGroupId))
  );

  const overdue: AgendaEntry[] = [];
  const lateIds = new Set<string>();
  for (const element of elements) {
    if (!element.done && element.status === "late") {
      lateIds.add(element.id);
      overdue.push({ type: "element", key: element.id, day: element.end, element, text: lateText(element) });
    }
    for (const todo of element.todos) {
      if (!todo.done && todo.due < today) {
        overdue.push({
          type: "todo",
          key: `todo-${todo.id}`,
          day: todo.due,
          element,
          todo,
          text: todoText(element, todo, dDay, true),
        });
      }
    }
  }
  overdue.sort(byDayThenName);

  const current = mondayOf(today, dDay);
  const lastMonday = Math.max(current, mondayOf(0, dDay));
  const found: AgendaWeek[] = [];
  for (let monday = current; monday <= lastMonday; monday += 7) {
    const sunday = monday + 6;
    const inWeek = (day: number) => day >= monday && day <= sunday;
    const entries: AgendaEntry[] = [];
    for (const element of elements) {
      if (!lateIds.has(element.id)) {
        const entry = (day: number, text: string): AgendaEntry => ({
          type: "element",
          key: element.id,
          day,
          element,
          text,
        });
        if (element.kind === "milestone") {
          if (inWeek(element.start)) entries.push(entry(element.start, `Meilenstein · ${weekday(element.start, dDay)}`));
        } else if (inWeek(element.start)) {
          entries.push(
            entry(element.start, `startet ${weekday(element.start, dDay)} · ${element.end - element.start} Tage`)
          );
        } else if (inWeek(element.end)) {
          entries.push(entry(element.end, `endet ${weekday(element.end, dDay)}`));
        } else if (monday === current && !element.done && element.start < monday && element.end > sunday) {
          entries.push(entry(element.start, `läuft bis ${weekday(element.end, dDay)}`));
        }
      }
      for (const todo of element.todos) {
        if (!todo.done && todo.due >= today && inWeek(todo.due)) {
          entries.push({
            type: "todo",
            key: `todo-${todo.id}`,
            day: todo.due,
            element,
            todo,
            text: todoText(element, todo, dDay, false),
          });
        }
      }
    }
    if (monday !== current && entries.length === 0) continue;
    const index = (monday - current) / 7;
    found.push({
      monday,
      title: index === 0 ? "Diese Woche" : index === 1 ? "Nächste Woche" : `KW ${isoWeek(monday, dDay)}`,
      range: `${formatDayMonth(monday, dDay)}–${formatDayMonth(sunday, dDay)} · ${formatDLabel(
        dayToDate(monday, dDay),
        dDay
      )}`,
      entries: entries.sort(byDayThenName),
    });
  }

  return { overdue, weeks: found.slice(0, options.weeks), hasMore: found.length > options.weeks };
}

/** "Mi 17.02.2027" */
export function formatWeekdayDate(day: number, dDay: string): string {
  const date = dayToDate(day, dDay);
  return `${formatWeekdayShort(date)}${date.slice(0, 4)}`;
}
