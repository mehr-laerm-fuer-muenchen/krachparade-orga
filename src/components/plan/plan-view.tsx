"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { PageTitle } from "@/components/placeholder";
import {
  NO_GROUP_KEY,
  type GanttGroup,
  type PlanViewElement,
  type PlanViewLink,
  type Zoom,
} from "@/lib/gantt-layout";
import { D_DAY_NAME } from "@/lib/plan-edit";
import type { PlanCounts, PlanInput } from "@/lib/plan-engine";
import { defaultGroupId } from "@/lib/plan-panel";
import { countLate } from "@/lib/plan-preview";
import { todoProgress } from "@/lib/todo-progress";
import { useUndoBar } from "./plan-bar";
import { PlanDetail, type PlanDepartmentOption, type PlanOption } from "./plan-detail";
import { PlanGantt, type GanttEdit } from "./plan-gantt";
import { PlanNewElement } from "./plan-new-element";
import { PlanWeekList } from "./plan-week-list";
import { PIN_PATH } from "./pin-icon";
import { usePlanActions } from "./use-plan-actions";
import { usePlanTicks } from "./use-plan-ticks";

/** Everything the plan page needs, computed on the server. */
export type PlanViewData = {
  title: string;
  dDay: string;
  /** Today in Europe/Berlin as a day relative to the D-Day (from the server). */
  today: number;
  elements: PlanViewElement[];
  groups: GanttGroup[];
  links: PlanViewLink[];
  /** Spec 025: critical and tight elements, late and warn. */
  counts: PlanCounts;
  myGroupIds: string[];
  /** Choices of the detail panel (spec 008); active members only, names only. */
  departments: PlanDepartmentOption[];
  members: PlanOption[];
};

type View = "gantt" | "list";

const VIEW_KEY = "kp-plan-view";
const ZOOM_KEY = "kp-plan-zoom";
const COLLAPSED_KEY = "kp-plan-collapsed";
/** Spec 026: time window bands on ("1", default) or off ("0"). */
const WINDOWS_KEY = "kp-plan-windows";

const ZOOMS: { value: Zoom; label: string }[] = [
  { value: "quarter", label: "Quartal" },
  { value: "month", label: "Monat" },
  { value: "week", label: "Woche" },
];

// View preferences per device. Storage can be missing or blocked, so every
// access is wrapped and the defaults apply.
function readStored(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Not remembered on this device.
  }
}

function readCollapsed(): string[] {
  try {
    const parsed: unknown = JSON.parse(readStored(COLLAPSED_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

const BUTTON = "min-h-11 px-3 font-medium";
const PRESSABLE = `${BUTTON} aria-pressed:bg-primary aria-pressed:text-on-primary not-aria-pressed:hover:bg-surface-2`;
const SEGMENTS = "flex overflow-hidden rounded-md border border-line bg-surface [&>*+*]:border-l [&>*+*]:border-line";

function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  className = "",
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div role="group" aria-label={label} className={`${SEGMENTS} ${className}`}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
          className={PRESSABLE}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function FilterButton({
  pressed,
  onClick,
  children,
  className = "",
}: {
  pressed: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`${PRESSABLE} rounded-md border border-line bg-surface aria-pressed:border-primary ${className}`}
    >
      {children}
    </button>
  );
}

function LegendItem({ children, label }: { children: ReactNode; label: string }) {
  return (
    <li className="flex items-center gap-1.5">
      <svg aria-hidden viewBox="0 0 18 12" className="h-3 w-[18px] shrink-0">
        {children}
      </svg>
      {label}
    </li>
  );
}

/** Legend for the model of spec 026; wraps on phones, never scrolls sideways. */
function Legend() {
  return (
    <ul aria-label="Legende" className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
      <LegendItem label="Zeitfenster">
        <rect x="0.5" y="1.5" width="17" height="9" rx="2" strokeDasharray="3 2" className="fill-window stroke-window-edge" />
      </LegendItem>
      <LegendItem label="On track">
        <rect x="1.5" y="2.5" width="15" height="7" rx="2" className="fill-status-ok stroke-on-status-ok" />
      </LegendItem>
      <LegendItem label="Erreicht">
        <rect x="1" y="2" width="16" height="8" rx="2" className="fill-status-done" />
      </LegendItem>
      <LegendItem label="Wackelt / Zu früh">
        <rect x="1" y="2" width="16" height="8" rx="2" className="fill-status-warn" />
      </LegendItem>
      <LegendItem label="Verzug">
        <rect x="1" y="2" width="16" height="8" rx="2" className="fill-status-late" />
      </LegendItem>
      <LegendItem label="fest">
        <path d={PIN_PATH} transform="translate(4 0)" fill="currentColor" fillRule="evenodd" className="text-text" />
      </LegendItem>
      <LegendItem label="kritisch">
        <rect x="2" y="2" width="14" height="8" rx="2" strokeWidth="2" className="fill-surface stroke-accent" />
      </LegendItem>
      <LegendItem label="knapp">
        <rect
          x="2"
          y="2"
          width="14"
          height="8"
          rx="2"
          strokeWidth="2"
          strokeDasharray="3 2"
          className="fill-surface stroke-accent"
        />
      </LegendItem>
      <LegendItem label="Heute">
        <line x1="9" x2="9" y1="0" y2="12" strokeWidth="2" className="stroke-accent" />
      </LegendItem>
      <LegendItem label={D_DAY_NAME}>
        <line x1="9" x2="9" y1="0" y2="12" strokeWidth="1.5" strokeDasharray="3 2" className="stroke-primary" />
      </LegendItem>
    </ul>
  );
}

/**
 * The plan of the current edition (spec 007, editable from spec 008): Gantt
 * on wide screens, the week list on phones (and on request), details of the
 * selected element. Shows the result from the server; only while dragging
 * the browser computes a preview with the same engine.
 */
export function PlanView({ data }: { data: PlanViewData }) {
  const { elements, groups, links, counts, today, dDay } = data;
  const [view, setView] = useState<View>("gantt");
  const [zoom, setZoom] = useState<Zoom>("month");
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set());
  const [criticalOnly, setCriticalOnly] = useState(false);
  const [openOnly, setOpenOnly] = useState(false);
  const [windows, setWindows] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const { show, bar } = useUndoBar();

  // The first render uses the defaults (same as on the server); the stored
  // preferences of this device apply right after.
  useEffect(() => {
    const storedView = readStored(VIEW_KEY);
    const storedZoom = readStored(ZOOM_KEY);
    const storedCollapsed = readCollapsed();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only storage after hydration
    if (storedView === "gantt" || storedView === "list") setView(storedView);
    if (storedZoom === "quarter" || storedZoom === "month" || storedZoom === "week") setZoom(storedZoom);
    if (storedCollapsed.length > 0) setCollapsed(new Set(storedCollapsed));
    if (readStored(WINDOWS_KEY) === "0") setWindows(false);
  }, []);

  const byId = useMemo(() => new Map(elements.map((element) => [element.id, element])), [elements]);
  const laneKeys = useMemo(() => {
    const known = new Set(groups.map((group) => group.id));
    const keys = groups.map((group) => group.id);
    if (elements.some((element) => element.workingGroupId === null || !known.has(element.workingGroupId))) {
      keys.push(NO_GROUP_KEY);
    }
    return keys;
  }, [elements, groups]);
  const allCollapsed = laneKeys.length > 0 && laneKeys.every((key) => collapsed.has(key));

  const changeView = (next: View) => {
    setView(next);
    writeStored(VIEW_KEY, next);
  };
  const changeZoom = (next: Zoom) => {
    setZoom(next);
    writeStored(ZOOM_KEY, next);
  };
  const toggleWindows = () => {
    setWindows(!windows);
    writeStored(WINDOWS_KEY, windows ? "0" : "1");
  };
  const changeCollapsed = (next: Set<string>) => {
    setCollapsed(next);
    writeStored(COLLAPSED_KEY, JSON.stringify([...next]));
  };
  const toggleLane = (key: string) => {
    const next = new Set(collapsed);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    changeCollapsed(next);
  };

  const close = useCallback(() => setSelectedId(null), []);
  const closeForm = useCallback(() => setCreating(false), []);
  const { run, drag } = usePlanActions(byId, show);
  const ticks = usePlanTicks(byId, show);
  /** Elements whose "Als erreicht markieren?" hint was put off in the panel during this visit (spec 016). */
  const [hintHidden, setHintHidden] = useState<ReadonlySet<string>>(() => new Set());

  const enginePlan = useMemo<PlanInput>(
    () => ({
      elements: elements.map((element) => ({
        id: element.id,
        name: element.name,
        kind: element.kind,
        durationDays: element.durationDays,
        placement: element.placement,
        fixedDay: element.fixedDay,
        fixedOffsetDays: element.fixedOffsetDays,
        freeStartDay: element.freeStartDay,
        done: element.done,
        doneDay: element.doneDay,
        wobbly: element.wobbly,
        sortOrder: element.sortOrder,
      })),
      links,
    }),
    [elements, links]
  );
  const ganttEdit = useMemo<GanttEdit>(() => ({ plan: enginePlan, onDrag: drag }), [enginePlan, drag]);
  const progress = useMemo(
    () => new Map(elements.map((element) => [element.id, todoProgress(element.todos)])),
    [elements]
  );

  // The filters apply to the week list as well. "Kritisch & knapp" (spec 025)
  // shows critical or tight elements.
  const criticalIds = useMemo(
    () => elements.filter((element) => element.critical || element.tight).map((element) => element.id),
    [elements]
  );
  const critical = new Set(criticalIds);
  const listElements = elements.filter(
    (element) => (!criticalOnly || critical.has(element.id)) && (!openOnly || !element.done)
  );

  const late = countLate(elements);
  const selected = selectedId === null ? undefined : byId.get(selectedId);
  const gantt = view === "gantt";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <PageTitle>{data.title}</PageTitle>
        <p className="text-muted">
          Rückwärts gerechnet ab der {D_DAY_NAME} · {elements.length} Elemente · {late} in Verzug
          {criticalOnly
            ? counts.critical === 0 && counts.tight === 0
              ? " · nichts kritisch"
              : ` · ${counts.critical} kritisch · ${counts.tight} knapp`
            : null}
        </p>
      </div>

      <div role="toolbar" aria-label="Ansicht und Filter" className="flex flex-wrap items-center gap-2">
        <Segmented
          label="Ansicht"
          options={[
            { value: "gantt", label: "Gantt" },
            { value: "list", label: "Liste" },
          ]}
          value={view}
          onChange={changeView}
          className="hidden desk:flex"
        />
        <FilterButton pressed={criticalOnly} onClick={() => setCriticalOnly(!criticalOnly)}>
          Kritisch &amp; knapp
        </FilterButton>
        <FilterButton pressed={openOnly} onClick={() => setOpenOnly(!openOnly)}>
          Nur offene
        </FilterButton>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className={`${BUTTON} hidden rounded-md bg-primary font-semibold text-on-primary hover:opacity-90 desk:block`}
        >
          + Element
        </button>
        {gantt ? (
          <>
            <FilterButton pressed={windows} onClick={toggleWindows} className="hidden desk:block">
              Fenster
            </FilterButton>
            <Segmented label="Zoom" options={ZOOMS} value={zoom} onChange={changeZoom} className="hidden desk:flex" />
            <button
              type="button"
              onClick={() => changeCollapsed(allCollapsed ? new Set() : new Set(laneKeys))}
              className={`${BUTTON} hidden rounded-md border border-line bg-surface hover:bg-surface-2 desk:block`}
            >
              {allCollapsed ? "Alle AKs auf" : "Alle AKs zu"}
            </button>
          </>
        ) : null}
      </div>
      <Legend />

      <div className="flex items-start gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          {criticalOnly ? (
            <div data-testid="critical-explanation" className="rounded-md border border-line bg-surface-2 px-3 py-2 text-sm">
              <p>
                <strong>Kritisch</strong> heißt keine Luft: Das Fenster ist nicht größer als das Element selbst. Wird es
                später fertig, ist etwas danach zu spät. <strong>Knapp</strong> heißt höchstens 7 Tage Luft.
              </p>
              {counts.critical === 0 && counts.tight === 0 ? (
                <p className="mt-1">
                  Gerade hat alles noch Luft. Mit jedem Tag rückt „frühestens“ näher, die Fenster schrumpfen.
                </p>
              ) : null}
            </div>
          ) : null}
          {gantt ? (
            <div className="hidden flex-col gap-3 desk:flex">
              <PlanGantt
                elements={elements}
                groups={groups}
                links={links}
                criticalIds={criticalIds}
                today={today}
                dDay={dDay}
                zoom={zoom}
                collapsed={collapsed}
                criticalOnly={criticalOnly}
                openOnly={openOnly}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onToggleLane={toggleLane}
                edit={ganttEdit}
                progress={progress}
                windows={windows}
              />
              <p className="text-sm text-muted">
                Antippen zeigt Abhängigkeiten und Details. Ziehen legt den Termin selbst fest (Lage „Frei im
                Fenster“); bei festen Terminen ändert es die Tage vor der {D_DAY_NAME}.
              </p>
            </div>
          ) : null}
          <div className={`flex flex-col gap-3 ${gantt ? "desk:hidden" : ""}`}>
            <PlanWeekList
              elements={listElements}
              today={today}
              dDay={dDay}
              myGroupIds={data.myGroupIds}
              onSelect={setSelectedId}
              onCreate={() => setCreating(true)}
              ticks={ticks}
            />
            <p className="text-sm text-muted desk:hidden">Antippen öffnet Details und Lage.</p>
          </div>
        </div>
        {selected ? (
          <PlanDetail
            key={selected.id}
            element={selected}
            elements={byId}
            links={links}
            groups={groups}
            departments={data.departments}
            members={data.members}
            today={today}
            dDay={dDay}
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

      {creating ? (
        <PlanNewElement
          groups={groups}
          elements={elements}
          defaultGroupId={defaultGroupId(
            [...groups].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "de")),
            selected?.workingGroupId,
            data.myGroupIds
          )}
          onCreated={(id) => {
            setCreating(false);
            setSelectedId(id);
          }}
          onClose={closeForm}
        />
      ) : null}
      {bar}
    </div>
  );
}
