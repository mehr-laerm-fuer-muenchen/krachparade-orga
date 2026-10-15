"use client";

import { useId, useState, useTransition, type FormEvent } from "react";
import {
  assignDepartment,
  createDepartment,
  createWorkingGroup,
  deleteDepartment,
  deleteWorkingGroup,
  joinWorkingGroup,
  leaveWorkingGroup,
  moveDepartment,
  moveWorkingGroup,
  renameDepartment,
  renameWorkingGroup,
  setWorkingGroupsFinal,
  type WorkingGroupActionResult,
} from "@/actions/working-groups";

// Board of /arbeitskreise (spec 005). Every control calls a server action that
// checks the rights again; hiding admin controls is only for clarity.

export type BoardDepartment = { id: string; name: string; inUse: boolean };
export type BoardPerson = { id: string; name: string; active: boolean };
export type BoardGroup = {
  id: string;
  /** Stored name without "AK". */
  name: string;
  /** "AK ‹name›". */
  title: string;
  departments: BoardDepartment[];
  members: BoardPerson[];
};
export type GroupTarget = { id: string; title: string };

const INPUT =
  "min-h-11 w-full min-w-0 rounded-md border border-line-strong bg-surface px-3 text-base text-text disabled:bg-surface-2 disabled:text-muted";
const PRIMARY_BUTTON =
  "min-h-11 shrink-0 rounded-md bg-primary px-4 font-semibold text-on-primary disabled:opacity-50";
const SECONDARY_BUTTON =
  "min-h-11 shrink-0 rounded-md border border-line-strong bg-surface px-3 font-medium text-text hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-surface";
const ICON_BUTTON = `${SECONDARY_BUTTON} w-11 px-0`;
const CARD = "flex min-w-0 flex-col gap-3 rounded-md border border-line bg-surface p-4";

const DELETE_GROUP_LOCKED = "Erst die Aufgabenbereiche in einen anderen AK verschieben.";
const DELETE_DEPARTMENT_LOCKED = "Wird in Protokollen verwendet – stattdessen umbenennen oder verschieben.";

/** Runs a server action in a transition and keeps its error message. */
function useAction() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  function run(action: () => Promise<WorkingGroupActionResult>, onSuccess?: () => void) {
    startTransition(async () => {
      const result = await action();
      setError(result.ok ? null : result.message);
      if (result.ok) onSuccess?.();
    });
  }
  return { pending, error, run };
}

function ErrorMessage({ error }: { error: string | null }) {
  return error ? (
    <p role="alert" className="font-medium text-status-late">
      {error}
    </p>
  ) : null;
}

// --- Notice ------------------------------------------------------------------

/** Says that the grouping is only a proposal; admins can switch it. */
export function FinalNotice({ final, isAdmin }: { final: boolean; isAdmin: boolean }) {
  const { pending, error, run } = useAction();
  if (final && !isAdmin) return null;
  const toggle = isAdmin ? (
    <button
      type="button"
      disabled={pending}
      onClick={() => run(() => setWorkingGroupsFinal(!final))}
      className={`${SECONDARY_BUTTON} w-fit`}
    >
      {final ? "Wieder als Vorschlag markieren" : "Als beschlossen markieren"}
    </button>
  ) : null;
  if (final) {
    return (
      <div className="flex flex-col gap-2">
        {toggle}
        <ErrorMessage error={error} />
      </div>
    );
  }
  return (
    <div role="note" className="flex flex-col gap-3 rounded-md border border-line-strong bg-surface-2 px-4 py-3">
      <p>Die AKs müssen noch gemeinsam definiert werden. Die aktuelle Gruppierung dient nur der Darstellung.</p>
      {toggle}
      <ErrorMessage error={error} />
    </div>
  );
}

// --- Working groups ------------------------------------------------------------

export function GroupCard({
  group,
  targets,
  viewerId,
  isAdmin,
  activePeople,
  isFirst,
  isLast,
}: {
  group: BoardGroup;
  targets: readonly GroupTarget[];
  viewerId: string;
  isAdmin: boolean;
  activePeople: readonly { id: string; name: string }[];
  isFirst: boolean;
  isLast: boolean;
}) {
  const headingId = useId();
  const [menuOpen, setMenuOpen] = useState(false);
  const { pending, error, run } = useAction();
  const joined = group.members.some((person) => person.id === viewerId);
  const candidates = activePeople.filter((person) => !group.members.some((member) => member.id === person.id));

  return (
    <section aria-labelledby={headingId} className={CARD}>
      <div className="flex items-start justify-between gap-2">
        <h2 id={headingId} className="min-w-0 pt-2 text-lg font-semibold break-words [overflow-wrap:anywhere]">
          {group.title}
        </h2>
        <button
          type="button"
          aria-expanded={menuOpen}
          aria-label={`Menü ${group.title}`}
          onClick={() => setMenuOpen((open) => !open)}
          className={SECONDARY_BUTTON}
        >
          Menü
        </button>
      </div>

      {menuOpen ? (
        <GroupMenu group={group} isFirst={isFirst} isLast={isLast} onDone={() => setMenuOpen(false)} />
      ) : null}

      <div className="flex flex-col gap-2">
        <h3 className="font-semibold">Aufgabenbereiche</h3>
        {group.departments.length === 0 ? <p className="text-muted">Noch keine Aufgabenbereiche.</p> : null}
        <DepartmentList label={`Aufgabenbereiche ${group.title}`} departments={group.departments} targets={targets} currentGroupId={group.id} />
        <CreateDepartmentForm groupId={group.id} groupTitle={group.title} />
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="font-semibold">Teilnehmende ({group.members.length})</h3>
        {group.members.length === 0 ? (
          <p className="text-muted">Noch niemand.</p>
        ) : (
          <ul aria-label={`Teilnehmende ${group.title}`} className="flex flex-col">
            {group.members.map((person) => (
              <li key={person.id} className="flex min-h-11 items-center justify-between gap-2">
                <span className={person.active ? "" : "text-muted opacity-70"}>
                  {person.name}
                  {person.active ? "" : " (deaktiviert)"}
                </span>
                {isAdmin && person.id !== viewerId ? (
                  <button
                    type="button"
                    disabled={pending}
                    aria-label={`${person.name} austragen`}
                    onClick={() => run(() => leaveWorkingGroup(group.id, person.id))}
                    className={SECONDARY_BUTTON}
                  >
                    Austragen
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => (joined ? leaveWorkingGroup : joinWorkingGroup)(group.id, viewerId))}
          className={`${joined ? SECONDARY_BUTTON : PRIMARY_BUTTON} w-fit`}
        >
          {joined ? "Austreten" : "Mach ich mit"}
        </button>
        {isAdmin && candidates.length > 0 ? (
          <AddPersonForm groupId={group.id} groupTitle={group.title} candidates={candidates} />
        ) : null}
        <ErrorMessage error={error} />
      </div>
    </section>
  );
}

function GroupMenu({
  group,
  isFirst,
  isLast,
  onDone,
}: {
  group: BoardGroup;
  isFirst: boolean;
  isLast: boolean;
  onDone: () => void;
}) {
  const inputId = useId();
  const [draft, setDraft] = useState(group.name);
  const { pending, error, run } = useAction();
  const locked = group.departments.length > 0;

  function rename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    run(() => renameWorkingGroup(group.id, draft), onDone);
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border border-line bg-surface-2 p-3">
      <form onSubmit={rename} className="flex flex-col gap-1">
        <label htmlFor={inputId}>Name (ohne „AK“)</label>
        <div className="flex gap-2">
          <input
            id={inputId}
            required
            maxLength={64}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            className={INPUT}
          />
          <button type="submit" disabled={pending} className={SECONDARY_BUTTON}>
            Umbenennen
          </button>
        </div>
      </form>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending || isFirst}
          onClick={() => run(() => moveWorkingGroup(group.id, "up"))}
          className={SECONDARY_BUTTON}
        >
          Hoch
        </button>
        <button
          type="button"
          disabled={pending || isLast}
          onClick={() => run(() => moveWorkingGroup(group.id, "down"))}
          className={SECONDARY_BUTTON}
        >
          Runter
        </button>
        <button
          type="button"
          disabled={pending || locked}
          onClick={() => {
            if (!window.confirm(`${group.title} wirklich löschen?`)) return;
            run(() => deleteWorkingGroup(group.id));
          }}
          className={`${SECONDARY_BUTTON} text-status-late`}
        >
          AK löschen
        </button>
      </div>
      {locked ? <p className="text-xs text-muted">{DELETE_GROUP_LOCKED}</p> : null}
      <ErrorMessage error={error} />
    </div>
  );
}

function AddPersonForm({
  groupId,
  groupTitle,
  candidates,
}: {
  groupId: string;
  groupTitle: string;
  candidates: readonly { id: string; name: string }[];
}) {
  const selectId = useId();
  const [memberId, setMemberId] = useState("");
  const { pending, error, run } = useAction();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!memberId) return;
    run(() => joinWorkingGroup(groupId, memberId), () => setMemberId(""));
  }

  return (
    <form onSubmit={submit} aria-label={`Person eintragen in ${groupTitle}`} className="flex flex-col gap-1">
      <label htmlFor={selectId}>Person eintragen</label>
      <div className="flex gap-2">
        <select
          id={selectId}
          value={memberId}
          onChange={(event) => setMemberId(event.target.value)}
          className={INPUT}
        >
          <option value="">– Person wählen –</option>
          {candidates.map((person) => (
            <option key={person.id} value={person.id}>
              {person.name}
            </option>
          ))}
        </select>
        <button type="submit" disabled={pending || !memberId} className={SECONDARY_BUTTON}>
          Eintragen
        </button>
      </div>
      <ErrorMessage error={error} />
    </form>
  );
}

export function CreateGroupForm() {
  const inputId = useId();
  const [name, setName] = useState("");
  const { pending, error, run } = useAction();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    run(() => createWorkingGroup(name), () => setName(""));
  }

  return (
    <form onSubmit={submit} aria-label="AK hinzufügen" className={CARD}>
      <label htmlFor={inputId} className="font-semibold">
        AK hinzufügen
      </label>
      <div className="flex gap-2">
        <input
          id={inputId}
          required
          maxLength={64}
          value={name}
          placeholder="Name, z. B. Kommunikation"
          onChange={(event) => setName(event.target.value)}
          className={INPUT}
        />
        <button type="submit" disabled={pending} className={PRIMARY_BUTTON}>
          Anlegen
        </button>
      </div>
      <ErrorMessage error={error} />
    </form>
  );
}

// --- Departments ---------------------------------------------------------------

/** Departments without a working group; only shown while there are any. */
export function UngroupedCard({
  departments,
  targets,
}: {
  departments: readonly BoardDepartment[];
  targets: readonly GroupTarget[];
}) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className={CARD}>
      <h2 id={headingId} className="text-lg font-semibold">
        Ohne AK
      </h2>
      <DepartmentList label="Aufgabenbereiche ohne AK" departments={departments} targets={targets} currentGroupId="" />
    </section>
  );
}

function DepartmentList({
  label,
  departments,
  targets,
  currentGroupId,
}: {
  label: string;
  departments: readonly BoardDepartment[];
  targets: readonly GroupTarget[];
  /** "" = without group. */
  currentGroupId: string;
}) {
  if (departments.length === 0) return null;
  return (
    <ul aria-label={label} className="flex flex-col rounded-md border border-line">
      {departments.map((department, index) => (
        <DepartmentRow
          key={department.id}
          department={department}
          targets={targets}
          currentGroupId={currentGroupId}
          isFirst={index === 0}
          isLast={index === departments.length - 1}
        />
      ))}
    </ul>
  );
}

function DepartmentRow({
  department,
  targets,
  currentGroupId,
  isFirst,
  isLast,
}: {
  department: BoardDepartment;
  targets: readonly GroupTarget[];
  currentGroupId: string;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <li aria-label={department.name} className="flex flex-col gap-2 border-b border-line px-3 py-1 last:border-b-0">
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 break-words [overflow-wrap:anywhere]">{department.name}</span>
        <button
          type="button"
          aria-expanded={open}
          aria-label={`Bearbeiten: ${department.name}`}
          onClick={() => setOpen((value) => !value)}
          className={SECONDARY_BUTTON}
        >
          Bearbeiten
        </button>
      </div>
      {open ? (
        <DepartmentMenu
          department={department}
          targets={targets}
          currentGroupId={currentGroupId}
          isFirst={isFirst}
          isLast={isLast}
          onDone={() => setOpen(false)}
        />
      ) : null}
    </li>
  );
}

function DepartmentMenu({
  department,
  targets,
  currentGroupId,
  isFirst,
  isLast,
  onDone,
}: {
  department: BoardDepartment;
  targets: readonly GroupTarget[];
  currentGroupId: string;
  isFirst: boolean;
  isLast: boolean;
  onDone: () => void;
}) {
  const id = useId();
  const [draft, setDraft] = useState(department.name);
  const { pending, error, run } = useAction();

  function rename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    run(() => renameDepartment(department.id, draft), onDone);
  }

  return (
    <div className="flex flex-col gap-3 pb-2">
      <form onSubmit={rename} className="flex flex-col gap-1">
        <label htmlFor={`${id}-name`}>Name</label>
        <div className="flex gap-2">
          <input
            id={`${id}-name`}
            required
            maxLength={60}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            className={INPUT}
          />
          <button type="submit" disabled={pending} className={SECONDARY_BUTTON}>
            Umbenennen
          </button>
        </div>
      </form>
      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-group`}>In anderen AK verschieben</label>
        <select
          id={`${id}-group`}
          value={currentGroupId}
          disabled={pending}
          onChange={(event) => {
            const target = event.target.value;
            run(() => assignDepartment(department.id, target || null));
          }}
          className={INPUT}
        >
          {targets.map((target) => (
            <option key={target.id} value={target.id}>
              {target.title}
            </option>
          ))}
          <option value="">Ohne AK</option>
        </select>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending || isFirst}
          aria-label={`${department.name} nach oben`}
          onClick={() => run(() => moveDepartment(department.id, "up"))}
          className={ICON_BUTTON}
        >
          ↑
        </button>
        <button
          type="button"
          disabled={pending || isLast}
          aria-label={`${department.name} nach unten`}
          onClick={() => run(() => moveDepartment(department.id, "down"))}
          className={ICON_BUTTON}
        >
          ↓
        </button>
        <button
          type="button"
          disabled={pending || department.inUse}
          onClick={() => {
            if (!window.confirm(`Aufgabenbereich „${department.name}“ wirklich löschen?`)) return;
            run(() => deleteDepartment(department.id));
          }}
          className={`${SECONDARY_BUTTON} text-status-late`}
        >
          Löschen
        </button>
      </div>
      {department.inUse ? <p className="text-xs text-muted">{DELETE_DEPARTMENT_LOCKED}</p> : null}
      <ErrorMessage error={error} />
    </div>
  );
}

function CreateDepartmentForm({ groupId, groupTitle }: { groupId: string; groupTitle: string }) {
  const inputId = useId();
  const [name, setName] = useState("");
  const { pending, error, run } = useAction();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    run(() => createDepartment(name, groupId), () => setName(""));
  }

  return (
    <form onSubmit={submit} aria-label={`Aufgabenbereich hinzufügen in ${groupTitle}`} className="flex flex-col gap-1">
      <label htmlFor={inputId}>Aufgabenbereich hinzufügen</label>
      <div className="flex gap-2">
        <input
          id={inputId}
          required
          maxLength={60}
          value={name}
          onChange={(event) => setName(event.target.value)}
          className={INPUT}
        />
        <button type="submit" disabled={pending} className={SECONDARY_BUTTON}>
          Hinzufügen
        </button>
      </div>
      <ErrorMessage error={error} />
    </form>
  );
}
