// Choices of the editable detail panel (spec 008); the status texts live in
// plan-status.ts (spec 025). Pure functions.
import { D_DAY_NAME } from "./plan-edit";
import { wouldCreateCycle, type PlanLinkInput } from "./plan-engine";

type Named = { id: string; name: string };

const byName = (a: Named, b: Named) => a.name.localeCompare(b.name, "de");

/** Elements that can become a predecessor of `id`: not yet linked, no cycle. */
export function predecessorCandidates<T extends Named>(
  elements: readonly T[],
  links: readonly PlanLinkInput[],
  id: string
): T[] {
  return elements
    .filter(
      (candidate) =>
        candidate.id !== id &&
        !links.some((link) => link.fromId === candidate.id && link.toId === id) &&
        !wouldCreateCycle([...links], candidate.id, id)
    )
    .sort(byName);
}

/**
 * Elements that can become a successor of `id` (not yet linked, no cycle),
 * the D-Day first (id null) unless it is linked already.
 */
export function successorCandidates(
  elements: readonly Named[],
  links: readonly PlanLinkInput[],
  id: string
): { id: string | null; name: string }[] {
  const own = links.filter((link) => link.fromId === id);
  const result: { id: string | null; name: string }[] = own.some((link) => link.toId === null)
    ? []
    : [{ id: null, name: D_DAY_NAME }];
  const others = elements
    .filter(
      (candidate) =>
        candidate.id !== id &&
        !own.some((link) => link.toId === candidate.id) &&
        !wouldCreateCycle([...links], id, candidate.id)
    )
    .sort(byName);
  return [...result, ...others];
}

/**
 * Working group for a new element: that of the selected element, else the
 * first own one, else the first one (groups in display order).
 */
export function defaultGroupId(
  groups: readonly { id: string }[],
  selectedGroupId: string | null | undefined,
  myGroupIds: readonly string[]
): string | null {
  const known = new Set(groups.map((group) => group.id));
  if (selectedGroupId && known.has(selectedGroupId)) return selectedGroupId;
  const mine = groups.find((group) => myGroupIds.includes(group.id));
  return mine?.id ?? groups[0]?.id ?? null;
}
