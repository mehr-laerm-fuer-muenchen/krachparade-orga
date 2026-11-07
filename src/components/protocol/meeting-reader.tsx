"use client";

import Link from "next/link";
import { useCallback, useId, useState, type ReactNode } from "react";
import { setTodoDone } from "@/actions/meetings";
import { ItemKindBadge } from "@/components/item-kind-badge";
import { useUndoBar } from "@/components/plan/plan-bar";
import { SAVE_ERROR } from "@/components/plan/use-plan-actions";
import { TickBox } from "@/components/tick-box";
import { formatGermanDate } from "@/lib/dday";
import type { ReadModel, ReadNote, ReadTodo, ReadTopic } from "@/lib/protocol-read";
import { isOverdue } from "@/lib/protocol-rules";
import { ExportButtons } from "./export-buttons";
import type { ItemData, MeetingData, Person, Report } from "./types";

/** "2027-02-10" → "10.02." */
function dayMonth(date: string): string {
  const [, month, day] = date.split("-");
  return `${day}.${month}.`;
}

const LINK = "font-medium text-primary underline underline-offset-2";

/**
 * Read view of a meeting (spec 017): summary, decisions, to-dos and per TOP
 * the infos, without input fields. To-dos can be ticked off here too, with
 * "Rückgängig" as on "/meine". Names only, never e-mail addresses.
 */
export function MeetingReader({
  meeting,
  attendeeIds,
  items,
  people,
  model,
  today,
}: {
  meeting: MeetingData;
  attendeeIds: readonly string[];
  items: readonly ItemData[];
  people: readonly Person[];
  model: ReadModel;
  today: string;
}) {
  const { show, bar } = useUndoBar();
  const report = useCallback<Report>(
    (result, success = "Gespeichert") =>
      show(result.ok ? success : result.message, result.ok ? "info" : "error"),
    [show]
  );
  const editHref = `/protokolle/${meeting.id}?ansicht=bearbeiten`;
  const nameOf = (id: string | null) => people.find((person) => person.id === id)?.name ?? null;
  const attendees = people.filter((person) => attendeeIds.includes(person.id)).map((person) => person.name);
  const moderator = nameOf(meeting.moderatorId);
  const minuteTaker = nameOf(meeting.minuteTakerId);
  const summary = meeting.summary.trim();
  const notes = meeting.rawNotes.trim();

  return (
    <div
      data-feedback-context={`Protokoll ${meeting.title} ${formatGermanDate(meeting.date)}`}
      className="flex max-w-3xl flex-col gap-6"
    >
      <ExportButtons meeting={meeting} attendeeIds={attendeeIds} items={items} people={people} report={report} />

      <section aria-label="Angaben zum Treffen" className="flex flex-col gap-1 rounded-md border border-line bg-surface p-4">
        <p className="font-medium">
          {[formatGermanDate(meeting.date), meeting.place.trim()].filter(Boolean).join(" · ")}
        </p>
        {moderator || minuteTaker ? (
          <p className="flex flex-wrap gap-x-4">
            {moderator ? <span>Moderation: {moderator}</span> : null}
            {minuteTaker ? <span>Protokoll: {minuteTaker}</span> : null}
          </p>
        ) : null}
        {attendees.length > 0 ? <p className="break-words">Anwesend: {attendees.join(", ")}</p> : null}
        {meeting.guests.trim() ? <p className="break-words">Gäste: {meeting.guests.trim()}</p> : null}
      </section>

      {summary ? (
        <Section title="Kurzfassung">
          <p className="break-words whitespace-pre-wrap">{summary}</p>
        </Section>
      ) : meeting.status === "entwurf" ? (
        <p className="text-muted">
          Noch keine Kurzfassung ·{" "}
          <Link href={`${editHref}#kurzfassung`} replace className={LINK}>
            Hinzufügen
          </Link>
        </p>
      ) : null}

      {items.length === 0 ? (
        <p className="rounded-md border border-line bg-surface px-4 py-3 text-muted">
          Noch keine Punkte.{" "}
          <Link href={editHref} replace className={LINK}>
            Bearbeiten
          </Link>
        </p>
      ) : null}

      {model.decisions.length > 0 ? (
        <Section title={`Beschlüsse (${model.decisions.length})`}>
          <ul aria-label="Beschlüsse" className="flex flex-col rounded-md border border-line bg-surface">
            {model.decisions.map((decision) => (
              <li
                key={decision.id}
                aria-label={decision.text}
                className="flex flex-col gap-1 border-b border-line px-4 py-3 last:border-b-0"
              >
                <span className="flex flex-wrap items-baseline gap-2">
                  <ItemKindBadge kind="entscheidung" />
                  <span className="min-w-0 whitespace-pre-line break-words [overflow-wrap:anywhere]">{decision.text}</span>
                </span>
                <span className="text-xs text-muted break-words">
                  {[decision.topic, decision.department].filter(Boolean).join(" · ")}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {model.todos.length > 0 ? (
        <Todos todos={model.todos} today={today} show={show} />
      ) : null}

      {model.topics.length > 0 ? (
        <Section title="Tagesordnung">
          <div className="flex flex-col gap-3">
            {model.topics.map((topic) => (
              <Topic key={topic.topic} topic={topic} />
            ))}
          </div>
        </Section>
      ) : null}

      {notes ? <Notes notes={meeting.rawNotes} /> : null}
      {bar}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <h2 id={headingId} className="text-lg font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Todos({
  todos,
  today,
  show,
}: {
  todos: readonly ReadTodo[];
  today: string;
  show: ReturnType<typeof useUndoBar>["show"];
}) {
  /** Ticked state while the action is running (id → done). */
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const openCount = todos.filter((todo) => !todo.done).length;

  const save = useCallback(async (id: string, done: boolean): Promise<boolean> => {
    try {
      return (await setTodoDone(id, done)).ok;
    } catch {
      return false;
    }
  }, []);

  const toggle = useCallback(
    async (todo: ReadTodo, done: boolean) => {
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
      show(done ? "Erledigt" : "Wieder offen", "info", () => {
        void save(todo.id, !done).then((undone) => {
          if (!undone) show(SAVE_ERROR, "error");
        });
      });
    },
    [pending, save, show]
  );

  return (
    <Section title={`To-dos (${openCount} offen)`}>
      <ul aria-label="To-dos" className="flex flex-col rounded-md border border-line bg-surface">
        {todos.map((todo) => {
          const done = pending[todo.id] ?? todo.done;
          const late = isOverdue({ kind: "todo", done, dueDate: todo.dueDate }, today);
          return (
            <li key={todo.id} aria-label={todo.text} className="flex items-stretch border-b border-line last:border-b-0">
              <TickBox checked={done} label={`${todo.text} erledigt`} onToggle={() => void toggle(todo, !done)} />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5 py-3 pr-4">
                <span className={`whitespace-pre-line break-words [overflow-wrap:anywhere] ${done ? "text-muted line-through" : ""}`}>
                  {todo.text}
                </span>
                <span className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
                  {todo.owner ? (
                    <span>
                      Wer: {todo.owner.name}
                      {todo.owner.withoutAccount ? " (ohne Account)" : ""}
                    </span>
                  ) : null}
                  {todo.dueDate ? (
                    <span className={late ? "font-semibold text-status-late" : ""}>
                      bis {dayMonth(todo.dueDate)}
                      {late ? " · überfällig" : ""}
                    </span>
                  ) : null}
                  {todo.department ? <span>{todo.department}</span> : null}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

function NoteList({ notes, label }: { notes: readonly ReadNote[]; label: string }) {
  return (
    <ul aria-label={label} className="flex list-disc flex-col gap-1 pl-5">
      {notes.map((note) => (
        <li key={note.id} className="whitespace-pre-line break-words [overflow-wrap:anywhere]">
          {note.text}
          {note.department ? <span className="text-xs text-muted"> · {note.department}</span> : null}
        </li>
      ))}
    </ul>
  );
}

/** Opens and closes a part of the page; the state lasts for this visit only. */
function Toggle({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const contentId = useId();
  return (
    <div className="flex flex-col gap-2">
      <div>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={contentId}
          onClick={() => setOpen(!open)}
          className="flex min-h-11 items-center gap-2 rounded-md font-medium text-primary hover:underline"
        >
          <svg
            aria-hidden
            viewBox="0 0 16 16"
            className={`size-4 shrink-0 ${open ? "rotate-90" : ""}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M6 3l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {label}
        </button>
      </div>
      <div id={contentId} hidden={!open}>
        {open ? children : null}
      </div>
    </div>
  );
}

function Topic({ topic }: { topic: ReadTopic }) {
  const headingId = useId();
  const count = topic.discussions.length;
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2 rounded-md border border-line bg-surface p-4">
      <h3 id={headingId} className="font-semibold break-words">
        {topic.topic}
      </h3>
      {topic.infos.length > 0 ? <NoteList notes={topic.infos} label={`Infos zu ${topic.topic}`} /> : null}
      {count > 0 ? (
        <Toggle label={count === 1 ? "1 Diskussionspunkt" : `${count} Diskussionspunkte`}>
          <NoteList notes={topic.discussions} label={`Diskussion zu ${topic.topic}`} />
        </Toggle>
      ) : null}
    </section>
  );
}

function Notes({ notes }: { notes: string }) {
  return (
    <section aria-label="Notiz oder Transkript" className="rounded-md border border-line bg-surface px-4 py-2">
      <Toggle label="Notiz/Transkript anzeigen">
        <div
          // Scrollable with the keyboard as well.
          tabIndex={0}
          className="mb-2 max-h-[60dvh] overflow-auto rounded-md bg-surface-2 p-3 break-words whitespace-pre-wrap"
        >
          {notes}
        </div>
      </Toggle>
    </section>
  );
}
