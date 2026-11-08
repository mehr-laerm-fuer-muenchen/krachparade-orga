"use client";

import { useId, useState } from "react";
import { TickBox } from "@/components/tick-box";
import type { DayCheckView, DayEntryView, DayTrackView } from "@/db/day-plan";
import { checkProgress, formatEntryTime, groupByHour } from "@/lib/day-plan";
import { formatProgress } from "@/lib/todo-progress";

function Chevron({ open }: { open: boolean }) {
  return (
    <svg aria-hidden viewBox="0 0 16 16" className={`size-3.5 text-muted ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Day plan on phones (spec 030): entries grouped by hour, cards with time,
 * column, title, place and person. "x/y ▾" opens the checklist for ticking off.
 */
export function DayList({
  tracks,
  entries,
  pendingChecks,
  onSelect,
  onCreateEntry,
  onEditTrack,
  onCreateTrack,
  onTick,
}: {
  tracks: readonly DayTrackView[];
  entries: readonly DayEntryView[];
  pendingChecks: Readonly<Record<string, boolean>>;
  onSelect: (id: string) => void;
  onCreateEntry: () => void;
  onEditTrack: (id: string) => void;
  onCreateTrack: () => void;
  onTick: (check: DayCheckView, done: boolean) => void;
}) {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  const trackName = new Map(tracks.map((track) => [track.id, track.name]));
  const groups = groupByHour(entries);
  const toggle = (id: string) =>
    setExpanded((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={onCreateEntry}
        disabled={tracks.length === 0}
        className="min-h-11 self-start rounded-md bg-primary px-4 font-semibold text-on-primary hover:opacity-90 disabled:opacity-50"
      >
        + Eintrag
      </button>
      {tracks.length === 0 ? <p className="text-muted">Lege zuerst eine Spalte an.</p> : null}
      {groups.length === 0 && tracks.length > 0 ? <p className="text-muted">Noch keine Einträge.</p> : null}

      {groups.map((group) => (
        <section key={group.key} aria-label={group.label} className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">{group.label}</h2>
          <ul className="flex flex-col gap-2">
            {group.entries.map((entry) => (
              <Card
                key={entry.id}
                entry={entry}
                track={trackName.get(entry.trackId) ?? "–"}
                pendingChecks={pendingChecks}
                expanded={expanded.has(entry.id)}
                onToggle={() => toggle(entry.id)}
                onSelect={() => onSelect(entry.id)}
                onTick={onTick}
              />
            ))}
          </ul>
        </section>
      ))}

      <section aria-label="Spalten" className="flex flex-col gap-2 border-t border-line pt-4">
        <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">Spalten</h2>
        <div className="flex flex-wrap gap-2">
          {tracks.map((track) => (
            <button
              key={track.id}
              type="button"
              onClick={() => onEditTrack(track.id)}
              aria-label={`Spalte ${track.name} ändern`}
              className="min-h-11 rounded-md border border-line bg-surface px-3 font-medium hover:bg-surface-2"
            >
              {track.name}
            </button>
          ))}
          <button
            type="button"
            onClick={onCreateTrack}
            className="min-h-11 rounded-md border border-line bg-surface px-3 font-medium hover:bg-surface-2"
          >
            + Spalte
          </button>
        </div>
      </section>
    </div>
  );
}

function Card({
  entry,
  track,
  pendingChecks,
  expanded,
  onToggle,
  onSelect,
  onTick,
}: {
  entry: DayEntryView;
  track: string;
  pendingChecks: Readonly<Record<string, boolean>>;
  expanded: boolean;
  onToggle: () => void;
  onSelect: () => void;
  onTick: (check: DayCheckView, done: boolean) => void;
}) {
  const listId = useId();
  const done = (check: DayCheckView) => pendingChecks[check.id] ?? check.done;
  const progress = checkProgress(entry.checks.map((check) => ({ done: done(check) })));
  const open = expanded && progress.total > 0;
  const stripe = progress.total === 0 ? "bg-line-strong" : progress.complete ? "bg-status-done" : "bg-status-ok";
  const meta = [entry.place, entry.person?.label].filter(Boolean).join(" · ");

  return (
    <li data-testid="day-card" className="overflow-hidden rounded-md border border-line bg-surface">
      <div className="relative flex min-h-11 items-stretch hover:bg-surface-2">
        <span aria-hidden className={`w-1 shrink-0 ${stripe}`} />
        <button
          type="button"
          onClick={onSelect}
          className="flex min-w-0 flex-1 flex-col justify-center py-2 pr-2 pl-3 text-left after:absolute after:inset-0"
        >
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-sm font-semibold tabular-nums">{formatEntryTime(entry)}</span>
            <span className="rounded-full border border-line bg-surface-2 px-2 text-[11px] font-semibold text-muted">
              {track}
            </span>
          </span>
          <span className="font-semibold break-words">{entry.title}</span>
          {meta ? <span className="text-sm break-words text-muted">{meta}</span> : null}
        </button>
        {progress.total > 0 ? (
          <span className="flex shrink-0 items-center pr-2">
            <button
              type="button"
              aria-expanded={open}
              aria-controls={open ? listId : undefined}
              onClick={onToggle}
              className={`relative z-10 flex min-h-11 items-center gap-1.5 rounded-full px-2 text-sm font-semibold tabular-nums hover:bg-surface ${
                progress.complete ? "text-progress-fill" : "text-muted"
              }`}
            >
              <span className="sr-only">Checkliste </span>
              {formatProgress(progress)}
              <Chevron open={open} />
            </button>
          </span>
        ) : null}
      </div>
      {open ? (
        <ul id={listId} aria-label={`Checkliste von ${entry.title}`} className="flex flex-col border-t border-line bg-surface-2 py-1 pr-3 pl-1">
          {entry.checks.map((check) => {
            const checked = done(check);
            return (
              <li key={check.id} className="flex min-h-11 items-stretch">
                <TickBox checked={checked} label={`Erledigt: ${check.text}`} onToggle={() => onTick(check, !checked)} />
                <span className="min-w-0 flex-1 py-2">
                  <span className={`block break-words ${checked ? "text-muted line-through" : ""}`}>{check.text}</span>
                  {check.person ? <span className="block text-sm text-muted">{check.person.label}</span> : null}
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </li>
  );
}
