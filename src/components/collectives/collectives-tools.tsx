"use client";

import { useState, useTransition, type FormEvent } from "react";
import { deleteAllRegistrations, updateRegistrationWindow } from "@/actions/collective-registrations-admin";

const GENERIC_ERROR = "Das hat nicht geklappt. Bitte noch einmal versuchen.";
const BUTTON =
  "min-h-11 rounded-md border border-line-strong bg-surface px-4 font-medium hover:bg-surface-2 disabled:opacity-50";

/** "Link zur Anmeldung kopieren"; the link is built from the current address. */
export function CopyRegistrationLink() {
  const [copied, setCopied] = useState<"ok" | "failed" | null>(null);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/anmeldung`);
      setCopied("ok");
    } catch {
      setCopied("failed");
    }
  };
  return (
    <span className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={copy} className={BUTTON}>
        Link zur Anmeldung kopieren
      </button>
      {copied ? (
        <span role="status" className={copied === "ok" ? "text-primary" : "text-status-late"}>
          {copied === "ok" ? "Kopiert." : "Kopieren ging nicht – der Link ist …/anmeldung."}
        </span>
      ) : null}
    </span>
  );
}

/** Admins: registration window (both dates or both empty). */
export function RegistrationWindowForm({ opensOn, closesOn }: { opensOn: string; closesOn: string }) {
  const [opens, setOpens] = useState(opensOn);
  const [closes, setCloses] = useState(closesOn);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const save = (clear: boolean) => {
    if (pending) return;
    setMessage(null);
    startTransition(async () => {
      try {
        const result = clear ? await updateRegistrationWindow(null, null) : await updateRegistrationWindow(opens, closes);
        if (result.ok) {
          if (clear) {
            setOpens("");
            setCloses("");
          }
          setMessage({ ok: true, text: "Gespeichert." });
        } else {
          setMessage({ ok: false, text: result.message });
        }
      } catch {
        setMessage({ ok: false, text: GENERIC_ERROR });
      }
    });
  };

  return (
    <form
      onSubmit={(event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        save(false);
      }}
      aria-labelledby="zeitfenster" className="flex flex-col gap-3">
      <h3 id="zeitfenster" className="font-semibold">
        Zeitfenster der Anmeldung
      </h3>
      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-muted">Offen ab</span>
          <input
            type="date"
            value={opens}
            onChange={(event) => setOpens(event.target.value)}
            className="min-h-11 rounded-md border border-line-strong bg-surface px-3 text-base"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-muted">Offen bis</span>
          <input
            type="date"
            value={closes}
            onChange={(event) => setCloses(event.target.value)}
            className="min-h-11 rounded-md border border-line-strong bg-surface px-3 text-base"
          />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="min-h-11 rounded-md bg-primary px-4 font-semibold text-on-primary hover:opacity-90 disabled:opacity-50"
        >
          Zeitfenster speichern
        </button>
        <button type="button" disabled={pending} onClick={() => save(true)} className={BUTTON}>
          Anmeldung schließen
        </button>
        {message ? (
          <p role={message.ok ? "status" : "alert"} className={message.ok ? "text-primary" : "font-medium text-status-late"}>
            {message.text}
          </p>
        ) : null}
      </div>
    </form>
  );
}

/** Admins, from the retention end on: deletes every registration of the edition. */
export function DeleteAllRegistrations({
  count,
  allowed,
  allowedFromLabel,
}: {
  count: number;
  allowed: boolean;
  allowedFromLabel: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const remove = () => {
    startTransition(async () => {
      try {
        const result = await deleteAllRegistrations();
        setConfirming(false);
        setMessage(result.ok ? { ok: true, text: "Alle Anmeldungen gelöscht." } : { ok: false, text: result.message });
      } catch {
        setMessage({ ok: false, text: GENERIC_ERROR });
      }
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <h3 className="font-semibold">Alle Anmeldungen löschen</h3>
      {!allowed ? (
        <p className="text-sm text-muted">Geht erst ab dem {allowedFromLabel} (3 Monate nach der Krachparade).</p>
      ) : confirming ? (
        <div role="alertdialog" aria-label="Löschen bestätigen" className="flex flex-col gap-2 rounded-md border border-status-late p-3">
          <p>
            Alle {count} Anmeldungen der Krachparade 2027 endgültig löschen? Exportiere vorher die CSV, falls du sie
            brauchst.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={remove}
              disabled={pending}
              className="min-h-11 rounded-md bg-status-late px-4 font-semibold text-on-status-late disabled:opacity-50"
            >
              Endgültig löschen
            </button>
            <button type="button" onClick={() => setConfirming(false)} className={BUTTON}>
              Abbrechen
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setConfirming(true)} disabled={count === 0} className={`${BUTTON} w-fit`}>
          Alle Anmeldungen löschen
        </button>
      )}
      {message ? (
        <p role={message.ok ? "status" : "alert"} className={message.ok ? "text-primary" : "font-medium text-status-late"}>
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
