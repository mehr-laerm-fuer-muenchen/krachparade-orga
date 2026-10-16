"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { addOngoingNote, addOngoingTodo, createGroupNote, deleteGroupNote, updateGroupNote } from "@/actions/ak-workspace";
import { setTodoDone } from "@/actions/meetings";
import { deleteNote, deleteTodo, updateNote } from "@/actions/plan";
import { joinWorkingGroup, leaveWorkingGroup } from "@/actions/working-groups";
import { BackLink } from "@/components/back-link";
import { FieldError } from "@/components/field-error";
import { ItemKindBadge } from "@/components/item-kind-badge";
import { NoteHistory, type NoteSave } from "@/components/note-history";
import { PageTitle } from "@/components/placeholder";
import { ElementCard } from "@/components/plan/element-card";
import { useUndoBar, type ShowNotice } from "@/components/plan/plan-bar";
import { PlanDetail } from "@/components/plan/plan-detail";
import { PlanNewElement } from "@/components/plan/plan-new-element";
import { SAVE_ERROR, usePlanActions } from "@/components/plan/use-plan-actions";
import { usePlanTicks, type PlanTicks } from "@/components/plan/use-plan-ticks";
import { useSaveStatus } from "@/components/save-status";
import { TickBox } from "@/components/tick-box";
import type { AkAttentionItem, AkGroup, AkMeetingTodo, AkOngoingTodo, LoadedAkWorkspace } from "@/db/ak-workspace";
import { termDay } from "@/lib/ak-workspace";
import { formatRelativeDay } from "@/lib/dday";
import type { PlanViewElement } from "@/lib/gantt-layout";
import { dateToDay, dayToDate } from "@/lib/plan-days";
import { formatWeekdayShort } from "@/lib/plan-preview";
import { isOverdue } from "@/lib/protocol-rules";
import { ErrorMessage, useAction } from "./board";
import { SituationPills } from "./overview";

// The AK workspace (spec 018, test layout v2): what needs attention, notes of
// the working group, then per department its plan, "Laufende Aufgaben", to-dos
// from meetings, decisions and notes. Ticking off uses the existing actions
// with the page's "Rückgängig" bar; plan elements open the editable panel on
// this page as on "/meine".

export type AkWorkspaceData = Extract<LoadedAkWorkspace, { status: "ok" }>;

const OPEN_KEY = "kp-ak-open";
const INPUT = "min-h-11 rounded-md border border-line-strong bg-surface px-3 text-base";
const PRIMARY_BUTTON =
  "min-h-11 shrink-0 rounded-md bg-primary px-4 font-semibold text-on-primary hover:opacity-90 disabled:opacity-50";
const SECONDARY_BUTTON =
  "min-h-11 shrink-0 rounded-md border border-line-strong bg-surface px-3 font-medium text-text hover:bg-surface-2 disabled:opacity-50";
const REMOVE_BUTTON =
  "flex size-11 shrink-0 items-center justify-center rounded-md text-xl leading-none text-muted hover:bg-surface-2";
const CHIP = "inline-flex items-center whitespace-nowrap rounded-full border border-line-strong px-2.5 py-0.5 text-xs font-semibold text-muted";
const SUMMARY = "flex min-h-11 cursor-pointer items-center font-medium text-muted hover:text-text";
const LINK = "font-medium text-primary underline underline-offset-2";

/** Which departments are open on this device (key → open); missing = open. */
function readOpen(): Record<string, boolean> {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(OPEN_KEY) ?? "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, boolean] => typeof entry[1] === "boolean"));
  } catch {
    return {};
  }
}

function writeOpen(open: Record<string, boolean>) {
  try {
    window.localStorage.setItem(OPEN_KEY, JSON.stringify(open));
  } catch {
    // Storage can be missing or blocked; then it is only remembered for this visit.
  }
}

/** "2026-10-14" → "14.10." */
function dayMonth(date: string): string {
  const [, month, day] = date.split("-");
  return `${day}.${month}.`;
}

/** "Meilenstein · Mi 17.02. (80 T vorher) · Kim Brenner", optionally with the department first. */
function elementMeta(element: PlanViewElement, dDay: string, withDepartment: boolean): string {
  const date = dayToDate(termDay(element), dDay);
  const term = `${element.kind === "milestone" ? "" : "bis "}${formatWeekdayShort(date)} (${formatRelativeDay(date, dDay)})`;
  return [
    withDepartment ? element.departmentName : null,
    element.kind === "milestone" ? "Meilenstein" : "Vorgang",
    term,
    element.ownerName,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Saves of one block: `save` with "Gespeichert ✓", `act` with an error at the control only. */
function useSaves() {
  const { track, status } = useSaveStatus();
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const save: NoteSave = (field, call) =>
    track(field, async () => {
      const result = await call();
      return result.ok ? { ok: true } : { ok: false, message: result.message };
    });
  const act: NoteSave = async (field, call) => {
    let message: string | null;
    try {
      const result = await call();
      message = result.ok ? null : result.message;
    } catch {
      message = SAVE_ERROR;
    }
    setErrors((previous) => ({ ...previous, [field]: message }));
    return message === null;
  };
  return { save, act, status, errors };
}

/** Ticking protocol to-dos off with `setTodoDone` and the "Rückgängig" bar, as in the read view (spec 017). */
function useMeetingTicks(show: ShowNotice) {
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const save = useCallback(async (id: string, done: boolean) => {
    try {
      return (await setTodoDone(id, done)).ok;
    } catch {
      return false;
    }
  }, []);
  const toggle = useCallback(
    async (todo: Pick<AkMeetingTodo, "id" | "text">, done: boolean) => {
      if (todo.id in pending) return;
      setPending((previous) => ({ ...previous, [todo.id]: done }));
      const ok = await save(todo.id, done);
      setPending((previous) => {
        const next = { ...previous };
        delete next[todo.id];
        return next;
      });
      if (!ok) {
        show(SAVE_ERROR, "error");
        return;
      }
      show(done ? `Erledigt: ${todo.text}` : `Wieder offen: ${todo.text}`, "info", () => {
        void save(todo.id, !done).then((undone) => {
          if (!undone) show(SAVE_ERROR, "error");
        });
      });
    },
    [pending, save, show]
  );
  return { pending, toggle };
}

type MeetingTicks = ReturnType<typeof useMeetingTicks>;

/** One line with a box: text, a line below (late in red) and optionally "×". */
function TodoRow({
  checked,
  text,
  meta,
  late,
  onToggle,
  onDelete,
  error,
}: {
  checked: boolean;
  text: string;
  meta: ReactNode;
  late: boolean;
  onToggle: () => void;
  onDelete?: () => void;
  error?: string | null;
}) {
  return (
    <li aria-label={text} className="flex flex-col border-b border-line last:border-b-0">
      <div className="flex items-stretch">
        <TickBox checked={checked} label={`Erledigt: ${text}`} onToggle={onToggle} />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5 py-2 pr-2">
          <span className={`break-words [overflow-wrap:anywhere] ${checked ? "text-muted line-through" : ""}`}>{text}</span>
          {meta ? (
            <span className={`text-sm break-words ${late && !checked ? "font-semibold text-status-late" : "text-muted"}`}>
              {meta}
            </span>
          ) : null}
        </span>
        {onDelete ? (
          <button type="button" aria-label={`Punkt löschen: ${text}`} onClick={onDelete} className={REMOVE_BUTTON}>
            ×
          </button>
        ) : null}
      </div>
      <FieldError message={error} />
    </li>
  );
}

function joinParts(parts: ReactNode[]): ReactNode {
  const present = parts.filter((part) => part !== null && part !== undefined && part !== "");
  return present.map((part, index) => (
    <span key={index}>
      {index > 0 ? " · " : ""}
      {part}
    </span>
  ));
}

function MeetingLink({ todo }: { todo: Pick<AkMeetingTodo, "meetingId" | "meetingTitle" | "meetingDate"> }) {
  return (
    <Link href={`/protokolle/${todo.meetingId}`} className={LINK}>
      {todo.meetingTitle} {dayMonth(todo.meetingDate)}
    </Link>
  );
}

function MeetingTodoRow({ todo, today, ticks }: { todo: AkMeetingTodo; today: string; ticks: MeetingTicks }) {
  const checked = ticks.pending[todo.id] ?? todo.done;
  const late = isOverdue({ kind: "todo", done: checked, dueDate: todo.dueDate }, today);
  const due = todo.dueDate ? `${late ? "war fällig" : "fällig"} ${formatWeekdayShort(todo.dueDate)}` : null;
  return (
    <TodoRow
      checked={checked}
      text={todo.text}
      meta={joinParts([todo.ownerName, <>aus <MeetingLink todo={todo} /></>, due])}
      late={late}
      onToggle={() => void ticks.toggle(todo, !checked)}
    />
  );
}

function Subsection({ title, subtitle, action, children }: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={headingId} className="font-semibold">
          {title}
          {subtitle ? <span className="ml-2 text-sm font-normal text-muted">{subtitle}</span> : null}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function Folded({ label, children }: { label: string; children: ReactNode }) {
  return (
    <details>
      <summary className={SUMMARY}>{label}</summary>
      {children}
    </details>
  );
}

type CardSetup = {
  dDay: string;
  today: number;
  ticks: PlanTicks;
  byId: ReadonlyMap<string, PlanViewElement>;
  expanded: ReadonlySet<string>;
  hintHidden: ReadonlySet<string>;
  onSelect: (id: string) => void;
  onToggleExpand: (id: string) => void;
  onExpand: (id: string) => void;
  onHideHint: (id: string) => void;
};

function ElementList({ elements, cards, withDepartment, label }: {
  elements: readonly PlanViewElement[];
  cards: CardSetup;
  withDepartment: (element: PlanViewElement) => boolean;
  label: string;
}) {
  return (
    <ul aria-label={label} className="flex flex-col gap-2">
      {elements.map((element) => {
        const full = cards.byId.get(element.id) ?? element;
        return (
          <ElementCard
            key={element.id}
            element={full}
            full={full}
            meta={elementMeta(full, cards.dDay, withDepartment(full))}
            today={cards.today}
            dDay={cards.dDay}
            ticks={cards.ticks}
            expanded={cards.expanded.has(element.id)}
            hintHidden={cards.hintHidden.has(element.id)}
            onSelect={cards.onSelect}
            onToggleExpand={cards.onToggleExpand}
            onExpand={cards.onExpand}
            onHideHint={cards.onHideHint}
          />
        );
      })}
    </ul>
  );
}

function Attention({ items, cards, today, meetingTicks }: {
  items: readonly AkAttentionItem[];
  cards: CardSetup;
  today: string;
  meetingTicks: MeetingTicks;
}) {
  const headingId = useId();
  const elements = items.flatMap((item) => (item.type === "element" ? [item.element] : []));
  const todos = items.filter((item) => item.type !== "element");
  const filled = items.length > 0;
  return (
    <section
      aria-labelledby={headingId}
      className={`flex flex-col overflow-hidden rounded-md border bg-surface ${filled ? "border-status-late" : "border-line"}`}
    >
      <h2 id={headingId} className={`px-4 py-2 text-lg font-semibold ${filled ? "bg-hint-bg" : ""}`}>
        Braucht Aufmerksamkeit
      </h2>
      <div className="flex flex-col gap-3 px-3 pb-3">
        {!filled ? <p className="px-1 text-muted">Nichts überfällig, nichts wackelt.</p> : null}
        {elements.length > 0 ? (
          <ElementList elements={elements} cards={cards} withDepartment={() => true} label="Plan-Elemente mit Verzug oder wackelnd" />
        ) : null}
        {todos.length > 0 ? (
          <ul aria-label="Überfällige To-dos" className="flex flex-col rounded-md border border-line">
            {todos.map((item) => {
              if (item.type === "meeting_todo") {
                return <MeetingTodoRow key={`m-${item.todo.id}`} todo={item.todo} today={today} ticks={meetingTicks} />;
              }
              if (item.type !== "plan_todo") return null;
              const { todo, element } = item;
              const checked = cards.ticks.pending[`todo-${todo.id}`] ?? todo.done;
              return (
                <TodoRow
                  key={`p-${todo.id}`}
                  checked={checked}
                  text={todo.text}
                  meta={joinParts([
                    todo.ownerName,
                    `an ${element.name}`,
                    `war fällig ${formatWeekdayShort(dayToDate(item.due, cards.dDay))}`,
                  ])}
                  late
                  onToggle={() => void cards.ticks.tickTodo(todo, !checked)}
                />
              );
            })}
          </ul>
        ) : null}
      </div>
    </section>
  );
}

function GroupNotes({ data }: { data: AkWorkspaceData }) {
  const headingId = useId();
  const saves = useSaves();
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2 rounded-md border border-line bg-surface p-4">
      <h2 id={headingId} className="text-lg font-semibold">
        Notizen zum AK
      </h2>
      <NoteHistory
        notes={data.notes}
        onAdd={(text) => createGroupNote(data.group.id, text)}
        onUpdate={updateGroupNote}
        onDelete={deleteGroupNote}
        {...saves}
        limit={3}
        placeholder="Notiz schreiben …"
        emptyText="Noch keine Notizen."
      />
    </section>
  );
}

function PointForm({ departmentId, departmentName, people, memberIds, show }: {
  departmentId: string;
  departmentName: string;
  people: readonly { id: string; name: string }[];
  memberIds: ReadonlySet<string>;
  show: ShowNotice;
}) {
  const { track, status } = useSaveStatus();
  const inAk = people.filter((person) => memberIds.has(person.id));
  const others = people.filter((person) => !memberIds.has(person.id));

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    await track("add-point", async () => {
      try {
        const result = await addOngoingTodo(
          departmentId,
          String(data.get("text") ?? ""),
          String(data.get("owner") ?? "") || null
        );
        if (!result.ok) return { ok: false, message: result.message };
        form.reset();
        if (result.created) show("Laufende Aufgaben angelegt (im Plan ausgeblendet)", "info");
        return { ok: true };
      } catch {
        return { ok: false };
      }
    });
  };

  return (
    <form onSubmit={submit} aria-label={`Punkt ohne Termin hinzufügen: ${departmentName}`} className="flex flex-col gap-1">
      <div className="flex flex-wrap gap-2">
        <input
          name="text"
          type="text"
          required
          maxLength={200}
          placeholder="Punkt ohne Termin hinzufügen"
          aria-label="Punkt ohne Termin hinzufügen"
          className={`${INPUT} min-w-0 flex-[1_1_14rem]`}
        />
        <select name="owner" aria-label="Wer? (optional)" defaultValue="" className={`${INPUT} min-w-0 flex-[1_1_10rem]`}>
          <option value="">Wer? (optional)</option>
          {inAk.length > 0 ? (
            <optgroup label="Im AK">
              {inAk.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </optgroup>
          ) : null}
          <optgroup label={inAk.length > 0 ? "Weitere" : "Alle"}>
            {others.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </optgroup>
        </select>
        <button type="submit" className={PRIMARY_BUTTON}>
          Hinzufügen
        </button>
      </div>
      {status("add-point")}
    </form>
  );
}

function OngoingSection({ group, data, cards, show }: {
  group: AkGroup;
  data: AkWorkspaceData;
  cards: CardSetup;
  show: ShowNotice;
}) {
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const department = group.department!;
  const open = group.ongoing?.openTodos ?? [];
  const done = group.ongoing?.doneTodos ?? [];
  const memberIds = useMemo(() => new Set(data.members.map((person) => person.id)), [data.members]);

  const remove = async (todo: AkOngoingTodo) => {
    let message: string | null;
    try {
      const result = await deleteTodo(todo.id);
      message = result.ok ? null : result.message;
    } catch {
      message = SAVE_ERROR;
    }
    setErrors((previous) => ({ ...previous, [todo.id]: message }));
  };
  const row = (todo: AkOngoingTodo) => {
    const checked = cards.ticks.pending[`todo-${todo.id}`] ?? todo.done;
    return (
      <TodoRow
        key={todo.id}
        checked={checked}
        text={todo.text}
        meta={todo.ownerName}
        late={false}
        onToggle={() => void cards.ticks.tickTodo(todo, !checked)}
        onDelete={() => void remove(todo)}
        error={errors[todo.id]}
      />
    );
  };

  return (
    <Subsection title="Laufende Aufgaben" subtitle="ohne Termin">
      {open.length === 0 ? (
        <p className="text-muted">Noch keine Punkte.</p>
      ) : (
        <ul aria-label={`Offene Punkte ${department.name}`} className="flex flex-col rounded-md border border-line">
          {open.map(row)}
        </ul>
      )}
      {done.length > 0 ? (
        <Folded label={`Erledigt (${done.length})`}>
          <ul aria-label={`Erledigte Punkte ${department.name}`} className="flex flex-col rounded-md border border-line">
            {done.map(row)}
          </ul>
        </Folded>
      ) : null}
      <PointForm
        departmentId={department.id}
        departmentName={department.name}
        people={data.people}
        memberIds={memberIds}
        show={show}
      />
    </Subsection>
  );
}

function Decisions({ group }: { group: AkGroup }) {
  const [all, setAll] = useState(false);
  const shown = all ? group.decisions : group.decisions.slice(0, 5);
  return (
    <Subsection title="Beschlüsse">
      {group.decisions.length === 0 ? (
        <p className="text-muted">Noch keine Beschlüsse.</p>
      ) : (
        <ul aria-label={`Beschlüsse ${group.department?.name ?? ""}`} className="flex flex-col gap-2">
          {shown.map((decision) => (
            <li key={decision.id} className="flex flex-col gap-1 rounded-md border border-line px-3 py-2">
              <span className="flex flex-wrap items-start gap-2">
                <ItemKindBadge kind="entscheidung" />
                <span className="min-w-0 flex-1 break-words [overflow-wrap:anywhere]">{decision.text}</span>
              </span>
              <span className="text-sm">
                <MeetingLink todo={decision} />
              </span>
            </li>
          ))}
        </ul>
      )}
      {group.decisions.length > 5 ? (
        <button type="button" onClick={() => setAll(!all)} className={`${SECONDARY_BUTTON} self-start`}>
          {all ? "Nur die letzten 5" : `Alle (${group.decisions.length})`}
        </button>
      ) : null}
    </Subsection>
  );
}

function DepartmentNotes({ group }: { group: AkGroup }) {
  const saves = useSaves();
  const department = group.department!;
  return (
    <Subsection title="Notizen">
      <NoteHistory
        notes={group.ongoing?.element.notes ?? []}
        onAdd={(text) => addOngoingNote(department.id, text)}
        onUpdate={updateNote}
        onDelete={deleteNote}
        {...saves}
        limit={3}
        placeholder="Notiz schreiben …"
        emptyText="Noch keine Notizen."
      />
    </Subsection>
  );
}

function DepartmentSection({ group, data, cards, today, meetingTicks, show, open, onToggle, onCreate }: {
  group: AkGroup;
  data: AkWorkspaceData;
  cards: CardSetup;
  today: string;
  meetingTicks: MeetingTicks;
  show: ShowNotice;
  open: boolean;
  onToggle: (open: boolean) => void;
  onCreate: (departmentId: string) => void;
}) {
  const headingId = useId();
  const { department } = group;
  const name = department?.name ?? "Ohne Aufgabenbereich";
  const all = [...group.openElements, ...group.reachedElements];
  const late = all.filter((element) => element.status === "late").length;
  const warn = all.filter((element) => element.status === "warn").length;
  const openCount =
    group.openElements.reduce((sum, element) => sum + element.todos.filter((todo) => !todo.done).length, 0) +
    (group.ongoing?.openTodos.length ?? 0) +
    group.openMeetingTodos.length;

  return (
    <section aria-labelledby={headingId} className="rounded-md border border-line bg-surface">
      <details open={open} onToggle={(event) => onToggle(event.currentTarget.open)}>
        <summary className="flex min-h-11 cursor-pointer flex-wrap items-center gap-2 px-4 py-2 hover:bg-surface-2">
          <h2 id={headingId} className="mr-1 min-w-0 text-lg font-semibold break-words [overflow-wrap:anywhere]">
            {name}
          </h2>
          <SituationPills late={late} warn={warn} calm={null} />
          <span className={CHIP}>{openCount} offen</span>
        </summary>
        <div className="flex flex-col gap-5 border-t border-line px-4 py-3">
          <Subsection
            title="Plan"
            action={
              department ? (
                <button type="button" onClick={() => onCreate(department.id)} className={SECONDARY_BUTTON}>
                  + Plan-Element
                </button>
              ) : null
            }
          >
            {group.openElements.length === 0 ? (
              <p className="text-muted">Keine offenen Plan-Elemente.</p>
            ) : (
              <ElementList
                elements={group.openElements}
                cards={cards}
                // In "Ohne Aufgabenbereich" a department of another AK is named.
                withDepartment={(element) => department === null && element.departmentName !== null}
                label={`Offene Plan-Elemente ${name}`}
              />
            )}
            {group.reachedElements.length > 0 ? (
              <Folded label={`Erreicht (${group.reachedElements.length})`}>
                <ElementList
                  elements={group.reachedElements}
                  cards={cards}
                  withDepartment={(element) => department === null && element.departmentName !== null}
                  label={`Erreichte Plan-Elemente ${name}`}
                />
              </Folded>
            ) : null}
          </Subsection>

          {department ? (
            <>
              <OngoingSection group={group} data={data} cards={cards} show={show} />
              <Subsection title="Aus Protokollen">
                {group.openMeetingTodos.length === 0 ? (
                  <p className="text-muted">Keine offenen To-dos aus Treffen.</p>
                ) : (
                  <ul aria-label={`Offene To-dos aus Treffen ${name}`} className="flex flex-col rounded-md border border-line">
                    {group.openMeetingTodos.map((todo) => (
                      <MeetingTodoRow key={todo.id} todo={todo} today={today} ticks={meetingTicks} />
                    ))}
                  </ul>
                )}
                {group.doneMeetingTodos.length > 0 ? (
                  <Folded label={`Erledigt (${group.doneMeetingTodos.length})`}>
                    <ul aria-label={`Erledigte To-dos aus Treffen ${name}`} className="flex flex-col rounded-md border border-line">
                      {group.doneMeetingTodos.map((todo) => (
                        <MeetingTodoRow key={todo.id} todo={todo} today={today} ticks={meetingTicks} />
                      ))}
                    </ul>
                  </Folded>
                ) : null}
              </Subsection>
              <Decisions group={group} />
              <DepartmentNotes group={group} />
            </>
          ) : null}
        </div>
      </details>
    </section>
  );
}

function Membership({ data, viewerId }: { data: AkWorkspaceData; viewerId: string }) {
  const { pending, error, run } = useAction();
  const joined = data.members.some((person) => person.id === viewerId);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <p className="min-w-0 break-words">
          <span className="text-muted">Teilnehmende: </span>
          {data.members.length === 0 ? (
            <span className="text-muted">Noch niemand</span>
          ) : (
            data.members.map((person, index) => (
              <span key={person.id} className={person.active ? "" : "text-muted opacity-70"}>
                {index > 0 ? ", " : ""}
                {person.name}
              </span>
            ))
          )}
        </p>
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => (joined ? leaveWorkingGroup : joinWorkingGroup)(data.group.id, viewerId))}
          className={joined ? SECONDARY_BUTTON : PRIMARY_BUTTON}
        >
          {joined ? "Austreten" : "Mach ich mit"}
        </button>
      </div>
      <ErrorMessage error={error} />
    </div>
  );
}

/** `today` = "YYYY-MM-DD" in Europe/Berlin, from the server. */
export function AkWorkspace({ data, viewerId, today }: { data: AkWorkspaceData; viewerId: string; today: string }) {
  const { group, dDay, plan } = data;
  const todayDay = dateToDay(today, dDay);
  const { show, bar } = useUndoBar();
  const byId = useMemo(() => new Map((plan?.elements ?? []).map((element) => [element.id, element])), [plan]);
  const { run, drag } = usePlanActions(byId, show);
  const ticks = usePlanTicks(byId, show);
  const meetingTicks = useMeetingTicks(show);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  /** The department the short form is for; undefined = closed. */
  const [creating, setCreating] = useState<string | undefined>(undefined);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  const [hintHidden, setHintHidden] = useState<ReadonlySet<string>>(() => new Set());
  const [openState, setOpenState] = useState<Record<string, boolean>>({});

  // The first render shows all departments open (same as on the server); the
  // stored state of this device applies right after.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only storage after hydration
    setOpenState(readOpen());
  }, []);

  const close = useCallback(() => setSelectedId(null), []);
  const closeForm = useCallback(() => setCreating(undefined), []);
  const cards: CardSetup = {
    dDay,
    today: todayDay,
    ticks,
    byId,
    expanded,
    hintHidden,
    onSelect: setSelectedId,
    onToggleExpand: (id) => {
      const next = new Set(expanded);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      setExpanded(next);
    },
    onExpand: (id) => setExpanded((previous) => new Set(previous).add(id)),
    onHideHint: (id) => setHintHidden((previous) => new Set(previous).add(id)),
  };
  const toggleDepartment = (key: string, open: boolean) => {
    if ((openState[key] ?? true) === open) return;
    const next = { ...openState, [key]: open };
    setOpenState(next);
    writeOpen(next);
  };
  const selected = selectedId === null ? undefined : byId.get(selectedId);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <BackLink href="/arbeitskreise">Alle AKs</BackLink>
        <PageTitle>
          <span className="break-words [overflow-wrap:anywhere]">{group.title}</span>
        </PageTitle>
        <Membership data={data} viewerId={viewerId} />
      </div>

      <div className="flex items-start gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <Attention items={data.attention} cards={cards} today={today} meetingTicks={meetingTicks} />
          <GroupNotes data={data} />
          {data.groups.map((entry) => (
            <DepartmentSection
              key={entry.key}
              group={entry}
              data={data}
              cards={cards}
              today={today}
              meetingTicks={meetingTicks}
              show={show}
              open={openState[entry.key] ?? true}
              onToggle={(open) => toggleDepartment(entry.key, open)}
              onCreate={setCreating}
            />
          ))}
          {data.groups.length === 0 ? (
            <p className="rounded-md border border-line bg-surface px-4 py-3 text-muted">
              Dieser AK hat noch keine Aufgabenbereiche.{" "}
              <Link href="/arbeitskreise/verwalten" className={LINK}>
                AKs verwalten
              </Link>
            </p>
          ) : null}
        </div>
        {selected && plan ? (
          <PlanDetail
            key={selected.id}
            element={selected}
            elements={byId}
            links={plan.links}
            groups={plan.groups}
            departments={plan.departments}
            members={plan.members}
            today={plan.today}
            dDay={plan.dDay}
            onSelect={setSelectedId}
            onClose={close}
            run={run}
            drag={drag}
            onReach={(element) => void ticks.reach(element, true)}
            hintHidden={hintHidden.has(selected.id)}
            onHideHint={(id) => setHintHidden(new Set(hintHidden).add(id))}
          />
        ) : null}
      </div>

      {creating !== undefined ? (
        <PlanNewElement
          groups={plan?.groups ?? [{ id: group.id, name: group.name, sortOrder: 0 }]}
          elements={plan?.elements ?? []}
          defaultGroupId={group.id}
          departments={
            plan?.departments ??
            data.departments.map((department) => ({ id: department.id, name: department.name, workingGroupId: group.id }))
          }
          defaultDepartmentId={creating}
          onCreated={(id) => {
            setCreating(undefined);
            setSelectedId(id);
          }}
          onClose={closeForm}
        />
      ) : null}
      {bar}
      {/* After the panel: an open plan element stays the context of the bug button (spec 014). */}
      <span hidden data-feedback-context={group.title} />
    </div>
  );
}
