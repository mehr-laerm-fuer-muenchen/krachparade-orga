"use client";

import Link from "next/link";
import { useId, useState, type ReactNode } from "react";
import { StatusPill, type Status } from "@/components/status-pill";
import { TickBox } from "@/components/tick-box";
import { weekAgenda, type AgendaEntry, type PlanTodoView, type PlanViewElement } from "@/lib/gantt-layout";
import { formatBuffer } from "@/lib/plan-preview";
import { formatProgress, todoProgress, type TodoProgress } from "@/lib/todo-progress";
import { dueText } from "./plan-detail";
import { ReachHint } from "./reach-hint";
import type { PlanTicks } from "./use-plan-ticks";

/** Weeks per page of the list. */
const PAGE_WEEKS = 6;

const STRIPE: Record<Status, string> = {
  done: "bg-status-done",
  ok: "bg-status-ok",
  warn: "bg-status-warn",
  late: "bg-status-late",
};

const TOGGLE =
  "min-h-11 px-4 font-medium aria-pressed:bg-primary aria-pressed:text-on-primary not-aria-pressed:hover:bg-surface-2";

/** What every card of the list needs besides its entry (spec 016). */
type CardContext = {
  byId: ReadonlyMap<string, PlanViewElement>;
  today: number;
  dDay: string;
  ticks: PlanTicks;
  expanded: ReadonlySet<string>;
  hintHidden: ReadonlySet<string>;
  onSelect: (id: string) => void;
  onToggleExpand: (id: string) => void;
  onExpand: (id: string) => void;
  onHideHint: (id: string) => void;
};

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className={`size-4 shrink-0 ${open ? "rotate-180" : ""}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** "0/2" with a small bar; opens the to-dos in the card. */
function ProgressToggle({ progress, open, controls, onClick }: {
  progress: TodoProgress;
  open: boolean;
  controls: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-controls={open ? controls : undefined}
      onClick={onClick}
      className="relative z-10 -mr-2 flex min-h-11 items-center gap-1.5 rounded-md px-2 text-sm tabular-nums hover:bg-surface"
    >
      <span aria-hidden className="block h-1 w-8 overflow-hidden rounded-full bg-progress-track">
        <span
          className="block h-full rounded-full bg-progress-fill"
          style={{ width: `${(progress.done / progress.total) * 100}%` }}
        />
      </span>
      <span className="sr-only">To-dos </span>
      <span className={progress.complete ? "font-semibold text-progress-fill" : "text-muted"}>
        {formatProgress(progress)}
      </span>
      <Chevron open={open} />
    </button>
  );
}

function Entry({ entry, context }: { entry: AgendaEntry; context: CardContext }) {
  const { byId, today, dDay, ticks, expanded, hintHidden, onSelect, onToggleExpand, onExpand, onHideHint } = context;
  const listId = useId();
  const { element } = entry;
  const full = byId.get(element.id);

  /** Ticks off a to-do; the last one opens the card so that the hint shows. */
  const tickTodo = async (todo: PlanTodoView, done: boolean) => {
    const ok = await ticks.tickTodo(todo, done);
    if (ok && done && full?.todos.every((other) => other.id === todo.id || other.done)) onExpand(element.id);
  };

  let stripe: string;
  let title: string;
  let meta: string;
  let box: ReactNode;
  let side: ReactNode;
  let open = false;
  let reached = false;
  // Counts what was just ticked, before the reloaded data arrives.
  const progress = todoProgress(
    (full?.todos ?? []).map((todo) => ({ done: ticks.pending[`todo-${todo.id}`] ?? todo.done }))
  );
  if (entry.type === "todo") {
    const overdue = entry.todo.due < today;
    const todo = full?.todos.find((candidate) => candidate.id === entry.todo.id);
    const checked = ticks.pending[`todo-${entry.todo.id}`] ?? entry.todo.done;
    stripe = overdue ? STRIPE.late : "bg-line-strong";
    title = `${entry.todo.anchor === "start" ? "Voraussetzung" : "To-do"} · ${entry.todo.text}`;
    meta = entry.text;
    box = todo ? (
      <TickBox
        checked={checked}
        label={`Erledigt: ${todo.text}`}
        onToggle={() => void tickTodo(todo, !checked)}
        className="relative z-10"
      />
    ) : null;
    side = <span className="text-xs text-muted">{element.workingGroupName}</span>;
  } else {
    reached = ticks.pending[`element-${element.id}`] ?? element.done;
    open = progress.total > 0 && expanded.has(element.id);
    stripe = STRIPE[element.status];
    title = element.name;
    meta = [element.workingGroupName, element.ownerName, entry.text].filter(Boolean).join(" · ");
    box = full ? (
      <TickBox
        checked={reached}
        label={reached ? `${element.name} – erreicht zurücknehmen` : `${element.name} als erreicht markieren`}
        onToggle={() => void ticks.reach(full, !reached)}
        className="relative z-10"
      />
    ) : null;
    side = (
      <>
        <StatusPill status={element.status} assessment={element.reason === "wobbly"} />
        {element.done ? null : (
          <span
            className={`text-sm tabular-nums ${element.buffer < 0 ? "font-semibold text-status-late" : "text-muted"}`}
          >
            {formatBuffer(element.buffer)}
          </span>
        )}
        {progress.total > 0 ? (
          <ProgressToggle
            progress={progress}
            open={open}
            controls={listId}
            onClick={() => onToggleExpand(element.id)}
          />
        ) : null}
      </>
    );
  }
  const showHint = open && full !== undefined && !reached && progress.complete && !hintHidden.has(element.id);

  return (
    <li className="overflow-hidden rounded-md border border-line bg-surface">
      {/* The card opens the details; its button covers the whole row (box and counter sit above it). */}
      <div className="relative flex min-h-11 items-stretch hover:bg-surface-2">
        <span aria-hidden className={`w-1 shrink-0 ${stripe}`} />
        {box ?? <span aria-hidden className="w-3 shrink-0" />}
        <button
          type="button"
          onClick={() => onSelect(element.id)}
          className="flex min-w-0 flex-1 flex-col justify-center py-2 pr-2 text-left after:absolute after:inset-0"
        >
          <span className={`font-semibold break-words ${reached ? "text-muted" : ""}`}>{title}</span>
          <span className="text-sm break-words text-muted">{meta}</span>
        </button>
        <span className="flex shrink-0 flex-col items-end justify-center gap-1 py-2 pr-3">{side}</span>
      </div>
      {open && full ? (
        <div id={listId} className="flex flex-col gap-2 border-t border-line py-1 pr-3 pl-1">
          <ul aria-label={`To-dos von ${element.name}`} className="flex flex-col">
            {full.todos.map((todo) => {
              const checked = ticks.pending[`todo-${todo.id}`] ?? todo.done;
              const overdue = !checked && todo.due < today;
              return (
                <li key={todo.id} className="flex min-h-11 items-stretch">
                  <TickBox
                    checked={checked}
                    label={`Erledigt: ${todo.text}`}
                    onToggle={() => void tickTodo(todo, !checked)}
                  />
                  <span className="min-w-0 flex-1 py-2">
                    <span className={`block break-words ${checked ? "text-muted line-through" : ""}`}>{todo.text}</span>
                    <span className={`block text-sm ${overdue ? "font-semibold text-status-late" : "text-muted"}`}>
                      {[todo.ownerName, dueText(todo, dDay)].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
          {showHint ? (
            <div className="pb-2 pl-2">
              <ReachHint onReach={() => void ticks.reach(full, true)} onDismiss={() => onHideHint(element.id)} />
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

function Group({
  title,
  range,
  entries,
  empty,
  context,
}: {
  title: string;
  range?: string;
  entries: AgendaEntry[];
  empty?: string;
  context: CardContext;
}) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <h2 id={headingId} className="text-lg font-semibold">
          {title}
        </h2>
        {range ? <span className="text-sm text-muted tabular-nums">{range}</span> : null}
      </div>
      {entries.length === 0 ? (
        <p className="text-muted">{empty}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {entries.map((entry) => (
            <Entry key={entry.key} entry={entry} context={context} />
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * "Was steht an" (spec 007): overdue items and the coming weeks as cards,
 * for everyone or only the AKs of the signed-in member. Opens elements for
 * editing (spec 008).
 */
export function PlanWeekList({
  elements,
  today,
  dDay,
  myGroupIds,
  onSelect,
  onCreate,
  ticks,
}: {
  elements: readonly PlanViewElement[];
  today: number;
  dDay: string;
  /** AKs of the signed-in member (from the working group memberships). */
  myGroupIds: readonly string[];
  onSelect: (id: string) => void;
  /** "+ Element" on phones (spec 008); on laptops it sits in the toolbar. */
  onCreate?: () => void;
  /** Ticking off elements and to-dos (spec 016). */
  ticks: PlanTicks;
}) {
  const [mineOnly, setMineOnly] = useState(false);
  const [weeks, setWeeks] = useState(PAGE_WEEKS);
  // Opened cards and put-off hints, only for this page visit (spec 016).
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  const [hintHidden, setHintHidden] = useState<ReadonlySet<string>>(() => new Set());
  const noGroups = mineOnly && myGroupIds.length === 0;
  const agenda = weekAgenda({ dDay, elements }, today, { weeks, myGroupIds: mineOnly ? myGroupIds : null });
  const context: CardContext = {
    byId: new Map(elements.map((element) => [element.id, element])),
    today,
    dDay,
    ticks,
    expanded,
    hintHidden,
    onSelect,
    onToggleExpand: (id) => {
      const next = new Set(expanded);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      setExpanded(next);
    },
    onExpand: (id) => setExpanded((previous) => new Set(previous).add(id)),
    onHideHint: (id) => setHintHidden((previous) => new Set(previous).add(id)),
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div
          role="group"
          aria-label="Welche AKs"
          className="flex self-start overflow-hidden rounded-md border border-line bg-surface"
        >
          <button type="button" aria-pressed={!mineOnly} onClick={() => setMineOnly(false)} className={TOGGLE}>
            Alle
          </button>
          <button
            type="button"
            aria-pressed={mineOnly}
            onClick={() => setMineOnly(true)}
            className={`${TOGGLE} border-l border-line`}
          >
            Meine AKs
          </button>
        </div>
        {onCreate ? (
          <button
            type="button"
            onClick={onCreate}
            className="min-h-11 rounded-md bg-primary px-4 font-semibold text-on-primary hover:opacity-90 desk:hidden"
          >
            + Element
          </button>
        ) : null}
      </div>

      {noGroups ? (
        <p className="rounded-md border border-line bg-surface px-4 py-3 text-muted">
          Du bist noch in keinem AK – trag dich unter{" "}
          <Link href="/arbeitskreise" className="font-medium text-primary underline underline-offset-2">
            AKs
          </Link>{" "}
          ein.
        </p>
      ) : (
        <>
          {agenda.overdue.length > 0 ? (
            <Group title="Überfällig & Verzug" entries={agenda.overdue} context={context} />
          ) : null}
          {agenda.weeks.map((week) => (
            <Group
              key={week.monday}
              title={week.title}
              range={week.range}
              entries={week.entries}
              empty="Nichts fällig."
              context={context}
            />
          ))}
          {agenda.hasMore ? (
            <button
              type="button"
              onClick={() => setWeeks(weeks + PAGE_WEEKS)}
              className="min-h-11 self-start rounded-md border border-line bg-surface px-4 font-medium hover:bg-surface-2"
            >
              Weitere Wochen
            </button>
          ) : null}
        </>
      )}
    </div>
  );
}
