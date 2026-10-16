import { describe, expect, it } from "vitest";
import { newFeedbackText } from "./count";
import { isFeedbackKind, kindLabel } from "./kinds";
import { FEEDBACK_STATUSES, isFeedbackStatus, isOpenStatus, statusLabel } from "./status";

describe("kindLabel", () => {
  it("names both kinds in German", () => {
    expect(kindLabel("bug")).toBe("Fehler");
    expect(kindLabel("wish")).toBe("Wunsch");
    expect(isFeedbackKind("bug")).toBe(true);
    expect(isFeedbackKind("question")).toBe(false);
  });
});

describe("statusLabel", () => {
  it("names every status in German", () => {
    expect(FEEDBACK_STATUSES.map(statusLabel)).toEqual(["Neu", "In Arbeit", "Erledigt", "Verworfen"]);
    expect(isFeedbackStatus("done")).toBe(true);
    expect(isFeedbackStatus("deleted")).toBe(false);
  });

  it("treats new and in progress as open", () => {
    expect(FEEDBACK_STATUSES.filter(isOpenStatus)).toEqual(["new", "in_progress"]);
  });
});

describe("newFeedbackText", () => {
  it("uses singular and plural", () => {
    expect(newFeedbackText(0)).toBe("Keine neuen Meldungen.");
    expect(newFeedbackText(1)).toBe("1 neue Meldung");
    expect(newFeedbackText(2)).toBe("2 neue Meldungen");
  });
});
