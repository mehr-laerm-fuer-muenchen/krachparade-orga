"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { deleteRegistration, setRegistrationNote, setRegistrationStatus } from "@/actions/collective-registrations-admin";
import { NOTE_MAX } from "@/lib/collectives/limits";
import {
  REGISTRATION_STATUSES,
  REGISTRATION_STATUS_LABELS,
  type RegistrationStatus,
} from "@/lib/collectives/options";

const GENERIC_ERROR = "Das hat nicht geklappt. Bitte noch einmal versuchen.";
type Message = { ok: boolean; text: string } | null;

function Feedback({ message }: { message: Message }) {
  return message ? (
    <p role={message.ok ? "status" : "alert"} className={message.ok ? "text-primary" : "font-medium text-status-late"}>
      {message.text}
    </p>
  ) : null;
}

/** Status (saved on click) and internal note (saved on "Speichern"), spec 031. */
export function RegistrationReview({
  id,
  status: savedStatus,
  note: savedNote,
}: {
  id: string;
  status: RegistrationStatus;
  note: string;
}) {
  const [status, setStatus] = useState(savedStatus);
  const [note, setNote] = useState(savedNote);
  const [statusMessage, setStatusMessage] = useState<Message>(null);
  const [noteMessage, setNoteMessage] = useState<Message>(null);
  const [pending, startTransition] = useTransition();

  const changeStatus = (value: RegistrationStatus) => {
    if (pending || value === status) return;
    const previous = status;
    setStatus(value);
    setStatusMessage(null);
    startTransition(async () => {
      try {
        const result = await setRegistrationStatus(id, value);
        if (result.ok) {
          setStatusMessage({ ok: true, text: `Status: ${REGISTRATION_STATUS_LABELS[value]}.` });
        } else {
          setStatus(previous);
          setStatusMessage({ ok: false, text: result.message });
        }
      } catch {
        setStatus(previous);
        setStatusMessage({ ok: false, text: GENERIC_ERROR });
      }
    });
  };

  const saveNote = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    setNoteMessage(null);
    startTransition(async () => {
      try {
        const result = await setRegistrationNote(id, note);
        setNoteMessage(result.ok ? { ok: true, text: "Gespeichert." } : { ok: false, text: result.message });
      } catch {
        setNoteMessage({ ok: false, text: GENERIC_ERROR });
      }
    });
  };

  return (
    <section aria-labelledby="bearbeitung" className="flex flex-col gap-4 rounded-md border border-line bg-surface p-4">
      <h2 id="bearbeitung" className="text-lg font-semibold">
        Status und Notiz
      </h2>
      <div className="flex flex-col gap-1">
        <div
          role="group"
          aria-label="Status"
          className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-line bg-line desk:grid-cols-4"
        >
          {REGISTRATION_STATUSES.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={status === value}
              onClick={() => changeStatus(value)}
              className="min-h-11 bg-surface px-3 font-medium aria-pressed:bg-primary aria-pressed:text-on-primary not-aria-pressed:hover:bg-surface-2"
            >
              {REGISTRATION_STATUS_LABELS[value]}
            </button>
          ))}
        </div>
        <Feedback message={statusMessage} />
      </div>
      <form onSubmit={saveNote} className="flex flex-col gap-2">
        <label htmlFor="interne-notiz" className="text-sm text-muted">
          Interne Notiz (sieht nur die Orga)
        </label>
        <textarea
          id="interne-notiz"
          value={note}
          onChange={(event) => {
            setNote(event.target.value);
            setNoteMessage(null);
          }}
          maxLength={NOTE_MAX}
          rows={3}
          className="min-h-24 w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-base"
        />
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="min-h-11 rounded-md bg-primary px-4 font-semibold text-on-primary hover:opacity-90 disabled:opacity-50"
          >
            Notiz speichern
          </button>
          <Feedback message={noteMessage} />
        </div>
      </form>
    </section>
  );
}

/** Admins only; asks once more before deleting (spec 031). */
export function DeleteRegistration({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<Message>(null);
  const [pending, startTransition] = useTransition();

  const remove = () => {
    startTransition(async () => {
      try {
        const result = await deleteRegistration(id);
        if (result.ok) {
          router.push("/kollektive");
          return;
        }
        setMessage({ ok: false, text: result.message });
      } catch {
        setMessage({ ok: false, text: GENERIC_ERROR });
      }
    });
  };

  return (
    <section aria-label="Anmeldung löschen" className="flex flex-col gap-2">
      {confirming ? (
        <div role="alertdialog" aria-label="Löschen bestätigen" className="flex flex-col gap-2 rounded-md border border-status-late bg-surface p-3">
          <p>Anmeldung von {name} endgültig löschen?</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={remove}
              disabled={pending}
              className="min-h-11 rounded-md bg-status-late px-4 font-semibold text-on-status-late disabled:opacity-50"
            >
              Endgültig löschen
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="min-h-11 rounded-md border border-line-strong bg-surface px-4 font-medium hover:bg-surface-2"
            >
              Abbrechen
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="min-h-11 w-fit rounded-md border border-status-late bg-surface px-4 font-medium text-status-late hover:bg-surface-2"
        >
          Anmeldung löschen
        </button>
      )}
      <Feedback message={message} />
    </section>
  );
}
