"use client";

import { useCallback } from "react";
import { moveElement, resizeElement, undoPlanChange, type PlanConflict, type PreviousValues } from "@/actions/plan";
import type { PlanViewElement } from "@/lib/gantt-layout";
import type { DragMode } from "@/lib/plan-drag";
import type { ShowNotice } from "./plan-bar";
import type { DragAction, PlanResult, RunAction } from "./plan-detail";

export const SAVE_ERROR = "Konnte nicht gespeichert werden.";

export function conflictText(conflict: PlanConflict): string {
  return `Wurde gerade von ${conflict.by ?? "jemand anderem"} geändert – Plan neu geladen.`;
}

/**
 * `run` and `drag` for the detail panel (spec 008), used on the plan page and
 * on "/meine" (spec 009). Messages go to the page's "Rückgängig" bar.
 */
export function usePlanActions(
  byId: ReadonlyMap<string, PlanViewElement>,
  show: ShowNotice
): { run: RunAction; drag: DragAction } {
  /** Every action refreshes the page itself (refresh()); a conflict only adds the notice. */
  const run = useCallback(
    async (call: () => Promise<PlanResult>): Promise<string | null> => {
      try {
        const result = await call();
        if (!result.ok) return result.message;
        if (result.conflict) show(conflictText(result.conflict), "info");
        return null;
      } catch {
        return SAVE_ERROR;
      }
    },
    [show]
  );

  const undo = useCallback(
    async (previous: PreviousValues[], updatedAt: string) => {
      const message = await run(() => undoPlanChange(previous, updatedAt));
      if (message !== null) show(message, "error");
    },
    [run, show]
  );

  /** Drag in the Gantt or "−/+ T" on phones: save, then offer "Rückgängig". */
  const drag = useCallback(
    async (id: string, mode: DragMode, delta: number): Promise<boolean> => {
      const element = byId.get(id);
      if (!element) return false;
      try {
        const result =
          mode === "move"
            ? await moveElement(id, delta, element.updatedAt)
            : await resizeElement(id, mode, delta, element.updatedAt);
        if (!result.ok) {
          show(SAVE_ERROR, "error");
          return false;
        }
        if (result.conflict) show(conflictText(result.conflict), "info");
        else if (result.previous.length > 0 && result.updatedAt !== null) {
          const { previous, updatedAt } = result;
          show(mode === "move" ? "Verschoben" : "Dauer geändert", "info", () => void undo(previous, updatedAt));
        }
        return true;
      } catch {
        show(SAVE_ERROR, "error");
        return false;
      }
    },
    [byId, show, undo]
  );

  return { run, drag };
}
