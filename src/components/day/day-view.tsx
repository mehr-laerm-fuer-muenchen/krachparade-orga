"use client";

import { useCallback, useState } from "react";
import { createEntry, createTrack } from "@/actions/day-plan";
import { useUndoBar } from "@/components/plan/plan-bar";
import type { Person } from "@/components/protocol/types";
import type { DayPlanView } from "@/db/day-plan";
import { DayList } from "./day-list";
import { DayTimeline } from "./day-timeline";
import { EntryPanel, type GroupOption } from "./entry-panel";
import { TrackPanel } from "./track-panel";
import { useDayActions } from "./use-day-actions";

/** A new entry starts at 12:00–13:00 in the first column (spec 030). */
const NEW_ENTRY = { title: "Neuer Eintrag", startMinute: 12 * 60, endMinute: 13 * 60 };
const NEW_TRACK = "Neue Spalte";

type Selection = { kind: "entry" | "track"; id: string; fresh: boolean } | null;

/**
 * "Ablauf" of the Krachparade page (spec 030): the day plan on laptops (from
 * 1024 px), the list by hour on phones, details in the panel or sheet.
 */
export function DayView({
  plan,
  people,
  groups,
}: {
  plan: DayPlanView;
  people: Person[];
  groups: GroupOption[];
}) {
  const { tracks, entries } = plan;
  const [selection, setSelection] = useState<Selection>(null);
  const { show, bar } = useUndoBar();
  const actions = useDayActions(tracks, show);
  const close = useCallback(() => setSelection(null), []);
  const select = (id: string) => setSelection({ kind: "entry", id, fresh: false });
  const editTrack = (id: string) => setSelection({ kind: "track", id, fresh: false });

  const addEntry = async () => {
    const first = tracks[0];
    if (!first) return;
    try {
      const result = await createEntry({ trackId: first.id, ...NEW_ENTRY });
      if (result.ok) setSelection({ kind: "entry", id: result.id, fresh: true });
      else show(result.message, "error");
    } catch {
      show("Konnte nicht gespeichert werden.", "error");
    }
  };

  const addTrack = async () => {
    try {
      const result = await createTrack(NEW_TRACK);
      if (result.ok) setSelection({ kind: "track", id: result.id, fresh: true });
      else show(result.message, "error");
    } catch {
      show("Konnte nicht gespeichert werden.", "error");
    }
  };

  const entry = selection?.kind === "entry" ? entries.find((candidate) => candidate.id === selection.id) : undefined;
  const track = selection?.kind === "track" ? tracks.find((candidate) => candidate.id === selection.id) : undefined;

  return (
    <>
      <div className="flex items-start gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="hidden lg:block">
            <DayTimeline
              tracks={tracks}
              entries={entries}
              selectedId={entry?.id ?? null}
              pendingChecks={actions.pendingChecks}
              onSelect={select}
              onEditTrack={editTrack}
              onCreateEntry={() => void addEntry()}
              onCreateTrack={() => void addTrack()}
              onMove={actions.move}
              onResize={actions.resize}
            />
          </div>
          <div className="lg:hidden">
            <DayList
              tracks={tracks}
              entries={entries}
              pendingChecks={actions.pendingChecks}
              onSelect={select}
              onCreateEntry={() => void addEntry()}
              onEditTrack={editTrack}
              onCreateTrack={() => void addTrack()}
              onTick={(check, done) => void actions.tick(check, done)}
            />
          </div>
        </div>
        {entry ? (
          <EntryPanel
            key={entry.id}
            entry={entry}
            tracks={tracks}
            groups={groups}
            people={people}
            actions={actions}
            focusTitle={selection?.fresh ?? false}
            onClose={close}
          />
        ) : null}
        {track ? (
          <TrackPanel
            key={track.id}
            track={track}
            tracks={tracks}
            entryCount={entries.filter((candidate) => candidate.trackId === track.id).length}
            focusName={selection?.fresh ?? false}
            onClose={close}
          />
        ) : null}
      </div>
      {bar}
    </>
  );
}
