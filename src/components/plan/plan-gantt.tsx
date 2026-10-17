"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { Status } from "@/components/status-pill";
// Relative imports for runtime code (as in src/lib/): Vitest renders this
// component and does not resolve the "@/" alias.
import { formatRelativeDay } from "../../lib/dday";
import {
  buildRows,
  elbowPath,
  formatDayMonth,
  HEADER_HEIGHT,
  monthTicks,
  rowPositions,
  timeRange,
  weekTicks,
  xOf,
  ZOOM_PX,
  type GanttElement,
  type GanttGroup,
  type GanttLink,
  type GanttRow,
  type Zoom,
} from "../../lib/gantt-layout";
import { dayToDate } from "../../lib/plan-days";
import { dragChanges, dragDays, isDrag, previewPlan, type DragMode } from "../../lib/plan-drag";
import { D_DAY_NAME } from "../../lib/plan-edit";
import type { PlanInput } from "../../lib/plan-engine";
import { formatBuffer } from "../../lib/plan-preview";
import { formatProgress, type TodoProgress } from "../../lib/todo-progress";

const NAME_WIDTH = 240;
const BAR_HEIGHT = 14;
const DIAMOND = 7;
const LANE_BAR_HEIGHT = 8;
const LATE_BAND_HEIGHT = 18;
/** To-do progress under a bar (spec 016), inside the 30 px row. */
const PROGRESS_HEIGHT = 3;
const PROGRESS_GAP = 3;
/** "Heute" sits about this far from the left edge after opening. */
const TODAY_OFFSET = 160;
/** Rough width of one character at 11 px, for label backgrounds. */
const CHAR_WIDTH = 6.2;

type LabelBox = { left: number; right: number };

/** Background of the "Heute" / "D-Day" label next to a day line at `x`. */
function dayLabelBox(x: number, label: string, side: "left" | "right"): LabelBox {
  const width = label.length * CHAR_WIDTH + 6;
  const left = side === "left" ? x - 3 - width : x + 3;
  return { left, right: left + width };
}

const overlaps = (a: LabelBox, b: LabelBox) => a.left < b.right && b.left < a.right;

/** Width of the drag handles at both ends of a task. */
const HANDLE_WIDTH = 8;

/** Escape in a form field (detail panel) does not clear the selection. */
function isFieldTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && target.closest("input, textarea, select") !== null;
}

/** Dragging (spec 008): the plan for the preview and saving on release. */
export type GanttEdit = {
  plan: PlanInput;
  /** Saves the drag; resolves once the page shows the server's result. False = failed. */
  onDrag: (id: string, mode: DragMode, delta: number) => Promise<boolean>;
};

type Drag = { id: string; mode: DragMode; delta: number };

const FILL: Record<Status, string> = {
  done: "fill-status-done",
  ok: "fill-status-ok",
  warn: "fill-status-warn",
  late: "fill-status-late",
};

export type PlanGanttProps = {
  elements: readonly GanttElement[];
  groups: readonly GanttGroup[];
  links: readonly GanttLink[];
  /** Elements the filter "Kritischer Pfad" shows (spec 025: critical or tight). */
  criticalIds: readonly string[];
  /** Today and the D-Day come from the server, never from the browser clock. */
  today: number;
  dDay: string;
  zoom: Zoom;
  /** Collapsed lane keys (working group ids, "none" for "Ohne AK"). */
  collapsed: ReadonlySet<string>;
  criticalOnly: boolean;
  openOnly: boolean;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onToggleLane: (laneKey: string) => void;
  /** Without it the Gantt is read only (as in spec 007). */
  edit?: GanttEdit;
  /** To-do progress per element id (spec 016); missing = no to-dos. */
  progress?: ReadonlyMap<string, TodoProgress>;
};

const NO_TODOS: TodoProgress = { done: 0, total: 0, complete: false };

/**
 * Read-only Gantt of the plan (spec 007): a name column with buttons on the
 * left, the time axis as SVG in its own horizontal scroll area on the right.
 * Lanes per AK, bars, milestones, buffer, too-late bands, today and D-Day.
 * The selected element shows arrows to its predecessors and successors.
 */
export function PlanGantt({
  elements,
  groups,
  links,
  criticalIds,
  today,
  dDay,
  zoom,
  collapsed,
  criticalOnly,
  openOnly,
  selectedId,
  onSelect,
  onToggleLane,
  edit,
  progress,
}: PlanGanttProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  // A press that turned into a drag must not select on the following click.
  const suppressClick = useRef(false);
  const px = ZOOM_PX[zoom];
  const range = timeRange(elements, today, dDay);
  const x = (day: number) => xOf(day, range, px);
  const width = x(range.end) + px;

  const rows = buildRows(elements, groups, { collapsed, criticalOnly, openOnly, criticalIds });
  const { positions, height: bodyHeight } = rowPositions(rows);
  const height = HEADER_HEIGHT + bodyHeight;

  // Vertical centre of every element; hidden elements point at their lane.
  const centerY = new Map<string, number>();
  const laneCenter = new Map<string, number>();
  rows.forEach((row, index) => {
    const center = HEADER_HEIGHT + positions[index].top + positions[index].height / 2;
    if (row.type === "lane") laneCenter.set(row.key, center);
    else centerY.set(row.element.id, center);
  });
  const byId = new Map(elements.map((element) => [element.id, element]));
  const laneKeyOf = (element: GanttElement) =>
    rows.find((row) => row.type === "lane" && row.groupId === element.workingGroupId)?.key ?? "none";
  const yOf = (element: GanttElement) => centerY.get(element.id) ?? laneCenter.get(laneKeyOf(element)) ?? 0;

  // Scroll so that "Heute" sits near the left edge (on opening and zooming).
  useEffect(() => {
    const scroller = scrollRef.current;
    if (scroller) scroller.scrollLeft = Math.max(0, (today - range.start) * px - TODAY_OFFSET);
  }, [today, range.start, px]);

  // Escape clears the selection.
  useEffect(() => {
    if (selectedId === null) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isFieldTarget(event.target)) onSelect(null);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [selectedId, onSelect]);

  const toggle = (id: string) => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    onSelect(selectedId === id ? null : id);
  };

  // While dragging, the browser computes a preview with the engine; the rows
  // keep their order (they come from the server values).
  const preview = useMemo(
    () =>
      drag && edit && drag.delta !== 0
        ? previewPlan(edit.plan, dragChanges(edit.plan, drag.id, drag.mode, drag.delta, today), today)
        : null,
    [drag, edit, today]
  );
  const shown = (element: GanttElement): GanttElement => {
    const values = preview?.get(element.id);
    return values ? { ...element, ...values } : element;
  };

  /** Mouse and pen only (no dragging on touch screens); saves on release. */
  const startDrag = (event: ReactPointerEvent, id: string, mode: DragMode) => {
    if (!edit || event.button !== 0 || event.pointerType === "touch") return;
    event.preventDefault();
    const startX = event.clientX;
    const startY = event.clientY;
    let current: Drag | null = null;
    const onMove = (move: PointerEvent) => {
      const dx = move.clientX - startX;
      if (current === null && !isDrag(dx, move.clientY - startY)) return;
      current = { id, mode, delta: dragDays(dx, px) };
      setDrag(current);
    };
    const onUp = async () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      if (current === null) return;
      suppressClick.current = true;
      // Clicks on a handle are not followed by a click on the element.
      window.setTimeout(() => (suppressClick.current = false), 0);
      if (current.delta !== 0) await edit.onDrag(id, mode, current.delta);
      setDrag(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  const selectedRaw = selectedId === null ? undefined : byId.get(selectedId);
  const selected = selectedRaw ? shown(selectedRaw) : undefined;

  const months = monthTicks(range, dDay);
  const weeks = weekTicks(range, dDay);
  // Calendar week labels that would sit under the "Heute" or "D-Day" label are left out.
  const dayLabels = [dayLabelBox(x(today), "Heute", "left"), dayLabelBox(x(0), D_DAY_NAME, "right")];
  const weekLabelFree = (day: number, label: string) => {
    const box = { left: x(day) + 3, right: x(day) + 3 + label.length * CHAR_WIDTH };
    return !dayLabels.some((dayLabel) => overlaps(box, dayLabel));
  };

  return (
    <div className="flex overflow-hidden rounded-md border border-line bg-surface">
      <div className="shrink-0 border-r border-line" style={{ width: NAME_WIDTH }}>
        <div
          className="flex items-end border-b border-line px-3 pb-1 text-xs text-muted"
          style={{ height: HEADER_HEIGHT }}
        >
          AK / Element
        </div>
        {rows.map((row, index) => (
          <NameRow
            key={row.key}
            row={row}
            height={positions[index].height}
            dDay={dDay}
            selected={row.type === "element" && row.element.id === selectedId}
            onSelect={toggle}
            onToggleLane={onToggleLane}
          />
        ))}
      </div>

      <div ref={scrollRef} className="min-w-0 flex-1 overflow-x-auto">
        <svg
          role="img"
          aria-label="Gantt-Plan"
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          className={`block text-[11px] select-none ${
            drag ? (drag.mode === "move" ? "cursor-grabbing" : "cursor-ew-resize") : ""
          }`}
        >
          <defs>
            <marker id="gantt-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="8" markerHeight="8" orient="auto">
              <path d="M0,0 L8,4 L0,8 z" className="fill-accent" />
            </marker>
          </defs>

          {/* Lane backgrounds and row lines. */}
          {rows.map((row, index) =>
            row.type === "lane" ? (
              <rect
                key={row.key}
                x={0}
                y={HEADER_HEIGHT + positions[index].top}
                width={width}
                height={positions[index].height}
                className="fill-gantt-lane"
              />
            ) : null
          )}

          {/* Grid: firsts of the month, Mondays from zoom "Monat" on. */}
          {zoom !== "quarter"
            ? weeks.map((tick) => (
                <line
                  key={`w${tick.day}`}
                  x1={x(tick.day)}
                  x2={x(tick.day)}
                  y1={HEADER_HEIGHT / 2}
                  y2={height}
                  strokeDasharray="2 3"
                  className="stroke-line"
                />
              ))
            : null}
          {months.map((tick) => (
            <line key={`m${tick.day}`} x1={x(tick.day)} x2={x(tick.day)} y1={0} y2={height} className="stroke-line" />
          ))}

          {/* Header: months above, calendar weeks below. */}
          <line x1={0} x2={width} y1={HEADER_HEIGHT} y2={HEADER_HEIGHT} className="stroke-line" />
          {months.map((tick) => (
            <text key={`ml${tick.day}`} x={x(tick.day) + 4} y={14} className="fill-text font-semibold">
              {tick.label}
            </text>
          ))}
          {weeks.map((tick, index) =>
            (zoom === "week" || index % 2 === 0) && weekLabelFree(tick.day, tick.label) ? (
              <text key={`wl${tick.day}`} x={x(tick.day) + 3} y={33} className="fill-muted">
                {tick.label}
              </text>
            ) : null
          )}

          {/* Rows: collective bars and elements. */}
          {rows.map((row, index) => {
            const center = HEADER_HEIGHT + positions[index].top + positions[index].height / 2;
            if (row.type === "lane") {
              if (!row.summary) return null;
              const left = x(row.summary.start);
              return (
                <rect
                  key={row.key}
                  data-testid="gantt-lane-bar"
                  x={left}
                  y={center - LANE_BAR_HEIGHT / 2}
                  width={Math.max(LANE_BAR_HEIGHT, x(row.summary.end) - left)}
                  height={LANE_BAR_HEIGHT}
                  rx={LANE_BAR_HEIGHT / 2}
                  className={FILL[row.summary.status]}
                />
              );
            }
            return (
              <ElementMark
                key={row.key}
                element={shown(row.element)}
                center={center}
                x={x}
                dDay={dDay}
                selected={row.element.id === selectedId}
                onSelect={toggle}
                onDragStart={edit ? startDrag : undefined}
                dragging={drag !== null}
                progress={progress?.get(row.element.id) ?? NO_TODOS}
              />
            );
          })}

          {/* Today and D-Day over the whole height, labels with a background. */}
          <DayLine x={x(today)} height={height} label="Heute" side="left" className="stroke-accent" strokeWidth={2} />
          <DayLine x={x(0)} height={height} label={D_DAY_NAME} side="right" className="stroke-primary" dashed />

          {/* Dependencies of the selected element. */}
          {selected ? (
            <g data-testid="gantt-arrows" className="pointer-events-none">
              {links.map((link, index) => {
                let from: GanttElement | undefined;
                let to: GanttElement | undefined;
                const get = (id: string) => {
                  const element = byId.get(id);
                  return element ? shown(element) : undefined;
                };
                if (link.toId === selected.id) {
                  from = get(link.fromId);
                  to = selected;
                } else if (link.fromId === selected.id) {
                  from = selected;
                  to = link.toId === null ? undefined : get(link.toId);
                  if (link.toId === null) {
                    const y = yOf(selected);
                    return <Arrow key={index} d={elbowPath(endX(selected, x), y, x(0), y)} />;
                  }
                } else {
                  return null;
                }
                if (!from || !to) return null;
                return <Arrow key={index} d={elbowPath(endX(from, x), yOf(from), startX(to, x), yOf(to))} />;
              })}
            </g>
          ) : null}
        </svg>
      </div>
    </div>
  );
}

/** Right edge of a bar or diamond. */
function endX(element: GanttElement, x: (day: number) => number): number {
  return element.kind === "milestone" ? x(element.start) + DIAMOND : x(element.end);
}

/** Left edge of a bar or diamond. */
function startX(element: GanttElement, x: (day: number) => number): number {
  return element.kind === "milestone" ? x(element.start) - DIAMOND : x(element.start);
}

function Arrow({ d }: { d: string }) {
  return <path d={d} fill="none" strokeWidth={1.5} markerEnd="url(#gantt-arrow)" className="stroke-accent" />;
}

function DayLine({
  x,
  height,
  label,
  side,
  className,
  strokeWidth = 1.5,
  dashed = false,
}: {
  x: number;
  height: number;
  label: string;
  side: "left" | "right";
  className: string;
  strokeWidth?: number;
  dashed?: boolean;
}) {
  const box = dayLabelBox(x, label, side);
  const labelX = box.left;
  const labelWidth = box.right - box.left;
  return (
    <g className="pointer-events-none">
      <line
        x1={x}
        x2={x}
        y1={HEADER_HEIGHT / 2}
        y2={height}
        strokeWidth={strokeWidth}
        strokeDasharray={dashed ? "5 4" : undefined}
        className={className}
      />
      <rect x={labelX} y={22} width={labelWidth} height={15} rx={2} className="fill-surface" />
      <text x={labelX + 3} y={33} className="fill-text font-semibold">
        {label}
      </text>
    </g>
  );
}

function ElementMark({
  element,
  center,
  x,
  dDay,
  selected,
  onSelect,
  onDragStart,
  dragging,
  progress,
}: {
  element: GanttElement;
  /** To-dos done and in total; total 0 = nothing shown (spec 016). */
  progress: TodoProgress;
  center: number;
  x: (day: number) => number;
  dDay: string;
  selected: boolean;
  onSelect: (id: string) => void;
  /** Only when editable (spec 008). */
  onDragStart?: (event: ReactPointerEvent, id: string, mode: DragMode) => void;
  dragging: boolean;
}) {
  const open = !element.done;
  const milestone = element.kind === "milestone";
  const left = x(element.start);
  const barWidth = Math.max(3, x(element.end) - left);
  const markEnd = milestone ? left + DIAMOND : left + barWidth;
  const showBuffer = open && element.buffer > 0;
  const showLate = open && element.buffer < 0;
  const labelX = Math.max(markEnd, showBuffer ? x(element.latestEnd) : 0) + 6;
  const outline = element.fixed
    ? "stroke-text stroke-2"
    : element.status === "ok"
      ? "stroke-on-status-ok stroke-1"
      : "";
  const dates = milestone
    ? formatDayMonth(element.start, dDay)
    : `${formatDayMonth(element.start, dDay)}–${formatDayMonth(element.end, dDay)}`;
  const diamond = (half: number) =>
    `${left},${center - half} ${left + half},${center} ${left},${center + half} ${left - half},${center}`;

  return (
    <g
      data-testid="gantt-element"
      data-element-id={element.id}
      data-element-name={element.name}
      className={`group ${onDragStart ? (dragging ? "" : "cursor-grab") : "cursor-pointer"}`}
      onClick={() => onSelect(element.id)}
      onPointerDown={onDragStart ? (event) => onDragStart(event, element.id, "move") : undefined}
    >
      {showLate ? (
        <rect
          x={x(element.latestEnd)}
          y={center - LATE_BAND_HEIGHT / 2}
          width={x(element.end) - x(element.latestEnd)}
          height={LATE_BAND_HEIGHT}
          className="fill-gantt-late"
        />
      ) : null}
      {showBuffer ? (
        <line
          x1={milestone ? left : x(element.end)}
          x2={x(element.latestEnd)}
          y1={center}
          y2={center}
          strokeWidth={3}
          className="stroke-gantt-buffer"
        />
      ) : null}
      {milestone ? (
        <polygon data-testid="gantt-mark" points={diamond(DIAMOND)} className={`${FILL[element.status]} ${outline}`} />
      ) : (
        <rect
          data-testid="gantt-mark"
          x={left}
          y={center - BAR_HEIGHT / 2}
          width={barWidth}
          height={BAR_HEIGHT}
          rx={3}
          className={`${FILL[element.status]} ${outline}`}
        />
      )}
      {!milestone && progress.total > 0 ? (
        <g data-testid="gantt-progress" data-done={progress.done} data-total={progress.total}>
          <rect
            x={left}
            y={center + BAR_HEIGHT / 2 + PROGRESS_GAP}
            width={barWidth}
            height={PROGRESS_HEIGHT}
            rx={PROGRESS_HEIGHT / 2}
            className="fill-progress-track"
          />
          {progress.done > 0 ? (
            <rect
              x={left}
              y={center + BAR_HEIGHT / 2 + PROGRESS_GAP}
              width={(barWidth * progress.done) / progress.total}
              height={PROGRESS_HEIGHT}
              rx={PROGRESS_HEIGHT / 2}
              className="fill-progress-fill"
            />
          ) : null}
        </g>
      ) : null}
      {selected ? (
        milestone ? (
          <polygon points={diamond(DIAMOND + 4)} fill="none" strokeWidth={2} className="stroke-accent" />
        ) : (
          <rect
            x={left - 3}
            y={center - BAR_HEIGHT / 2 - 3}
            width={barWidth + 6}
            height={BAR_HEIGHT + 6}
            rx={5}
            fill="none"
            strokeWidth={2}
            className="stroke-accent"
          />
        )
      ) : null}
      {onDragStart && !milestone
        ? (["start", "end"] as const).map((edge) => (
            <rect
              key={edge}
              data-testid={`gantt-handle-${edge}`}
              x={(edge === "start" ? left : left + barWidth) - HANDLE_WIDTH / 2}
              y={center - BAR_HEIGHT / 2 - 2}
              width={HANDLE_WIDTH}
              height={BAR_HEIGHT + 4}
              rx={2}
              className={`fill-text opacity-0 group-hover:opacity-50 ${dragging ? "" : "cursor-ew-resize"}`}
              onPointerDown={(event) => {
                event.stopPropagation();
                onDragStart(event, element.id, edge);
              }}
            />
          ))
        : null}
      <text x={labelX} y={center + 4} className="fill-text">
        {dates}
        {progress.total > 0 ? (
          <>
            {" · "}
            <tspan
              data-testid="gantt-progress-text"
              className={`tabular-nums ${progress.complete ? "fill-progress-fill font-semibold" : ""}`}
            >
              {formatProgress(progress)}
            </tspan>
          </>
        ) : null}
        {open && element.buffer !== 0 ? (
          <>
            {" · "}
            <tspan className={element.buffer < 0 ? "fill-status-late font-semibold" : undefined}>
              {formatBuffer(element.buffer)}
            </tspan>
          </>
        ) : null}
      </text>
    </g>
  );
}

function NameRow({
  row,
  height,
  dDay,
  selected,
  onSelect,
  onToggleLane,
}: {
  row: GanttRow;
  height: number;
  dDay: string;
  selected: boolean;
  onSelect: (id: string) => void;
  onToggleLane: (laneKey: string) => void;
}) {
  const focus = "focus-visible:outline-offset-[-2px]";
  if (row.type === "lane") {
    return (
      <button
        type="button"
        aria-expanded={!row.collapsed}
        onClick={() => onToggleLane(row.key)}
        className={`flex w-full items-center gap-1.5 bg-gantt-lane px-2 text-left font-semibold ${focus}`}
        style={{ height }}
      >
        <svg
          aria-hidden
          viewBox="0 0 16 16"
          className={`size-4 shrink-0 text-muted transition-transform motion-reduce:transition-none ${
            row.collapsed ? "-rotate-90" : ""
          }`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 6l4 4 4-4" />
        </svg>
        <span className="min-w-0 flex-1 truncate">{row.name}</span>
        <span className="shrink-0 text-xs font-normal text-muted tabular-nums">
          {row.visibleCount}/{row.totalCount}
        </span>
      </button>
    );
  }

  const { element } = row;
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => onSelect(element.id)}
      className={`flex w-full items-center gap-1.5 border-b border-line/60 pr-2 pl-6 text-left ${focus} ${
        selected ? "bg-surface-2 shadow-[inset_3px_0_0_var(--accent)]" : "hover:bg-surface-2"
      }`}
      style={{ height }}
    >
      <span className="min-w-0 flex-1 truncate" title={element.name}>
        {element.name}
      </span>
      {element.fixed ? (
        <span className="shrink-0 rounded-full border border-line-strong px-1.5 text-[11px] leading-4 font-semibold">
          Fix
        </span>
      ) : null}
      <span className="shrink-0 text-xs text-muted tabular-nums">
        {formatRelativeDay(dayToDate(element.start, dDay), dDay)}
      </span>
    </button>
  );
}
