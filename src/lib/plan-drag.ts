// Dragging in the Gantt (spec 008): turning pixels into days and the preview
// while dragging. The preview uses the same engine functions as the server;
// after releasing, the page shows the server's result again. Pure functions.
import type { Status } from "@/components/status-pill";
import {
  computePlan,
  moveElement,
  resizeFromEnd,
  resizeFromStart,
  type PlanElementChange,
  type PlanElementInput,
  type PlanInput,
} from "./plan-engine";

/** "move" = the bar or diamond, "start"/"end" = the handles of a task. */
export type DragMode = "move" | "start" | "end";

/** Below this distance in pixels a press counts as a click. */
export const DRAG_THRESHOLD = 4;

export function isDrag(dx: number, dy: number): boolean {
  return Math.abs(dx) >= DRAG_THRESHOLD || Math.abs(dy) >= DRAG_THRESHOLD;
}

/** Whole days for a horizontal distance at `pxPerDay` (never -0). */
export function dragDays(dx: number, pxPerDay: number): number {
  return Math.round(dx / pxPerDay) || 0;
}

/** The engine's changes for dragging `id` by `delta` days. */
export function dragChanges(plan: PlanInput, id: string, mode: DragMode, delta: number): PlanElementChange[] {
  if (mode === "start") return resizeFromStart(plan, id, delta);
  if (mode === "end") return resizeFromEnd(plan, id, delta);
  return moveElement(plan, id, delta);
}

export function applyChanges(
  elements: readonly PlanElementInput[],
  changes: readonly PlanElementChange[]
): PlanElementInput[] {
  const byId = new Map(changes.map((change) => [change.id, change]));
  return elements.map((element) => {
    const change = byId.get(element.id);
    if (!change) return element;
    return {
      ...element,
      shiftDays: change.shiftDays ?? element.shiftDays,
      fixedDay: change.fixedDay ?? element.fixedDay,
      durationDays: change.durationDays ?? element.durationDays,
    };
  });
}

/** What the Gantt draws of an element. */
export type PreviewValues = { start: number; end: number; latestEnd: number; buffer: number; status: Status };

/**
 * The plan after the changes, for every element; null if it cannot be
 * computed (then the preview simply does not move).
 */
export function previewPlan(
  plan: PlanInput,
  changes: readonly PlanElementChange[],
  today: number
): Map<string, PreviewValues> | null {
  try {
    const computed = computePlan(applyChanges(plan.elements, changes), plan.links, today);
    const result = new Map<string, PreviewValues>();
    for (const [id, element] of computed.elements) {
      result.set(id, {
        start: element.plannedStart,
        end: element.plannedEnd,
        latestEnd: element.latestFinish,
        buffer: element.buffer,
        status: element.status,
      });
    }
    return result;
  } catch {
    return null;
  }
}
