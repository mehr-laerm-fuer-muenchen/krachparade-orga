"use client";

import { useActionState, useState } from "react";
import {
  createDepartment,
  inviteMember,
  moveDepartment,
  renameDepartment,
  setDepartmentLead,
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
        D-Day
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

export type LeadOption = { id: string; name: string; active: boolean };

export function DepartmentRow({
  id,
  name,
  leadId,
  leads,
  isFirst,
  isLast,
}: {
  id: string;
  name: string;
  leadId: string | null;
  leads: readonly LeadOption[];
  isFirst: boolean;
  isLast: boolean;
}) {
  const [renameState, rename, renaming] = useActionState(renameDepartment, null);
  const [leadState, setLead, savingLead] = useActionState(setDepartmentLead, null);
  const [moveState, move, moving] = useActionState(moveDepartment, null);
  // "Umbenennen" only shows up once the name was edited (saves room on phones).
  const [draft, setDraft] = useState(name);
  const changed = draft.trim() !== name;

  return (
    <li className="flex flex-col gap-2 border-b border-line px-4 py-3 last:border-b-0 desk:grid desk:grid-cols-[minmax(0,1fr)_minmax(0,16rem)_auto] desk:items-start desk:gap-3">
      <form action={rename} className="flex flex-col gap-1">
        <input type="hidden" name="departmentId" value={id} />
        <div className="flex gap-2">
          <input
            name="name"
            required
            maxLength={100}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            aria-label={`Name von ${name}`}
            className={INPUT}
          />
          {changed ? (
            <button type="submit" disabled={renaming} className={SECONDARY_BUTTON}>
              Umbenennen
            </button>
          ) : null}
        </div>
        <FormMessage state={renameState} />
      </form>

      <div className="flex gap-2 desk:contents">
        <form action={setLead} className="flex min-w-0 flex-1 flex-col gap-1">
          <input type="hidden" name="departmentId" value={id} />
          <select
            name="leadId"
            defaultValue={leadId ?? ""}
            disabled={savingLead}
            aria-label={`Leitung ${name}`}
            onChange={(event) => event.currentTarget.form?.requestSubmit()}
            className={INPUT}
          >
            <option value="">– keine Leitung –</option>
            {leads.map((lead) => (
              <option key={lead.id} value={lead.id} disabled={!lead.active}>
                {lead.active ? lead.name : `${lead.name} (deaktiviert)`}
              </option>
            ))}
          </select>
          <FormMessage state={leadState} />
        </form>

        <form action={move} className="flex flex-col gap-1">
          <input type="hidden" name="departmentId" value={id} />
          <div className="flex gap-1">
            <button
              type="submit"
              name="direction"
              value="up"
              disabled={moving || isFirst}
              aria-label={`${name} nach oben`}
              className={`${SECONDARY_BUTTON} w-11 px-0`}
            >
              ↑
            </button>
            <button
              type="submit"
              name="direction"
              value="down"
              disabled={moving || isLast}
              aria-label={`${name} nach unten`}
              className={`${SECONDARY_BUTTON} w-11 px-0`}
            >
              ↓
            </button>
          </div>
          <FormMessage state={moveState} />
        </form>
      </div>
    </li>
  );
}

export function CreateDepartmentForm() {
  const [state, action, pending] = useActionState(createDepartment, null);
  return (
    <form action={action} className="flex flex-col gap-2">
      <label htmlFor="newDepartment" className="font-medium">
        Neues Referat
      </label>
      <div className="flex gap-2">
        <input id="newDepartment" name="name" required maxLength={100} className={INPUT} />
        <button type="submit" disabled={pending} className={PRIMARY_BUTTON}>
          Anlegen
        </button>
      </div>
      <FormMessage state={state} />
    </form>
  );
}
