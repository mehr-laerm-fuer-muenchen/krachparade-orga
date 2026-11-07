"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { addCheck, deleteCheck, deleteEntry, updateEntry, type DayEntryPatch } from "@/actions/day-plan";
import { FieldError } from "@/components/field-error";
import { OwnerPicker } from "@/components/protocol/owner-picker";
import { INPUT, SECONDARY_BUTTON, type Owner, type Person } from "@/components/protocol/types";
import { useSaveStatus } from "@/components/save-status";
import { TickBox } from "@/components/tick-box";
import type { DayCheckView, DayEntryView, DayPersonView, DayTrackView } from "@/db/day-plan";
import { CHECK_TEXT_MAX, ENTRY_TITLE_MAX, NOTE_MAX, PLACE_MAX, checkProgress, formatEntryTime, minutesToTime, timeToMinutes } from "@/lib/day-plan";
import { formatProgress } from "@/lib/todo-progress";
import { DayPanel, NamesOnlyHint } from "./day-panel";
import type { DayActions } from "./use-day-actions";

export type GroupOption = { id: string; name: string };

const LABEL = "flex flex-col gap-1";
const NUDGES = [-15, -5, 5, 15] as const;

export function ownerOf(person: DayPersonView | null): Owner {
  if (!person) return null;
  return person.memberId ? { memberId: person.memberId } : { name: person.name ?? "" };
}

const nudgeLabel = (minutes: number) => `${minutes > 0 ? "+" : "−"}${Math.abs(minutes)} min`;

/** Details of an entry (spec 030): fields save on blur or change, checklist, move on phones, delete. */
export function EntryPanel({
  entry,
  tracks,
  groups,
  people,
  actions,
  focusTitle,
  onClose,
}: {
  entry: DayEntryView;
  tracks: readonly DayTrackView[];
  groups: readonly GroupOption[];
  people: readonly Person[];
  actions: DayActions;
  focusTitle: boolean;
  onClose: () => void;
}) {
  const { track, status } = useSaveStatus();
  const titleRef = useRef<HTMLInputElement>(null);
  const [owner, setOwner] = useState<Owner>(() => ownerOf(entry.person));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!focusTitle) return;
    titleRef.current?.focus();
    titleRef.current?.select();
  }, [focusTitle]);

  const save = (key: string, patch: DayEntryPatch) => track(key, () => updateEntry(entry.id, patch));
  const checks = entry.checks.map((check) => ({ ...check, done: actions.pendingChecks[check.id] ?? check.done }));
  const progress = checkProgress(checks);
  const trackName = tracks.find((candidate) => candidate.id === entry.trackId)?.name ?? "–";

  const saveTime = (key: "startMinute" | "endMinute", value: string, stored: number | null) => {
    const minutes = value === "" ? null : timeToMinutes(value);
    if (value !== "" && minutes === null) return;
    if (minutes === stored) return;
    void save(key, { [key]: minutes });
  };

  const remove = async () => {
    const count = entry.checks.length;
    const question = `Eintrag „${entry.title}“ mit ${count} ${count === 1 ? "Checkpunkt" : "Checkpunkten"} löschen?`;
    if (!window.confirm(question)) return;
    try {
      const result = await deleteEntry(entry.id);
      if (!result.ok) return setError(result.message);
      onClose();
    } catch {
      setError("Konnte nicht gelöscht werden.");
    }
  };

  const head = (
    <>
      <p data-testid="entry-panel-meta" className="text-sm text-muted tabular-nums">
        {[trackName, formatEntryTime(entry), progress.total > 0 ? `${formatProgress(progress)} Checkliste` : null]
          .filter(Boolean)
          .join(" · ")}
      </p>
      <h2 className="text-lg leading-snug font-semibold break-words">{entry.title}</h2>
    </>
  );

  return (
    <DayPanel label="Eintrag" head={head} onClose={onClose}>
      <label className={LABEL}>
        Titel
        <input
          key={`title-${entry.title}`}
          ref={titleRef}
          type="text"
          defaultValue={entry.title}
          maxLength={ENTRY_TITLE_MAX}
          onBlur={(event) => {
            const value = event.target.value.trim();
            if (value !== entry.title) void save("title", { title: value });
          }}
          className={INPUT}
        />
        {status("title")}
      </label>

      <label className={LABEL}>
        Spalte
        <select
          key={`track-${entry.trackId}`}
          defaultValue={entry.trackId}
          onChange={(event) => void save("trackId", { trackId: event.target.value })}
          className={INPUT}
        >
          {tracks.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </select>
        {status("trackId")}
      </label>

      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1">Uhrzeit</legend>
        <div className="flex flex-wrap items-end gap-2">
          <label className={`${LABEL} w-32`}>
            <span className="text-sm text-muted">von</span>
            <TimeInput
              key={`start-${entry.startMinute}`}
              value={entry.startMinute}
              onSave={(value) => saveTime("startMinute", value, entry.startMinute)}
            />
          </label>
          <label className={`${LABEL} w-32`}>
            <span className="text-sm text-muted">bis (optional)</span>
            <TimeInput
              key={`end-${entry.endMinute}-${entry.startMinute === null}`}
              value={entry.endMinute}
              disabled={entry.startMinute === null}
              onSave={(value) => saveTime("endMinute", value, entry.endMinute)}
            />
          </label>
          <label className="flex min-h-11 items-center gap-2">
            <input
              key={`approx-${entry.approx}`}
              type="checkbox"
              defaultChecked={entry.approx}
              onChange={(event) => void save("approx", { approx: event.target.checked })}
              className="size-5"
            />
            ca.
          </label>
        </div>
        {status("startMinute")}
        {status("endMinute")}
        {status("approx")}
      </fieldset>

      {entry.startMinute !== null ? (
        <div role="group" aria-label="Verschieben" className="flex flex-col gap-1 lg:hidden">
          <span>Verschieben</span>
          <div className="flex flex-wrap gap-2">
            {NUDGES.map((minutes) => (
              <button
                key={minutes}
                type="button"
                onClick={() => void actions.move(entry, entry.startMinute! + minutes, entry.trackId)}
                className={SECONDARY_BUTTON}
              >
                {nudgeLabel(minutes)}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <label className={LABEL}>
        Ort
        <input
          key={`place-${entry.place}`}
          type="text"
          defaultValue={entry.place ?? ""}
          maxLength={PLACE_MAX}
          onBlur={(event) => {
            const value = event.target.value.trim();
            if (value !== (entry.place ?? "")) void save("place", { place: value });
          }}
          className={INPUT}
        />
        {status("place")}
      </label>

      <label className={LABEL}>
        AK
        <select
          key={`group-${entry.workingGroupId}`}
          defaultValue={entry.workingGroupId ?? ""}
          onChange={(event) => void save("workingGroupId", { workingGroupId: event.target.value || null })}
          className={INPUT}
        >
          <option value="">kein AK</option>
          {groups.map((group) => (
            <option key={group.id} value={group.id}>
              AK {group.name}
            </option>
          ))}
        </select>
        {status("workingGroupId")}
      </label>

      <div className="flex flex-col gap-1">
        <OwnerPicker
          people={people}
          value={owner}
          label="Person"
          onChange={(next) => {
            setOwner(next);
            void save("person", { person: next });
          }}
        />
        {status("person")}
      </div>

      <label className={LABEL}>
        Notiz
        <textarea
          key={`note-${entry.note}`}
          defaultValue={entry.note ?? ""}
          maxLength={NOTE_MAX}
          rows={3}
          onBlur={(event) => {
            const value = event.target.value.trim();
            if (value !== (entry.note ?? "")) void save("note", { note: value });
          }}
          className={`${INPUT} py-2`}
        />
        {status("note")}
      </label>
      <NamesOnlyHint />

      <Checklist entry={entry} checks={checks} people={people} actions={actions} progress={formatProgress(progress)} />

      <div className="flex flex-col gap-1 border-t border-line pt-4">
        <button
          type="button"
          onClick={() => void remove()}
          className={`${SECONDARY_BUTTON} self-start border-status-late text-status-late`}
        >
          Eintrag löschen
        </button>
        <FieldError message={error} />
      </div>
    </DayPanel>
  );
}

/** Waiting time after a change before a time is saved (picker wheels on phones change it step by step). */
const TIME_SAVE_DELAY_MS = 800;

/**
 * `type="time"` in 5-minute steps: saves on blur and shortly after a change
 * (the time pickers of phones do not always blur the field).
 */
function TimeInput({
  value,
  disabled = false,
  onSave,
}: {
  value: number | null;
  disabled?: boolean;
  onSave: (value: string) => void;
}) {
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const saveNow = (text: string) => {
    window.clearTimeout(timer.current);
    onSave(text);
  };
  return (
    <input
      type="time"
      step={300}
      disabled={disabled}
      defaultValue={value === null ? "" : minutesToTime(value)}
      onChange={(event) => {
        const text = event.target.value;
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => onSave(text), TIME_SAVE_DELAY_MS);
      }}
      onBlur={(event) => saveNow(event.target.value)}
      className={INPUT}
    />
  );
}

function Checklist({
  entry,
  checks,
  people,
  actions,
  progress,
}: {
  entry: DayEntryView;
  checks: DayCheckView[];
  people: readonly Person[];
  actions: DayActions;
  progress: string;
}) {
  const [text, setText] = useState("");
  const [owner, setOwner] = useState<Owner>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const add = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const result = await addCheck(entry.id, text, owner);
      if (!result.ok) {
        setError(result.message);
      } else {
        setText("");
        setOwner(null);
        setError(null);
      }
    } catch {
      setError("Konnte nicht gespeichert werden.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (check: DayCheckView) => {
    try {
      const result = await deleteCheck(check.id);
      setError(result.ok ? null : result.message);
    } catch {
      setError("Konnte nicht gelöscht werden.");
    }
  };

  return (
    <section aria-label="Checkliste" className="flex flex-col gap-2 border-t border-line pt-4">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold tracking-wide text-muted uppercase">Checkliste</h3>
        {progress ? (
          <span data-testid="entry-checks-progress" className="text-sm text-muted tabular-nums">
            {progress}
          </span>
        ) : null}
      </div>
      {checks.length === 0 ? <p className="text-sm text-muted">Noch keine Punkte.</p> : null}
      <ul className="flex flex-col">
        {checks.map((check) => (
          <li key={check.id} className="flex min-h-11 items-stretch border-t border-line first:border-t-0">
            <TickBox
              checked={check.done}
              label={`Erledigt: ${check.text}`}
              onToggle={() => void actions.tick(check, !check.done)}
            />
            <span className="min-w-0 flex-1 py-2">
              <span className={`block break-words ${check.done ? "text-muted line-through" : ""}`}>{check.text}</span>
              {check.person ? <span className="block text-sm text-muted">{check.person.label}</span> : null}
            </span>
            <button
              type="button"
              onClick={() => void remove(check)}
              aria-label={`Checkpunkt „${check.text}“ löschen`}
              className="flex size-11 shrink-0 items-center justify-center rounded-md text-lg text-muted hover:bg-surface-2 hover:text-text"
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      <form onSubmit={(event) => void add(event)} aria-label="Checkpunkt hinzufügen" className="flex flex-col gap-2">
        <label className={LABEL}>
          Neuer Punkt
          <input
            type="text"
            value={text}
            maxLength={CHECK_TEXT_MAX}
            onChange={(event) => setText(event.target.value)}
            className={INPUT}
          />
        </label>
        <OwnerPicker people={people} value={owner} label="Wer? (optional)" onChange={setOwner} />
        <button type="submit" disabled={busy || text.trim() === ""} className={`${SECONDARY_BUTTON} self-start`}>
          Hinzufügen
        </button>
        <FieldError message={error} />
      </form>
    </section>
  );
}
