"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { useScrollLock } from "@/components/use-scroll-lock";

/** Below this width the panel is a sheet from the bottom (as the day plan switches to the list). */
const SHEET_QUERY = "(max-width: 1023px)";

function subscribe(onChange: () => void) {
  const query = window.matchMedia(SHEET_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** True on narrow screens; false on the server, the browser value applies after hydration. */
export function useIsSheet(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(SHEET_QUERY).matches,
    () => false
  );
}

/**
 * Panel next to the content on laptops, sheet from the bottom on phones
 * (spec 030, like the plan's detail panel). The head stays, only the body
 * scrolls; on phones the page behind it does not scroll. Escape closes it,
 * except in form fields.
 */
export function DayPanel({
  label,
  head,
  onClose,
  children,
}: {
  label: string;
  head: ReactNode;
  onClose: () => void;
  children: ReactNode;
}) {
  const sheet = useIsSheet();
  useScrollLock(sheet);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      const inField = target instanceof HTMLElement && target.closest("input, textarea, select") !== null;
      if (event.key === "Escape" && !inField) onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <>
      <div aria-hidden onClick={onClose} className="fixed inset-0 z-30 bg-black/50 lg:hidden" />
      <aside
        aria-label={label}
        className="fixed inset-x-0 bottom-0 z-40 flex max-h-[85dvh] flex-col rounded-t-xl border-t border-line bg-surface shadow-[0_-8px_24px_rgb(0_0_0/0.2)] lg:sticky lg:top-4 lg:z-auto lg:max-h-[calc(100dvh-2rem)] lg:w-[380px] lg:shrink-0 lg:self-start lg:rounded-md lg:border lg:shadow-none"
      >
        <div className="flex items-start gap-2 border-b border-line py-2 pr-1 pl-4">
          <div className="flex min-w-0 flex-1 flex-col gap-1 pt-1.5">{head}</div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Schließen"
            className="flex size-11 shrink-0 items-center justify-center rounded-md text-2xl leading-none text-muted hover:bg-surface-2 hover:text-text"
          >
            ×
          </button>
        </div>
        <div className="flex flex-col gap-4 overflow-y-auto overscroll-contain px-4 pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          {children}
        </div>
      </aside>
    </>
  );
}

/** "Nur Namen – keine Telefonnummern oder Adressen." under fields with people (spec 030). */
export function NamesOnlyHint() {
  return <p className="text-sm text-muted">Nur Namen – keine Telefonnummern oder Adressen.</p>;
}
