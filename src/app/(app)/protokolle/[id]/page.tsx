import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { getCurrentMember } from "@/components/current-member";
import { PageTitle } from "@/components/placeholder";
import { ProtocolTabs } from "@/components/protocol/protocol-tabs";
import { MeetingEditor } from "@/components/protocol/meeting-editor";
import { MeetingReader } from "@/components/protocol/meeting-reader";
import { param } from "@/components/protocol/todo-rows";
import { SECONDARY_BUTTON, type ItemData, type MeetingData, type Person } from "@/components/protocol/types";
import { getCurrentEdition } from "@/db/editions";
import { findMeeting, listAttendeeIds, listMeetingItems } from "@/db/meetings";
import { listMembers } from "@/db/members";
import { listDepartmentsWithGroup } from "@/db/working-groups";
import { formatGermanDate, todayInBerlin } from "@/lib/dday";
import { toDepartmentOptions } from "@/lib/department-groups";
import { readModel, resolveView, type MeetingView } from "@/lib/protocol-read";
import { canDeleteMeeting, isItemKind, type MeetingStatus } from "@/lib/protocol-rules";

export const metadata: Metadata = {
  title: "Treffen – Krachparade Orga",
};

// The meeting id is only known at request time, so the header and tab bar
// (usePathname in the layout) cannot be prerendered for this route: it may
// block until the server has rendered it.
export const instant = false;

export default function MeetingPage({ params, searchParams }: PageProps<"/protokolle/[id]">) {
  return (
    <div className="flex flex-col gap-4">
      <ProtocolTabs active="treffen" />
      <Suspense fallback={<p className="text-muted">Lade Treffen …</p>}>
        <Meeting params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

function PencilIcon() {
  return (
    <svg aria-hidden viewBox="0 0 16 16" className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M11 2.5l2.5 2.5L5.5 13H3v-2.5z" strokeLinejoin="round" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg aria-hidden viewBox="0 0 16 16" className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z" strokeLinejoin="round" />
      <circle cx="8" cy="8" r="2" />
    </svg>
  );
}

/** Title, date, status and the switch between both views (spec 017). */
function MeetingTitle({
  meeting,
  view,
}: {
  meeting: Pick<MeetingData, "id" | "title" | "date" | "status">;
  view: MeetingView;
}) {
  const reading = view === "lesen";
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
      <div className="flex min-w-0 flex-col">
        <PageTitle>
          <span className="break-words">{meeting.title}</span>
        </PageTitle>
        <p className="flex flex-wrap items-center gap-2 text-muted">
          {formatGermanDate(meeting.date)}
          <StatusLabel status={meeting.status} />
        </p>
      </div>
      <Link
        href={`/protokolle/${meeting.id}?ansicht=${reading ? "bearbeiten" : "lesen"}`}
        // Switching views replaces the entry: "Zurück" still leads to the list.
        replace
        className={`${SECONDARY_BUTTON} inline-flex items-center gap-2`}
      >
        {reading ? <PencilIcon /> : <EyeIcon />}
        {reading ? "Bearbeiten" : "Leseansicht"}
      </Link>
    </div>
  );
}

function StatusLabel({ status }: { status: MeetingStatus }) {
  return status === "final" ? (
    <span className="inline-flex items-center rounded-full bg-status-done px-2.5 py-0.5 text-xs font-semibold text-on-status-done">
      Final
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full border border-line-strong px-2.5 py-0.5 text-xs font-semibold text-muted">
      Entwurf
    </span>
  );
}

async function Meeting({ params, searchParams }: Pick<PageProps<"/protokolle/[id]">, "params" | "searchParams">) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
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

  const data: MeetingData = {
    id: meeting.id,
    date: meeting.date,
    title: meeting.title,
    place: meeting.place,
    moderatorId: meeting.moderatorId,
    minuteTakerId: meeting.minuteTakerId,
    guests: meeting.guests,
    rawNotes: meeting.rawNotes,
    summary: meeting.summary ?? "",
    status: meeting.status === "final" ? "final" : "entwurf",
  };
  const known = items.flatMap((item) => (isItemKind(item.kind) ? [{ ...item, kind: item.kind }] : []));
  const itemData: ItemData[] = known.map((item) => ({
    id: item.id,
    topic: item.topic,
    kind: item.kind,
    text: item.text,
    ownerId: item.ownerId,
    ownerName: item.ownerName,
    dueDate: item.dueDate,
    departmentId: item.departmentId,
    done: item.done,
  }));
  const departmentOptions = toDepartmentOptions(departments);
  const today = todayInBerlin(new Date());
  const view = resolveView(param(query.ansicht), data.status);

  return (
    <>
      <MeetingTitle meeting={data} view={view} />
      {view === "lesen" ? (
        <MeetingReader
          key={meeting.id}
          meeting={data}
          attendeeIds={attendeeIds}
          items={itemData}
          people={people}
          model={readModel(known, departmentOptions, new Map(people.map((person) => [person.id, person.name])))}
          today={today}
        />
      ) : (
        <MeetingEditor
          // A different meeting starts with fresh local state.
          key={meeting.id}
          meeting={data}
          attendeeIds={attendeeIds}
          items={itemData}
          people={people}
          departments={departmentOptions}
          today={today}
          canDelete={canDeleteMeeting({ id: viewer.id, active: true, isAdmin: viewer.isAdmin }, meeting)}
        />
      )}
    </>
  );
}
