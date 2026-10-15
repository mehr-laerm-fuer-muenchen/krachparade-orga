import { describe, expect, it } from "vitest";
import {
  departmentLabel,
  groupDepartmentOptions,
  toDepartmentOptions,
  type DepartmentWithGroup,
} from "./department-groups";

const departments: DepartmentWithGroup[] = [
  { id: "presse", name: "Pressearbeit", sortOrder: 15, groupName: "Kommunikation", groupSortOrder: 4 },
  { id: "neu", name: "Neu", sortOrder: 16, groupName: null, groupSortOrder: null },
  { id: "route", name: "Route", sortOrder: 2, groupName: "Demo & Route", groupSortOrder: 1 },
  { id: "social", name: "Social Media", sortOrder: 11, groupName: "Kommunikation", groupSortOrder: 4 },
  { id: "demo", name: "Demoleitung", sortOrder: 1, groupName: "Demo & Route", groupSortOrder: 1 },
  { id: "alt", name: "Alt", sortOrder: 3, groupName: null, groupSortOrder: null },
];

describe("toDepartmentOptions", () => {
  it("orders by working group, then sort_order, without group last", () => {
    expect(toDepartmentOptions(departments).map((option) => option.id)).toEqual([
      "demo",
      "route",
      "social",
      "presse",
      "alt",
      "neu",
    ]);
  });

  it("shows the group with the AK prefix", () => {
    const [first] = toDepartmentOptions(departments);
    expect(first).toEqual({ id: "demo", name: "Demoleitung", group: "AK Demo & Route" });
    expect(toDepartmentOptions(departments).at(-1)?.group).toBeNull();
  });
});

describe("groupDepartmentOptions", () => {
  it("builds one group per working group and Ohne AK last", () => {
    const groups = groupDepartmentOptions(toDepartmentOptions(departments));
    expect(groups.map((group) => [group.label, group.options.map((option) => option.id)])).toEqual([
      ["AK Demo & Route", ["demo", "route"]],
      ["AK Kommunikation", ["social", "presse"]],
      ["Ohne AK", ["alt", "neu"]],
    ]);
  });

  it("is empty without departments", () => {
    expect(groupDepartmentOptions([])).toEqual([]);
  });
});

describe("departmentLabel", () => {
  it("adds the working group after the name", () => {
    expect(departmentLabel({ name: "Finanzen", group: "AK Finanzen" })).toBe("Finanzen · AK Finanzen");
    expect(departmentLabel({ name: "Neu", group: null })).toBe("Neu");
  });
});
