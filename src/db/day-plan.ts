import { asc, count, desc, eq, inArray } from "drizzle-orm";
import { db } from "./index";
import { dayChecks, dayEntries, dayRolePeople, dayRoles, dayTracks, members, workingGroups } from "./schema";

// Spec 030: the day plan of an edition for the Krachparade pages. Names only,
// never e-mail addresses.

export type DayPersonView = { memberId: string | null; name: string | null; label: string };

export type DayCheckView = {
  id: string;
  text: string;
  done: boolean;
  person: DayPersonView | null;
};

export type DayEntryView = {
  id: string;
  trackId: string;
  title: string;
  startMinute: number | null;
  endMinute: number | null;
  approx: boolean;
  place: string | null;
  workingGroupId: string | null;
  workingGroupName: string | null;
  person: DayPersonView | null;
  note: string | null;
  updatedAt: string;
  checks: DayCheckView[];
};

export type DayTrackView = { id: string; name: string; position: number };

export type DayRoleView = {
  id: string;
  title: string;
  task: string | null;
  mark: string | null;
  workingGroupId: string | null;
  workingGroupName: string | null;
  people: (DayPersonView & { id: string })[];
};

export type DayPlanView = { tracks: DayTrackView[]; entries: DayEntryView[]; roles: DayRoleView[] };

/** Working groups of the edition and all members (names only) for the choices on the Krachparade pages. */
export async function loadDayOptions(editionId: string) {
  const [groups, people] = await Promise.all([
    db
      .select({ id: workingGroups.id, name: workingGroups.name })
      .from(workingGroups)
      .where(eq(workingGroups.editionId, editionId))
      .orderBy(asc(workingGroups.sortOrder), asc(workingGroups.name)),
    db
      .select({ id: members.id, name: members.name, active: members.active })
      .from(members)
      .orderBy(desc(members.active), asc(members.name)),
  ]);
  return { groups, people };
}

/** Number of entries and roles of the day plan, for the link in the plan (spec 030). */
export async function countDayPlan(editionId: string): Promise<{ entries: number; roles: number }> {
  const [[entryRow], [roleRow]] = await Promise.all([
    db.select({ total: count() }).from(dayEntries).where(eq(dayEntries.editionId, editionId)),
    db.select({ total: count() }).from(dayRoles).where(eq(dayRoles.editionId, editionId)),
  ]);
  return { entries: entryRow?.total ?? 0, roles: roleRow?.total ?? 0 };
}

function personView(memberId: string | null, memberName: string | null, text: string | null): DayPersonView | null {
  if (memberId) return { memberId, name: null, label: memberName ?? "Unbekannt" };
  if (text) return { memberId: null, name: text, label: text };
  return null;
}

/** Columns, entries with their checklists and roles with their people of the edition. */
export async function loadDayPlan(editionId: string): Promise<DayPlanView> {
  const [tracks, entryRows, roleRows] = await Promise.all([
    db
      .select({ id: dayTracks.id, name: dayTracks.name, position: dayTracks.position })
      .from(dayTracks)
      .where(eq(dayTracks.editionId, editionId))
      .orderBy(asc(dayTracks.position), asc(dayTracks.createdAt)),
    db
      .select({
        id: dayEntries.id,
        trackId: dayEntries.trackId,
        title: dayEntries.title,
        startMinute: dayEntries.startMinute,
        endMinute: dayEntries.endMinute,
        approx: dayEntries.approx,
        place: dayEntries.place,
        workingGroupId: dayEntries.workingGroupId,
        workingGroupName: workingGroups.name,
        personMemberId: dayEntries.personMemberId,
        personName: members.name,
        personText: dayEntries.personText,
        note: dayEntries.note,
        updatedAt: dayEntries.updatedAt,
      })
      .from(dayEntries)
      .leftJoin(workingGroups, eq(workingGroups.id, dayEntries.workingGroupId))
      .leftJoin(members, eq(members.id, dayEntries.personMemberId))
      .where(eq(dayEntries.editionId, editionId))
      .orderBy(asc(dayEntries.startMinute), asc(dayEntries.endMinute), asc(dayEntries.createdAt)),
    db
      .select({
        id: dayRoles.id,
        title: dayRoles.title,
        task: dayRoles.task,
        mark: dayRoles.mark,
        workingGroupId: dayRoles.workingGroupId,
        workingGroupName: workingGroups.name,
      })
      .from(dayRoles)
      .leftJoin(workingGroups, eq(workingGroups.id, dayRoles.workingGroupId))
      .where(eq(dayRoles.editionId, editionId))
      .orderBy(asc(dayRoles.position), asc(dayRoles.createdAt)),
  ]);

  const entryIds = entryRows.map((entry) => entry.id);
  const roleIds = roleRows.map((role) => role.id);
  const [checkRows, peopleRows] = await Promise.all([
    entryIds.length
      ? db
          .select({
            id: dayChecks.id,
            entryId: dayChecks.entryId,
            text: dayChecks.text,
            done: dayChecks.done,
            memberId: dayChecks.memberId,
            memberName: members.name,
            nameText: dayChecks.nameText,
          })
          .from(dayChecks)
          .leftJoin(members, eq(members.id, dayChecks.memberId))
          .where(inArray(dayChecks.entryId, entryIds))
          .orderBy(asc(dayChecks.position), asc(dayChecks.createdAt))
      : [],
    roleIds.length
      ? db
          .select({
            id: dayRolePeople.id,
            roleId: dayRolePeople.roleId,
            memberId: dayRolePeople.memberId,
            memberName: members.name,
            nameText: dayRolePeople.nameText,
          })
          .from(dayRolePeople)
          .leftJoin(members, eq(members.id, dayRolePeople.memberId))
          .where(inArray(dayRolePeople.roleId, roleIds))
          .orderBy(asc(dayRolePeople.position))
      : [],
  ]);

  const checksByEntry = new Map<string, DayCheckView[]>();
  for (const check of checkRows) {
    const list = checksByEntry.get(check.entryId) ?? [];
    list.push({
      id: check.id,
      text: check.text,
      done: check.done,
      person: personView(check.memberId, check.memberName, check.nameText),
    });
    checksByEntry.set(check.entryId, list);
  }
  const peopleByRole = new Map<string, DayRoleView["people"]>();
  for (const row of peopleRows) {
    const person = personView(row.memberId, row.memberName, row.nameText);
    if (!person) continue;
    const list = peopleByRole.get(row.roleId) ?? [];
    list.push({ ...person, id: row.id });
    peopleByRole.set(row.roleId, list);
  }

  return {
    tracks,
    entries: entryRows.map((entry) => ({
      id: entry.id,
      trackId: entry.trackId,
      title: entry.title,
      startMinute: entry.startMinute,
      endMinute: entry.endMinute,
      approx: entry.approx,
      place: entry.place,
      workingGroupId: entry.workingGroupId,
      workingGroupName: entry.workingGroupName,
      person: personView(entry.personMemberId, entry.personName, entry.personText),
      note: entry.note,
      updatedAt: entry.updatedAt.toISOString(),
      checks: checksByEntry.get(entry.id) ?? [],
    })),
    roles: roleRows.map((role) => ({ ...role, people: peopleByRole.get(role.id) ?? [] })),
  };
}
