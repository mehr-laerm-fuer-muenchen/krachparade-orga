"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { addRolePerson, createRole, deleteRole, removeRolePerson, updateRole, type DayRolePatch } from "@/actions/day-plan";
import { FieldError } from "@/components/field-error";
import { OwnerPicker } from "@/components/protocol/owner-picker";
import { INPUT, SECONDARY_BUTTON, type Owner, type Person } from "@/components/protocol/types";
import { useSaveStatus } from "@/components/save-status";
import type { DayRoleView } from "@/db/day-plan";
import { ROLE_MARK_MAX, ROLE_TASK_MAX, ROLE_TITLE_MAX } from "@/lib/day-plan";
import { DayPanel, NamesOnlyHint } from "./day-panel";
import type { GroupOption } from "./entry-panel";

const NEW_ROLE = "Neue Rolle";
const CHIP = "inline-flex items-center rounded-full border border-line-strong px-2 text-xs font-semibold text-muted";

/** Roles on the day (spec 030): cards like the AK cards, unfilled roles in red. */
export function DayRoles({
  roles,
  people,
  groups,
}: {
  roles: DayRoleView[];
  people: Person[];
  groups: GroupOption[];
}) {
  const [selected, setSelected] = useState<{ id: string; fresh: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const close = useCallback(() => setSelected(null), []);
  const role = selected ? roles.find((candidate) => candidate.id === selected.id) : undefined;

  const add = async () => {
    try {
      const result = await createRole(NEW_ROLE);
      if (result.ok) {
        setError(null);
        setSelected({ id: result.id, fresh: true });
      } else {
        setError(result.message);
      }
    } catch {
      setError("Konnte nicht gespeichert werden.");
    }
  };

  return (
    <div className="flex items-start gap-4">
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <button
          type="button"
          onClick={() => void add()}
          className="min-h-11 self-start rounded-md bg-primary px-4 font-semibold text-on-primary hover:opacity-90"
        >
          + Rolle
        </button>
        <FieldError message={error} />
        {roles.length === 0 ? <p className="text-muted">Noch keine Rollen.</p> : null}
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))] gap-3">
          {roles.map((candidate) => (
            <li
              key={candidate.id}
              data-testid="role-card"
              className={`flex flex-col rounded-md border bg-surface ${candidate.id === role?.id ? "border-accent" : "border-line"}`}
            >
              <button
                type="button"
                onClick={() => setSelected({ id: candidate.id, fresh: false })}
                className="flex flex-1 flex-col gap-1.5 rounded-t-md px-4 pt-3 pb-2.5 text-left hover:bg-surface-2"
              >
                <h2 className="flex justify-between gap-2 text-base font-semibold">
                  <span className="break-words">{candidate.title}</span>
                  <span aria-hidden className="font-medium text-muted">
                    ›
                  </span>
                </h2>
                {candidate.task ? <span className="text-sm break-words text-muted">{candidate.task}</span> : null}
                {candidate.workingGroupName || candidate.mark ? (
                  <span className="flex flex-wrap gap-1.5">
                    {candidate.workingGroupName ? <span className={CHIP}>AK {candidate.workingGroupName}</span> : null}
                    {candidate.mark ? <span className={CHIP}>{candidate.mark}</span> : null}
                  </span>
                ) : null}
              </button>
              <p data-testid="role-people" className="border-t border-line px-4 py-2 text-sm">
                {candidate.people.length > 0 ? (
                  <span className="font-medium">{candidate.people.map((person) => person.label).join(", ")}</span>
                ) : (
                  <span className="font-semibold text-status-late">noch niemand eingetragen</span>
                )}
              </p>
            </li>
          ))}
        </ul>
      </div>
      {role ? (
        <RolePanel
          key={role.id}
          role={role}
          people={people}
          groups={groups}
          focusTitle={selected?.fresh ?? false}
          onClose={close}
        />
      ) : null}
    </div>
  );
}

function RolePanel({
  role,
  people,
  groups,
  focusTitle,
  onClose,
}: {
  role: DayRoleView;
  people: Person[];
  groups: GroupOption[];
  focusTitle: boolean;
  onClose: () => void;
}) {
  const { track, status } = useSaveStatus();
  const titleRef = useRef<HTMLInputElement>(null);
  const [owner, setOwner] = useState<Owner>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!focusTitle) return;
    titleRef.current?.focus();
    titleRef.current?.select();
  }, [focusTitle]);

  const save = (key: string, patch: DayRolePatch) => track(key, () => updateRole(role.id, patch));
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

  const addPerson = async () => {
    if (!owner || busy) return;
    setBusy(true);
    if (await run(() => addRolePerson(role.id, owner))) setOwner(null);
    setBusy(false);
  };

  const remove = async () => {
    if (!window.confirm(`Rolle „${role.title}“ löschen?`)) return;
    if (await run(() => deleteRole(role.id))) onClose();
  };

  const text = (key: "title" | "task" | "mark", value: string, stored: string | null) => {
    const trimmed = value.trim();
    if (trimmed !== (stored ?? "")) void save(key, { [key]: trimmed });
  };

  const head = (
    <>
      <p className="text-sm text-muted">
        Rolle · {role.people.length} {role.people.length === 1 ? "Person" : "Personen"}
      </p>
      <h2 className="text-lg leading-snug font-semibold break-words">{role.title}</h2>
    </>
  );

  return (
    <DayPanel label="Rolle" head={head} onClose={onClose}>
      <label className="flex flex-col gap-1">
        Rolle
        <input
          key={`title-${role.title}`}
          ref={titleRef}
          type="text"
          defaultValue={role.title}
          maxLength={ROLE_TITLE_MAX}
          onBlur={(event) => text("title", event.target.value, role.title)}
          className={INPUT}
        />
        {status("title")}
      </label>
      <label className="flex flex-col gap-1">
        Aufgabe
        <textarea
          key={`task-${role.task}`}
          defaultValue={role.task ?? ""}
          maxLength={ROLE_TASK_MAX}
          rows={3}
          onBlur={(event) => text("task", event.target.value, role.task)}
          className={`${INPUT} py-2`}
        />
        {status("task")}
      </label>
      <label className="flex flex-col gap-1">
        Kennzeichen
        <input
          key={`mark-${role.mark}`}
          type="text"
          defaultValue={role.mark ?? ""}
          maxLength={ROLE_MARK_MAX}
          placeholder="z. B. Weste lila"
          onBlur={(event) => text("mark", event.target.value, role.mark)}
          className={INPUT}
        />
        {status("mark")}
      </label>
      <label className="flex flex-col gap-1">
        AK
        <select
          key={`group-${role.workingGroupId}`}
          defaultValue={role.workingGroupId ?? ""}
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

      <section aria-label="Personen" className="flex flex-col gap-2 border-t border-line pt-4">
        <h3 className="text-sm font-semibold tracking-wide text-muted uppercase">Personen</h3>
        {role.people.length === 0 ? (
          <p className="text-sm font-semibold text-status-late">noch niemand eingetragen</p>
        ) : (
          <ul className="flex flex-col">
            {role.people.map((person) => (
              <li key={person.id} className="flex min-h-11 items-center justify-between gap-2 border-t border-line first:border-t-0">
                <span className={`min-w-0 break-words ${person.memberId ? "font-medium" : "italic"}`}>
                  {person.memberId ? person.label : `Ohne Account: ${person.label}`}
                </span>
                <button
                  type="button"
                  onClick={() => void run(() => removeRolePerson(person.id))}
                  aria-label={`${person.label} austragen`}
                  className="flex size-11 shrink-0 items-center justify-center rounded-md text-lg text-muted hover:bg-surface-2 hover:text-text"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
        <OwnerPicker people={people} value={owner} label="Person eintragen" onChange={setOwner} />
        <button
          type="button"
          disabled={!owner || busy}
          onClick={() => void addPerson()}
          className={`${SECONDARY_BUTTON} self-start`}
        >
          Hinzufügen
        </button>
        <NamesOnlyHint />
      </section>

      <div className="flex flex-col gap-1 border-t border-line pt-4">
        <button
          type="button"
          onClick={() => void remove()}
          className={`${SECONDARY_BUTTON} self-start border-status-late text-status-late`}
        >
          Rolle löschen
        </button>
        <FieldError message={error} />
      </div>
    </DayPanel>
  );
}
