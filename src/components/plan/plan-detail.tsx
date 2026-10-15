"use client";

import { useEffect, type ReactNode } from "react";
import { StatusPill } from "@/components/status-pill";
import { formatDLabel } from "@/lib/dday";
import {
  formatWeekdayDate,
  type GanttLink,
  type PlanTodoView,
  type PlanViewElement,
} from "@/lib/gantt-layout";
import { dayToDate } from "@/lib/plan-days";
import { formatWeekdayShort } from "@/lib/plan-preview";

export const EDIT_LATER = "Bearbeiten kommt mit dem nächsten Update.";

/** "+5 T Puffer", "0 T Puffer", "−2 T Verzug" or "erledigt". */
export function bufferLabel(element: Pick<PlanViewElement, "buffer" | "done">): string {
  if (element.done) return "erledigt";
  if (element.buffer > 0) return `+${element.buffer} T Puffer`;
  if (element.buffer < 0) return `−${-element.buffer} T Verzug`;
  return "0 T Puffer";
}

function dateWithD(day: number, dDay: string): string {
  return `${formatWeekdayDate(day, dDay)} · ${formatDLabel(dayToDate(day, dDay), dDay)}`;
}

function dueText(todo: PlanTodoView, dDay: string): string {
  const anchor = todo.anchor === "start" ? "Start" : "Ende";
  const when = todo.daysBefore === 0 ? `zum ${anchor}` : `${todo.daysBefore} T vor ${anchor}`;
  return `${formatWeekdayShort(dayToDate(todo.due, dDay))} · ${when}`;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2 border-t border-line pt-3">
      <h3 className="text-xs font-semibold tracking-wide text-muted uppercase">{title}</h3>
      {children}
    </section>
  );
}

type LinkItem = { key: string; id: string | null; name: string; lag: number };

const EMPTY = <p className="text-muted">Noch keine.</p>;

/**
 * Read-only details of a plan element (spec 007). Next to the plan on wide
 * screens, a sheet from the bottom on phones. Closes with "×" or Escape.
 */
export function PlanDetail({
  element,
  elements,
  links,
  today,
  dDay,
  onSelect,
  onClose,
}: {
  element: PlanViewElement;
  elements: ReadonlyMap<string, PlanViewElement>;
  links: readonly GanttLink[];
  today: number;
  dDay: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const open = !element.done;
  const milestone = element.kind === "milestone";
  const meta = [
    element.workingGroupName,
    element.departmentName,
    milestone ? "Meilenstein" : "Vorgang",
    element.ownerName,
  ].filter(Boolean);

  const predecessors = links.flatMap((link): LinkItem[] => {
    const from = link.toId === element.id ? elements.get(link.fromId) : undefined;
    return from ? [{ key: `${link.fromId}-p`, id: from.id, name: from.name, lag: link.lagDays }] : [];
  });
  const successors = links.flatMap((link): LinkItem[] => {
    if (link.fromId !== element.id) return [];
    if (link.toId === null) return [{ key: "dday", id: null, name: "D-Day", lag: link.lagDays }];
    const to = elements.get(link.toId);
    return to ? [{ key: `${to.id}-s`, id: to.id, name: to.name, lag: link.lagDays }] : [];
  });

  let hint: string | null = null;
  if (open) {
    if (element.buffer < 0) hint = `Liegt ${-element.buffer} Tage zu spät für die Nachfolger.`;
    else if (element.buffer > 0) hint = `${element.buffer} Tage Luft bis zum spätesten Termin.`;
    else hint = "Liegt auf dem spätesten Termin. Jede Verzögerung schiebt Nachfolger.";
  }

  const linkList = (items: LinkItem[]) =>
    items.length === 0 ? (
      EMPTY
    ) : (
      <ul className="flex flex-col">
        {items.map(({ key, id, name, lag }) => {
          const label = `${name} · ${lag} T Abstand`;
          return (
            <li key={key}>
              {id === null ? (
                <span className="flex min-h-11 items-center">{label}</span>
              ) : (
                <button
                  type="button"
                  onClick={() => onSelect(id)}
                  className="flex min-h-11 w-full items-center rounded-sm text-left text-primary underline-offset-2 hover:underline"
                >
                  {label}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    );

  return (
    <>
      <div aria-hidden onClick={onClose} className="fixed inset-0 z-30 bg-black/50 desk:hidden" />
      <aside
        aria-label="Details"
        className="fixed inset-x-0 bottom-0 z-40 flex max-h-[88dvh] flex-col rounded-t-xl border-t border-line bg-surface shadow-[0_-8px_24px_rgb(0_0_0/0.2)] desk:sticky desk:top-4 desk:z-auto desk:max-h-[calc(100dvh-2rem)] desk:w-[380px] desk:shrink-0 desk:self-start desk:rounded-md desk:border desk:shadow-none"
      >
        <div className="flex items-start gap-2 border-b border-line py-2 pr-1 pl-4">
          <div className="flex min-w-0 flex-1 flex-col gap-1 pt-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill status={element.status} assessment={element.reason === "wobbly"} />
              <span
                className={`text-sm tabular-nums ${open && element.buffer < 0 ? "font-semibold text-status-late" : "text-muted"}`}
              >
                {bufferLabel(element)}
              </span>
            </div>
            <h2 className="text-lg leading-snug font-semibold">{element.name}</h2>
            <p className="text-sm text-muted">{meta.join(" · ")}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Details schließen"
            className="flex size-11 shrink-0 items-center justify-center rounded-md text-2xl leading-none text-muted hover:bg-surface-2"
          >
            ×
          </button>
        </div>

        <div className="flex flex-col gap-4 overflow-y-auto px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <Section title="Termin">
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 tabular-nums">
              {milestone ? (
                <>
                  <dt className="text-muted">Datum</dt>
                  <dd>{dateWithD(element.start, dDay)}</dd>
                </>
              ) : (
                <>
                  <dt className="text-muted">Start</dt>
                  <dd>{dateWithD(element.start, dDay)}</dd>
                  <dt className="text-muted">Ende</dt>
                  <dd>{dateWithD(element.end, dDay)}</dd>
                </>
              )}
              <dt className="text-muted">Spätestens</dt>
              <dd>{dateWithD(element.latestEnd, dDay)}</dd>
            </dl>
            {hint ? <p className={element.buffer < 0 ? "text-status-late" : "text-muted"}>{hint}</p> : null}
            {element.fixed ? <p className="font-medium">Fixtermin (extern festgelegt)</p> : null}
            {element.wobbly ? <p className="font-medium">Wackelt (Einschätzung)</p> : null}
          </Section>

          <Section title="To-dos & Voraussetzungen">
            {element.todos.length === 0 ? (
              EMPTY
            ) : (
              <ul className="flex flex-col gap-2">
                {element.todos.map((todo) => {
                  const overdue = !todo.done && todo.due < today;
                  return (
                    <li key={todo.id} className="flex gap-2">
                      <span
                        aria-label={todo.done ? "erledigt" : "offen"}
                        role="img"
                        className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-sm border ${
                          todo.done ? "border-status-done bg-status-done text-on-status-done" : "border-line-strong"
                        }`}
                      >
                        {todo.done ? (
                          <svg aria-hidden viewBox="0 0 16 16" className="size-3" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M3.5 8.5l3 3 6-7" />
                          </svg>
                        ) : null}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className={todo.done ? "text-muted line-through" : ""}>{todo.text}</p>
                        <p className={`text-sm ${overdue ? "font-semibold text-status-late" : "text-muted"}`}>
                          {[todo.ownerName, dueText(todo, dDay)].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>

          <Section title="Notizen">
            {element.notes.length === 0 ? (
              EMPTY
            ) : (
              <ul className="flex flex-col gap-3">
                {element.notes.map((note) => (
                  <li key={note.id}>
                    <p className="text-sm text-muted">
                      {note.authorName} · {formatWeekdayShort(note.date)}
                    </p>
                    <p className="whitespace-pre-line">{note.text}</p>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Vorgänger">{linkList(predecessors)}</Section>
          <Section title="Nachfolger">{linkList(successors)}</Section>

          <p className="text-sm text-muted">{EDIT_LATER}</p>
        </div>
      </aside>
    </>
  );
}
