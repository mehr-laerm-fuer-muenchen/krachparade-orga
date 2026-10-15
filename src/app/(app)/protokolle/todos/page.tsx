import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageTitle } from "@/components/placeholder";
import { FilterDepartmentSelect, FilterForm, FilterSelect } from "@/components/protocol/filter-form";
import { ProtocolTabs } from "@/components/protocol/protocol-tabs";
import { TodoList } from "@/components/protocol/todo-list";
import { param, toTodoRows } from "@/components/protocol/todo-rows";
import { getCurrentEdition } from "@/db/editions";
import { listEditionItems } from "@/db/meetings";
import { listMembers } from "@/db/members";
import { listDepartmentsWithGroup } from "@/db/working-groups";
import { todayInBerlin } from "@/lib/dday";
import { groupDepartmentOptions, toDepartmentOptions } from "@/lib/department-groups";
import { filterTodos, WITHOUT_ACCOUNT } from "@/lib/protocol-rules";

export const metadata: Metadata = {
  title: "To-dos – Krachparade Orga",
};

export default function TodosPage({ searchParams }: PageProps<"/protokolle/todos">) {
  return (
    <div className="flex flex-col gap-4">
      <PageTitle>Protokolle</PageTitle>
      <ProtocolTabs active="todos" />
      <Suspense fallback={<p className="text-muted">Lade To-dos …</p>}>
        <Todos searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

/** All to-dos of the current edition, open or done, filtered by person and department. */
async function Todos({ searchParams }: Pick<PageProps<"/protokolle/todos">, "searchParams">) {
  const query = await searchParams;
  const done = param(query.status) === "erledigt";
  const person = param(query.person);
  const departmentId = param(query.referat);

  const edition = await getCurrentEdition();
  const [items, departments, members] = edition
    ? await Promise.all([
        listEditionItems(edition.id, "todo"),
        listDepartmentsWithGroup(edition.id),
        listMembers(),
      ])
    : [[], [], []];

  // Active members plus everyone already entered as owner; names only.
  const owners = new Set(items.map((item) => item.ownerId));
  const personOptions = [
    ...members
      .filter((member) => member.active || owners.has(member.id))
      .sort((a, b) => a.name.localeCompare(b.name, "de"))
      .map((member) => ({
        value: member.id,
        label: member.active ? member.name : `${member.name} (deaktiviert)`,
      })),
    { value: WITHOUT_ACCOUNT, label: "Ohne Account" },
  ];

  const shown = filterTodos(items, { done, person: person || undefined, departmentId: departmentId || undefined });
  const departmentOptions = toDepartmentOptions(departments);
  const rows = toTodoRows(shown, members, departmentOptions, todayInBerlin(new Date()));

  const filters = new URLSearchParams({ ...(person && { person }), ...(departmentId && { referat: departmentId }) });
  const statusHref = (status: "offen" | "erledigt") => {
    const next = new URLSearchParams(filters);
    if (status === "erledigt") next.set("status", "erledigt");
    const search = next.toString();
    return `/protokolle/todos${search ? `?${search}` : ""}`;
  };

  return (
    <>
      <nav aria-label="Status" className="flex w-fit rounded-md border border-line-strong p-0.5">
        {(["offen", "erledigt"] as const).map((status) => {
          const current = (status === "erledigt") === done;
          return (
            <Link
              key={status}
              href={statusHref(status)}
              replace
              scroll={false}
              aria-current={current ? "page" : undefined}
              className={`flex min-h-11 items-center rounded px-4 font-medium ${
                current ? "bg-primary text-on-primary" : "text-text hover:bg-surface-2"
              }`}
            >
              {status === "offen" ? "Offen" : "Erledigt"}
            </Link>
          );
        })}
      </nav>

      <FilterForm
        key={`${person}|${departmentId}`}
        action="/protokolle/todos"
        hidden={done ? { status: "erledigt" } : {}}
      >
        <FilterSelect label="Person" name="person" value={person} emptyLabel="Alle Personen" options={personOptions} />
        <FilterDepartmentSelect
          name="referat"
          value={departmentId}
          groups={groupDepartmentOptions(departmentOptions)}
        />
      </FilterForm>

      {rows.length === 0 ? (
        <p className="rounded-md border border-line bg-surface px-4 py-3 text-muted">
          {done ? "Keine erledigten To-dos." : "Keine offenen To-dos."}
        </p>
      ) : (
        <TodoList todos={rows} label={done ? "Erledigte To-dos" : "Offene To-dos"} />
      )}
    </>
  );
}
