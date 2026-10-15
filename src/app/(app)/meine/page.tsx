import type { Metadata } from "next";
import { Suspense } from "react";
import { getCurrentMember } from "@/components/current-member";
import { ComingSoon, PageTitle } from "@/components/placeholder";
import { TodoList } from "@/components/protocol/todo-list";
import { toTodoRows } from "@/components/protocol/todo-rows";
import { listDepartments } from "@/db/departments";
import { getCurrentEdition } from "@/db/editions";
import { listEditionItems } from "@/db/meetings";
import { todayInBerlin } from "@/lib/dday";
import { filterTodos } from "@/lib/protocol-rules";

export const metadata: Metadata = {
  title: "Meine Aufgaben – Krachparade Orga",
};

export default function MyTasksPage() {
  return (
    <div className="flex flex-col gap-4">
      <PageTitle>Meine Aufgaben</PageTitle>
      <ComingSoon>Meilenstein-Aufgaben kommen mit R1</ComingSoon>
      <Suspense fallback={<p className="text-muted">Lade To-dos …</p>}>
        <MyTodos />
      </Suspense>
    </div>
  );
}

/** Open to-dos with the signed-in member as owner (free-text owners never show up here). */
async function MyTodos() {
  const [member, edition] = await Promise.all([getCurrentMember(), getCurrentEdition()]);
  const [items, departments] = edition
    ? await Promise.all([listEditionItems(edition.id, "todo", member.id), listDepartments(edition.id)])
    : [[], []];
  const open = filterTodos(items, { done: false });
  if (open.length === 0) {
    return <p className="rounded-md border border-line bg-surface px-4 py-3 text-muted">Keine offenen To-dos.</p>;
  }
  const rows = toTodoRows(
    open,
    [{ id: member.id, name: member.name, active: true }],
    departments,
    todayInBerlin(new Date())
  );
  return (
    <section aria-labelledby="meine-todos" className="flex flex-col gap-2">
      <h2 id="meine-todos" className="text-lg font-semibold">
        Offene To-dos aus Protokollen
      </h2>
      <TodoList todos={rows} label="Meine offenen To-dos" />
    </section>
  );
}
