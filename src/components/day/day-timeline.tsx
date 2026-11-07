"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import type { DayEntryView, DayTrackView } from "@/db/day-plan";
import {
  POINT_MINUTES,
  SNAP_MINUTES,
  checkProgress,
  compareEntries,
  formatEntryTime,
  layoutLanes,
  minutesToTime,
  moveEntry,
  resizeEntry,
  snapMinutes,
  timelineRange,
} from "@/lib/day-plan";
import { isDrag } from "@/lib/plan-drag";
import { formatProgress } from "@/lib/todo-progress";

/** Pixels per minute (16 hours ≈ 1440 px, the area scrolls in itself). */
export const PX_PER_MINUTE = 1.5;
/** Blocks lower than this show one line only. */
const COMPACT_PX = 40;
const AXIS_WIDTH = 56;

/**
 * `savedWith`: stored on the server while the page showed these entries; the
 * preview stays until newer data from the server arrives (no jump back).
 */
type Preview = {
  id: string;
  startMinute: number;
  endMinute: number | null;
  trackId: string;
  savedWith?: readonly DayEntryView[];
};

const BUTTON = "min-h-11 rounded-md px-4 font-semibold";

/** Left border: all done (dark green), open points (light green), no checklist (grey). */
function borderClass(entry: DayEntryView, pending: Readonly<Record<string, boolean>>): string {
  if (entry.checks.length === 0) return "border-l-line-strong";
  const done = entry.checks.every((check) => pending[check.id] ?? check.done);
  return done ? "border-l-status-done" : "border-l-status-ok";
}

/**
 * Day plan on laptops (spec 030): one column per track, time from top to
 * bottom. Blocks move by dragging (5-minute grid, also into another column),
 * the lower edge changes the duration; saved on release. A click without
 * dragging opens the panel; arrow keys move by 5 minutes.
 */
export function DayTimeline({
  tracks,
  entries,
  selectedId,
  pendingChecks,
  onSelect,
  onEditTrack,
  onCreateEntry,
  onCreateTrack,
  onMove,
  onResize,
}: {
  tracks: readonly DayTrackView[];
  entries: readonly DayEntryView[];
  selectedId: string | null;
  pendingChecks: Readonly<Record<string, boolean>>;
  onSelect: (id: string) => void;
  onEditTrack: (id: string) => void;
  onCreateEntry: () => void;
  onCreateTrack: () => void;
  onMove: (entry: DayEntryView, startMinute: number, trackId: string) => Promise<boolean>;
  onResize: (entry: DayEntryView, endMinute: number) => Promise<boolean>;
}) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const columnRefs = useRef(new Map<string, HTMLDivElement>());
  // A press that turned into a drag must not open the panel on the following click.
  const suppressClick = useRef(false);

  // The reloaded data has arrived: drop the preview (adjusting state while rendering, as React recommends).
  if (preview?.savedWith && preview.savedWith !== entries) setPreview(null);

  const shown = (entry: DayEntryView): DayEntryView =>
    preview?.id === entry.id
      ? { ...entry, startMinute: preview.startMinute, endMinute: preview.endMinute, trackId: preview.trackId }
      : entry;
  const shownEntries = entries.map(shown);
  const timed = shownEntries.filter((entry) => entry.startMinute !== null);
  const untimed = shownEntries.filter((entry) => entry.startMinute === null).sort(compareEntries);
  const range = timelineRange(entries);
  const height = (range.end - range.start) * PX_PER_MINUTE;
  const y = (minute: number) => (minute - range.start) * PX_PER_MINUTE;
  const hours: number[] = [];
  for (let minute = range.start; minute <= range.end; minute += 60) hours.push(minute);

  // Start at the first entry minus 30 minutes (only in the browser, after loading).
  const firstStart = timed.reduce<number | null>(
    (first, entry) => (first === null ? entry.startMinute : Math.min(first, entry.startMinute!)),
    null
  );
  const scrolled = useRef(false);
  useEffect(() => {
    if (scrolled.current || !scrollRef.current || firstStart === null) return;
    scrolled.current = true;
    scrollRef.current.scrollTop = Math.max(0, y(firstStart - 30));
    // Only on the first render with entries.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstStart]);

  const trackAt = (clientX: number): string | null => {
    for (const [id, element] of columnRefs.current) {
      const rect = element.getBoundingClientRect();
      if (clientX >= rect.left && clientX < rect.right) return id;
    }
    return null;
  };

  /** Mouse and pen only (touch screens get the list); saves on release. */
  const startDrag = (event: ReactPointerEvent, entry: DayEntryView, mode: "move" | "resize") => {
    if (event.button !== 0 || event.pointerType === "touch" || entry.startMinute === null) return;
    if (mode === "resize" && entry.endMinute === null) return;
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startY = event.clientY;
    const start = entry.startMinute;
    let current: Preview | null = null;

    const onPointerMove = (move: PointerEvent) => {
      const dx = move.clientX - startX;
      const dy = move.clientY - startY;
      if (current === null && !isDrag(dx, dy)) return;
      const minutes = dy / PX_PER_MINUTE;
      if (mode === "move") {
        const moved = moveEntry(entry, snapMinutes(start + minutes) - start);
        current = {
          id: entry.id,
          startMinute: moved.startMinute ?? start,
          endMinute: moved.endMinute,
          trackId: trackAt(move.clientX) ?? entry.trackId,
        };
      } else {
        const end = resizeEntry(entry, snapMinutes(entry.endMinute! + minutes)) ?? entry.endMinute;
        current = { id: entry.id, startMinute: start, endMinute: end, trackId: entry.trackId };
      }
      setPreview(current);
    };

    const onPointerUp = async () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      if (current === null) return;
      suppressClick.current = true;
      window.setTimeout(() => (suppressClick.current = false), 0);
      const final: Preview = current;
      let saved = false;
      if (mode === "move" && (final.startMinute !== start || final.trackId !== entry.trackId)) {
        saved = await onMove(entry, final.startMinute, final.trackId);
      } else if (mode === "resize" && final.endMinute !== null && final.endMinute !== entry.endMinute) {
        saved = await onResize(entry, final.endMinute);
      }
      // `entries` of the render where the drag began: any newer data from the server drops the preview.
      setPreview(saved ? { ...final, savedWith: entries } : null);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
  };

  const onBlockKeyDown = (event: KeyboardEvent, entry: DayEntryView) => {
    if (entry.startMinute === null || (event.key !== "ArrowUp" && event.key !== "ArrowDown")) return;
    event.preventDefault();
    const delta = event.key === "ArrowUp" ? -SNAP_MINUTES : SNAP_MINUTES;
    const moved = moveEntry(entry, delta);
    if (moved.startMinute === null || moved.startMinute === entry.startMinute) return;
    void onMove(entry, moved.startMinute, entry.trackId);
  };

  const gridTemplate = `${AXIS_WIDTH}px repeat(${Math.max(tracks.length, 1)}, minmax(170px, 1fr))`;
  const targetTrack = preview?.trackId ?? null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onCreateEntry}
          disabled={tracks.length === 0}
          className={`${BUTTON} bg-primary text-on-primary hover:opacity-90 disabled:opacity-50`}
        >
          + Eintrag
        </button>
        <button type="button" onClick={onCreateTrack} className={`${BUTTON} border border-line bg-surface hover:bg-surface-2`}>
          + Spalte
        </button>
        <p className="text-sm text-muted">
          Blöcke ziehen = verschieben · unteren Rand ziehen = Dauer · antippen = Details
        </p>
      </div>

      <div className="overflow-x-auto rounded-md border border-line bg-surface">
        <div style={{ minWidth: AXIS_WIDTH + Math.max(tracks.length, 1) * 170 }}>
          <div className="grid border-b border-line" style={{ gridTemplateColumns: gridTemplate }}>
            <span aria-hidden />
            {tracks.map((track) => {
              const total = entries.filter((entry) => entry.trackId === track.id).length;
              return (
                <div
                  key={track.id}
                  className="flex min-w-0 items-center justify-between gap-1 border-l border-line py-1 pr-1 pl-3"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{track.name}</span>
                    <span className="block text-xs text-muted">
                      {total} {total === 1 ? "Eintrag" : "Einträge"}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => onEditTrack(track.id)}
                    aria-label={`Spalte ${track.name} ändern`}
                    className="min-h-11 shrink-0 rounded-md px-2 text-sm font-medium text-primary underline underline-offset-2 hover:bg-surface-2"
                  >
                    Ändern
                  </button>
                </div>
              );
            })}
          </div>

          <div
            ref={scrollRef}
            data-testid="day-timeline-scroll"
            className="relative grid max-h-[760px] overflow-y-auto"
            style={{ gridTemplateColumns: gridTemplate }}
          >
            <div aria-hidden className="relative bg-surface-2" style={{ height }}>
              {hours.map((minute) => (
                <span
                  key={minute}
                  className="absolute right-2 -translate-y-1/2 text-xs text-muted tabular-nums first:translate-y-0"
                  style={{ top: y(minute) }}
                >
                  {minutesToTime(minute)}
                </span>
              ))}
            </div>
            {tracks.map((track) => {
              const laned = layoutLanes(timed.filter((entry) => entry.trackId === track.id));
              return (
                <div
                  key={track.id}
                  ref={(element) => {
                    if (element) columnRefs.current.set(track.id, element);
                    else columnRefs.current.delete(track.id);
                  }}
                  role="group"
                  aria-label={`Spalte ${track.name}`}
                  data-drop-target={targetTrack === track.id ? "" : undefined}
                  className={`relative border-l border-line ${targetTrack === track.id ? "bg-hint-bg" : ""}`}
                  style={{ height }}
                >
                  {hours.map((minute) => (
                    <span key={minute} aria-hidden className="absolute inset-x-0 border-t border-line" style={{ top: y(minute) }} />
                  ))}
                  {hours.slice(0, -1).map((minute) => (
                    <span
                      key={`h${minute}`}
                      aria-hidden
                      className="absolute inset-x-0 border-t border-dashed border-line opacity-60"
                      style={{ top: y(minute + 30) }}
                    />
                  ))}
                  {laned.map(({ entry, lane, laneCount }) => (
                    <Block
                      key={entry.id}
                      entry={entry}
                      top={y(entry.startMinute!)}
                      height={((entry.endMinute ?? entry.startMinute! + POINT_MINUTES) - entry.startMinute!) * PX_PER_MINUTE}
                      left={`calc(${(lane / laneCount) * 100}% + 2px)`}
                      width={`calc(${100 / laneCount}% - 4px)`}
                      selected={entry.id === selectedId}
                      dragging={preview?.id === entry.id}
                      border={borderClass(entry, pendingChecks)}
                      progress={formatProgress(
                        checkProgress(entry.checks.map((check) => ({ done: pendingChecks[check.id] ?? check.done })))
                      )}
                      onPointerDown={(event, mode) => startDrag(event, entries.find((e) => e.id === entry.id)!, mode)}
                      onClick={() => {
                        if (suppressClick.current) return;
                        onSelect(entry.id);
                      }}
                      onKeyDown={(event) => onBlockKeyDown(event, entries.find((e) => e.id === entry.id)!)}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {untimed.length > 0 ? (
        <section aria-labelledby="day-untimed" className="flex flex-col gap-2">
          <h2 id="day-untimed" className="text-sm font-semibold tracking-wide text-muted uppercase">
            Ohne Uhrzeit
          </h2>
          <ul className="flex flex-col gap-2">
            {untimed.map((entry) => (
              <li key={entry.id}>
                <button
                  type="button"
                  onClick={() => onSelect(entry.id)}
                  className={`flex min-h-11 w-full flex-col rounded-md border border-l-4 border-line bg-surface px-3 py-2 text-left hover:bg-surface-2 ${borderClass(entry, pendingChecks)} ${entry.id === selectedId ? "outline-2 outline-accent" : ""}`}
                >
                  <span className="font-semibold break-words">{entry.title}</span>
                  <span className="text-sm text-muted">
                    {[tracks.find((track) => track.id === entry.trackId)?.name, entry.place, entry.person?.label]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function Block({
  entry,
  top,
  height,
  left,
  width,
  selected,
  dragging,
  border,
  progress,
  onPointerDown,
  onClick,
  onKeyDown,
}: {
  entry: DayEntryView;
  top: number;
  height: number;
  left: string;
  width: string;
  selected: boolean;
  dragging: boolean;
  border: string;
  progress: string;
  onPointerDown: (event: ReactPointerEvent, mode: "move" | "resize") => void;
  onClick: () => void;
  onKeyDown: (event: KeyboardEvent) => void;
}) {
  const time = formatEntryTime(entry);
  const compact = height < COMPACT_PX;
  const point = entry.endMinute === null;
  const meta = [entry.place, entry.person?.label].filter(Boolean).join(" · ");
  return (
    <div
      data-testid="day-block"
      data-entry-id={entry.id}
      className={`absolute overflow-hidden rounded border border-l-4 bg-surface shadow-sm hover:border-primary ${
        point ? "border-dashed border-line-strong" : "border-line-strong"
      } ${border} ${selected ? "outline-2 outline-accent" : ""} ${dragging ? "z-10 opacity-90 shadow-lg" : ""}`}
      style={{ top, height: Math.max(height, 18), left, width }}
    >
      <button
        type="button"
        aria-label={`${entry.title}, ${time}`}
        onPointerDown={(event) => onPointerDown(event, "move")}
        onClick={onClick}
        onKeyDown={onKeyDown}
        className={`block size-full touch-none text-left select-none ${dragging ? "cursor-grabbing" : "cursor-grab"} ${
          compact ? "flex items-center gap-1.5 px-1.5 whitespace-nowrap" : "px-1.5 pt-0.5 pb-2"
        }`}
      >
        {compact ? (
          <>
            <span className="shrink-0 text-xs text-muted tabular-nums">{time}</span>
            <span className="min-w-0 truncate text-xs font-semibold">{entry.title}</span>
            {progress ? <span className="ml-auto shrink-0 text-[11px] font-semibold text-muted">{progress}</span> : null}
          </>
        ) : (
          <>
            {progress ? (
              <span className="absolute top-0.5 right-1.5 text-[11px] font-semibold text-muted tabular-nums">{progress}</span>
            ) : null}
            <span data-testid="day-block-time" className="block pr-10 text-xs text-muted tabular-nums">
              {time}
            </span>
            <span className="block text-[13px] leading-tight font-semibold break-words">{entry.title}</span>
            {meta ? <span className="block truncate text-xs text-muted">{meta}</span> : null}
          </>
        )}
      </button>
      {point ? null : (
        <span
          aria-hidden
          data-testid="day-block-resize"
          onPointerDown={(event) => onPointerDown(event, "resize")}
          className="absolute inset-x-0 bottom-0 h-2 cursor-ns-resize hover:bg-line"
        />
      )}
    </div>
  );
}
