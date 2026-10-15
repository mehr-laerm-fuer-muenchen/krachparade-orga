import { revalidatePath } from "next/cache";

/**
 * Spec 009: after a change to plan elements, to-dos or protocol to-dos,
 * "/meine" and the overdue count at "Meine" (loaded in the layout of all
 * signed-in pages) load again. For server actions only.
 */
export function revalidateMyTasks(): void {
  revalidatePath("/meine");
  revalidatePath("/", "layout");
}
