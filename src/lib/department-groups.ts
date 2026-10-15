import { displayGroupName } from "./working-groups";

/** Departments ("Aufgabenbereiche") grouped by working group (spec 005). */

export const WITHOUT_GROUP = "Ohne AK";

export type DepartmentWithGroup = {
  id: string;
  name: string;
  sortOrder: number;
  /** Stored name of the working group (without "AK"), null = without group. */
  groupName: string | null;
  groupSortOrder: number | null;
};

/** What a select or a list needs: `group` is already "AK ‹name›" or null. */
export type DepartmentOption = { id: string; name: string; group: string | null };

export type DepartmentOptionGroup = { label: string; options: DepartmentOption[] };

/**
 * Working groups in their order, "without group" last; inside a group the
 * departments in `sort_order` (name as tie-break).
 */
export function toDepartmentOptions(departments: readonly DepartmentWithGroup[]): DepartmentOption[] {
  return [...departments]
    .sort(
      (a, b) =>
        (a.groupSortOrder ?? Number.POSITIVE_INFINITY) - (b.groupSortOrder ?? Number.POSITIVE_INFINITY) ||
        (a.groupName ?? "").localeCompare(b.groupName ?? "", "de") ||
        a.sortOrder - b.sortOrder ||
        a.name.localeCompare(b.name, "de")
    )
    .map((department) => ({
      id: department.id,
      name: department.name,
      group: department.groupName === null ? null : displayGroupName(department.groupName),
    }));
}

/** Consecutive options of the same group as one `optgroup`; null → "Ohne AK". */
export function groupDepartmentOptions(options: readonly DepartmentOption[]): DepartmentOptionGroup[] {
  const groups: DepartmentOptionGroup[] = [];
  for (const option of options) {
    const label = option.group ?? WITHOUT_GROUP;
    const last = groups.at(-1);
    if (last && last.label === label) {
      last.options.push(option);
    } else {
      groups.push({ label, options: [option] });
    }
  }
  return groups;
}

/** "Finanzen · AK Finanzen", or just the name without a group. */
export function departmentLabel(option: Pick<DepartmentOption, "name" | "group">): string {
  return option.group ? `${option.name} · ${option.group}` : option.name;
}
