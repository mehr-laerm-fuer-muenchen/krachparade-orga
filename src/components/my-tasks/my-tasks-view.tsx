"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { setTodoDone } from "@/actions/meetings";
import { claimItem } from "@/actions/my-tasks";
import { setDone, toggleTodo } from "@/actions/plan";
import { PageTitle } from "@/components/placeholder";
import { useUndoBar } from "@/components/plan/plan-bar";
import { PlanDetail } from "@/components/plan/plan-detail";
import type { PlanViewData } from "@/components/plan/plan-view";
import { SAVE_ERROR, usePlanActions } from "@/components/plan/use-plan-actions";
import { usePlanTicks } from "@/components/plan/use-plan-ticks";
import { StatusPill, type Status } from "@/components/status-pill";
import { TickBox } from "@/components/tick-box";
import type { MyAgenda, MyTask, MyWeek } from "@/lib/my-tasks";
import { formatBuffer } from "@/lib/plan-preview";

/** Sections that can be folded; remembered per device. */
type Fold = "later" | "unassigned" | "done";

const COLLAPSED_KEY = "kp-meine-collapsed";
const DEFAULT_COLLAPSED: Record<Fold, boolean> = { later: true, unassigned: true, done: true };

// Storage can be missing or blocked, so every access is wrapped and the defaults apply.
function readCollapsed(): Record<Fold, boolean> {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(COLLAPSED_KEY) ?? "{}");
    const stored = typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {};
    const value = (fold: Fold) => (typeof stored[fold] === "boolean" ? stored[fold] : DEFAULT_COLLAPSED[fold]);
    return { later: value("later"), unassigned: value("unassigned"), done: value("done") };
  } catch {
    return DEFAULT_COLLAPSED;
  }
}

function writeCollapsed(collapsed: Record<Fold, boolean>) {
  try {
    window.localStorage.setItem(COLLAPSED_KEY, JSON.stringify(collapsed));
  } catch {
    // Not remembered on this device.
  }
}

const STRIPE: Record<Status, string> = {
  done: "bg-status-done",
  ok: "bg-status-ok",
  warn: "bg-status-warn",
  late: "bg-status-late",
};

const NOTICE = "rounded-md border border-line bg-surface px-4 py-3 text-muted";

/** "2027-02-10" → "10.02." */
function dayMonth(date: string): string {
  const [, month, day] = date.split("-");
  return `${day}.${month}.`;
}

function titleOf(task: MyTask): string {
  return task.kind === "plan_todo" && !task.ongoing ? `${task.anchorLabel} · ${task.title}` : task.title;
}

/** "AK ‹Name› · ‹Zusatztext›", plus element or meeting where the text does not name it yet. */
function metaOf(task: MyTask): string {
  const parts = [task.workingGroupName, task.text];
  if (task.kind === "plan_todo" && task.ongoing) {
    // "Laufende Aufgaben · ‹Bereich›" (spec 018); done entries name it after the date.
    if (task.text !== task.elementName) parts.push(task.elementName);
  } else if (task.kind === "plan_todo") {
    if (!task.text.startsWith("für ")) parts.push(`für ${task.elementName}`);
    if (task.onOwnElement) parts.push("an deinem Element");
  } else if (task.kind === "meeting_todo" && !task.text.startsWith("aus Treffen")) {
    parts.push(`aus Treffen ${dayMonth(task.meetingDate)}`);
  }
  return parts.filter(Boolean).join(" · ");
}

type CardMode = "open" | "done" | "unassigned";

function TaskCard({
  task,
  mode,
  today,
  checked,
  onToggle,
  onOpen,
  onClaim,
}: {
  task: MyTask;
  mode: CardMode;
  today: number;
  checked: boolean;
  onToggle: (task: MyTask, done: boolean) => void;
  onOpen: (elementId: string) => void;
  onClaim: (task: MyTask) => void;
}) {
  const late = task.day !== null && task.day < today;
  const stripe =
    mode === "done"
      ? STRIPE.done
      : task.kind === "element"
        ? STRIPE[task.status]
        : late
          ? STRIPE.late
          : "bg-line-strong";

  const side =
    task.kind === "element" ? (
      <>
        <StatusPill status={mode === "done" ? "done" : task.status} assessment={task.reason === "wobbly"} />
        {mode === "done" ? null : (
          <span className={`text-sm tabular-nums ${task.buffer < 0 ? "font-semibold text-status-late" : "text-muted"}`}>
            {formatBuffer(task.buffer)}
          </span>
        )}
      </>
    ) : task.kind === "meeting_todo" ? (
      <span className="rounded-full border border-line-strong px-2 py-0.5 text-xs font-semibold text-muted">
        Protokoll
      </span>
    ) : null;

  const body = (
    <>
      <span className="flex min-w-0 flex-1 flex-col justify-center py-2 pr-2">
        <span className={`font-semibold break-words ${mode === "done" ? "text-muted line-through" : ""}`}>
          {titleOf(task)}
        </span>
        <span className={`text-sm break-words ${mode === "open" && late ? "text-status-late" : "text-muted"}`}>
          {metaOf(task)}
        </span>
      </span>
      {side ? <span className="flex shrink-0 flex-col items-end justify-center gap-1 py-2 pr-3">{side}</span> : null}
    </>
  );
  const MAIN = "flex min-h-11 min-w-0 flex-1 items-stretch text-left hover:bg-surface-2";

  return (
    <li
      aria-label={task.title}
      className="flex items-stretch overflow-hidden rounded-md border border-line bg-surface"
    >
      <span aria-hidden className={`w-1 shrink-0 ${stripe}`} />
      {mode === "unassigned" ? (
        <span aria-hidden className="w-3 shrink-0" />
      ) : (
        <TickBox checked={checked} label={`${task.title} erledigt`} onToggle={() => onToggle(task, !checked)} />
      )}
      {task.kind === "meeting_todo" ? (
        <Link href={`/protokolle/${task.meetingId}`} className={MAIN}>
          {body}
        </Link>
      ) : task.kind === "plan_todo" && task.ongoing ? (
        // "Laufende Aufgaben" are not in the plan: they open the AK workspace (spec 018).
        <Link
          href={task.ongoing.workingGroupId ? `/arbeitskreise/${task.ongoing.workingGroupId}` : "/arbeitskreise"}
          className={MAIN}
        >
          {body}
        </Link>
      ) : (
        <button
          type="button"
          onClick={() => onOpen(task.kind === "element" ? task.id : task.elementId)}
          className={MAIN}
        >
          {body}
        </button>
      )}
      {mode === "unassigned" ? (
        <span className="flex shrink-0 items-center py-1 pr-1">
          <button
            type="button"
            onClick={() => onClaim(task)}
            className="min-h-11 rounded-md border border-line bg-surface px-3 font-medium hover:bg-surface-2"
          >
            Übernehmen
          </button>
        </span>
      ) : null}
    </li>
  );
}

type CardProps = Omit<Parameters<typeof TaskCard>[0], "task" | "mode" | "checked"> & {
  checkedOf: (task: MyTask, mode: CardMode) => boolean;
};

function TaskList({ tasks, mode, label, card }: { tasks: MyTask[]; mode: CardMode; label: string; card: CardProps }) {
  const { checkedOf, ...rest } = card;
  return (
    <ul aria-label={label} className="flex flex-col gap-2">
      {tasks.map((task) => (
        <TaskCard key={task.key} task={task} mode={mode} checked={checkedOf(task, mode)} {...rest} />
      ))}
    </ul>
  );
}

function Group({
  title,
  range,
  nested = false,
  children,
}: {
  title: string;
  range?: string;
  /** Inside a foldable section: one heading level lower. */
  nested?: boolean;
  children: ReactNode;
}) {
  const headingId = useId();
  const Heading = nested ? "h3" : "h2";
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <Heading id={headingId} className="text-lg font-semibold">
          {title}
        </Heading>
        {range ? <span className="text-sm text-muted tabular-nums">{range}</span> : null}
      </div>
      {children}
    </section>
  );
}

function Foldable({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const contentId = useId();
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={contentId}
          onClick={onToggle}
          className="flex min-h-11 w-full items-center gap-2 rounded-md text-left hover:text-primary"
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
          {title}
        </button>
      </h2>
      <div id={contentId} hidden={!open} className="flex flex-col gap-2">
        {open ? children : null}
      </div>
    </section>
  );
}

function Weeks({
  weeks,
  mode,
  card,
  nested = false,
}: {
  weeks: MyWeek[];
  mode: CardMode;
  card: CardProps;
  nested?: boolean;
}) {
  return weeks.map((week) => (
    <Group key={week.monday} title={week.title} range={week.range} nested={nested}>
      {week.entries.length === 0 ? (
        <p className="text-muted">Nichts fällig.</p>
      ) : (
        <TaskList tasks={week.entries} mode={mode} label={week.title} card={card} />
      )}
    </Group>
  ));
}

export type MyTasksViewData = {
  agenda: MyAgenda;
  recentlyDone: MyTask[];
  /** Today, relative to the D-Day. */
  today: number;
  hasGroups: boolean;
  /** Plan for the detail panel; null without plan elements. */
  plan: PlanViewData | null;
};

/**
 * "Meine Aufgaben" (spec 009): my open entries as one time list, my AKs'
 * entries without anyone and what I ticked off lately. Everything is computed
 * on the server; ticking off and taking over call the server actions, which
 * reload the page. Plan entries open the editable detail panel.
 */
export function MyTasksView({ data }: { data: MyTasksViewData }) {
  const { agenda, recentlyDone, today, hasGroups, plan } = data;
  const { show, bar } = useUndoBar();
  const [collapsed, setCollapsed] = useState(DEFAULT_COLLAPSED);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  /** Ticked state while an action is running (key → done). */
  const [pending, setPending] = useState<Record<string, boolean>>({});

  // The first render uses the defaults (same as on the server); the stored
  // state of this device applies right after.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only storage after hydration
    setCollapsed(readCollapsed());
  }, []);

  const byId = useMemo(() => new Map((plan?.elements ?? []).map((element) => [element.id, element])), [plan]);
  // "Rückgängig" runs after the page has reloaded: it needs the newest `updated_at`.
  const latest = useRef(byId);
  useEffect(() => {
    latest.current = byId;
  }, [byId]);

  const { run, drag } = usePlanActions(byId, show);
  const { reach } = usePlanTicks(byId, show);
  /** Elements whose "Als erreicht markieren?" hint was put off in this visit (spec 016). */
  const [hintHidden, setHintHidden] = useState<ReadonlySet<string>>(() => new Set());
  const close = useCallback(() => setSelectedId(null), []);

  const toggleFold = (fold: Fold) => {
    const next = { ...collapsed, [fold]: !collapsed[fold] };
    setCollapsed(next);
    writeCollapsed(next);
  };

  const save = useCallback(async (task: MyTask, done: boolean): Promise<boolean> => {
    try {
      if (task.kind === "element") {
        const element = latest.current.get(task.id);
        if (!element) return false;
        return (await setDone(task.id, done, element.updatedAt)).ok;
      }
      if (task.kind === "plan_todo") return (await toggleTodo(task.id, done)).ok;
      return (await setTodoDone(task.id, done)).ok;
    } catch {
      return false;
    }
  }, []);

  const toggle = useCallback(
    async (task: MyTask, done: boolean) => {
      if (task.key in pending) return;
      setPending((previous) => ({ ...previous, [task.key]: done }));
      const ok = await save(task, done);
      setPending((previous) => {
        const next = { ...previous };
        delete next[task.key];
        return next;
      });
      if (!ok) {
        show(SAVE_ERROR, "error");
        return;
      }
      show(done ? "Erledigt" : "Wieder offen", "info", () => {
        void save(task, !done).then((undone) => {
          if (!undone) show(SAVE_ERROR, "error");
        });
      });
    },
    [pending, save, show]
  );

  const claim = useCallback(
    async (task: MyTask) => {
      try {
        const result = await claimItem({ kind: task.kind, id: task.id });
        show(result.ok ? "Übernommen" : result.message, result.ok ? "info" : "error");
      } catch {
        show(SAVE_ERROR, "error");
      }
    },
    [show]
  );

  const card: CardProps = {
    today,
    onToggle: (task, done) => void toggle(task, done),
    onOpen: setSelectedId,
    onClaim: (task) => void claim(task),
    checkedOf: (task, mode) => pending[task.key] ?? mode === "done",
  };

  const laterCount = agenda.later.reduce((sum, week) => sum + week.entries.length, 0);
  const openCount =
    agenda.overdue.length +
    agenda.weeks.reduce((sum, week) => sum + week.entries.length, 0) +
    laterCount +
    agenda.undated.length;
  const selected = selectedId === null ? undefined : byId.get(selectedId);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <PageTitle>Meine Aufgaben</PageTitle>
        <p className="text-muted">
          {openCount} offen
          {agenda.overdue.length > 0 ? (
            <>
              {" · "}
              <span className="font-semibold text-status-late">{agenda.overdue.length} überfällig</span>
            </>
          ) : null}
        </p>
      </div>

      <div className="flex items-start gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-5">
          {openCount === 0 ? (
            <p className={NOTICE}>Nichts offen bei dir.</p>
          ) : (
            <>
              {agenda.overdue.length > 0 ? (
                <Group title={`Überfällig & Verzug (${agenda.overdue.length})`}>
                  <TaskList tasks={agenda.overdue} mode="open" label="Überfällig & Verzug" card={card} />
                </Group>
              ) : null}
              <Weeks weeks={agenda.weeks} mode="open" card={card} />
              {laterCount > 0 ? (
                <Foldable title={`Später (${laterCount})`} open={!collapsed.later} onToggle={() => toggleFold("later")}>
                  <Weeks weeks={agenda.later} mode="open" card={card} nested />
                </Foldable>
              ) : null}
              {agenda.undated.length > 0 ? (
                <Group title={`Ohne Datum (${agenda.undated.length})`}>
                  <TaskList tasks={agenda.undated} mode="open" label="Ohne Datum" card={card} />
                </Group>
              ) : null}
            </>
          )}

          <Foldable
            title={`Aus meinen AKs – noch niemand eingetragen (${agenda.unassigned.length})`}
            open={!collapsed.unassigned}
            onToggle={() => toggleFold("unassigned")}
          >
            {!hasGroups ? (
              <p className={NOTICE}>
                Du bist noch in keinem AK – trag dich unter{" "}
                <Link href="/arbeitskreise" className="font-medium text-primary underline underline-offset-2">
                  AKs
                </Link>{" "}
                ein.
              </p>
            ) : agenda.unassigned.length === 0 ? (
              <p className="text-muted">Alles hat schon jemanden.</p>
            ) : (
              <TaskList tasks={agenda.unassigned} mode="unassigned" label="Noch niemand eingetragen" card={card} />
            )}
          </Foldable>

          <Foldable
            title={`Zuletzt erledigt (${recentlyDone.length})`}
            open={!collapsed.done}
            onToggle={() => toggleFold("done")}
          >
            {recentlyDone.length === 0 ? (
              <p className="text-muted">In den letzten 14 Tagen nichts abgehakt.</p>
            ) : (
              <TaskList tasks={recentlyDone} mode="done" label="Zuletzt erledigt" card={card} />
            )}
          </Foldable>
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
            onReach={(element) => void reach(element, true)}
            hintHidden={hintHidden.has(selected.id)}
            onHideHint={(id) => setHintHidden(new Set(hintHidden).add(id))}
          />
        ) : null}
      </div>
      {bar}
    </div>
  );
}
