import { describe, expect, it } from "vitest";
import { isConfirmationMissing } from "./mail-status";

const created = new Date("2027-01-20T10:00:00Z");

describe("isConfirmationMissing", () => {
  it("is false once the mail went out", () => {
    expect(isConfirmationMissing(new Date("2027-01-20T10:00:05Z"), created, new Date("2027-01-21T10:00:00Z"))).toBe(false);
  });

  it("waits ten minutes before reporting a missing mail", () => {
    expect(isConfirmationMissing(null, created, new Date("2027-01-20T10:10:00Z"))).toBe(false);
    expect(isConfirmationMissing(null, created, new Date("2027-01-20T10:10:01Z"))).toBe(true);
  });
});
