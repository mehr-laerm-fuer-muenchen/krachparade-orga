import { describe, expect, it } from "vitest";
import {
  canChangeMembership,
  canDeleteDepartment,
  canDeleteGroup,
  canMarkFinal,
  displayGroupName,
  ERROR_NAME_MISSING,
  ERROR_NAME_TOO_LONG,
  normalizeGroupName,
} from "./working-groups";

describe("normalizeGroupName", () => {
  it("drops a leading AK prefix in any case", () => {
    expect(normalizeGroupName("AK Kommunikation")).toEqual({ ok: true, name: "Kommunikation" });
    expect(normalizeGroupName("ak Finanzen")).toEqual({ ok: true, name: "Finanzen" });
    expect(normalizeGroupName("Ak  Programm")).toEqual({ ok: true, name: "Programm" });
  });

  it("keeps AK inside a word or later in the name", () => {
    expect(normalizeGroupName("Akustik")).toEqual({ ok: true, name: "Akustik" });
    expect(normalizeGroupName("Demo AK Route")).toEqual({ ok: true, name: "Demo AK Route" });
  });

  it("trims and collapses whitespace", () => {
    expect(normalizeGroupName("  Demo   &\tRoute  ")).toEqual({ ok: true, name: "Demo & Route" });
  });

  it("rejects empty names, also a lone prefix", () => {
    expect(normalizeGroupName("")).toEqual({ ok: false, error: ERROR_NAME_MISSING });
    expect(normalizeGroupName("   ")).toEqual({ ok: false, error: ERROR_NAME_MISSING });
    expect(normalizeGroupName("AK ")).toEqual({ ok: false, error: ERROR_NAME_MISSING });
  });

  it("allows 60 characters and rejects 61", () => {
    expect(normalizeGroupName("x".repeat(60))).toEqual({ ok: true, name: "x".repeat(60) });
    expect(normalizeGroupName("x".repeat(61))).toEqual({ ok: false, error: ERROR_NAME_TOO_LONG });
    expect(normalizeGroupName(`AK ${"x".repeat(60)}`)).toEqual({ ok: true, name: "x".repeat(60) });
  });
});

describe("displayGroupName", () => {
  it("adds the AK prefix", () => {
    expect(displayGroupName("Kommunikation")).toBe("AK Kommunikation");
  });
});

describe("canChangeMembership", () => {
  const member = { id: "m1", active: true, isAdmin: false };
  const admin = { id: "a1", active: true, isAdmin: true };

  it("lets everyone change their own membership", () => {
    expect(canChangeMembership(member, "m1")).toBe(true);
  });

  it("forbids changing someone else without admin right", () => {
    expect(canChangeMembership(member, "m2")).toBe(false);
  });

  it("lets admins change anyone", () => {
    expect(canChangeMembership(admin, "m2")).toBe(true);
    expect(canChangeMembership(admin, "a1")).toBe(true);
  });

  it("forbids deactivated members, also admins", () => {
    expect(canChangeMembership({ ...member, active: false }, "m1")).toBe(false);
    expect(canChangeMembership({ ...admin, active: false }, "m2")).toBe(false);
  });
});

describe("canMarkFinal", () => {
  it("is for active admins only", () => {
    expect(canMarkFinal({ active: true, isAdmin: true })).toBe(true);
    expect(canMarkFinal({ active: true, isAdmin: false })).toBe(false);
    expect(canMarkFinal({ active: false, isAdmin: true })).toBe(false);
  });
});

describe("delete rules", () => {
  it("deletes a working group only without departments", () => {
    expect(canDeleteGroup(0)).toBe(true);
    expect(canDeleteGroup(1)).toBe(false);
  });

  it("deletes a department only without minutes items", () => {
    expect(canDeleteDepartment(0)).toBe(true);
    expect(canDeleteDepartment(3)).toBe(false);
  });
});
