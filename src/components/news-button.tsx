"use client";

import { useEffect, useId, useRef, useState, type MouseEvent } from "react";
import { useScrollLock } from "@/components/use-scroll-lock";
import { NEWS } from "@/lib/news/entries";
import { NEWS_SEEN_KEY, formatNewsDate, hasUnread, latestNewsId } from "@/lib/news/news";

/** Bell icon, drawn inline like the bug icon (no icon library). */
function BellIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M6 9a6 6 0 0 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9" />
      <path d="M10.3 20a2 2 0 0 0 3.4 0" />
    </svg>
  );
}

// Seen state per device. Storage can be missing or blocked: then there is
// simply no dot.
function readSeen(): string | null {
  try {
    return window.localStorage.getItem(NEWS_SEEN_KEY);
  } catch {
    return null;
  }
}

function writeSeen(id: string) {
  try {
    window.localStorage.setItem(NEWS_SEEN_KEY, id);
  } catch {
    // Not remembered on this device.
  }
}

/**
 * Bell in the header with the "Neuigkeiten" panel (spec 015). The server
 * renders the bell without the dot; the stored value of this device applies
 * right after hydration. Opening marks the newest entry as seen.
 */
export function NewsButton({ className = "" }: { className?: string }) {
  const panelId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const latest = latestNewsId(NEWS);
  const [unread, setUnread] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set(latest ? [latest] : []));

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only storage after hydration
    setUnread(hasUnread(NEWS, readSeen()));
  }, []);

  // Keys pressed in the panel stay there: the plan listens on the document
  // (Escape closes its panel), which must stay open behind the news.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const stop = (event: KeyboardEvent) => event.stopPropagation();
    dialog.addEventListener("keydown", stop);
    return () => dialog.removeEventListener("keydown", stop);
  }, []);

  // The page behind the panel does not scroll while it is open.
  useScrollLock(isOpen);

  const open = () => {
    if (latest) writeSeen(latest);
    setUnread(false);
    setIsOpen(true);
    dialogRef.current?.showModal();
    headingRef.current?.focus();
  };

  const close = () => dialogRef.current?.close();

  // A click on the dimming hits the dialog itself; the content fills it.
  const closeOnBackdrop = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === event.currentTarget) close();
  };

  const toggle = (id: string) =>
    setExpanded((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={open}
        aria-label={unread ? "Neuigkeiten – es gibt Neues" : "Neuigkeiten"}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls={panelId}
        className={`relative flex size-11 shrink-0 items-center justify-center rounded-md text-header-text hover:bg-white/10 ${className}`}
      >
        <BellIcon />
        {unread ? (
          <span
            aria-hidden
            data-testid="news-dot"
            className="pointer-events-none absolute top-2 right-2 size-2.5 rounded-full bg-accent ring-2 ring-header-bg"
          />
        ) : null}
      </button>

      <dialog
        ref={dialogRef}
        id={panelId}
        aria-labelledby={`${panelId}-title`}
        onClick={closeOnBackdrop}
        onClose={() => {
          setIsOpen(false);
          buttonRef.current?.focus();
        }}
        className="news-panel fixed inset-x-0 top-auto bottom-0 m-0 w-full max-w-none flex-col overflow-hidden rounded-t-xl border-t border-line bg-surface p-0 text-text shadow-[0_-8px_24px_rgb(0_0_0/0.2)] backdrop:bg-black/50 open:flex desk:top-0 desk:right-0 desk:left-auto desk:h-dvh desk:max-h-none desk:w-[420px] desk:rounded-none desk:border-t-0 desk:border-l desk:shadow-xl"
      >
        <div className="flex shrink-0 items-start gap-2 border-b border-line py-2 pr-1 pl-4">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5 pt-1.5">
            <h2
              ref={headingRef}
              id={`${panelId}-title`}
              tabIndex={-1}
              className="text-lg leading-snug font-semibold outline-none"
            >
              Neuigkeiten
            </h2>
            <p className="text-sm text-muted">Was sich in der App geändert hat.</p>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Neuigkeiten schließen"
            className="flex size-11 shrink-0 items-center justify-center rounded-md text-2xl leading-none text-muted hover:bg-surface-2"
          >
            ×
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-4 pt-2 [-webkit-overflow-scrolling:touch] pb-[calc(env(safe-area-inset-bottom,0px)+5rem)] desk:pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <ul className="flex flex-col divide-y divide-line">
            {NEWS.map((entry) => {
              const isExpanded = expanded.has(entry.id);
              const itemsId = `${panelId}-${entry.id}`;
              return (
                <li key={entry.id} className="py-1">
                  <button
                    type="button"
                    onClick={() => toggle(entry.id)}
                    aria-expanded={isExpanded}
                    aria-controls={itemsId}
                    className="flex min-h-11 w-full items-center gap-3 rounded-md py-2 text-left hover:bg-surface-2"
                  >
                    <span className="flex min-w-0 flex-1 flex-col leading-snug">
                      <span className="font-semibold break-words">{entry.title}</span>
                      <span className="text-sm text-muted tabular-nums">{formatNewsDate(entry.date)}</span>
                    </span>
                    <svg
                      aria-hidden
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className={`size-5 shrink-0 text-muted ${isExpanded ? "rotate-180" : ""}`}
                    >
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </button>
                  <ul id={itemsId} hidden={!isExpanded} className="flex list-disc flex-col gap-2 pt-1 pb-3 pl-5">
                    {entry.items.map((item) => (
                      <li key={item.lead}>
                        <strong className="font-semibold">{item.lead}</strong>
                        {item.text ? ` ${item.text}` : null}
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-sm text-muted">Fehler gefunden oder einen Wunsch? Melde ihn über den Käfer oben.</p>
        </div>
      </dialog>
    </>
  );
}
