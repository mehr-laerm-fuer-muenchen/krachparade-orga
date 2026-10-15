import { describe, expect, it } from "vitest";
import {
  buildRows,
  elbowPath,
  formatDayMonth,
  isoWeek,
  laneSummary,
  mondayOf,
  monthTicks,
  NO_GROUP_KEY,
  rowPositions,
  timeRange,
  weekTicks,
  xOf,
  type GanttElement,
  type GanttGroup,
  type RowOptions,
} from "./gantt-layout";
import { dateToDay, dayToDate } from "./plan-days";

const D_DAY = "2027-05-08"; // a Saturday
const day = (date: string) => dateToDay(date, D_DAY);

function element(overrides: Partial<GanttElement> & { id: string }): GanttElement {
  return {
    name: overrides.id,
    kind: "task",
    workingGroupId: "demo",
    start: -20,
    end: -10,
    latestEnd: -10,
    buffer: 0,
    status: "ok",
    done: false,
    fixed: false,
    ...overrides,
  };
}

const GROUPS: GanttGroup[] = [
  { id: "finanzen", name: "Finanzen", sortOrder: 2 },
  { id: "demo", name: "Demo & Route", sortOrder: 1 },
];

const NONE: RowOptions = { collapsed: new Set(), criticalOnly: false, openOnly: false, criticalPath: [] };

describe("isoWeek and mondayOf", () => {
  it("counts weeks over the turn of the year (KW 53 / KW 1)", () => {
    expect(isoWeek(day("2026-12-28"), D_DAY)).toBe(53);
    expect(isoWeek(day("2026-12-31"), D_DAY)).toBe(53);
    expect(isoWeek(day("2027-01-03"), D_DAY)).toBe(53);
    expect(isoWeek(day("2027-01-04"), D_DAY)).toBe(1);
    expect(isoWeek(day("2027-05-08"), D_DAY)).toBe(18);
  });

  it("weeks run from Monday to Sunday", () => {
    expect(dayToDate(mondayOf(day("2027-05-08"), D_DAY), D_DAY)).toBe("2027-05-03");
    expect(dayToDate(mondayOf(day("2027-05-09"), D_DAY), D_DAY)).toBe("2027-05-03");
    expect(dayToDate(mondayOf(day("2027-05-10"), D_DAY), D_DAY)).toBe("2027-05-10");
    expect(dayToDate(mondayOf(day("2027-01-01"), D_DAY), D_DAY)).toBe("2026-12-28");
  });
});

describe("timeRange and xOf", () => {
  it("starts on the Monday a week before the earliest start or today", () => {
    const range = timeRange([element({ id: "a", start: day("2027-02-17") })], day("2026-10-15"), D_DAY);
    // today (Thu 15.10.) − 7 = Thu 08.10. → Monday 05.10.
    expect(dayToDate(range.start, D_DAY)).toBe("2026-10-05");
    expect(range.end).toBe(21);
  });

  it("uses the earliest start when it lies before today", () => {
    const range = timeRange([element({ id: "a", start: day("2026-09-01") })], day("2026-10-15"), D_DAY);
    expect(dayToDate(range.start, D_DAY)).toBe("2026-08-24");
  });

  it("measures pixels from the start of the range", () => {
    expect(xOf(-10, { start: -20, end: 21 }, 6)).toBe(60);
  });
});

describe("monthTicks and weekTicks", () => {
  const range = { start: day("2026-12-28"), end: day("2027-03-02") };

  it("marks every first of a month", () => {
    expect(monthTicks(range, D_DAY)).toEqual([
      { day: day("2027-01-01"), label: "Jan 27" },
      { day: day("2027-02-01"), label: "Feb 27" },
      { day: day("2027-03-01"), label: "Mär 27" },
    ]);
  });

  it("marks every Monday with its calendar week", () => {
    const ticks = weekTicks(range, D_DAY);
    expect(ticks[0]).toEqual({ day: day("2026-12-28"), label: "KW 53" });
    expect(ticks[1]).toEqual({ day: day("2027-01-04"), label: "KW 1" });
    expect(ticks.at(-1)).toEqual({ day: day("2027-03-01"), label: "KW 9" });
  });

  it("skips a Monday before the range", () => {
    expect(weekTicks({ start: day("2027-01-02"), end: day("2027-01-05") }, D_DAY)).toEqual([
      { day: day("2027-01-04"), label: "KW 1" },
    ]);
  });
});

describe("laneSummary", () => {
  it("spans the elements and shows the worst open status", () => {
    expect(
      laneSummary([
        element({ id: "a", start: -50, end: -40, status: "warn" }),
        element({ id: "b", start: -30, end: -5, status: "late", done: true }),
        element({ id: "c", start: -45, end: -20, status: "ok" }),
      ])
    ).toEqual({ start: -50, end: -5, status: "warn" });
  });

  it("is done when everything is done", () => {
    expect(
      laneSummary([
        element({ id: "a", status: "done", done: true }),
        element({ id: "b", status: "done", done: true }),
      ])?.status
    ).toBe("done");
  });

  it("is empty without elements", () => {
    expect(laneSummary([])).toBeNull();
  });
});

describe("buildRows", () => {
  const elements = [
    element({ id: "budget", name: "Budget", workingGroupId: "finanzen", start: -100, end: -100, kind: "milestone" }),
    element({ id: "route-b", name: "Route B", start: -60, end: -30 }),
    element({ id: "route-a", name: "Route A", start: -60, end: -30, done: true, status: "done" }),
    element({ id: "first", name: "Zuerst", start: -90, end: -70 }),
    element({ id: "short", name: "Kurz", start: -60, end: -50 }),
  ];

  it("lists lanes in AK order with their elements sorted by start, end and name", () => {
    const rows = buildRows(elements, GROUPS, NONE);
    expect(rows.map((row) => (row.type === "lane" ? row.name : row.key))).toEqual([
      "AK Demo & Route",
      "first",
      "short",
      "route-a",
      "route-b",
      "AK Finanzen",
      "budget",
    ]);
    expect(rows[0]).toMatchObject({ visibleCount: 4, totalCount: 4, collapsed: false });
  });

  it("puts elements without a known AK into 'Ohne AK' at the end", () => {
    const rows = buildRows(
      [...elements, element({ id: "loose", workingGroupId: null }), element({ id: "gone", workingGroupId: "deleted" })],
      GROUPS,
      NONE
    );
    const last = rows.findIndex((row) => row.type === "lane" && row.key === NO_GROUP_KEY);
    expect(rows[last]).toMatchObject({ name: "Ohne AK", groupId: null, totalCount: 2 });
    expect(rows.slice(last + 1).map((row) => row.key)).toEqual(["gone", "loose"]);
  });

  it("shows no 'Ohne AK' lane without such elements", () => {
    expect(buildRows(elements, GROUPS, NONE).some((row) => row.key === NO_GROUP_KEY)).toBe(false);
  });

  it("filters to the critical path", () => {
    const rows = buildRows(elements, GROUPS, { ...NONE, criticalOnly: true, criticalPath: ["first", "route-a"] });
    expect(rows.map((row) => row.key)).toEqual(["demo", "first", "route-a", "finanzen"]);
    expect(rows[0]).toMatchObject({ visibleCount: 2, totalCount: 4 });
    expect(rows[3]).toMatchObject({ visibleCount: 0, totalCount: 1, summary: null });
  });

  it("filters to open elements", () => {
    const rows = buildRows(elements, GROUPS, { ...NONE, openOnly: true });
    expect(rows.map((row) => row.key)).not.toContain("route-a");
    expect(rows[0]).toMatchObject({ visibleCount: 3 });
  });

  it("combines both filters", () => {
    const rows = buildRows(elements, GROUPS, {
      ...NONE,
      criticalOnly: true,
      openOnly: true,
      criticalPath: ["first", "route-a"],
    });
    expect(rows.map((row) => row.key)).toEqual(["demo", "first", "finanzen"]);
  });

  it("hides the elements of a collapsed lane but keeps its collective bar", () => {
    const rows = buildRows(elements, GROUPS, { ...NONE, collapsed: new Set(["demo"]) });
    expect(rows.map((row) => row.key)).toEqual(["demo", "finanzen", "budget"]);
    expect(rows[0]).toMatchObject({ collapsed: true, visibleCount: 4, summary: { start: -90, end: -30 } });
  });
});

describe("rowPositions", () => {
  it("stacks lane rows (34 px) and element rows (30 px)", () => {
    const rows = buildRows([element({ id: "a" })], GROUPS, NONE);
    expect(rowPositions(rows)).toEqual({
      positions: [
        { top: 0, height: 34 },
        { top: 34, height: 30 },
        { top: 64, height: 34 },
      ],
      height: 98,
    });
  });
});

describe("elbowPath", () => {
  it("bends just before the successor", () => {
    expect(elbowPath(0, 10, 100, 40)).toBe("M0,10 H92 V40 H100");
  });

  it("goes round when the successor starts too early", () => {
    expect(elbowPath(100, 10, 90, 40)).toBe("M100,10 H108 V25 H82 V40 H90");
  });

  it("is a straight line on the same row", () => {
    expect(elbowPath(0, 10, 50, 10)).toBe("M0,10 H50");
  });
});

describe("formatDayMonth", () => {
  it("shows day and month", () => {
    expect(formatDayMonth(0, D_DAY)).toBe("08.05.");
    expect(formatDayMonth(day("2027-02-17"), D_DAY)).toBe("17.02.");
  });
});
