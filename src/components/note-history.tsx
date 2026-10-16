"use client";

import { useId, useState, type FormEvent } from "react";
import { FieldError } from "@/components/field-error";
import type { PlanResult } from "@/components/plan/plan-detail";
import type { FieldStatus } from "@/components/save-status";
import type { PlanNoteView } from "@/lib/gantt-layout";
import { formatWeekdayShort } from "@/lib/plan-preview";

// Notes as a history (spec 008, shared from spec 018 on): the panel of a plan
// element, the notes of a working group and of a department.

/** Saves through the page's save status; true if it worked. */
export type NoteSave = (field: string, call: () => Promise<PlanResult>) => Promise<boolean>;

/** Same as in the panel; the hint every note field carries. */
export const PRIVACY_HINT = "Keine Telefonnummern, Adressen oder Kontodaten eintragen.";

const INPUT =
  "min-h-11 rounded-md border border-line-strong bg-surface px-3 text-base disabled:opacity-50 aria-invalid:border-status-late";
const SMALL_BUTTON =
  "min-h-11 shrink-0 rounded-md border border-line bg-surface px-3 font-medium hover:bg-surface-2 disabled:opacity-50";
const PRIMARY_BUTTON =
  "min-h-11 shrink-0 rounded-md bg-primary px-4 font-semibold text-on-primary hover:opacity-90 disabled:opacity-50";

/**
 * Form on top, notes newest first with "Name · Tag (· bearbeitet)"; own
 * notes can be edited and deleted (the server checks it again). `save` shows
 * "Gespeichert ✓" at the field, `act` only an error. With `limit` only the
 * newest notes show, "Alle (n)" shows the rest.
 */
export function NoteHistory({
  notes,
  onAdd,
  onUpdate,
  onDelete,
  save,
  act,
  status,
  errors,
  limit,
  placeholder,
  emptyText = "Noch keine.",
}: {
  notes: readonly PlanNoteView[];
  onAdd: (text: string) => Promise<PlanResult>;
  onUpdate: (noteId: string, text: string) => Promise<PlanResult>;
  onDelete: (noteId: string) => Promise<PlanResult>;
  save: NoteSave;
  act: NoteSave;
  status: FieldStatus;
  errors: Record<string, string | null>;
  limit?: number;
  placeholder?: string;
  emptyText?: string;
}) {
  const hintId = useId();
  const [editing, setEditing] = useState<string | null>(null);
  const [all, setAll] = useState(false);
  const shown = limit === undefined || all ? notes : notes.slice(0, limit);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const text = String(new FormData(form).get("text") ?? "");
    await save("add-note", async () => {
      const result = await onAdd(text);
      if (result.ok) form.reset();
      return result;
    });
  };

  return (
    <>
      <form onSubmit={submit} aria-label="Notiz schreiben" className="flex flex-col gap-2">
        <textarea
          name="text"
          rows={3}
          maxLength={2000}
          required
          placeholder={placeholder}
          aria-label="Neue Notiz"
          aria-describedby={hintId}
          className={`${INPUT} py-2`}
        />
        <button type="submit" className={`${PRIMARY_BUTTON} self-start`}>
          Notiz speichern
        </button>
        <p id={hintId} className="text-sm text-muted">
          {PRIVACY_HINT}
        </p>
        {status("add-note")}
      </form>
      {notes.length === 0 ? (
        <p className="text-muted">{emptyText}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {shown.map((note) => (
            <li key={note.id} className="flex flex-col gap-1">
              <p className="text-sm text-muted">
                {note.authorName} · {formatWeekdayShort(note.date)}
                {note.edited ? " · bearbeitet" : ""}
              </p>
              {editing === note.id ? (
                <form
                  className="flex flex-col gap-2"
                  onSubmit={async (event) => {
                    event.preventDefault();
                    const text = String(new FormData(event.currentTarget).get("text") ?? "");
                    await save(`note-${note.id}`, async () => {
                      const result = await onUpdate(note.id, text);
                      if (result.ok) setEditing(null);
                      return result;
                    });
                  }}
                >
                  <textarea
                    name="text"
                    rows={3}
                    maxLength={2000}
                    required
                    defaultValue={note.text}
                    aria-label="Notiz bearbeiten"
                    className={`${INPUT} py-2`}
                  />
                  <div className="flex gap-2">
                    <button type="submit" className={PRIMARY_BUTTON}>
                      Speichern
                    </button>
                    <button type="button" onClick={() => setEditing(null)} className={SMALL_BUTTON}>
                      Abbrechen
                    </button>
                  </div>
                </form>
              ) : (
                <p className="whitespace-pre-line break-words">{note.text}</p>
              )}
              {note.own && editing !== note.id ? (
                <div className="flex gap-2">
                  <button type="button" onClick={() => setEditing(note.id)} className={SMALL_BUTTON}>
                    Bearbeiten
                  </button>
                  <button
                    type="button"
                    onClick={() => act(`note-delete-${note.id}`, () => onDelete(note.id))}
                    className={SMALL_BUTTON}
                  >
                    Löschen
                  </button>
                </div>
              ) : null}
              {status(`note-${note.id}`)}
              <FieldError message={errors[`note-delete-${note.id}`]} />
            </li>
          ))}
        </ul>
      )}
      {limit !== undefined && notes.length > limit ? (
        <button type="button" onClick={() => setAll(!all)} className={`${SMALL_BUTTON} self-start`}>
          {all ? `Nur die letzten ${limit}` : `Alle (${notes.length})`}
        </button>
      ) : null}
    </>
  );
}
