"use client";

import { useEffect, useRef, useState } from "react";
import { deleteTrack, moveTrack, renameTrack } from "@/actions/day-plan";
import { FieldError } from "@/components/field-error";
import { INPUT, SECONDARY_BUTTON } from "@/components/protocol/types";
import { useSaveStatus } from "@/components/save-status";
import type { DayTrackView } from "@/db/day-plan";
import { TRACK_NAME_MAX } from "@/lib/day-plan";
import { DayPanel } from "./day-panel";

/** Edit a column (spec 030): name, move left/right, delete only while empty. */
export function TrackPanel({
  track,
  tracks,
  entryCount,
  focusName,
  onClose,
}: {
  track: DayTrackView;
  tracks: readonly DayTrackView[];
  entryCount: number;
  focusName: boolean;
  onClose: () => void;
}) {
  const { track: trackSave, status } = useSaveStatus();
  const nameRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const index = tracks.findIndex((candidate) => candidate.id === track.id);

  useEffect(() => {
    if (!focusName) return;
    nameRef.current?.focus();
    nameRef.current?.select();
  }, [focusName]);

  const run = async (call: () => Promise<{ ok: true } | { ok: false; message: string }>) => {
    try {
      const result = await call();
      setError(result.ok ? null : result.message);
      return result.ok;
    } catch {
      setError("Konnte nicht gespeichert werden.");
      return false;
    }
  };

  const head = (
    <>
      <p className="text-sm text-muted">Spalte</p>
      <h2 className="text-lg leading-snug font-semibold break-words">{track.name}</h2>
    </>
  );

  return (
    <DayPanel label="Spalte" head={head} onClose={onClose}>
      <label className="flex flex-col gap-1">
        Name
        <input
          key={`name-${track.name}`}
          ref={nameRef}
          type="text"
          defaultValue={track.name}
          maxLength={TRACK_NAME_MAX}
          onBlur={(event) => {
            const value = event.target.value.trim();
            if (value !== track.name) void trackSave("name", () => renameTrack(track.id, value));
          }}
          className={INPUT}
        />
        {status("name")}
      </label>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={index <= 0}
          onClick={() => void run(() => moveTrack(track.id, "left"))}
          className={SECONDARY_BUTTON}
        >
          ← nach links
        </button>
        <button
          type="button"
          disabled={index === -1 || index >= tracks.length - 1}
          onClick={() => void run(() => moveTrack(track.id, "right"))}
          className={SECONDARY_BUTTON}
        >
          nach rechts →
        </button>
      </div>

      <div className="flex flex-col gap-2 border-t border-line pt-4">
        {entryCount === 0 ? (
          <button
            type="button"
            onClick={async () => {
              if (await run(() => deleteTrack(track.id))) onClose();
            }}
            className={`${SECONDARY_BUTTON} self-start border-status-late text-status-late`}
          >
            Spalte löschen
          </button>
        ) : (
          <p data-testid="track-delete-hint" className="text-sm text-muted">
            Löschen geht erst, wenn die Spalte leer ist ({entryCount} {entryCount === 1 ? "Eintrag" : "Einträge"}{" "}
            verschieben).
          </p>
        )}
        <FieldError message={error} />
      </div>
    </DayPanel>
  );
}
