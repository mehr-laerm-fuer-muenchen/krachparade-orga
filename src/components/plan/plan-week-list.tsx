"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { TickBox } from "@/components/tick-box";
import { weekAgenda, type AgendaEntry, type PlanTodoView, type PlanViewElement } from "@/lib/gantt-layout";
import { windowText } from "@/lib/plan-status";
import { CardShell, ElementCard, STRIPE, type CardFrame } from "./element-card";
import { PinIcon } from "./pin-icon";
import type { PlanTicks } from "./use-plan-ticks";

/** Weeks per page of the list. */
const PAGE_WEEKS = 6;

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

function Entry({ entry, context }: { entry: AgendaEntry; context: CardContext }) {
  const { byId, ticks, expanded, hintHidden, onExpand } = context;
  const { element } = entry;
  const full = byId.get(element.id);

  if (entry.type === "element") {
    // Spec 026: frame and word for critical/tight, the window line with a pin for fixed dates.
    const frame: CardFrame = full && !full.done ? (full.critical ? "critical" : full.tight ? "tight" : null) : null;
    const word = frame === "critical" ? "kritisch" : frame === "tight" ? "knapp" : null;
    const detail = full ? (
      <span data-testid="card-window">
        {!full.done && full.fixed ? (
          <>
            <PinIcon label={false} />{" "}
          </>
        ) : null}
        {windowText(
          {
            status: full.status,
            earliestStart: full.earliestStart,
            latestStart: full.latestStart,
            latestFinish: full.latestEnd,
            plannedStart: full.start,
            plannedEnd: full.end,
            slack: full.slack,
          },
          full,
          context.dDay
        )}
      </span>
    ) : null;
    return (
      <ElementCard
        element={element}
        full={full}
        frame={frame}
        detail={detail}
        meta={[element.workingGroupName, element.ownerName, entry.text, word].filter(Boolean).join(" · ")}
        today={context.today}
        dDay={context.dDay}
        ticks={ticks}
        expanded={expanded.has(element.id)}
        hintHidden={hintHidden.has(element.id)}
        onSelect={context.onSelect}
        onToggleExpand={context.onToggleExpand}
        onExpand={onExpand}
        onHideHint={context.onHideHint}
      />
    );
  }

  /** Ticks off a to-do; the last one opens the element's card so that the hint shows. */
  const tickTodo = async (todo: PlanTodoView, done: boolean) => {
    const ok = await ticks.tickTodo(todo, done);
    if (ok && done && full?.todos.every((other) => other.id === todo.id || other.done)) onExpand(element.id);
  };
  const overdue = entry.todo.due < context.today;
  const todo = full?.todos.find((candidate) => candidate.id === entry.todo.id);
  const checked = ticks.pending[`todo-${entry.todo.id}`] ?? entry.todo.done;

  return (
    <CardShell
      stripe={overdue ? STRIPE.late : "bg-line-strong"}
      box={
        todo ? (
          <TickBox
            checked={checked}
            label={`Erledigt: ${todo.text}`}
            onToggle={() => void tickTodo(todo, !checked)}
            className="relative z-10"
          />
        ) : null
      }
      title={`${entry.todo.anchor === "start" ? "Voraussetzung" : "To-do"} · ${entry.todo.text}`}
      meta={entry.text}
      muted={false}
      side={<span className="text-xs text-muted">{element.workingGroupName}</span>}
      onOpen={() => context.onSelect(element.id)}
    />
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
