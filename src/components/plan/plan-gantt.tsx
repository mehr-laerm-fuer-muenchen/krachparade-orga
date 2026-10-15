"use client";

import { useEffect, useRef } from "react";
import type { Status } from "@/components/status-pill";
// Relative imports for runtime code (as in src/lib/): Vitest renders this
// component and does not resolve the "@/" alias.
import { formatDLabel } from "../../lib/dday";
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
import { formatBuffer } from "../../lib/plan-preview";

const NAME_WIDTH = 240;
const BAR_HEIGHT = 14;
const DIAMOND = 7;
const LANE_BAR_HEIGHT = 8;
const LATE_BAND_HEIGHT = 18;
/** "Heute" sits about this far from the left edge after opening. */
const TODAY_OFFSET = 160;
/** Rough width of one character at 11 px, for label backgrounds. */
const CHAR_WIDTH = 6.2;

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
  criticalPath: readonly string[];
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
};

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
  criticalPath,
  today,
  dDay,
  zoom,
  collapsed,
  criticalOnly,
  openOnly,
  selectedId,
  onSelect,
  onToggleLane,
}: PlanGanttProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const px = ZOOM_PX[zoom];
  const range = timeRange(elements, today, dDay);
  const x = (day: number) => xOf(day, range, px);
  const width = x(range.end) + px;

  const rows = buildRows(elements, groups, { collapsed, criticalOnly, openOnly, criticalPath });
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
      if (event.key === "Escape") onSelect(null);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [selectedId, onSelect]);

  const toggle = (id: string) => onSelect(selectedId === id ? null : id);
  const selected = selectedId === null ? undefined : byId.get(selectedId);

  const months = monthTicks(range, dDay);
  const weeks = weekTicks(range, dDay);

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
          className="block text-[11px]"
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
            zoom === "week" || index % 2 === 0 ? (
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
                element={row.element}
                center={center}
                x={x}
                dDay={dDay}
                selected={row.element.id === selectedId}
                onSelect={toggle}
              />
            );
          })}

          {/* Today and D-Day over the whole height, labels with a background. */}
          <DayLine x={x(today)} height={height} label="Heute" side="left" className="stroke-accent" strokeWidth={2} />
          <DayLine x={x(0)} height={height} label="D-Day" side="right" className="stroke-primary" dashed />

          {/* Dependencies of the selected element. */}
          {selected ? (
            <g data-testid="gantt-arrows" className="pointer-events-none">
              {links.map((link, index) => {
                let from: GanttElement | undefined;
                let to: GanttElement | undefined;
                if (link.toId === selected.id) {
                  from = byId.get(link.fromId);
                  to = selected;
                } else if (link.fromId === selected.id) {
                  from = selected;
                  to = link.toId === null ? undefined : byId.get(link.toId);
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
  const labelWidth = label.length * CHAR_WIDTH + 6;
  const labelX = side === "left" ? x - 3 - labelWidth : x + 3;
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
}: {
  element: GanttElement;
  center: number;
  x: (day: number) => number;
  dDay: string;
  selected: boolean;
  onSelect: (id: string) => void;
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
      className="cursor-pointer"
      onClick={() => onSelect(element.id)}
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
        <polygon points={diamond(DIAMOND)} className={`${FILL[element.status]} ${outline}`} />
      ) : (
        <rect
          x={left}
          y={center - BAR_HEIGHT / 2}
          width={barWidth}
          height={BAR_HEIGHT}
          rx={3}
          className={`${FILL[element.status]} ${outline}`}
        />
      )}
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
      <text x={labelX} y={center + 4} className="fill-text">
        {dates}
        {open ? (
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
        {formatDLabel(dayToDate(element.start, dDay), dDay)}
      </span>
    </button>
  );
}
