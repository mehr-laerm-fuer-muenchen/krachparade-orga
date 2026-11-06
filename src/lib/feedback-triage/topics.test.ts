import { describe, expect, it } from "vitest";
import { highestPriority, readTopicMarker, topicsToClose, writeTopicMarker } from "./topics";

const A = "aaaaaaaa-0000-4000-8000-000000000001";
const B = "bbbbbbbb-0000-4000-8000-000000000002";
const C = "cccccccc-0000-4000-8000-000000000003";
const UNKNOWN = "dddddddd-0000-4000-8000-000000000004";

describe("readTopicMarker / writeTopicMarker", () => {
  it("writes sorted ids without duplicates", () => {
    expect(writeTopicMarker([B, A, B])).toBe(`<!-- meldungen: ${A},${B} -->`);
  });

  it("round-trips", () => {
    expect(readTopicMarker(`Text\n\n${writeTopicMarker([C, A])}`)).toEqual([A, C]);
  });

  it("ignores short or broken ids and missing markers", () => {
    expect(readTopicMarker(null)).toEqual([]);
    expect(readTopicMarker("ohne Marke")).toEqual([]);
    expect(readTopicMarker(`<!-- meldungen: aaaaaaaa, ${A} , kaputt -->`)).toEqual([A]);
    expect(readTopicMarker("<!-- meldungen:  -->")).toEqual([]);
  });

  it("takes the last marker", () => {
    expect(readTopicMarker(`<!-- meldungen: ${A} -->\n<!-- meldungen: ${B} -->`)).toEqual([B]);
  });
});

describe("topicsToClose", () => {
  const status = { [A]: "done", [B]: "rejected", [C]: "in_progress" } as const;

  it("closes when all known entries are done or rejected", () => {
    const topics = [
      { number: 1, ids: [A, B] },
      { number: 2, ids: [A, C] }, // C still open
      { number: 3, ids: [A, UNKNOWN] }, // unknown does not count
      { number: 4, ids: [UNKNOWN] }, // only unknown: stays open
      { number: 5, ids: [] }, // no marker: stays open
    ];
    expect(topicsToClose(topics, status).map((t) => t.number)).toEqual([1, 3]);
  });

  it("new keeps a topic open", () => {
    expect(topicsToClose([{ number: 1, ids: [A] }], { [A]: "new" })).toEqual([]);
  });
});

describe("highestPriority", () => {
  it("takes the strongest of labels and new priorities", () => {
    expect(highestPriority(["feedback-thema", "p3"], ["p2", "keine"])).toBe("p2");
    expect(highestPriority(["p2"], ["p3"])).toBe("p2");
    expect(highestPriority([], ["p3", "p1"])).toBe("p1");
    expect(highestPriority(["feedback-thema"], ["keine"])).toBeNull();
  });
});
