import { describe, expect, it } from "vitest";
import { NEWS, type NewsEntry } from "./entries";
import { formatNewsDate, hasUnread, latestNewsId } from "./news";

function isCalendarDay(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}

describe("NEWS", () => {
  it("has unique ids", () => {
    const ids = NEWS.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has valid calendar days, newest first (same day: file order)", () => {
    for (const entry of NEWS) expect(isCalendarDay(entry.date), entry.id).toBe(true);
    const dates = NEWS.map((entry) => entry.date);
    expect(dates).toEqual([...dates].sort().reverse());
  });

  it("has 1–5 points and titles of at most 60 characters", () => {
    for (const entry of NEWS) {
      expect(entry.items.length, entry.id).toBeGreaterThanOrEqual(1);
      expect(entry.items.length, entry.id).toBeLessThanOrEqual(5);
      expect(entry.title.length, entry.id).toBeLessThanOrEqual(60);
    }
  });

  it("never uses the old term", () => {
    const texts = NEWS.flatMap((entry) => [entry.title, ...entry.items.flatMap((item) => [item.lead, item.text ?? ""])]);
    expect(texts.filter((text) => /D-Day|D[-−]\d/.test(text))).toEqual([]);
  });
});

const ENTRIES: NewsEntry[] = [
  { id: "new", date: "2026-10-16", title: "Neu", items: [{ lead: "A" }] },
  { id: "old", date: "2026-10-15", title: "Alt", items: [{ lead: "B" }] },
];

describe("latestNewsId", () => {
  it("is the first entry, null without entries", () => {
    expect(latestNewsId(ENTRIES)).toBe("new");
    expect(latestNewsId([])).toBeNull();
  });

  it("is the entry of spec 032", () => {
    expect(latestNewsId(NEWS)).toBe("032-bestaetigungs-mail");
  });
});

describe("hasUnread", () => {
  it("is true without a stored value", () => {
    expect(hasUnread(ENTRIES, null)).toBe(true);
    expect(hasUnread(ENTRIES, undefined)).toBe(true);
  });

  it("is true for an older entry", () => {
    expect(hasUnread(ENTRIES, "old")).toBe(true);
  });

  it("is false for the newest entry", () => {
    expect(hasUnread(ENTRIES, "new")).toBe(false);
  });

  it("is true for an unknown value", () => {
    expect(hasUnread(ENTRIES, "gibt-es-nicht")).toBe(true);
  });

  it("is false without entries", () => {
    expect(hasUnread([], null)).toBe(false);
  });
});

describe("formatNewsDate", () => {
  it("formats German dates", () => {
    expect(formatNewsDate("2026-10-16")).toBe("16.10.2026");
    expect(formatNewsDate("2027-05-08")).toBe("08.05.2027");
  });

  it("rejects other formats", () => {
    expect(() => formatNewsDate("16.10.2026")).toThrow();
  });
});
