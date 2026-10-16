"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Result of one save. `message` is the server's reason (e.g. a validation
 * error): shown alone, since saving the same again would fail again. Without
 * it (network, server unreachable) "Nicht gespeichert – nochmal" offers a retry.
 */
export type SaveOutcome = { ok: true } | { ok: false; message?: string };

type SaveState =
  | { phase: "saving" }
  | { phase: "saved" }
  | { phase: "error"; message?: string; retry: () => void };

/** "Gespeichert ✓" stays this long. */
const SAVED_MS = 2000;

export type TrackSave = (key: string, call: () => Promise<SaveOutcome>) => Promise<boolean>;

/** Renders the save state of a field next to it. */
export type FieldStatus = (key: string) => ReactNode;

/**
 * Save state per field (spec 016): `track` runs a save and remembers it for
 * "nochmal", `status` renders the state of a field next to it, `failed` says
 * whether its last save went wrong.
 */
export function useSaveStatus(): {
  track: TrackSave;
  status: FieldStatus;
  failed: (key: string) => boolean;
} {
  const [states, setStates] = useState<Record<string, SaveState>>({});
  const timers = useRef(new Map<string, number>());
  /** Newest run per field; older successes are ignored, older errors still show. */
  const runs = useRef(new Map<string, number>());

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((timer) => window.clearTimeout(timer));
  }, []);

  const set = useCallback((key: string, state: SaveState | null) => {
    setStates((previous) => {
      const next = { ...previous };
      if (state) next[key] = state;
      else delete next[key];
      return next;
    });
  }, []);

  const track = useCallback<TrackSave>(
    async function run(key, call) {
      const id = (runs.current.get(key) ?? 0) + 1;
      runs.current.set(key, id);
      window.clearTimeout(timers.current.get(key));
      set(key, { phase: "saving" });
      let outcome: SaveOutcome;
      try {
        outcome = await call();
      } catch {
        outcome = { ok: false };
      }
      if (outcome.ok && runs.current.get(key) !== id) return true;
      if (outcome.ok) {
        set(key, { phase: "saved" });
        timers.current.set(
          key,
          window.setTimeout(() => set(key, null), SAVED_MS)
        );
      } else {
        set(key, { phase: "error", message: outcome.message, retry: () => void run(key, call) });
      }
      return outcome.ok;
    },
    [set]
  );

  const status = useCallback((key: string) => <SaveStatus state={states[key]} />, [states]);
  const failed = useCallback((key: string) => states[key]?.phase === "error", [states]);

  return { track, status, failed };
}

/**
 * "Speichert …", "Gespeichert ✓", the server's reason or "Nicht gespeichert – nochmal" at a field.
 * The status region stays in the page (empty and out of the layout when idle)
 * so screen readers announce changes; nothing moves.
 */
export function SaveStatus({ state }: { state?: SaveState }) {
  return (
    <>
      <span role="status" className="block text-sm empty:sr-only">
        {state?.phase === "saving" ? <span className="text-muted">Speichert …</span> : null}
        {state?.phase === "saved" ? <span className="font-medium text-primary">Gespeichert ✓</span> : null}
      </span>
      {state?.phase === "error" && state.message ? (
        <p role="alert" className="text-sm font-medium text-status-late">
          {state.message}
        </p>
      ) : null}
      {state?.phase === "error" && !state.message ? (
        <p role="alert" className="flex flex-wrap items-center gap-x-1 text-sm font-medium text-status-late">
          <span>Nicht gespeichert –</span>
          <button
            type="button"
            onClick={state.retry}
            className="min-h-11 rounded-md px-1 font-semibold underline underline-offset-2 hover:bg-surface-2"
          >
            nochmal
          </button>
        </p>
      ) : null}
    </>
  );
}
