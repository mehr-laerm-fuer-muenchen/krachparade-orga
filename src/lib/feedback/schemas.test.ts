import { describe, expect, it } from "vitest";
import {
  createFeedbackInput,
  ERROR_KIND,
  ERROR_MESSAGE,
  ERROR_PATH,
  ERROR_STATUS,
  ERROR_TOO_LONG,
  fieldErrors,
  updateFeedbackInput,
} from "./schemas";

const valid = {
  kind: "bug",
  message: "  Knopf reagiert nicht  ",
  pagePath: "/meine",
  pageTitle: "Meine · Krachparade Orga",
  context: null,
  device: "iPhone · Safari",
  viewport: "390 × 844",
};

describe("createFeedbackInput", () => {
  it("accepts a valid report and trims the text", () => {
    const parsed = createFeedbackInput.parse(valid);
    expect(parsed.message).toBe("Knopf reagiert nicht");
    expect(parsed.context).toBeNull();
  });

  it("reports missing kind and text with German messages", () => {
    const result = createFeedbackInput.safeParse({ ...valid, kind: undefined, message: "   " });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(fieldErrors(result.error)).toEqual({ kind: ERROR_KIND, message: ERROR_MESSAGE });
  });

  it("rejects unknown kinds and texts over 2000 characters", () => {
    const result = createFeedbackInput.safeParse({ ...valid, kind: "praise", message: "x".repeat(2001) });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(fieldErrors(result.error)).toEqual({ kind: ERROR_KIND, message: ERROR_TOO_LONG });
  });

  it("cuts query and hash off the path and requires a leading slash", () => {
    expect(createFeedbackInput.parse({ ...valid, pagePath: "/feedback?filter=alle#x" }).pagePath).toBe("/feedback");
    const result = createFeedbackInput.safeParse({ ...valid, pagePath: "https://example.org/" });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(fieldErrors(result.error)).toEqual({ pagePath: ERROR_PATH });
  });

  it("shortens long optional fields instead of rejecting them", () => {
    const parsed = createFeedbackInput.parse({
      ...valid,
      pageTitle: "t".repeat(300),
      context: "c".repeat(300),
      device: "d".repeat(300),
      viewport: "1".repeat(30),
    });
    expect(parsed.pageTitle).toHaveLength(200);
    expect(parsed.context).toHaveLength(200);
    expect(parsed.device).toHaveLength(100);
    expect(parsed.viewport).toHaveLength(20);
  });

  it("turns empty optional fields into null", () => {
    const parsed = createFeedbackInput.parse({ ...valid, pageTitle: " ", device: undefined });
    expect(parsed.pageTitle).toBeNull();
    expect(parsed.device).toBeNull();
  });
});

describe("updateFeedbackInput", () => {
  it("accepts a status with an empty reply as null", () => {
    expect(updateFeedbackInput.parse({ status: "done", reply: "  " })).toEqual({ status: "done", reply: null });
    expect(updateFeedbackInput.parse({ status: "in_progress", reply: " Schau ich mir an " })).toEqual({
      status: "in_progress",
      reply: "Schau ich mir an",
    });
  });

  it("rejects unknown statuses and long replies", () => {
    const result = updateFeedbackInput.safeParse({ status: "deleted", reply: "x".repeat(2001) });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(fieldErrors(result.error)).toEqual({ status: ERROR_STATUS, reply: ERROR_TOO_LONG });
  });
});
