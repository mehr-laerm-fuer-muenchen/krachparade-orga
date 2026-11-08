import { describe, expect, it } from "vitest";
import { validateDayTemplate } from "../lib/day-plan";
import { DAY_TEMPLATE } from "./day-template";
import { TEST_DAY, TEST_MEMBERS, WORKING_GROUPS } from "./seed";

describe("DAY_TEMPLATE (spec 030)", () => {
  it("has 3 columns, 13 entries and 6 roles", () => {
    expect(DAY_TEMPLATE.tracks).toEqual(["Programm & Bühne", "Demozug & Wägen", "Orga & Logistik"]);
    expect(DAY_TEMPLATE.entries).toHaveLength(13);
    expect(DAY_TEMPLATE.roles).toHaveLength(6);
  });

  it("is valid: all columns present, all times in order", () => {
    expect(validateDayTemplate(DAY_TEMPLATE)).toEqual([]);
  });

  it("contains no person and no e-mail address", () => {
    for (const entry of DAY_TEMPLATE.entries) {
      expect(entry.person, entry.title).toBeUndefined();
      for (const check of entry.checks ?? []) expect(typeof check, entry.title).toBe("string");
    }
    for (const role of DAY_TEMPLATE.roles) expect(role.people ?? [], role.title).toEqual([]);
    expect(JSON.stringify(DAY_TEMPLATE)).not.toMatch(/@/);
  });

  it("only uses working groups of the proposal", () => {
    const names = new Set(WORKING_GROUPS.map((group) => group.name));
    const used = [...DAY_TEMPLATE.entries, ...DAY_TEMPLATE.roles].flatMap((item) => (item.group ? [item.group] : []));
    for (const name of used) expect(names, name).toContain(name);
  });
});

describe("TEST_DAY (spec 030)", () => {
  it("is valid and only uses made-up test members", () => {
    expect(validateDayTemplate(TEST_DAY)).toEqual([]);
    const emails = new Set(TEST_MEMBERS.map((member) => member.email));
    const people = [
      ...TEST_DAY.entries.flatMap((entry) => [
        entry.person,
        ...(entry.checks ?? []).map((check) => (typeof check === "string" ? undefined : check.person)),
      ]),
      ...TEST_DAY.roles.flatMap((role) => role.people ?? []),
    ];
    for (const person of people) {
      if (person && "email" in person) {
        expect(person.email).toMatch(/@example\.org$/);
        expect(emails).toContain(person.email);
      }
    }
  });
});
