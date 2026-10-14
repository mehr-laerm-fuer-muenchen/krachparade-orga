import { describe, expect, it } from "vitest";
import { isAllowed, parseAdminEmails } from "./access";

const MEMBERS = [
  { email: "alex.rauch@example.org", active: true },
  { email: "sascha.moeller@example.org", active: false },
];
const ADMINS = ["kim.brenner@example.org"];

describe("parseAdminEmails", () => {
  it("returns an empty list for a missing value", () => {
    expect(parseAdminEmails(undefined)).toEqual([]);
    expect(parseAdminEmails("")).toEqual([]);
  });

  it("trims, lower cases and ignores empty entries", () => {
    expect(parseAdminEmails(" Kim.Brenner@Example.org , ,alex.rauch@example.org,")).toEqual([
      "kim.brenner@example.org",
      "alex.rauch@example.org",
    ]);
  });
});

describe("isAllowed", () => {
  it("allows an invited, active member", () => {
    expect(isAllowed("alex.rauch@example.org", MEMBERS, ADMINS)).toBe(true);
  });

  it("refuses a deactivated member", () => {
    expect(isAllowed("sascha.moeller@example.org", MEMBERS, ADMINS)).toBe(false);
  });

  it("refuses an address that is not invited", () => {
    expect(isAllowed("niemand@example.org", MEMBERS, ADMINS)).toBe(false);
  });

  it("allows an address that is only in ADMIN_EMAILS", () => {
    expect(isAllowed("kim.brenner@example.org", [], ADMINS)).toBe(true);
  });

  it("allows an admin even with a deactivated member entry", () => {
    const members = [{ email: "kim.brenner@example.org", active: false }];
    expect(isAllowed("kim.brenner@example.org", members, ADMINS)).toBe(true);
  });

  it("ignores upper and lower case", () => {
    expect(isAllowed("Alex.Rauch@EXAMPLE.org", MEMBERS, ADMINS)).toBe(true);
    expect(isAllowed("KIM.BRENNER@example.org", [], ADMINS)).toBe(true);
    expect(isAllowed("alex.rauch@example.org", [{ email: "Alex.Rauch@Example.org", active: true }], [])).toBe(true);
  });

  it("ignores surrounding spaces", () => {
    expect(isAllowed("  alex.rauch@example.org ", MEMBERS, ADMINS)).toBe(true);
    expect(isAllowed(" kim.brenner@example.org", [], parseAdminEmails(" kim.brenner@example.org "))).toBe(true);
  });

  it("refuses a missing or empty address", () => {
    expect(isAllowed(undefined, MEMBERS, ADMINS)).toBe(false);
    expect(isAllowed(null, MEMBERS, ADMINS)).toBe(false);
    expect(isAllowed("   ", MEMBERS, ["", "   "])).toBe(false);
  });
});
