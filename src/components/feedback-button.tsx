"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { createFeedback } from "@/actions/feedback";
import { newFeedbackText } from "@/lib/feedback/count";
import { describeDevice } from "@/lib/feedback/device";
import { FEEDBACK_KINDS, kindLabel, type FeedbackKind } from "@/lib/feedback/kinds";

const GENERIC_ERROR = "Das hat nicht geklappt. Bitte noch einmal versuchen.";

const INPUT =
  "min-h-28 w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-base aria-invalid:border-status-late";
const PRIMARY_BUTTON =
  "min-h-11 rounded-md bg-primary px-4 font-semibold text-on-primary hover:opacity-90 disabled:opacity-50";
const SECONDARY_BUTTON = "min-h-11 rounded-md border border-line bg-surface px-4 font-medium hover:bg-surface-2";

/** Bug icon, drawn inline (no icon library). */
export function BugIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M9 7.5V6a3 3 0 0 1 6 0v1.5" />
      <rect x="7" y="7.5" width="10" height="12" rx="5" />
      <path d="M12 11v8.5M7 12H3.5M20.5 12H17M7.5 16.5 4.5 19M16.5 16.5l3 2.5M7.5 9 4.5 6.5M16.5 9l3-2.5" />
    </svg>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <p id={id} role="alert" className="text-sm font-medium text-status-late">
      {message}
    </p>
  ) : null;
}

/**
 * Bug button in the header with the feedback dialog (spec 014). Page, device
 * and the open plan element are read in the browser when opening and
 * sending. Sending saves without re-rendering the page behind the dialog.
 */
export function FeedbackButton({
  className = "",
  newCount = 0,
}: {
  className?: string;
  /** New reports, only passed for admins (pink number, spec 014 B4). */
  newCount?: number;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const sendingRef = useRef(false);
  const [kind, setKind] = useState<FeedbackKind | null>(null);
  const [message, setMessage] = useState("");
  const [context, setContext] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  // Keys pressed in the dialog stay there: the plan listens on the document
  // (Escape closes its panel), which must not react behind the dialog.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const stop = (event: KeyboardEvent) => event.stopPropagation();
    dialog.addEventListener("keydown", stop);
    return () => dialog.removeEventListener("keydown", stop);
  }, []);

  // The form disappears after sending; focus stays inside the dialog.
  useEffect(() => {
    if (sent) closeRef.current?.focus();
  }, [sent]);

  const open = () => {
    if (sent) {
      setKind(null);
      setMessage("");
      setSent(false);
    }
    setErrors({});
    setServerError(null);
    const element = document.querySelector<HTMLElement>("[data-feedback-context]");
    setContext(element?.dataset.feedbackContext?.trim() || null);
    dialogRef.current?.showModal();
  };

  const close = () => dialogRef.current?.close();

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    setServerError(null);
    try {
      const result = await createFeedback({
        kind,
        message,
        pagePath: window.location.pathname,
        pageTitle: document.title,
        context,
        device: describeDevice(navigator.userAgent, navigator.maxTouchPoints),
        viewport: `${window.innerWidth} × ${window.innerHeight}`,
      });
      if (result.ok) {
        setErrors({});
        setSent(true);
      } else {
        setErrors(result.fieldErrors ?? {});
        setServerError(result.message ?? (result.fieldErrors ? null : GENERIC_ERROR));
      }
    } catch {
      setServerError(GENERIC_ERROR);
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={open}
        aria-label={newCount > 0 ? `Feedback geben, ${newFeedbackText(newCount)}` : "Feedback geben"}
        aria-haspopup="dialog"
        className={`relative flex size-11 shrink-0 items-center justify-center rounded-md text-header-text hover:bg-white/10 ${className}`}
      >
        <BugIcon />
        {newCount > 0 ? (
          // Same look as the number at "Meine" (spec 009).
          <span
            aria-hidden
            data-testid="feedback-new-count"
            className="pointer-events-none absolute top-0 right-0 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-xs font-bold text-header-bg tabular-nums"
          >
            {newCount}
          </span>
        ) : null}
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby="feedback-title"
        onClose={() => buttonRef.current?.focus()}
        className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto overscroll-contain rounded-md border border-line bg-surface p-0 text-text shadow-xl backdrop:bg-black/50"
      >
        <div className="flex flex-col gap-4 p-4 desk:p-5">
          <h2 id="feedback-title" className="text-lg font-semibold">
            Feedback geben
          </h2>

          {sent ? (
            <>
              <p role="status" className="font-medium">
                Danke! Deine Meldung ist gespeichert.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <button ref={closeRef} type="button" onClick={close} className={PRIMARY_BUTTON}>
                  Schließen
                </button>
                <Link
                  href="/feedback"
                  prefetch={false}
                  onClick={close}
                  className="flex min-h-11 items-center rounded-md px-2 font-medium text-primary underline underline-offset-4"
                >
                  Alle Meldungen
                </Link>
              </div>
            </>
          ) : (
            <form noValidate onSubmit={submit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <div
                  role="group"
                  aria-label="Art"
                  aria-describedby={errors.kind ? "feedback-kind-error" : undefined}
                  className={`flex overflow-hidden rounded-md border ${errors.kind ? "border-status-late" : "border-line"}`}
                >
                  {FEEDBACK_KINDS.map((value) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={kind === value}
                      onClick={() => {
                        setKind(value);
                        setErrors((previous) => ({ ...previous, kind: "" }));
                      }}
                      className="min-h-11 flex-1 font-medium not-first:border-l not-first:border-line aria-pressed:bg-primary aria-pressed:text-on-primary not-aria-pressed:hover:bg-surface-2"
                    >
                      {kindLabel(value)}
                    </button>
                  ))}
                </div>
                <FieldError id="feedback-kind-error" message={errors.kind} />
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="feedback-message" className="text-sm text-muted">
                  Beschreibung
                </label>
                <textarea
                  id="feedback-message"
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  maxLength={2000}
                  rows={4}
                  aria-invalid={Boolean(errors.message)}
                  aria-describedby={`feedback-message-hint${errors.message ? " feedback-message-error" : ""}`}
                  className={INPUT}
                />
                <FieldError id="feedback-message-error" message={errors.message} />
                <p id="feedback-message-hint" className="text-sm text-muted">
                  Bei Fehlern: Was hast du gemacht, was ist passiert?
                </p>
              </div>

              {context ? <p className="break-words">Bezieht sich auf: {context}</p> : null}

              <p className="text-sm text-muted">
                Seite, Zeitpunkt, Gerät und dein Name werden mitgeschickt. Alle in der Kern-Orga können die Meldung
                lesen. Bitte keine Telefonnummern, Adressen oder Kontodaten eintragen.
              </p>

              {serverError ? (
                <p role="alert" className="text-sm font-medium text-status-late">
                  {serverError}
                </p>
              ) : null}

              <div className="flex flex-wrap gap-3">
                <button type="submit" disabled={sending} className={PRIMARY_BUTTON}>
                  Absenden
                </button>
                <button type="button" onClick={close} className={SECONDARY_BUTTON}>
                  Abbrechen
                </button>
              </div>
            </form>
          )}
        </div>
      </dialog>
    </>
  );
}
