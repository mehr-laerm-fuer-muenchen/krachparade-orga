"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
// Relative imports: the Gantt (rendered by Vitest) uses this component.
import { formatCountdown } from "../../lib/dday";
import { dayToDate } from "../../lib/plan-days";
import { dayDateLabel } from "./date-label";

/** Numbers of the day plan for the links in the plan (spec 030). */
export type DayPlanCounts = { entries: number; roles: number };

const LINK = "inline-flex min-h-11 items-center font-semibold text-primary underline underline-offset-2";

/** "Ablauf am Tag ansehen ›" (week list, spec 030). */
export function DayPlanLink({ className = "" }: { className?: string }) {
  return (
    <Link href="/krachparade" className={`${LINK} ${className}`}>
      Ablauf am Tag ansehen ›
    </Link>
  );
}

/**
 * Button over the Krachparade label of the Gantt (spec 030) with a small
 * window: date, countdown, link to the day plan, number of entries and roles.
 * "Today" comes from the server as a day relative to the D-Day.
 */
export function DayPlanPopover({
  left,
  width,
  dDay,
  today,
  counts,
}: {
  left: number;
  width: number;
  dDay: string;
  today: number;
  counts: DayPlanCounts;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  const countdown = formatCountdown(dayToDate(today, dDay), dDay);
  return (
    <div ref={boxRef} className="absolute top-0 z-20" style={{ left }}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-label="Krachparade: Ablauf am Tag"
        onClick={() => setOpen(!open)}
        className="block h-11 cursor-pointer rounded-sm hover:bg-primary/10"
        style={{ width: Math.max(width, 44) }}
      />
      {open ? (
        <div
          id={id}
          role="dialog"
          aria-label="Krachparade"
          className="absolute top-11 right-0 flex w-64 flex-col gap-1 rounded-md border border-line-strong bg-surface p-3 text-sm shadow-lg"
        >
          <p className="font-semibold">Krachparade · {dayDateLabel(dDay)}</p>
          <p className="text-muted">
            <span aria-label={countdown.ariaLabel}>{countdown.label}</span>
          </p>
          <Link href="/krachparade" className={LINK}>
            Ablauf am Tag ansehen ›
          </Link>
          <p className="text-muted">
            {counts.entries} {counts.entries === 1 ? "Eintrag" : "Einträge"} · {counts.roles}{" "}
            {counts.roles === 1 ? "Rolle" : "Rollen"}
          </p>
        </div>
      ) : null}
    </div>
  );
}
