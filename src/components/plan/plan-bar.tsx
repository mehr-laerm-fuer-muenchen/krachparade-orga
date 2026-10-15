"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

/** A short message at the bottom: "Verschoben · Rückgängig", a conflict or an error. */
export type PlanNotice = {
  /** New key = new message (restarts the timer). */
  key: number;
  text: string;
  tone: "info" | "error";
  undo?: () => void;
};

export type ShowNotice = (text: string, tone: PlanNotice["tone"], undo?: () => void) => void;

/**
 * The "Rückgängig" bar of a page (spec 008, shared with "/meine" in spec
 * 009): `show` puts up a new message (restarting the timer), `bar` is the
 * element to render once on the page.
 */
export function useUndoBar(): { show: ShowNotice; bar: ReactNode } {
  const [notice, setNotice] = useState<PlanNotice | null>(null);
  const noticeKey = useRef(0);
  const close = useCallback(() => setNotice(null), []);
  const show = useCallback<ShowNotice>((text, tone, undo) => {
    noticeKey.current += 1;
    setNotice({ key: noticeKey.current, text, tone, undo });
  }, []);
  return { show, bar: <PlanBar key={notice?.key} notice={notice} onClose={close} /> };
}

/** Visible for this long, unless the pointer or the focus is on the bar. */
const VISIBLE_MS = 5000;

/**
 * Bar above the tab bar (phones) or at the bottom (laptop), spec 008. Stays
 * while focused or hovered, Escape closes it. Nothing moves in it.
 */
export function PlanBar({ notice, onClose }: { notice: PlanNotice | null; onClose: () => void }) {
  const [paused, setPaused] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!notice || paused) return;
    const timer = window.setTimeout(onClose, VISIBLE_MS);
    return () => window.clearTimeout(timer);
  }, [notice, paused, onClose]);

  if (!notice) return null;
  const resume = () => {
    if (!barRef.current?.contains(document.activeElement)) setPaused(false);
  };

  return (
    <div
      ref={barRef}
      role={notice.tone === "error" ? "alert" : "status"}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          onClose();
        }
      }}
      onFocus={() => setPaused(true)}
      onBlur={() => window.setTimeout(resume, 0)}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={resume}
      className={`fixed inset-x-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-50 mx-auto flex max-w-lg items-center gap-2 rounded-md py-1 pr-1 pl-4 shadow-lg desk:bottom-6 ${
        notice.tone === "error" ? "bg-status-late text-on-status-late" : "bg-text text-bg"
      }`}
    >
      <p className="min-w-0 flex-1 py-2">{notice.text}</p>
      {notice.undo ? (
        <button
          type="button"
          onClick={() => {
            notice.undo?.();
            onClose();
          }}
          className="min-h-11 shrink-0 rounded-md px-3 font-semibold underline underline-offset-2 hover:bg-white/15"
        >
          Rückgängig
        </button>
      ) : null}
      <button
        type="button"
        onClick={onClose}
        aria-label="Hinweis schließen"
        className="flex size-11 shrink-0 items-center justify-center rounded-md text-xl leading-none hover:bg-white/15"
      >
        ×
      </button>
    </div>
  );
}
