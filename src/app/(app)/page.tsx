import type { Metadata } from "next";
import { Suspense } from "react";
import { getCurrentMember } from "@/components/current-member";
import { PageTitle } from "@/components/placeholder";
import { StatusPill } from "@/components/status-pill";
import { getCurrentEdition } from "@/db/editions";
import { loadPlan, type LoadedPlanElement } from "@/db/plan";
import { formatDLabel, formatGermanDate, todayInBerlin } from "@/lib/dday";
import { dateToDay, dayToDate } from "@/lib/plan-days";
import { computePlan, PlanCycleError, type ComputedElement, type ComputedPlan } from "@/lib/plan-engine";
import { countLate, formatBuffer, formatWeekdayShort, shortEditionName } from "@/lib/plan-preview";
import { displayGroupName } from "@/lib/working-groups";

export const metadata: Metadata = {
  title: "Plan – Krachparade Orga",
};

const NOTICE = "rounded-md border border-line bg-surface px-4 py-3 text-muted";
/** Name column stays visible while the table scrolls sideways on the phone. */
const NAME_CELL =
  "sticky left-0 z-10 w-40 min-w-40 px-3 py-2 shadow-[inset_-1px_0_0_var(--line)] desk:static desk:w-auto desk:shadow-none";
const MARK = "inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-semibold";

export default function Home() {
  return (
    <div className="flex flex-col gap-4">
      <Suspense fallback={<p className="text-muted">Lade Plan …</p>}>
        <PlanPreview />
      </Suspense>
    </div>
  );
}

type Row = { element: LoadedPlanElement; computed: ComputedElement; critical: boolean };
type Lane = { key: string; title: string; rows: Row[] };

/**
 * Read-only preview of the plan engine (spec 006): every element of the
 * current edition with its computed dates, buffer and status, grouped by AK.
 * Names only, never e-mail addresses. Gantt view and editing follow with
 * specs 007 and 008.
 */
async function PlanPreview() {
  await getCurrentMember();
  const edition = await getCurrentEdition();
  if (!edition) {
    return (
      <>
        <PageTitle>Plan</PageTitle>
        <p className={NOTICE}>Noch keine aktuelle Ausgabe angelegt.</p>
      </>
    );
  }

  const title = `Plan ${shortEditionName(edition.name)}`;
  const plan = await loadPlan(edition.id);
  if (plan.elements.length === 0) {
    return (
      <>
        <PageTitle>{title}</PageTitle>
        <p className={NOTICE}>Noch kein Plan. Die KP27-Vorlage kommt mit Spec 010.</p>
      </>
    );
  }

  const today = dateToDay(todayInBerlin(new Date()), plan.dDay);
  let computed: ComputedPlan;
  try {
    computed = computePlan(plan.elements, plan.links, today);
  } catch (error) {
    if (!(error instanceof PlanCycleError)) throw error;
    return (
      <>
        <PageTitle>{title}</PageTitle>
        <p role="alert" className="font-medium text-status-late">
          Der Plan lässt sich nicht berechnen: Die Verbindungen enthalten einen Kreis.
        </p>
      </>
    );
  }

  const critical = new Set(computed.criticalPath);
  const lanes = groupByWorkingGroup(
    plan.elements.map((element) => ({
      element,
      computed: computed.elements.get(element.id)!,
      critical: critical.has(element.id),
    }))
  );
  const late = countLate(computed.elements.values());
  const startDate = dayToDate(computed.latestProjectStart, plan.dDay);

  return (
    <>
      <div className="flex flex-col gap-1">
        <PageTitle>{title}</PageTitle>
        <p className="text-muted">
          {plan.elements.length} Elemente · {late} in Verzug · Kritischer Pfad:{" "}
          {computed.criticalPath.length} Elemente, Start spätestens {formatWeekdayShort(startDate)} (
          {formatDLabel(startDate, plan.dDay)})
        </p>
      </div>
      <p className={NOTICE}>Vorschau der Plan-Rechnung. Gantt-Ansicht und Bearbeiten kommen mit den nächsten Specs.</p>
      {lanes.map((lane) => (
        <LaneTable key={lane.key} lane={lane} dDay={plan.dDay} />
      ))}
    </>
  );
}

/** One lane per AK in AK order, sorted by start; "Ohne AK" last. */
function groupByWorkingGroup(rows: Row[]): Lane[] {
  const lanes = new Map<string, Lane & { order: number }>();
  for (const row of rows) {
    const { workingGroupId, workingGroupName, workingGroupSortOrder } = row.element;
    const key = workingGroupId ?? "none";
    let lane = lanes.get(key);
    if (!lane) {
      lane = {
        key,
        title: workingGroupName === null ? "Ohne AK" : displayGroupName(workingGroupName),
        order: workingGroupId === null ? Number.POSITIVE_INFINITY : (workingGroupSortOrder ?? 0),
        rows: [],
      };
      lanes.set(key, lane);
    }
    lane.rows.push(row);
  }
  return [...lanes.values()]
    .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title, "de"))
    .map((lane) => ({
      ...lane,
      rows: lane.rows.sort(
        (a, b) =>
          a.computed.plannedStart - b.computed.plannedStart ||
          a.element.sortOrder - b.element.sortOrder ||
          a.element.name.localeCompare(b.element.name, "de")
      ),
    }));
}

function DayCell({ day, dDay }: { day: number; dDay: string }) {
  const date = dayToDate(day, dDay);
  return (
    <>
      <span className="block">{formatGermanDate(date)}</span>
      <span className="block text-xs text-muted">{formatDLabel(date, dDay)}</span>
    </>
  );
}

function LaneTable({ lane, dDay }: { lane: Lane; dDay: string }) {
  const headingId = `lane-${lane.key}`;
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <h2 id={headingId} className="text-lg font-semibold">
        {lane.title}
      </h2>
      <div
        role="region"
        aria-label={`Tabelle ${lane.title}`}
        tabIndex={0}
        className="overflow-x-auto rounded-md border border-line bg-surface"
      >
        <table className="w-full min-w-[56rem] border-collapse text-left text-sm">
          <thead className="bg-surface-2 text-xs text-muted">
            <tr>
              <th scope="col" className={`${NAME_CELL} bg-surface-2 font-semibold`}>
                Name
              </th>
              <th scope="col" className="px-3 py-2 font-semibold">Art</th>
              <th scope="col" className="px-3 py-2 font-semibold">Start</th>
              <th scope="col" className="px-3 py-2 font-semibold">Ende</th>
              <th scope="col" className="px-3 py-2 font-semibold">Puffer</th>
              <th scope="col" className="px-3 py-2 font-semibold">Status</th>
              <th scope="col" className="px-3 py-2 font-semibold">Verantwortlich</th>
              <th scope="col" className="px-3 py-2 text-right font-semibold">Offene To-dos</th>
            </tr>
          </thead>
          <tbody>
            {lane.rows.map(({ element, computed, critical }) => (
              <tr key={element.id} className="border-t border-line align-top">
                <th scope="row" className={`${NAME_CELL} bg-surface font-medium`}>
                  <span>{element.name}</span>
                  {element.fixedDay !== null || critical ? (
                    <span className="mt-1 flex flex-wrap gap-1">
                      {element.fixedDay !== null ? (
                        <span className={`${MARK} border-line-strong text-text`}>Fix</span>
                      ) : null}
                      {critical ? <span className={`${MARK} border-primary text-primary`}>kritisch</span> : null}
                    </span>
                  ) : null}
                </th>
                <td className="px-3 py-2">{element.kind === "milestone" ? "Meilenstein" : "Vorgang"}</td>
                <td className="px-3 py-2 tabular-nums">
                  <DayCell day={computed.plannedStart} dDay={dDay} />
                </td>
                <td className="px-3 py-2 tabular-nums">
                  {element.kind === "task" ? <DayCell day={computed.plannedEnd} dDay={dDay} /> : null}
                </td>
                <td
                  className={`whitespace-nowrap px-3 py-2 tabular-nums ${
                    computed.buffer < 0 ? "font-semibold text-status-late" : ""
                  }`}
                >
                  {formatBuffer(computed.buffer)}
                </td>
                <td className="px-3 py-2">
                  <StatusPill status={computed.status} assessment={computed.reason === "wobbly"} />
                </td>
                <td className="px-3 py-2">{element.ownerName ?? <span className="text-muted">–</span>}</td>
                <td className="px-3 py-2 text-right tabular-nums">{element.openTodos}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
