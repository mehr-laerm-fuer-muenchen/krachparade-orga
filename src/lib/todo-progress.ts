// Progress of the to-dos of a plan element (spec 016). Pure functions; the
// progress never changes the status of an element.

export type TodoProgress = { done: number; total: number; complete: boolean };

/** Ticked-off and all to-dos; `complete` only when there are some and all are done. */
export function todoProgress(todos: readonly { done: boolean }[]): TodoProgress {
  const total = todos.length;
  const done = todos.filter((todo) => todo.done).length;
  return { done, total, complete: total > 0 && done === total };
}

/** "3/10", "10/10 ✓" when complete, "" without to-dos. */
export function formatProgress(progress: TodoProgress): string {
  if (progress.total === 0) return "";
  const text = `${progress.done}/${progress.total}`;
  return progress.complete ? `${text} ✓` : text;
}

/** Text of the "Rückgängig" bar after marking an element as reached. */
export function reachedWithOpenText(openCount: number): string {
  if (openCount <= 0) return "Erreicht";
  return `Erreicht · ${openCount} ${openCount === 1 ? "To-do" : "To-dos"} noch offen`;
}
