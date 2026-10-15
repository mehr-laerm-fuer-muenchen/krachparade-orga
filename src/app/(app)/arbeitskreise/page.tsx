import type { Metadata } from "next";
import { Suspense } from "react";
import { getCurrentMember } from "@/components/current-member";
import { PageTitle } from "@/components/placeholder";
import {
  CreateGroupForm,
  FinalNotice,
  GroupCard,
  UngroupedCard,
  type BoardDepartment,
  type BoardGroup,
} from "@/components/working-groups/board";
import { listDepartments } from "@/db/departments";
import { getCurrentEdition } from "@/db/editions";
import { listMembers } from "@/db/members";
import { countDepartmentUsage, listWorkingGroupMembers, listWorkingGroups } from "@/db/working-groups";
import { displayGroupName } from "@/lib/working-groups";

export const metadata: Metadata = {
  title: "AKs – Krachparade Orga",
};

export default function WorkingGroupsPage() {
  return (
    <div className="flex flex-col gap-4">
      <PageTitle>AKs</PageTitle>
      <Suspense fallback={<p className="text-muted">Lade AKs …</p>}>
        <WorkingGroups />
      </Suspense>
    </div>
  );
}

/**
 * Working groups of the current edition with their departments and members
 * (spec 005). Names only, never e-mail addresses. Admin controls are only
 * shown to admins; the server actions check the rights again on every call.
 */
async function WorkingGroups() {
  const [viewer, edition] = await Promise.all([getCurrentMember(), getCurrentEdition()]);
  if (!edition) {
    return <p className="rounded-md border border-line bg-surface px-4 py-3 text-muted">Noch keine aktuelle Ausgabe angelegt.</p>;
  }

  const [groups, memberships, departments, usage, people] = await Promise.all([
    listWorkingGroups(edition.id),
    listWorkingGroupMembers(edition.id),
    listDepartments(edition.id),
    countDepartmentUsage(edition.id),
    listMembers(),
  ]);

  const toBoardDepartment = (department: (typeof departments)[number]): BoardDepartment => ({
    id: department.id,
    name: department.name,
    inUse: (usage.get(department.id) ?? 0) > 0,
  });
  const boardGroups: BoardGroup[] = groups.map((group) => ({
    id: group.id,
    name: group.name,
    title: displayGroupName(group.name),
    departments: departments.filter((department) => department.workingGroupId === group.id).map(toBoardDepartment),
    members: memberships
      .filter((membership) => membership.workingGroupId === group.id)
      .map((membership) => ({ id: membership.memberId, name: membership.name, active: membership.active })),
  }));
  const ungrouped = departments.filter((department) => department.workingGroupId === null).map(toBoardDepartment);
  const targets = boardGroups.map((group) => ({ id: group.id, title: group.title }));
  const activePeople = people
    .filter((person) => person.active)
    .map((person) => ({ id: person.id, name: person.name }))
    .sort((a, b) => a.name.localeCompare(b.name, "de"));

  return (
    <>
      <FinalNotice final={edition.workingGroupsFinal} isAdmin={viewer.isAdmin} />
      {boardGroups.length === 0 ? (
        <p className="rounded-md border border-line bg-surface px-4 py-3 text-muted">Noch keine AKs.</p>
      ) : null}
      <div className="grid items-start gap-4 desk:grid-cols-2">
        {boardGroups.map((group, index) => (
          <GroupCard
            key={group.id}
            group={group}
            targets={targets}
            viewerId={viewer.id}
            isAdmin={viewer.isAdmin}
            activePeople={activePeople}
            isFirst={index === 0}
            isLast={index === boardGroups.length - 1}
          />
        ))}
        {ungrouped.length > 0 ? <UngroupedCard departments={ungrouped} targets={targets} /> : null}
      </div>
      <CreateGroupForm />
    </>
  );
}
