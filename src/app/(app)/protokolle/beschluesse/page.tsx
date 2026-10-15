import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageTitle } from "@/components/placeholder";
import { FilterForm, FilterSearch, FilterSelect } from "@/components/protocol/filter-form";
import { ProtocolTabs } from "@/components/protocol/protocol-tabs";
import { param } from "@/components/protocol/todo-rows";
import { listDepartments } from "@/db/departments";
import { getCurrentEdition } from "@/db/editions";
import { listEditionItems } from "@/db/meetings";
import { formatGermanDate } from "@/lib/dday";
import { filterDecisions } from "@/lib/protocol-rules";

export const metadata: Metadata = {
  title: "Beschlüsse – Krachparade Orga",
};

export default function DecisionsPage({ searchParams }: PageProps<"/protokolle/beschluesse">) {
  return (
    <div className="flex flex-col gap-4">
      <PageTitle>Protokolle</PageTitle>
      <ProtocolTabs active="beschluesse" />
      <Suspense fallback={<p className="text-muted">Lade Beschlüsse …</p>}>
        <Decisions searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

/** All decisions of the current edition, newest meeting first. */
async function Decisions({ searchParams }: Pick<PageProps<"/protokolle/beschluesse">, "searchParams">) {
  const query = await searchParams;
  const departmentId = param(query.referat);
  const search = param(query.q);

  const edition = await getCurrentEdition();
  const [items, departments] = edition
    ? await Promise.all([listEditionItems(edition.id, "entscheidung"), listDepartments(edition.id)])
    : [[], []];
  if (items.length === 0) {
    return <p className="rounded-md border border-line bg-surface px-4 py-3 text-muted">Noch keine Beschlüsse.</p>;
  }

  const departmentNames = new Map(departments.map((department) => [department.id, department.name]));
  const shown = filterDecisions(items, { departmentId, query: search });

  return (
    <>
      <FilterForm key={`${departmentId}|${search}`} action="/protokolle/beschluesse">
        <FilterSelect
          label="Referat"
          name="referat"
          value={departmentId}
          emptyLabel="Alle Referate"
          options={departments.map((department) => ({ value: department.id, label: department.name }))}
        />
        <FilterSearch label="Suche im Text" name="q" value={search} />
      </FilterForm>

      {shown.length === 0 ? (
        <p className="rounded-md border border-line bg-surface px-4 py-3 text-muted">
          Keine Beschlüsse für diesen Filter.
        </p>
      ) : (
        <ul aria-label="Beschlüsse" className="flex flex-col rounded-md border border-line bg-surface">
          {shown.map((item) => (
            <li key={item.id} aria-label={item.text} className="flex flex-col gap-1 border-b border-line px-4 py-3 last:border-b-0">
              <span className="break-words [overflow-wrap:anywhere]">{item.text}</span>
              <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted">
                <Link
                  href={`/protokolle/${item.meetingId}`}
                  className="inline-flex min-h-11 items-center text-primary underline underline-offset-4"
                >
                  Treffen {formatGermanDate(item.meetingDate)}
                </Link>
                <span>TOP: {item.topic}</span>
                {item.departmentId && departmentNames.has(item.departmentId) ? (
                  <span>Referat: {departmentNames.get(item.departmentId)}</span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
