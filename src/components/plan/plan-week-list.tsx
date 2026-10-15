"use client";

import Link from "next/link";
import { useId, useState, type ReactNode } from "react";
import { StatusPill, type Status } from "@/components/status-pill";
import { weekAgenda, type AgendaEntry, type PlanViewElement } from "@/lib/gantt-layout";
import { formatBuffer } from "@/lib/plan-preview";

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

function Entry({ entry, today, onSelect }: { entry: AgendaEntry; today: number; onSelect: (id: string) => void }) {
  const { element } = entry;
  let stripe: string;
  let title: string;
  let meta: string;
  let side: ReactNode;
  if (entry.type === "todo") {
    const overdue = entry.todo.due < today;
    stripe = overdue ? STRIPE.late : "bg-line-strong";
    title = `${entry.todo.anchor === "start" ? "Voraussetzung" : "To-do"} · ${entry.todo.text}`;
    meta = entry.text;
    side = <span className="text-xs text-muted">{element.workingGroupName}</span>;
  } else {
    stripe = STRIPE[element.status];
    title = element.name;
    meta = [element.workingGroupName, element.ownerName, entry.text].filter(Boolean).join(" · ");
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
      </>
    );
  }
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(element.id)}
        className="flex min-h-11 w-full items-stretch overflow-hidden rounded-md border border-line bg-surface text-left hover:bg-surface-2"
      >
        <span aria-hidden className={`w-1 shrink-0 ${stripe}`} />
        <span className="flex min-w-0 flex-1 flex-col justify-center py-2 pr-2 pl-3">
          <span className="font-semibold">{title}</span>
          <span className="text-sm text-muted">{meta}</span>
        </span>
        <span className="flex shrink-0 flex-col items-end justify-center gap-1 py-2 pr-3">{side}</span>
      </button>
    </li>
  );
}

function Group({
  title,
  range,
  entries,
  empty,
  today,
  onSelect,
}: {
  title: string;
  range?: string;
  entries: AgendaEntry[];
  empty?: string;
  today: number;
  onSelect: (id: string) => void;
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
            <Entry key={entry.key} entry={entry} today={today} onSelect={onSelect} />
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * "Was steht an" (spec 007): overdue items and the coming weeks as cards,
 * for everyone or only the AKs of the signed-in member. Read only.
 */
export function PlanWeekList({
  elements,
  today,
  dDay,
  myGroupIds,
  onSelect,
}: {
  elements: readonly PlanViewElement[];
  today: number;
  dDay: string;
  /** AKs of the signed-in member (from the working group memberships). */
  myGroupIds: readonly string[];
  onSelect: (id: string) => void;
}) {
  const [mineOnly, setMineOnly] = useState(false);
  const [weeks, setWeeks] = useState(PAGE_WEEKS);
  const noGroups = mineOnly && myGroupIds.length === 0;
  const agenda = weekAgenda({ dDay, elements }, today, { weeks, myGroupIds: mineOnly ? myGroupIds : null });

  return (
    <div className="flex flex-col gap-5">
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
            <Group title="Überfällig & Verzug" entries={agenda.overdue} today={today} onSelect={onSelect} />
          ) : null}
          {agenda.weeks.map((week) => (
            <Group
              key={week.monday}
              title={week.title}
              range={week.range}
              entries={week.entries}
              empty="Nichts fällig."
              today={today}
              onSelect={onSelect}
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
