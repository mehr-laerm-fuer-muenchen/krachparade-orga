"use client";

import { useState, useTransition, type FormEvent } from "react";
import { updateFeedback } from "@/actions/feedback";
import { FEEDBACK_STATUSES, statusLabel, type FeedbackStatus } from "@/lib/feedback/status";

const GENERIC_ERROR = "Das hat nicht geklappt. Bitte noch einmal versuchen.";

/**
 * Status and reply of a report, admins only (spec 014). Saved on "Speichern"
 * only; the server checks `is_admin` again on every call.
 */
export function FeedbackReplyForm({
  id,
  status: savedStatus,
  reply: savedReply,
}: {
  id: string;
  status: FeedbackStatus;
  reply: string;
}) {
  const [status, setStatus] = useState(savedStatus);
  const [reply, setReply] = useState(savedReply);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await updateFeedback(id, { status, reply });
        if (result.ok) {
          setErrors({});
          setMessage({ ok: true, text: "Gespeichert." });
        } else {
          setErrors(result.fieldErrors ?? {});
          setMessage(
            result.message ? { ok: false, text: result.message } : result.fieldErrors ? null : { ok: false, text: GENERIC_ERROR }
          );
        }
      } catch {
        setMessage({ ok: false, text: GENERIC_ERROR });
      }
    });
  };

  return (
    <form
      aria-labelledby="status-antwort"
      onSubmit={submit}
      noValidate
      className="flex flex-col gap-4 rounded-md border border-line bg-surface p-4"
    >
      <h2 id="status-antwort" className="text-lg font-semibold">
        Status und Antwort
      </h2>
      <div className="flex flex-col gap-1">
        <div
          role="group"
          aria-label="Status"
          // Phones 2 × 2, wide screens one row; the gap draws the lines.
          className={`grid grid-cols-2 gap-px overflow-hidden rounded-md border bg-line desk:grid-cols-4 ${
            errors.status ? "border-status-late" : "border-line"
          }`}
        >
          {FEEDBACK_STATUSES.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={status === value}
              onClick={() => {
                setStatus(value);
                setMessage(null);
              }}
              className="min-h-11 bg-surface px-3 font-medium aria-pressed:bg-primary aria-pressed:text-on-primary not-aria-pressed:hover:bg-surface-2"
            >
              {statusLabel(value)}
            </button>
          ))}
        </div>
        {errors.status ? (
          <p role="alert" className="text-sm font-medium text-status-late">
            {errors.status}
          </p>
        ) : null}
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="feedback-reply" className="text-sm text-muted">
          Antwort
        </label>
        <textarea
          id="feedback-reply"
          value={reply}
          onChange={(event) => {
            setReply(event.target.value);
            setMessage(null);
          }}
          maxLength={2000}
          rows={4}
          aria-invalid={Boolean(errors.reply)}
          aria-describedby={errors.reply ? "feedback-reply-error" : undefined}
          className="min-h-28 w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-base aria-invalid:border-status-late"
        />
        {errors.reply ? (
          <p id="feedback-reply-error" role="alert" className="text-sm font-medium text-status-late">
            {errors.reply}
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="min-h-11 rounded-md bg-primary px-4 font-semibold text-on-primary hover:opacity-90 disabled:opacity-50"
        >
          Speichern
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
