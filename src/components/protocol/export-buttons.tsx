"use client";

import { useEffect, useRef, useState } from "react";
import { toMarkdown, toTelegramText } from "@/lib/protocol-export";
import { SECONDARY_BUTTON, type ItemData, type MeetingData, type Person, type Report } from "./types";

/**
 * "Als Text kopieren" (Telegram) and "Als Markdown kopieren". If the browser
 * refuses the clipboard, the text is shown selected in a field instead.
 */
export function ExportButtons({
  meeting,
  attendeeIds,
  items,
  people,
  report,
}: {
  meeting: MeetingData;
  attendeeIds: readonly string[];
  items: readonly ItemData[];
  people: readonly Person[];
  report: Report;
}) {
  const [fallback, setFallback] = useState<string | null>(null);
  const fieldRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fieldRef.current?.select();
  }, [fallback]);

  async function copy(format: "text" | "markdown") {
    const names = new Map(people.map((person) => [person.id, person.name]));
    const data = { ...meeting, attendeeIds };
    const text = format === "text" ? toTelegramText(data, items, names) : toMarkdown(data, items, names);
    try {
      await navigator.clipboard.writeText(text);
      setFallback(null);
      report({ ok: true }, "Kopiert");
    } catch {
      setFallback(text);
    }
  }

  return (
    <section aria-label="Export" className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => void copy("text")} className={SECONDARY_BUTTON}>
          Als Text kopieren
        </button>
        <button type="button" onClick={() => void copy("markdown")} className={SECONDARY_BUTTON}>
          Als Markdown kopieren
        </button>
      </div>
      {fallback !== null ? (
        <div className="flex flex-col gap-1 rounded-md border border-line bg-surface p-3">
          <label htmlFor="export-text">Kopieren ging nicht automatisch – Text ist markiert, bitte selbst kopieren.</label>
          <textarea
            id="export-text"
            ref={fieldRef}
            readOnly
            value={fallback}
            className="h-48 w-full resize-y rounded-md border border-line-strong bg-surface p-3 text-base text-text"
          />
          <div>
            <button type="button" onClick={() => setFallback(null)} className={SECONDARY_BUTTON}>
              Schließen
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
