"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { setDone, toggleTodo } from "@/actions/plan";
import type { PlanTodoView, PlanViewElement } from "@/lib/gantt-layout";
import { reachedWithOpenText } from "@/lib/todo-progress";
import type { ShowNotice } from "./plan-bar";
import { SAVE_ERROR } from "./use-plan-actions";

function withoutKeys(record: Record<string, boolean>, keys: readonly string[]): Record<string, boolean> {
  const next = { ...record };
  for (const key of keys) delete next[key];
  return next;
}

export type PlanTicks = {
  /** Marks an element as reached (or takes it back) with the "Rückgängig" bar; false if it failed. */
  reach: (element: PlanViewElement, done: boolean) => Promise<boolean>;
  /** Ticks a to-do off (or opens it again) with the "Rückgängig" bar; false if it failed. */
  tickTodo: (todo: Pick<PlanTodoView, "id" | "text">, done: boolean) => Promise<boolean>;
  /** Ticked state while an action is running: `element-‹id›` or `todo-‹id›` → done. */
  pending: Readonly<Record<string, boolean>>;
};

/**
 * Ticking off in the week list and the "Als erreicht markieren?" hint (spec
 * 016), with the existing actions `setDone` and `toggleTodo` and the page's
 * "Rückgängig" bar, as on "/meine" (spec 009).
 */
export function usePlanTicks(byId: ReadonlyMap<string, PlanViewElement>, show: ShowNotice): PlanTicks {
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const pendingRef = useRef(pending);
  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);
  const running = useRef(new Set<string>());
  /** Saved, but the page may not show the reloaded data yet: keep the ticked state until it does. */
  const settled = useRef(new Set<string>());
  // "Rückgängig" runs after the page has reloaded: it needs the newest `updated_at`.
  const latest = useRef(byId);
  useEffect(() => {
    latest.current = byId;
    if (settled.current.size === 0) return;
    const keys = [...settled.current];
    settled.current.clear();
    // The server's data has arrived: show it instead of the ticked state.
    setPending((previous) => withoutKeys(previous, keys));
  }, [byId]);

  const tick = useCallback(
    async (key: string, save: (done: boolean) => Promise<boolean>, done: boolean, text: string, undoneText: string) => {
      if (running.current.has(key)) return false;
      running.current.add(key);
      settled.current.delete(key);
      setPending((previous) => ({ ...previous, [key]: done }));
      const ok = await save(done);
      running.current.delete(key);
      if (!ok) {
        setPending((previous) => withoutKeys(previous, [key]));
        show(SAVE_ERROR, "error");
        return false;
      }
      settled.current.add(key);
      show(done ? text : undoneText, "info", () => {
        void save(!done).then((undone) => {
          if (!undone) show(SAVE_ERROR, "error");
        });
      });
      return true;
    },
    [show]
  );

  const reach = useCallback(
    (element: PlanViewElement, done: boolean) => {
      const save = async (value: boolean) => {
        const current = latest.current.get(element.id);
        if (!current) return false;
        try {
          return (await setDone(element.id, value, current.updatedAt)).ok;
        } catch {
          return false;
        }
      };
      // Counts what was just ticked, before the reloaded data arrives.
      const open = element.todos.filter((todo) => !(pendingRef.current[`todo-${todo.id}`] ?? todo.done)).length;
      return tick(`element-${element.id}`, save, done, reachedWithOpenText(open), "Wieder offen");
    },
    [tick]
  );

  const tickTodo = useCallback(
    (todo: Pick<PlanTodoView, "id" | "text">, done: boolean) => {
      const save = async (value: boolean) => {
        try {
          return (await toggleTodo(todo.id, value)).ok;
        } catch {
          return false;
        }
      };
      return tick(`todo-${todo.id}`, save, done, `Erledigt: ${todo.text}`, `Wieder offen: ${todo.text}`);
    },
    [tick]
  );

  return { reach, tickTodo, pending };
}
