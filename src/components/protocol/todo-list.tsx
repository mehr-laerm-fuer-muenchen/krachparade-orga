"use client";

import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { setTodoDone } from "@/actions/meetings";
import { formatGermanDate } from "@/lib/dday";

/** One to-do as the lists show it: names only, overdue already decided on the server. */
export type TodoRowData = {
  id: string;
  text: string;
  done: boolean;
  owner: string | null;
  dueDate: string | null;
  overdue: boolean;
  department: string | null;
  meetingId: string;
  meetingDate: string;
};

/** To-dos of /protokolle/todos and /meine; ticking off works directly. */
export function TodoList({ todos, label }: { todos: readonly TodoRowData[]; label: string }) {
  return (
    <ul aria-label={label} className="flex flex-col rounded-md border border-line bg-surface">
      {todos.map((todo) => (
        <TodoRow key={todo.id} todo={todo} />
      ))}
    </ul>
  );
}

function TodoRow({ todo }: { todo: TodoRowData }) {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useOptimistic(todo.done);
  const [error, setError] = useState<string | null>(null);

  return (
    <li aria-label={todo.text} className="flex items-start gap-2 border-b border-line px-2 py-2 last:border-b-0">
      <label className="flex size-11 shrink-0 cursor-pointer items-center justify-center">
        <input
          type="checkbox"
          checked={done}
          disabled={pending}
          onChange={(event) => {
            const next = event.target.checked;
            startTransition(async () => {
              setDone(next);
              const result = await setTodoDone(todo.id, next);
              setError(result.ok ? null : result.message);
            });
          }}
          aria-label={`Erledigt: ${todo.text}`}
          className="size-5 accent-primary"
        />
      </label>
      <div className="flex min-w-0 flex-1 flex-col gap-1 py-2">
        <span className={`break-words [overflow-wrap:anywhere] ${done ? "text-muted line-through" : ""}`}>
          {todo.text}
        </span>
        <span className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
          {todo.owner ? <span>Wer: {todo.owner}</span> : null}
          {todo.dueDate ? (
            <span className={todo.overdue && !done ? "font-semibold text-status-late" : ""}>
              bis {formatGermanDate(todo.dueDate)}
              {todo.overdue && !done ? " · überfällig" : ""}
            </span>
          ) : null}
          {todo.department ? <span>Referat: {todo.department}</span> : null}
        </span>
        {error ? (
          <span role="alert" className="font-medium text-status-late">
            {error}
          </span>
        ) : null}
      </div>
      <Link
        href={`/protokolle/${todo.meetingId}`}
        className="flex min-h-11 shrink-0 items-center px-2 text-xs text-primary underline underline-offset-4"
      >
        Treffen {formatGermanDate(todo.meetingDate)}
      </Link>
    </li>
  );
}
