"use client";

import { useEffect, useRef, useSyncExternalStore, type Ref } from "react";
import { INPUT } from "./types";

// Spec 028: the text of an item is a textarea that grows with its text.
// Laptop: Enter saves, Shift+Enter adds a line. Touch: Enter adds a line,
// the "Speichern" button saves. The device is only known in the browser,
// so the server and the first render use the laptop behaviour.

const COARSE = "(pointer: coarse)";

function subscribeCoarse(onChange: () => void) {
  const query = window.matchMedia(COARSE);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** True on touch devices; false on the server and while hydrating. */
export function useCoarsePointer(): boolean {
  return useSyncExternalStore(
    subscribeCoarse,
    () => window.matchMedia(COARSE).matches,
    () => false
  );
}

/**
 * Fallback for browsers without `field-sizing: content`: sets the height to
 * the content. `max-h-64` (about 10 lines) caps it, then the field scrolls.
 */
function useAutoGrow(value: string) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const field = ref.current;
    if (!field || CSS.supports("field-sizing", "content")) return;
    field.style.height = "auto";
    const border = field.offsetHeight - field.clientHeight;
    field.style.height = `${field.scrollHeight + border}px`;
  }, [value]);
  return ref;
}

function setRefs<T>(value: T | null, ...refs: (Ref<T> | undefined)[]) {
  for (const ref of refs) {
    if (typeof ref === "function") ref(value);
    else if (ref) ref.current = value;
  }
}

export function ItemTextArea({
  id,
  value,
  onChange,
  textRef,
  autoFocus,
  placeholder,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  textRef?: Ref<HTMLTextAreaElement>;
  autoFocus?: boolean;
  /** Laptop and touch text, e.g. with and without the Enter hint. */
  placeholder?: { fine: string; coarse: string };
}) {
  const coarse = useCoarsePointer();
  const growRef = useAutoGrow(value);

  return (
    <textarea
      ref={(field) => setRefs(field, growRef, textRef)}
      id={id}
      rows={1}
      value={value}
      maxLength={2000}
      autoFocus={autoFocus}
      autoComplete="off"
      placeholder={placeholder ? (coarse ? placeholder.coarse : placeholder.fine) : undefined}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={(event) => {
        if (
          event.key !== "Enter" ||
          event.shiftKey ||
          event.altKey ||
          event.ctrlKey ||
          event.metaKey ||
          event.nativeEvent.isComposing ||
          coarse
        ) {
          return;
        }
        event.preventDefault();
        event.currentTarget.form?.requestSubmit();
      }}
      // One line for the placeholder too: field-sizing would grow with a wrapped placeholder.
      className={`${INPUT} block max-h-64 resize-none overflow-y-auto py-2 field-sizing-content placeholder:truncate`}
    />
  );
}
