import { describe, expect, it } from "vitest";
import {
  ERROR_ADMIN_BY_SERVER,
  ERROR_NOT_ADMIN,
  ERROR_SELF_DEACTIVATE,
  ERROR_SELF_REVOKE,
  canManage,
  moveItem,
  type Actor,
} from "./permissions";

const ADMIN: Actor = { id: "a", email: "kim.brenner@example.org", active: true, isAdmin: true };
const MEMBER: Actor = { id: "b", email: "alex.rauch@example.org", active: true, isAdmin: false };
const OTHER = { id: "c", email: "sascha.moeller@example.org" };
const SERVER_ADMIN = { id: "d", email: "robin.tal@example.org" };
const ADMIN_EMAILS = ["robin.tal@example.org"];

describe("canManage", () => {
  it("allows an active admin", () => {
    expect(canManage(ADMIN, null, ADMIN_EMAILS, "write")).toEqual({ ok: true });
    expect(canManage(ADMIN, OTHER, ADMIN_EMAILS, "deactivate")).toEqual({ ok: true });
    expect(canManage(ADMIN, OTHER, ADMIN_EMAILS, "grantAdmin")).toEqual({ ok: true });
    expect(canManage(ADMIN, OTHER, ADMIN_EMAILS, "revokeAdmin")).toEqual({ ok: true });
  });

  it("refuses a member who is not admin", () => {
    for (const action of ["write", "deactivate", "activate", "grantAdmin", "revokeAdmin"] as const) {
      expect(canManage(MEMBER, OTHER, ADMIN_EMAILS, action)).toEqual({ ok: false, error: ERROR_NOT_ADMIN });
    }
  });

  it("refuses a deactivated admin", () => {
    const deactivated = { ...ADMIN, active: false };
    expect(canManage(deactivated, null, ADMIN_EMAILS, "write")).toEqual({ ok: false, error: ERROR_NOT_ADMIN });
    expect(canManage(deactivated, OTHER, ADMIN_EMAILS, "activate")).toEqual({
      ok: false,
      error: ERROR_NOT_ADMIN,
    });
  });

  it("refuses a missing actor", () => {
    expect(canManage(null, null, ADMIN_EMAILS, "write")).toEqual({ ok: false, error: ERROR_NOT_ADMIN });
    expect(canManage(undefined, OTHER, ADMIN_EMAILS, "grantAdmin")).toEqual({
      ok: false,
      error: ERROR_NOT_ADMIN,
    });
  });

  it("refuses deactivating oneself", () => {
    expect(canManage(ADMIN, { id: ADMIN.id, email: ADMIN.email }, ADMIN_EMAILS, "deactivate")).toEqual({
      ok: false,
      error: ERROR_SELF_DEACTIVATE,
    });
  });

  it("refuses taking the admin right from oneself", () => {
    expect(canManage(ADMIN, { id: ADMIN.id, email: ADMIN.email }, ADMIN_EMAILS, "revokeAdmin")).toEqual({
      ok: false,
      error: ERROR_SELF_REVOKE,
    });
  });

  it("refuses taking the admin right from an address in ADMIN_EMAILS", () => {
    expect(canManage(ADMIN, SERVER_ADMIN, ADMIN_EMAILS, "revokeAdmin")).toEqual({
      ok: false,
      error: ERROR_ADMIN_BY_SERVER,
    });
    // Case and spaces do not matter.
    const shouting = { ...SERVER_ADMIN, email: " Robin.Tal@EXAMPLE.org " };
    expect(canManage(ADMIN, shouting, ADMIN_EMAILS, "revokeAdmin")).toEqual({
      ok: false,
      error: ERROR_ADMIN_BY_SERVER,
    });
  });

  it("refuses deactivating an address in ADMIN_EMAILS", () => {
    expect(canManage(ADMIN, SERVER_ADMIN, ADMIN_EMAILS, "deactivate")).toEqual({
      ok: false,
      error: ERROR_ADMIN_BY_SERVER,
    });
    const shouting = { ...SERVER_ADMIN, email: " Robin.Tal@EXAMPLE.org " };
    expect(canManage(ADMIN, shouting, ADMIN_EMAILS, "deactivate")).toEqual({
      ok: false,
      error: ERROR_ADMIN_BY_SERVER,
    });
  });

  it("still allows other actions on an address in ADMIN_EMAILS", () => {
    expect(canManage(ADMIN, SERVER_ADMIN, ADMIN_EMAILS, "grantAdmin")).toEqual({ ok: true });
    expect(canManage(ADMIN, SERVER_ADMIN, ADMIN_EMAILS, "activate")).toEqual({ ok: true });
  });

  it("allows reactivating oneself only as active admin", () => {
    expect(canManage(ADMIN, { id: ADMIN.id, email: ADMIN.email }, [], "activate")).toEqual({ ok: true });
  });
});

describe("moveItem", () => {
  const ids = ["a", "b", "c"];

  it("moves an item up and down", () => {
    expect(moveItem(ids, "b", "up")).toEqual(["b", "a", "c"]);
    expect(moveItem(ids, "b", "down")).toEqual(["a", "c", "b"]);
  });

  it("returns null at the ends and for unknown ids", () => {
    expect(moveItem(ids, "a", "up")).toBeNull();
    expect(moveItem(ids, "c", "down")).toBeNull();
    expect(moveItem(ids, "x", "up")).toBeNull();
  });

  it("does not change the input", () => {
    moveItem(ids, "b", "up");
    expect(ids).toEqual(["a", "b", "c"]);
  });
});
