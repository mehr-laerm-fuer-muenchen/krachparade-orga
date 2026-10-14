import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { createMeeting } from "@/actions/meetings";
import { PageTitle } from "@/components/placeholder";
import { MeetingStatusMark, ProtocolTabs } from "@/components/protocol/protocol-tabs";
import { getCurrentEdition } from "@/db/editions";
import { listMeetings } from "@/db/meetings";
import { formatGermanDate } from "@/lib/dday";

export const metadata: Metadata = {
  title: "Protokolle – Krachparade Orga",
};

export default function MinutesPage() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageTitle>Protokolle</PageTitle>
        <form action={createMeeting}>
          <button
            type="submit"
            className="min-h-11 rounded-md bg-primary px-4 font-semibold text-on-primary"
          >
            Neues Treffen
          </button>
        </form>
      </div>
      <ProtocolTabs active="treffen" />
      <Suspense fallback={<p className="text-muted">Lade Treffen …</p>}>
        <MeetingList />
      </Suspense>
    </div>
  );
}

async function MeetingList() {
  const edition = await getCurrentEdition();
  const meetings = edition ? await listMeetings(edition.id) : [];
  if (meetings.length === 0) {
    return (
      <p className="rounded-md border border-line bg-surface px-4 py-3 text-muted">Noch keine Treffen.</p>
    );
  }
  return (
    <ul aria-label="Treffen" className="flex flex-col rounded-md border border-line bg-surface">
      {meetings.map((meeting) => (
        <li key={meeting.id} className="border-b border-line last:border-b-0">
          <Link
            href={`/protokolle/${meeting.id}`}
            className="flex min-h-11 flex-col gap-1 px-4 py-3 hover:bg-surface-2 sm:flex-row sm:items-center sm:gap-4"
          >
            <span className="w-24 shrink-0 tabular-nums text-muted">{formatGermanDate(meeting.date)}</span>
            <span className="min-w-0 flex-1 font-medium break-words">{meeting.title}</span>
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
              <MeetingStatusMark status={meeting.status} />
              <span>
                {meeting.decisions} {meeting.decisions === 1 ? "Entscheidung" : "Entscheidungen"}
              </span>
              <span>
                {meeting.openTodos} {meeting.openTodos === 1 ? "offenes To-do" : "offene To-dos"}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
