import { describe, expect, it } from "vitest";
import type { FeedbackStatus } from "../feedback/status";
import { FRESH_LIMIT, isMondayInBerlin, selectForTriage, shortId, shouldReport, type TriageRow } from "./select";

const NOW = new Date("2026-11-06T05:45:00.000Z"); // Friday

function uuid(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
}

function row(n: number, createdAt: string, status: FeedbackStatus = "new"): TriageRow {
  return {
    id: uuid(n),
    kind: "bug",
    message: `E2E Meldung ${n}`,
    pagePath: "/",
    pageTitle: null,
    context: null,
    device: null,
    viewport: null,
    status,
    reply: null,
    createdAt: new Date(createdAt),
    updatedAt: new Date(createdAt),
  };
}

/** n rows, one minute apart, starting at `start`. */
function rows(count: number, start = "2026-11-01T10:00:00.000Z", status: FeedbackStatus = "new"): TriageRow[] {
  const base = new Date(start).getTime();
  return Array.from({ length: count }, (_, i) => row(i + 1, new Date(base + i * 60_000).toISOString(), status));
}

describe("selectForTriage", () => {
  it("handles an empty table", () => {
    const selection = selectForTriage([], null, NOW);
    expect(selection).toEqual({ fresh: [], restCount: 0, stale: [], newCursor: null, statusById: {} });
    expect(shouldReport(selection, NOW)).toBe(false);
  });

  it("keeps the old cursor when nothing is new", () => {
    const cursor = new Date("2026-11-05T05:45:00.000Z");
    const selection = selectForTriage([row(1, "2026-11-01T10:00:00.000Z")], cursor, NOW);
    expect(selection.fresh).toEqual([]);
    expect(selection.newCursor).toBe(cursor);
  });

  it("first run takes only open entries, oldest first", () => {
    const table = [
      row(1, "2026-10-20T10:00:00.000Z", "done"),
      row(2, "2026-10-25T10:00:00.000Z", "in_progress"),
      row(3, "2026-10-21T10:00:00.000Z", "new"),
      row(4, "2026-10-22T10:00:00.000Z", "rejected"),
    ];
    const selection = selectForTriage(table, null, NOW);
    expect(selection.fresh.map((r) => r.id)).toEqual([uuid(3), uuid(2)]);
    expect(selection.newCursor?.toISOString()).toBe("2026-10-25T10:00:00.000Z");
    expect(selection.restCount).toBe(0);
    expect(selection.statusById).toEqual({
      [uuid(1)]: "done",
      [uuid(2)]: "in_progress",
      [uuid(3)]: "new",
      [uuid(4)]: "rejected",
    });
  });

  it("with a cursor takes everything after it, whatever the status", () => {
    const cursor = new Date("2026-11-02T00:00:00.000Z");
    const table = [
      row(1, "2026-11-01T10:00:00.000Z"),
      row(2, "2026-11-02T00:00:00.000Z"), // exactly the cursor: already seen
      row(3, "2026-11-03T10:00:00.000Z", "done"),
      row(4, "2026-11-04T10:00:00.000Z", "rejected"),
    ];
    const selection = selectForTriage(table, cursor, NOW);
    expect(selection.fresh.map((r) => r.id)).toEqual([uuid(3), uuid(4)]);
  });

  it("takes at most 40, the second run gets the rest", () => {
    const table = rows(45);
    const first = selectForTriage(table, null, NOW);
    expect(first.fresh).toHaveLength(FRESH_LIMIT);
    expect(first.restCount).toBe(5);
    expect(first.fresh[0].id).toBe(uuid(1));
    expect(first.newCursor).toEqual(table[39].createdAt);

    const second = selectForTriage(table, first.newCursor, NOW);
    expect(second.fresh.map((r) => r.id)).toEqual([41, 42, 43, 44, 45].map(uuid));
    expect(second.restCount).toBe(0);
  });

  it("does not split entries of the same moment at the limit", () => {
    const table = rows(41);
    table[40].createdAt = table[39].createdAt; // 40th and 41st at the same moment
    const first = selectForTriage(table, null, NOW);
    expect(first.fresh).toHaveLength(39);
    expect(first.restCount).toBe(2);
    const second = selectForTriage(table, first.newCursor, NOW);
    expect(second.fresh.map((r) => r.id)).toEqual([uuid(40), uuid(41)]);
  });

  it("stale: new, older than 7 days, not fresh", () => {
    const cursor = new Date("2026-11-01T00:00:00.000Z");
    const table = [
      row(1, "2026-10-20T10:00:00.000Z", "new"),
      row(2, "2026-10-20T11:00:00.000Z", "in_progress"),
      row(3, "2026-10-30T05:45:00.000Z", "new"), // exactly 7 days: not older
      row(4, "2026-11-05T10:00:00.000Z", "new"), // fresh
    ];
    const selection = selectForTriage(table, cursor, NOW);
    expect(selection.stale.map((r) => r.id)).toEqual([uuid(1)]);
    expect(selection.fresh.map((r) => r.id)).toEqual([uuid(4)]);
  });

  it("an old entry in the first run is fresh, not stale", () => {
    const selection = selectForTriage([row(1, "2026-09-01T10:00:00.000Z")], null, NOW);
    expect(selection.fresh).toHaveLength(1);
    expect(selection.stale).toEqual([]);
  });
});

describe("shouldReport / isMondayInBerlin", () => {
  const staleOnly = { fresh: [], stale: [row(1, "2026-10-01T10:00:00.000Z")] };

  it("reports with fresh entries on any day", () => {
    expect(shouldReport({ fresh: [row(1, "2026-11-05T10:00:00.000Z")], stale: [] }, NOW)).toBe(true);
  });

  it("Monday 00:30 Berlin (Sunday 23:30 UTC) counts as Monday", () => {
    const now = new Date("2026-11-08T23:30:00.000Z");
    expect(isMondayInBerlin(now)).toBe(true);
    expect(shouldReport(staleOnly, now)).toBe(true);
  });

  it("Sunday 23:59 Berlin is not Monday", () => {
    const now = new Date("2026-11-08T22:59:00.000Z");
    expect(isMondayInBerlin(now)).toBe(false);
    expect(shouldReport(staleOnly, now)).toBe(false);
  });

  it("Tuesday 00:30 Berlin (Monday 23:30 UTC) is not Monday", () => {
    const now = new Date("2026-11-09T23:30:00.000Z");
    expect(isMondayInBerlin(now)).toBe(false);
    expect(shouldReport(staleOnly, now)).toBe(false);
  });

  it("Monday 23:59 Berlin in summer time is still Monday", () => {
    expect(isMondayInBerlin(new Date("2027-05-10T21:59:00.000Z"))).toBe(true);
    expect(isMondayInBerlin(new Date("2027-05-10T22:00:00.000Z"))).toBe(false);
  });

  it("no report on Monday without stale entries", () => {
    expect(shouldReport({ fresh: [], stale: [] }, new Date("2026-11-09T05:45:00.000Z"))).toBe(false);
  });
});

describe("shortId", () => {
  it("is the first 8 characters", () => {
    expect(shortId("abcdef12-3456-4000-8000-000000000000")).toBe("abcdef12");
  });
});
