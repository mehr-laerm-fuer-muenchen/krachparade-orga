import type { EditionItem } from "@/db/meetings";
import type { Department, Member } from "@/db/schema";
import { isOverdue, sortTodos } from "@/lib/protocol-rules";
import type { TodoRowData } from "./todo-list";

/** Sorted rows for the to-do lists: names only, never e-mail addresses. */
export function toTodoRows(
  items: readonly EditionItem[],
  members: readonly Pick<Member, "id" | "name" | "active">[],
  departments: readonly Pick<Department, "id" | "name">[],
  today: string
): TodoRowData[] {
  const people = new Map(members.map((member) => [member.id, member]));
  const departmentNames = new Map(departments.map((department) => [department.id, department.name]));
  return sortTodos(items).map((item) => {
    const member = item.ownerId ? people.get(item.ownerId) : undefined;
    const owner = member
      ? member.active
        ? member.name
        : `${member.name} (deaktiviert)`
      : item.ownerName
        ? `${item.ownerName} (ohne Account)`
        : null;
    return {
      id: item.id,
      text: item.text,
      done: item.done,
      owner,
      dueDate: item.dueDate,
      overdue: isOverdue(item, today),
      department: item.departmentId ? (departmentNames.get(item.departmentId) ?? null) : null,
      meetingId: item.meetingId,
      meetingDate: item.meetingDate,
    };
  });
}

/** The first value of a search param. */
export function param(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}
