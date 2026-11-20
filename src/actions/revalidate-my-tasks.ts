import { revalidatePath } from "next/cache";

/**
 * Spec 009: after a change to plan elements, to-dos or protocol to-dos,
 * "/meine" loads again. The overdue count at "Meine" (in the layout) follows
 * through `refresh()` of the current page; the layout itself is not
 * revalidated, since in a production build that rebuilds the static shell of "/" at
 * runtime without its path (hydration error #418). For server actions only.
 */
export function revalidateMyTasks(): void {
  revalidatePath("/meine");
}
