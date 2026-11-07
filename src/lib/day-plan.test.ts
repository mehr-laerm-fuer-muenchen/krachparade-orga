import { describe, expect, it } from "vitest";
import {
  checkProgress,
  formatEntryTime,
  groupByHour,
  layoutLanes,
  minutesToTime,
  moveEntry,
  resizeEntry,
  snapMinutes,
  timelineRange,
  timeToMinutes,
  validateDayTemplate,
  type DayTemplate,
} from "./day-plan";

const at = (start: string | null, end?: string, approx = false) => ({
  startMinute: start === null ? null : timeToMinutes(start),
  endMinute: end === undefined ? null : timeToMinutes(end),
  approx,
});

describe("timeToMinutes / minutesToTime", () => {
  it("converts both ways", () => {
    expect(timeToMinutes("11:15")).toBe(675);
    expect(timeToMinutes("9:05")).toBe(545);
    expect(minutesToTime(675)).toBe("11:15");
    expect(minutesToTime(545)).toBe("09:05");
  });

  it("handles the edges of the day", () => {
    expect(timeToMinutes("00:00")).toBe(0);
    expect(timeToMinutes("23:59")).toBe(1439);
    expect(minutesToTime(0)).toBe("00:00");
    expect(minutesToTime(1439)).toBe("23:59");
  });

  it("rejects what is no time of day", () => {
    expect(timeToMinutes("24:00")).toBeNull();
    expect(timeToMinutes("12:60")).toBeNull();
    expect(timeToMinutes("12")).toBeNull();
    expect(timeToMinutes("")).toBeNull();
  });
});

describe("snapMinutes", () => {
  it("rounds to the grid", () => {
    expect(snapMinutes(677)).toBe(675);
    expect(snapMinutes(678)).toBe(680);
    expect(snapMinutes(-3)).toBe(-5);
    expect(snapMinutes(22, 15)).toBe(15);
  });
});

describe("formatEntryTime", () => {
  it("formats all kinds of entries", () => {
    expect(formatEntryTime(at("11:00", "11:15"))).toBe("11:00–11:15");
    expect(formatEntryTime(at("19:45", undefined, true))).toBe("ca. 19:45");
    expect(formatEntryTime(at("09:00"))).toBe("09:00");
    expect(formatEntryTime(at(null))).toBe("ohne Uhrzeit");
    expect(formatEntryTime(at("00:00", "23:59"))).toBe("00:00–23:59");
  });
});

describe("moveEntry", () => {
  it("keeps the duration", () => {
    expect(moveEntry(at("10:00", "11:00"), 30)).toEqual({ startMinute: 630, endMinute: 690 });
    expect(moveEntry(at("10:00"), -15)).toEqual({ startMinute: 585, endMinute: null });
  });

  it("stops at 0:00 and 23:59 without changing the duration", () => {
    expect(moveEntry(at("00:10", "01:10"), -30)).toEqual({ startMinute: 0, endMinute: 60 });
    expect(moveEntry(at("23:00", "23:30"), 60)).toEqual({ startMinute: 1409, endMinute: 1439 });
    expect(moveEntry(at("23:50"), 30)).toEqual({ startMinute: 1439, endMinute: null });
  });

  it("leaves entries without a time alone", () => {
    expect(moveEntry(at(null), 15)).toEqual({ startMinute: null, endMinute: null });
  });
});

describe("resizeEntry", () => {
  it("sets the new end", () => {
    expect(resizeEntry(at("14:00", "16:00"), 990)).toBe(990);
  });

  it("keeps at least five minutes and at most 23:59", () => {
    expect(resizeEntry(at("14:00", "16:00"), 800)).toBe(845);
    expect(resizeEntry(at("23:00", "23:30"), 1500)).toBe(1439);
    expect(resizeEntry(at("23:57"), 1439)).toBe(1439);
    expect(resizeEntry(at("23:59"), 1439)).toBeNull();
    expect(resizeEntry(at(null), 600)).toBeNull();
  });
});

describe("layoutLanes", () => {
  const entry = (id: string, start: string | null, end?: string) => ({ id, ...at(start, end) });
  const lanes = (result: ReturnType<typeof layoutLanes<ReturnType<typeof entry>>>) =>
    Object.fromEntries(result.map((item) => [item.entry.id, [item.lane, item.laneCount]]));

  it("puts entries without overlap in one lane", () => {
    expect(lanes(layoutLanes([entry("a", "10:00", "11:00"), entry("b", "11:00", "12:00")]))).toEqual({
      a: [0, 1],
      b: [0, 1],
    });
  });

  it("puts three overlapping entries side by side", () => {
    const result = layoutLanes([
      entry("a", "13:00", "13:35"),
      entry("b", "13:15", "14:00"),
      entry("c", "13:30", "13:45"),
      entry("d", "15:00", "16:00"),
    ]);
    expect(lanes(result)).toEqual({ a: [0, 3], b: [1, 3], c: [2, 3], d: [0, 1] });
  });

  it("reuses a free lane in the same group", () => {
    const result = layoutLanes([
      entry("a", "10:00", "12:00"),
      entry("b", "10:00", "10:30"),
      entry("c", "10:30", "11:00"),
    ]);
    expect(lanes(result)).toEqual({ a: [1, 2], b: [0, 2], c: [0, 2] });
  });

  it("counts points in time as 20 minutes", () => {
    expect(lanes(layoutLanes([entry("a", "12:00"), entry("b", "12:15", "13:00")]))).toEqual({
      a: [0, 2],
      b: [1, 2],
    });
    expect(lanes(layoutLanes([entry("a", "12:00"), entry("b", "12:20", "13:00")]))).toEqual({
      a: [0, 1],
      b: [0, 1],
    });
  });

  it("leaves out entries without a time", () => {
    expect(layoutLanes([entry("a", null)])).toEqual([]);
  });
});

describe("timelineRange", () => {
  it("is 08:00–24:00 by default", () => {
    expect(timelineRange([])).toEqual({ start: 480, end: 1440 });
    expect(timelineRange([at("09:00", "10:00"), at(null)])).toEqual({ start: 480, end: 1440 });
  });

  it("widens to full hours around early and late entries", () => {
    expect(timelineRange([at("06:30", "07:00")])).toEqual({ start: 360, end: 1440 });
    expect(timelineRange([at("00:00")])).toEqual({ start: 0, end: 1440 });
    expect(timelineRange([at("23:59")])).toEqual({ start: 480, end: 1440 });
  });
});

describe("groupByHour", () => {
  it("groups by hour, sorted by start and end, without time last", () => {
    const entries = [
      { id: "c", ...at("11:00", "13:00") },
      { id: "x", ...at(null) },
      { id: "a", ...at("09:00") },
      { id: "b", ...at("11:00", "11:15") },
      { id: "d", ...at("00:00") },
    ];
    const groups = groupByHour(entries);
    expect(groups.map((group) => group.label)).toEqual(["00 Uhr", "09 Uhr", "11 Uhr", "Ohne Uhrzeit"]);
    expect(groups[2].entries.map((entry) => entry.id)).toEqual(["b", "c"]);
    expect(groups[3].entries.map((entry) => entry.id)).toEqual(["x"]);
  });
});

describe("checkProgress", () => {
  it("counts done and all checkpoints", () => {
    expect(checkProgress([])).toEqual({ done: 0, total: 0, complete: false });
    expect(checkProgress([{ done: true }, { done: false }])).toEqual({ done: 1, total: 2, complete: false });
    expect(checkProgress([{ done: true }])).toEqual({ done: 1, total: 1, complete: true });
  });
});

describe("validateDayTemplate", () => {
  const valid: DayTemplate = {
    tracks: ["A", "B"],
    entries: [
      { track: "A", title: "Eins", start: "10:00", end: "11:00", checks: ["Punkt"] },
      { track: "B", title: "Zwei", start: null },
    ],
    roles: [{ title: "Rolle" }],
  };

  it("accepts a valid template", () => {
    expect(validateDayTemplate(valid)).toEqual([]);
  });

  it("finds missing columns and bad times", () => {
    const problems = validateDayTemplate({
      ...valid,
      entries: [
        { track: "C", title: "Fehlt", start: "10:00" },
        { track: "A", title: "Rückwärts", start: "11:00", end: "10:00" },
        { track: "A", title: "Kaputt", start: "25:00" },
        { track: "A", title: "Ende ohne Start", start: null, end: "10:00" },
      ],
    });
    expect(problems).toHaveLength(4);
  });

  it("finds duplicate columns", () => {
    expect(validateDayTemplate({ ...valid, tracks: ["A", "A", "B"] })).toContain("Spalten doppelt");
  });
});
