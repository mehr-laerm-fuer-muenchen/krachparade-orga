import { asc, count, eq } from "drizzle-orm";
import type { DepartmentWithGroup } from "@/lib/department-groups";
import { db } from "./index";
import { departments, meetingItems, members, workingGroupMembers, workingGroups, type WorkingGroup } from "./schema";

/** Working groups of an edition in their display order. */
export async function listWorkingGroups(editionId: string): Promise<WorkingGroup[]> {
  return db
    .select()
    .from(workingGroups)
    .where(eq(workingGroups.editionId, editionId))
    .orderBy(asc(workingGroups.sortOrder), asc(workingGroups.name));
}

/** Who takes part where: names only, never e-mail addresses. */
export async function listWorkingGroupMembers(editionId: string) {
  return db
    .select({
      workingGroupId: workingGroupMembers.workingGroupId,
      memberId: members.id,
      name: members.name,
      active: members.active,
    })
    .from(workingGroupMembers)
    .innerJoin(workingGroups, eq(workingGroups.id, workingGroupMembers.workingGroupId))
    .innerJoin(members, eq(members.id, workingGroupMembers.memberId))
    .where(eq(workingGroups.editionId, editionId))
    .orderBy(asc(members.name));
}

/** Number of minutes items per department of the edition (only departments in use). */
export async function countDepartmentUsage(editionId: string): Promise<Map<string, number>> {
  const rows = await db
    .select({ departmentId: meetingItems.departmentId, total: count() })
    .from(meetingItems)
    .innerJoin(departments, eq(departments.id, meetingItems.departmentId))
    .where(eq(departments.editionId, editionId))
    .groupBy(meetingItems.departmentId);
  return new Map(rows.flatMap((row) => (row.departmentId ? [[row.departmentId, row.total] as const] : [])));
}

/** Departments of an edition with their working group, for selects and lists. */
export async function listDepartmentsWithGroup(editionId: string): Promise<DepartmentWithGroup[]> {
  return db
    .select({
      id: departments.id,
      name: departments.name,
      sortOrder: departments.sortOrder,
      groupName: workingGroups.name,
      groupSortOrder: workingGroups.sortOrder,
    })
    .from(departments)
    .leftJoin(workingGroups, eq(workingGroups.id, departments.workingGroupId))
    .where(eq(departments.editionId, editionId));
}
