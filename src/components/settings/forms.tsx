"use client";

import { useActionState } from "react";
import {
  inviteMember,
  setMemberActive,
  setMemberAdmin,
  updateDDay,
  type ActionState,
} from "@/actions/settings";

const INPUT =
  "min-h-11 w-full rounded-md border border-line-strong bg-surface px-3 text-base text-text disabled:bg-surface-2 disabled:text-muted";
const PRIMARY_BUTTON =
  "min-h-11 shrink-0 rounded-md bg-primary px-4 font-semibold text-on-primary disabled:opacity-50";
const SECONDARY_BUTTON =
  "min-h-11 shrink-0 rounded-md border border-line-strong bg-surface px-3 font-medium text-text hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-surface";

/** Result of the last submit: errors as alert, successes as status. */
export function FormMessage({ state }: { state: ActionState }) {
  if (!state) {
    return null;
  }
  return state.ok ? (
    <p role="status" className="text-primary">
      {state.message}
    </p>
  ) : (
    <p role="alert" className="font-medium text-status-late">
      {state.message}
    </p>
  );
}

export function DDayForm({ dDay, canEdit }: { dDay: string; canEdit: boolean }) {
  const [state, action, pending] = useActionState(updateDDay, null);
  return (
    <form action={action} className="flex flex-col gap-2">
      <label htmlFor="dDay" className="font-medium">
        Datum der Krachparade
      </label>
      <div className="flex flex-wrap gap-2">
        <input
          id="dDay"
          name="dDay"
          type="date"
          required
          defaultValue={dDay}
          disabled={!canEdit}
          className={`${INPUT} max-w-52`}
        />
        {canEdit ? (
          <button type="submit" disabled={pending} className={PRIMARY_BUTTON}>
            Speichern
          </button>
        ) : null}
      </div>
      <FormMessage state={state} />
    </form>
  );
}

export function InviteForm() {
  const [state, action, pending] = useActionState(inviteMember, null);
  return (
    <form action={action} aria-label="Person einladen" className="flex flex-col gap-3">
      <h3 className="font-semibold">Person einladen</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span>Name</span>
          <input name="name" required maxLength={100} autoComplete="off" className={INPUT} />
        </label>
        <label className="flex flex-col gap-1">
          <span>E-Mail (Google-Konto)</span>
          <input name="email" type="email" required autoComplete="off" className={INPUT} />
        </label>
      </div>
      <div>
        <button type="submit" disabled={pending} className={PRIMARY_BUTTON}>
          Einladen
        </button>
      </div>
      <FormMessage state={state} />
    </form>
  );
}

/**
 * One action on a person (deactivate, admin right …). `lockedReason` disables
 * the button and says why; the server checks the same rules again.
 */
export function MemberActionButton({
  kind,
  memberId,
  value,
  label,
  lockedReason,
}: {
  kind: "active" | "admin";
  memberId: string;
  value: boolean;
  label: string;
  lockedReason?: string;
}) {
  const [state, action, pending] = useActionState(
    kind === "active" ? setMemberActive : setMemberAdmin,
    null
  );
  return (
    <form action={action} className="flex flex-col gap-1">
      <input type="hidden" name="memberId" value={memberId} />
      <input type="hidden" name="value" value={String(value)} />
      <button
        type="submit"
        disabled={pending || Boolean(lockedReason)}
        title={lockedReason}
        className={SECONDARY_BUTTON}
      >
        {label}
      </button>
      {lockedReason ? <span className="text-xs text-muted">{lockedReason}</span> : null}
      <FormMessage state={state} />
    </form>
  );
}
