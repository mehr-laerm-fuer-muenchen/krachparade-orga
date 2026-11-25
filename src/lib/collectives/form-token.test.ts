import { describe, expect, it } from "vitest";
import { checkFormToken, issueFormToken } from "./form-token";

const SECRET = "test-secret-not-real-0000000000000000";
const START = 1_800_000_000_000;

describe("form token", () => {
  it("accepts its own token after the minimum time", () => {
    const token = issueFormToken(START, SECRET);
    expect(checkFormToken(token, START + 21_000, SECRET, 20)).toBe("ok");
  });

  it("refuses a token that is too fresh", () => {
    const token = issueFormToken(START, SECRET);
    expect(checkFormToken(token, START + 5_000, SECRET, 20)).toBe("too_fast");
  });

  it("refuses an old token", () => {
    const token = issueFormToken(START, SECRET);
    expect(checkFormToken(token, START + 13 * 60 * 60 * 1000, SECRET, 20)).toBe("expired");
  });

  it("refuses an earlier start time with the old signature", () => {
    const [, sig] = issueFormToken(START, SECRET).split(".");
    expect(checkFormToken(`${START - 60_000}.${sig}`, START, SECRET, 20)).toBe("invalid");
  });

  it("refuses a token of another secret", () => {
    const token = issueFormToken(START - 60_000, "another-secret-0000000000000000000000");
    expect(checkFormToken(token, START, SECRET, 20)).toBe("invalid");
  });

  it("refuses garbage and the former number", () => {
    for (const token of [undefined, null, 0, START - 60_000, "", "abc", `${START}.`, `${START}.x`, "1.2.3"]) {
      expect(checkFormToken(token, START, SECRET, 20)).toBe("invalid");
    }
  });

  it("refuses everything without a secret", () => {
    const token = issueFormToken(START, SECRET);
    expect(checkFormToken(token, START + 60_000, "", 20)).toBe("invalid");
    expect(() => issueFormToken(START, "")).toThrow();
  });
});
