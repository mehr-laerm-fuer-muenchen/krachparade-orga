import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { getCurrentMember } from "@/components/current-member";
import { PageTitle } from "@/components/placeholder";
import { ProtocolTabs } from "@/components/protocol/protocol-tabs";
import { MeetingEditor } from "@/components/protocol/meeting-editor";
import type { Person } from "@/components/protocol/types";
import { getCurrentEdition } from "@/db/editions";
import { findMeeting, listAttendeeIds, listMeetingItems } from "@/db/meetings";
import { listMembers } from "@/db/members";
import { listDepartmentsWithGroup } from "@/db/working-groups";
import { formatGermanDate, todayInBerlin } from "@/lib/dday";
import { toDepartmentOptions } from "@/lib/department-groups";
import { canDeleteMeeting, isItemKind } from "@/lib/protocol-rules";

export const metadata: Metadata = {
  title: "Treffen – Krachparade Orga",
};

// The meeting id is only known at request time, so the header and tab bar
// (usePathname in the layout) cannot be prerendered for this route: it may
// block until the server has rendered it.
export const instant = false;

export default function MeetingPage({ params }: PageProps<"/protokolle/[id]">) {
  return (
    <div className="flex flex-col gap-4">
      <ProtocolTabs active="treffen" />
      <Suspense fallback={<p className="text-muted">Lade Treffen …</p>}>
        <Meeting params={params} />
      </Suspense>
    </div>
  );
}

async function Meeting({ params }: Pick<PageProps<"/protokolle/[id]">, "params">) {
  const { id } = await params;
  const meetingId = z.uuid().safeParse(id);
  if (!meetingId.success) notFound();

  const [viewer, edition] = await Promise.all([getCurrentMember(), getCurrentEdition()]);
  if (!edition) notFound();
  const meeting = await findMeeting(meetingId.data, edition.id);
  if (!meeting) notFound();

  const [items, attendeeIds, members, departments] = await Promise.all([
    listMeetingItems(meeting.id),
    listAttendeeIds(meeting.id),
    listMembers(),
    listDepartmentsWithGroup(edition.id),
  ]);

  // Active members can be chosen; deactivated ones only show up where they
  // are already entered. Names only, never e-mail addresses.
  const used = new Set([
    ...attendeeIds,
    meeting.moderatorId,
    meeting.minuteTakerId,
    ...items.map((item) => item.ownerId),
  ]);
  const people: Person[] = members
    .filter((member) => member.active || used.has(member.id))
    .map((member) => ({ id: member.id, name: member.name, active: member.active }))
    .sort((a, b) => a.name.localeCompare(b.name, "de"));

  return (
    <>
      <div className="flex flex-col">
        <PageTitle>{meeting.title}</PageTitle>
        <p className="text-muted">{formatGermanDate(meeting.date)}</p>
      </div>
      <MeetingEditor
        // A different meeting starts with fresh local state.
        key={meeting.id}
        meeting={{
          id: meeting.id,
          date: meeting.date,
          title: meeting.title,
          place: meeting.place,
          moderatorId: meeting.moderatorId,
          minuteTakerId: meeting.minuteTakerId,
          guests: meeting.guests,
          rawNotes: meeting.rawNotes,
          status: meeting.status === "final" ? "final" : "entwurf",
        }}
        attendeeIds={attendeeIds}
        items={items.flatMap((item) =>
          isItemKind(item.kind)
            ? [
                {
                  id: item.id,
                  topic: item.topic,
                  kind: item.kind,
                  text: item.text,
                  ownerId: item.ownerId,
                  ownerName: item.ownerName,
                  dueDate: item.dueDate,
                  departmentId: item.departmentId,
                  done: item.done,
                },
              ]
            : []
        )}
        people={people}
        departments={toDepartmentOptions(departments)}
        today={todayInBerlin(new Date())}
        canDelete={canDeleteMeeting({ id: viewer.id, active: true, isAdmin: viewer.isAdmin }, meeting)}
      />
    </>
  );
}
