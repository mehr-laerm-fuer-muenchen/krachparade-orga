"use client";

import { useCallback, useState } from "react";
import { moveEntryTo, resizeEntryTo, toggleCheck, type DayMoveResult } from "@/actions/day-plan";
import type { ShowNotice } from "@/components/plan/plan-bar";
import type { DayCheckView, DayEntryView, DayTrackView } from "@/db/day-plan";
import { minutesToTime, moveEntry } from "@/lib/day-plan";

const NETWORK_ERROR = "Konnte nicht gespeichert werden.";

async function safe<T extends { ok: boolean }>(call: () => Promise<T>): Promise<T | { ok: false; message: string }> {
  try {
    return await call();
  } catch {
    return { ok: false, message: NETWORK_ERROR };
  }
}

/** Text of the bar after a move (spec 030). */
export function movedText(startMinute: number, trackName: string): string {
  return `Verschoben auf ${minutesToTime(startMinute)} · Spalte „${trackName}“`;
}

/** Text of the bar after a new end (spec 030). */
export function resizedText(title: string, endMinute: number): string {
  return `„${title}“ jetzt bis ${minutesToTime(endMinute)}`;
}

/**
 * Moving, resizing and ticking off in the day plan (spec 030), each followed
 * by the "Rückgängig" bar. `pendingChecks` shows a tick right away, before the
 * reloaded data arrives.
 */
export function useDayActions(tracks: readonly DayTrackView[], show: ShowNotice) {
  const [pendingChecks, setPendingChecks] = useState<Readonly<Record<string, boolean>>>({});
  const trackName = useCallback(
    (id: string) => tracks.find((track) => track.id === id)?.name ?? "–",
    [tracks]
  );

  const undoMove = useCallback(
    async (entryId: string, previous: Extract<DayMoveResult, { ok: true }>["previous"]) => {
      // Restoring the start keeps the duration; then the old end comes back.
      const back = await safe(() => moveEntryTo(entryId, previous.startMinute, previous.trackId));
      if (back.ok && previous.endMinute !== null) await safe(() => resizeEntryTo(entryId, previous.endMinute!));
      if (!back.ok) show(back.message, "error");
    },
    [show]
  );

  /** Saves a new start (and column); false if it failed. */
  const move = useCallback(
    async (entry: DayEntryView, startMinute: number, trackId: string): Promise<boolean> => {
      const result = await safe(() => moveEntryTo(entry.id, startMinute, trackId));
      if (!result.ok) {
        show(result.message, "error");
        return false;
      }
      // The server stops the entry at the edges of the day in the same way.
      const shown = moveEntry(entry, startMinute - (entry.startMinute ?? startMinute)).startMinute ?? startMinute;
      show(movedText(shown, trackName(trackId)), "info", () => void undoMove(entry.id, result.previous));
      return true;
    },
    [show, trackName, undoMove]
  );

  /** Saves a new end; false if it failed. */
  const resize = useCallback(
    async (entry: DayEntryView, endMinute: number): Promise<boolean> => {
      const result = await safe(() => resizeEntryTo(entry.id, endMinute));
      if (!result.ok) {
        show(result.message, "error");
        return false;
      }
      const previousEnd = result.previous.endMinute;
      show(resizedText(entry.title, endMinute), "info", () => {
        if (previousEnd !== null) void safe(() => resizeEntryTo(entry.id, previousEnd));
      });
      return true;
    },
    [show]
  );

  const tick = useCallback(
    async (check: DayCheckView, done: boolean) => {
      setPendingChecks((previous) => ({ ...previous, [check.id]: done }));
      const result = await safe(() => toggleCheck(check.id, done));
      setPendingChecks((previous) => {
        const next = { ...previous };
        delete next[check.id];
        return next;
      });
      if (!result.ok) {
        show(result.message, "error");
        return;
      }
      show(done ? `Abgehakt: ${check.text}` : `Wieder offen: ${check.text}`, "info", () => {
        void safe(() => toggleCheck(check.id, !done));
      });
    },
    [show]
  );

  return { move, resize, tick, pendingChecks, trackName };
}

export type DayActions = ReturnType<typeof useDayActions>;
