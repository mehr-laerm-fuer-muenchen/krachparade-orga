import { describe, expect, it } from "vitest";
import { parseMoment, readCursor, writeCursor } from "./cursor";

describe("readCursor / writeCursor", () => {
  it("round-trips a moment", () => {
    const date = new Date("2026-11-06T05:45:00.000Z");
    expect(writeCursor(date)).toBe("<!-- triage-bis: 2026-11-06T05:45:00.000Z -->");
    expect(readCursor(`Bericht\n\n${writeCursor(date)}\n`)?.toISOString()).toBe(date.toISOString());
  });

  it("returns null without a marker or with an invalid one", () => {
    expect(readCursor(null)).toBeNull();
    expect(readCursor("")).toBeNull();
    expect(readCursor("kein Marker")).toBeNull();
    expect(readCursor("<!-- triage-bis: gestern -->")).toBeNull();
    expect(readCursor("<!-- triage-bis: 2026-13-45T99:00:00.000Z -->")).toBeNull();
    expect(readCursor("<!-- triage-bis: 2026-11-06 -->")).toBeNull();
    expect(readCursor("<!-- triage-bis: 2026-11-06T05:45:00+01:00 -->")).toBeNull();
  });

  it("takes the last marker", () => {
    const body = "<!-- triage-bis: 2026-01-01T00:00:00.000Z -->\n…\n<!-- triage-bis: 2026-11-06T05:45:00.000Z -->";
    expect(readCursor(body)?.toISOString()).toBe("2026-11-06T05:45:00.000Z");
  });

  it("parseMoment accepts only UTC ISO moments", () => {
    expect(parseMoment("2026-11-06T05:45:00Z")?.toISOString()).toBe("2026-11-06T05:45:00.000Z");
    expect(parseMoment("")).toBeNull();
    expect(parseMoment(undefined)).toBeNull();
  });
});
