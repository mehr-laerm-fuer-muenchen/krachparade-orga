"use client";

import { useId, type ReactNode } from "react";
import { StatusPill, type Status } from "@/components/status-pill";
import { TickBox } from "@/components/tick-box";
import type { AgendaElement, PlanTodoView, PlanViewElement } from "@/lib/gantt-layout";
import { formatBuffer } from "@/lib/plan-preview";
import { formatProgress, todoProgress, type TodoProgress } from "@/lib/todo-progress";
import { dueText } from "./plan-detail";
import { ReachHint } from "./reach-hint";
import type { PlanTicks } from "./use-plan-ticks";

// Cards of the week list (spec 016), also used in the AK workspace (spec 018).

export const STRIPE: Record<Status, string> = {
  done: "bg-status-done",
  ok: "bg-status-ok",
  warn: "bg-status-warn",
  late: "bg-status-late",
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

/**
 * The frame of a card: colour stripe, tick box, a button over the whole row
 * that opens the details (box and side controls sit above it), side column
 * and optional content below.
 */
/** Frame of a critical (solid) or tight (dashed) element (spec 026, week list only). */
export type CardFrame = "critical" | "tight" | null;

const FRAME: Record<Exclude<CardFrame, null>, string> = {
  critical: "border-2 border-accent",
  tight: "border-2 border-dashed border-accent",
};

export function CardShell({
  stripe,
  box,
  title,
  meta,
  muted,
  side,
  onOpen,
  children,
  frame = null,
  detail,
}: {
  stripe: string;
  box: ReactNode;
  title: string;
  meta: string;
  muted: boolean;
  side: ReactNode;
  onOpen: () => void;
  children?: ReactNode;
  frame?: CardFrame;
  /** A further line under the meta line (spec 026: the window). */
  detail?: ReactNode;
}) {
  return (
    <li
      data-frame={frame ?? undefined}
      className={`overflow-hidden rounded-md bg-surface ${frame ? FRAME[frame] : "border border-line"}`}
    >
      {/* The card opens the details; its button covers the whole row (box and counter sit above it). */}
      <div className="relative flex min-h-11 items-stretch hover:bg-surface-2">
        <span aria-hidden className={`w-1 shrink-0 ${stripe}`} />
        {box ?? <span aria-hidden className="w-3 shrink-0" />}
        <button
          type="button"
          onClick={onOpen}
          className="flex min-w-0 flex-1 flex-col justify-center py-2 pr-2 text-left after:absolute after:inset-0"
        >
          <span className={`font-semibold break-words ${muted ? "text-muted" : ""}`}>{title}</span>
          <span className="text-sm break-words text-muted">{meta}</span>
          {detail ? <span className="text-sm break-words text-muted tabular-nums">{detail}</span> : null}
        </button>
        <span className="flex shrink-0 flex-col items-end justify-center gap-1 py-2 pr-3">{side}</span>
      </div>
      {children}
    </li>
  );
}

/**
 * A plan element as a card (spec 016): box = "Erreicht", status, buffer,
 * counter that opens the to-dos (each can be ticked off) and the hint "Als
 * erreicht markieren?" once all are done. `full` carries the to-dos.
 */
export function ElementCard({
  element,
  full,
  meta,
  today,
  dDay,
  ticks,
  expanded,
  hintHidden,
  onSelect,
  onToggleExpand,
  onExpand,
  onHideHint,
  frame,
  detail,
}: {
  element: AgendaElement;
  full: PlanViewElement | undefined;
  meta: string;
  /** Spec 026, week list only: frame for critical/tight and the window line. */
  frame?: CardFrame;
  detail?: ReactNode;
  today: number;
  dDay: string;
  ticks: PlanTicks;
  expanded: boolean;
  hintHidden: boolean;
  onSelect: (id: string) => void;
  onToggleExpand: (id: string) => void;
  onExpand: (id: string) => void;
  onHideHint: (id: string) => void;
}) {
  const listId = useId();

  /** Ticks off a to-do; the last one opens the card so that the hint shows. */
  const tickTodo = async (todo: PlanTodoView, done: boolean) => {
    const ok = await ticks.tickTodo(todo, done);
    if (ok && done && full?.todos.every((other) => other.id === todo.id || other.done)) onExpand(element.id);
  };

  // Counts what was just ticked, before the reloaded data arrives.
  const progress = todoProgress(
    (full?.todos ?? []).map((todo) => ({ done: ticks.pending[`todo-${todo.id}`] ?? todo.done }))
  );
  const reached = ticks.pending[`element-${element.id}`] ?? element.done;
  const open = progress.total > 0 && expanded;
  const showHint = open && full !== undefined && !reached && progress.complete && !hintHidden;

  const box = full ? (
    <TickBox
      checked={reached}
      label={reached ? `${element.name} – erreicht zurücknehmen` : `${element.name} als erreicht markieren`}
      onToggle={() => void ticks.reach(full, !reached)}
      className="relative z-10"
    />
  ) : null;
  const side = (
    <>
      <StatusPill status={element.status} reason={element.reason} assessment={element.reason === "wobbly"} />
      {element.done ? null : (
        <span className={`text-sm tabular-nums ${element.buffer < 0 ? "font-semibold text-status-late" : "text-muted"}`}>
          {formatBuffer(element.buffer)}
        </span>
      )}
      {progress.total > 0 ? (
        <ProgressToggle progress={progress} open={open} controls={listId} onClick={() => onToggleExpand(element.id)} />
      ) : null}
    </>
  );

  return (
    <CardShell
      stripe={STRIPE[element.status]}
      box={box}
      title={element.name}
      meta={meta}
      muted={reached}
      side={side}
      onOpen={() => onSelect(element.id)}
      frame={frame}
      detail={detail}
    >
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
    </CardShell>
  );
}
