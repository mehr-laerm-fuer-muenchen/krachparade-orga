"use client";

import { useEffect, useId, useState, type FormEvent, type ReactNode } from "react";
import { loadPlanHistory } from "@/actions/plan-history";
import {
  addLink,
  addNote,
  addTodo,
  deleteElement,
  deleteNote,
  deleteTodo,
  removeLink,
  setDone,
  setFixedDate,
  setFixedOffset,
  setPlacement,
  setWobbly,
  toggleTodo,
  updateElement,
  updateLinkLag,
  updateNote,
  type PlanConflict,
} from "@/actions/plan";
import { FieldError } from "@/components/field-error";
import { NoteHistory, PRIVACY_HINT } from "@/components/note-history";
import { useSaveStatus, type FieldStatus, type SaveOutcome } from "@/components/save-status";
import { StatusPill } from "@/components/status-pill";
import { formatRelativeDay } from "@/lib/dday";
import {
  formatWeekdayDate,
  type GanttGroup,
  type PlanTodoView,
  type PlanViewElement,
  type PlanViewLink,
} from "@/lib/gantt-layout";
import type { DragMode } from "@/lib/plan-drag";
import { dayToDate } from "@/lib/plan-days";
import { D_DAY_NAME, PLACEMENT_NAMES } from "@/lib/plan-edit";
import { predecessorCandidates, successorCandidates } from "@/lib/plan-panel";
import { formatWeekdayShort } from "@/lib/plan-preview";
import { resolvePlacement, todoDueDay, type FixedVariant, type Placement } from "@/lib/plan-engine";
import { causeText, daysShort, reasonText } from "@/lib/plan-status";
import { formatTodoDue } from "@/lib/todo-due";
import { formatProgress, todoProgress, type TodoProgress } from "@/lib/todo-progress";
import { displayGroupName } from "@/lib/working-groups";
import { ReachHint } from "./reach-hint";
import { SAVE_ERROR } from "./use-plan-actions";

/** Result of a plan action as the panel sees it. */
export type PlanResult = { ok: true; conflict?: PlanConflict | null } | { ok: false; message: string };

/** Runs an action, shows a conflict notice; returns the error message or null. */
export type RunAction = (call: () => Promise<PlanResult>) => Promise<string | null>;

/** Moves or resizes an element with the "Rückgängig" bar; false if it failed. */
export type DragAction = (id: string, mode: DragMode, delta: number) => Promise<boolean>;

export type PlanOption = { id: string; name: string };
export type PlanDepartmentOption = PlanOption & { workingGroupId: string | null };

/** Order of the placement buttons (2 × 2) and their explanations (spec 025). */
const PLACEMENT_ORDER: readonly Placement[] = ["fixed", "asap", "alap", "free"];
const PLACEMENT_HINTS: Record<Placement, string> = {
  fixed: "Liegt immer auf diesem Termin. Für gewollte Termine wie Pressemitteilung oder Gesamtbriefing.",
  asap: "Startet, sobald die Vorgänger fertig sind (plus Mindestabstand). Wandert mit, wenn sich die Vorgänger verschieben.",
  alap: "Liegt auf dem letzten Termin, der nichts danach gefährdet. So hat die App bisher alles gerechnet.",
  free: "Ihr legt den Termin selbst, zum Beispiel durch Ziehen. Liegt er außerhalb des Fensters, wird er gelb oder rot.",
};

/** The placement as it counts and the variant of "Fest". */
function placementOf(element: PlanViewElement): { placement: Placement; variant: FixedVariant } {
  const resolved = resolvePlacement(element);
  return {
    placement: resolved.mode,
    variant: resolved.mode === "fixed" ? resolved.variant : "offset",
  };
}

/** Neutral pill in the head: "Luft 5 T", "keine Luft", "fest · 80 T vorher", "festes Datum" or "erreicht". */
export function windowLabel(element: PlanViewElement): string {
  if (element.done) return "erreicht";
  const { placement, variant } = placementOf(element);
  if (placement === "fixed") {
    return variant === "offset" ? `fest · ${daysShort(element.fixedOffsetDays ?? 0)} vorher` : "festes Datum";
  }
  return element.slack > 0 ? `Luft ${daysShort(element.slack)}` : "keine Luft";
}

/** "5 Tage", "1 Tag" */
function daysLong(days: number): string {
  return days === 1 ? "1 Tag" : `${days} Tage`;
}

const NEUTRAL_PILL =
  "inline-flex items-center whitespace-nowrap rounded-full border border-line-strong px-2.5 py-0.5 text-xs font-semibold text-muted";
const MARK_PILL = "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold text-text";

/** "3/10 To-dos", "10/10 To-dos ✓" (spec 023); "3/10" and "✓" from formatProgress. */
function progressLabel(progress: TodoProgress): string {
  const [count, check] = formatProgress(progress).split(" ");
  return check ? `${count} To-dos ${check}` : `${count} To-dos`;
}

function dateWithD(day: number, dDay: string): string {
  return `${formatWeekdayDate(day, dDay)} · ${formatRelativeDay(dayToDate(day, dDay), dDay)}`;
}

/** "fällig 18.12. (3 Tage vor Start)" (spec 023) */
export function dueText(todo: Pick<PlanTodoView, "anchor" | "daysBefore" | "due">, dDay: string): string {
  return formatTodoDue(todo.daysBefore, todo.anchor, todo.due, dDay);
}

/** Escape in a form field does not close the panel. */
export function isFieldTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && target.closest("input, textarea, select") !== null;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2 border-t border-line pt-3">
      <h3 className="text-xs font-semibold tracking-wide text-muted uppercase">{title}</h3>
      {children}
    </section>
  );
}

const INPUT =
  "min-h-11 rounded-md border border-line-strong bg-surface px-3 text-base disabled:opacity-50 aria-invalid:border-status-late";
const SMALL_BUTTON =
  "min-h-11 shrink-0 rounded-md border border-line bg-surface px-3 font-medium hover:bg-surface-2 disabled:opacity-50";
const PRIMARY_BUTTON =
  "min-h-11 shrink-0 rounded-md bg-primary px-4 font-semibold text-on-primary hover:opacity-90 disabled:opacity-50";
const REMOVE_BUTTON =
  "flex size-11 shrink-0 items-center justify-center rounded-md text-xl leading-none text-muted hover:bg-surface-2";
const CHECKBOX = "size-5 shrink-0 accent-[var(--primary)]";
const EMPTY = <p className="text-muted">Noch keine.</p>;

/** A field with its label; `status` (spec 016) sits below it, outside the label, so it is not part of the field's name. */
function Labeled({ label, children, status }: { label: string; children: ReactNode; status?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="flex flex-col gap-1">
        <span className="text-sm text-muted">{label}</span>
        {children}
      </label>
      {status}
    </div>
  );
}

/** Whole number from a field, NaN for anything else (the server then answers). */
function toInt(value: string): number {
  return value.trim() === "" ? Number.NaN : Number(value);
}

type LinkRow = { link: PlanViewLink; id: string | null; name: string };

export type PlanDetailProps = {
  element: PlanViewElement;
  elements: ReadonlyMap<string, PlanViewElement>;
  links: readonly PlanViewLink[];
  groups: readonly GanttGroup[];
  departments: readonly PlanDepartmentOption[];
  members: readonly PlanOption[];
  today: number;
  dDay: string;
  onSelect: (id: string) => void;
  onClose: () => void;
  run: RunAction;
  drag: DragAction;
  /** "Erreicht" in the "Als erreicht markieren?" hint, with the "Rückgängig" bar (spec 016). */
  onReach: (element: PlanViewElement) => void;
  /** "Noch nicht" was chosen for this element during this page visit. */
  hintHidden: boolean;
  onHideHint: (id: string) => void;
};

/**
 * Details of a plan element, editable (spec 008, layout like test layout
 * v4). Next to the plan on wide screens, a sheet from the bottom on phones.
 * Fields save when leaving them or on selection. Closes with "×" or Escape.
 */
export function PlanDetail(props: PlanDetailProps) {
  const { element, elements, links, groups, departments, members, today, dDay, onSelect, onClose, run, drag } =
    props;
  const progress = todoProgress(element.todos);
  const showHint = !element.done && !props.hintHidden && progress.complete;
  const seen = element.updatedAt;
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const { track, status, failed } = useSaveStatus();
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isFieldTarget(event.target)) onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  /** Saves a field with "Gespeichert ✓" or "Nicht gespeichert – nochmal" at it (spec 016). */
  const save: Save = (field, call) => track(field, async () => toOutcome(await run(call)));

  /** Ticking off, buttons and deleting: only an error appears at the control. */
  const act: Save = async (field, call) => {
    const message = await run(call);
    setErrors((previous) => ({ ...previous, [field]: message }));
    return message === null;
  };

  const open = !element.done;
  const milestone = element.kind === "milestone";
  const meta = [
    element.workingGroupName,
    element.departmentName,
    milestone ? "Meilenstein" : "Vorgang",
    element.ownerName,
  ].filter(Boolean);

  const names = new Map([...elements.values()].map((item) => [item.id, item.name]));
  const { placement, variant } = placementOf(element);
  // Spec 026: "– wegen ‹Name› (…)" for a follow-on delay; the name opens that element.
  const causeName = element.cause ? names.get(element.cause.elementId) : undefined;
  const cause =
    element.cause && causeName && (element.status === "late" || element.status === "warn")
      ? (() => {
          const text = causeText(element.cause, causeName);
          const at = text.indexOf(causeName);
          return {
            id: element.cause.elementId,
            name: causeName,
            before: text.slice(0, at),
            after: text.slice(at + causeName.length),
          };
        })()
      : null;

  const predecessors = links.flatMap((link): LinkRow[] => {
    const from = link.toId === element.id ? elements.get(link.fromId) : undefined;
    return from ? [{ link, id: from.id, name: from.name }] : [];
  });
  const successors = links.flatMap((link): LinkRow[] => {
    if (link.fromId !== element.id) return [];
    if (link.toId === null) return [{ link, id: null, name: D_DAY_NAME }];
    const to = elements.get(link.toId);
    return to ? [{ link, id: to.id, name: to.name }] : [];
  });
  const all = [...elements.values()];
  const predecessorOptions = predecessorCandidates(all, links, element.id);
  const successorOptions = successorCandidates(all, links, element.id);
  const groupDepartments = departments.filter((department) => department.workingGroupId === element.workingGroupId);
  // Fields show the stored values again after every change from the server.
  const version = `${element.id}-${element.updatedAt}`;

  return (
    <>
      <div aria-hidden onClick={onClose} className="fixed inset-0 z-30 bg-black/50 desk:hidden" />
      <aside
        aria-label="Details"
        data-feedback-context={element.name}
        className="fixed inset-x-0 bottom-0 z-40 flex max-h-[88dvh] flex-col rounded-t-xl border-t border-line bg-surface shadow-[0_-8px_24px_rgb(0_0_0/0.2)] desk:sticky desk:top-4 desk:z-auto desk:max-h-[calc(100dvh-2rem)] desk:w-[380px] desk:shrink-0 desk:self-start desk:rounded-md desk:border desk:shadow-none"
      >
        <div className="flex items-start gap-2 border-b border-line py-2 pr-1 pl-4">
          <div className="flex min-w-0 flex-1 flex-col gap-1 pt-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill status={element.status} reason={element.reason} assessment={element.reason === "wobbly"} />
              <span data-testid="detail-window-pill" className={`${NEUTRAL_PILL} tabular-nums`}>
                {windowLabel(element)}
              </span>
              {progress.total > 0 ? (
                <span
                  data-testid="detail-progress"
                  className={`text-sm tabular-nums ${progress.complete ? "font-semibold text-progress-fill" : "text-muted"}`}
                >
                  {progressLabel(progress)}
                </span>
              ) : null}
              {open && element.critical ? (
                <span className={`${MARK_PILL} ring-2 ring-accent ring-inset`}>Kritisch</span>
              ) : open && element.tight ? (
                <span className={`${MARK_PILL} border-2 border-dashed border-accent`}>Knapp</span>
              ) : null}
            </div>
            <h2 className="text-lg leading-snug font-semibold break-words">{element.name}</h2>
            <p className="text-sm text-muted">{meta.join(" · ")}</p>
            {element.status !== "ok" ? (
              <p data-testid="detail-reason" className="text-sm">
                {reasonText(element, names, dDay)}
              </p>
            ) : null}
            {cause ? (
              <p data-testid="detail-cause" className="text-sm">
                – {cause.before}
                <button
                  type="button"
                  onClick={() => onSelect(cause.id)}
                  className="font-medium text-primary underline underline-offset-2"
                >
                  {cause.name}
                </button>
                {cause.after}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Details schließen"
            className="flex size-11 shrink-0 items-center justify-center rounded-md text-2xl leading-none text-muted hover:bg-surface-2"
          >
            ×
          </button>
        </div>

        <div className="flex flex-col gap-4 overflow-y-auto px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          {showHint ? (
            <ReachHint onReach={() => props.onReach(element)} onDismiss={() => props.onHideHint(element.id)} />
          ) : null}
          <Section title="Lage">
            <div role="group" aria-label="Lage" className="grid grid-cols-2 gap-2">
              {PLACEMENT_ORDER.map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={open && placement === option}
                  disabled={!open}
                  onClick={() => {
                    if (placement !== option) {
                      void save("placement", () =>
                        setPlacement(element.id, option, option === "fixed" ? "offset" : undefined, seen)
                      );
                    }
                  }}
                  className="min-h-11 rounded-md border border-line px-2 py-1.5 text-sm leading-tight font-medium disabled:opacity-50 aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-on-primary not-aria-pressed:not-disabled:hover:bg-surface-2"
                >
                  {PLACEMENT_NAMES[option]}
                </button>
              ))}
            </div>
            {status("placement")}
            {open ? (
              <p data-testid="placement-hint" className="text-sm text-muted">
                {PLACEMENT_HINTS[placement]}
              </p>
            ) : (
              <p className="text-sm text-muted">Erreicht – die Lage gilt wieder, wenn du den Haken entfernst.</p>
            )}
            {open && placement === "fixed" ? (
              <FixedEditor
                key={version}
                element={element}
                variant={variant}
                dDay={dDay}
                onVariant={(next) => save("fixed", () => setPlacement(element.id, "fixed", next, seen))}
                onOffset={(days) => save("fixed", () => setFixedOffset(element.id, days, seen))}
                onDate={(date) => save("fixed", () => setFixedDate(element.id, date, seen))}
                status={status("fixed")}
                failed={failed("fixed")}
              />
            ) : null}
          </Section>

          <Section title="Zeitfenster">
            {element.done ? (
              <p data-testid="detail-window" className="tabular-nums">
                Erreicht am {formatWeekdayDate(element.end, dDay)}
              </p>
            ) : (
              <div className="rounded-md border border-line bg-surface-2 p-3">
                <dl data-testid="detail-window" className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 tabular-nums">
                  <dt className="text-muted">Frühestens</dt>
                  <dd data-testid="detail-earliest">{formatWeekdayDate(element.earliestStart, dDay)}</dd>
                  <dt className="text-muted">Spätestens</dt>
                  <dd>
                    {formatWeekdayDate(element.latestStart, dDay)}
                    {milestone ? null : ` (Ende ${formatWeekdayShort(dayToDate(element.latestEnd, dDay))})`}
                  </dd>
                  <dt className="text-muted">Geplant</dt>
                  <dd>
                    {milestone ? (
                      <span data-testid="detail-start">{dateWithD(element.start, dDay)}</span>
                    ) : (
                      <>
                        <span data-testid="detail-start">{formatWeekdayDate(element.start, dDay)}</span>
                        {" – "}
                        <span data-testid="detail-end">{formatWeekdayDate(element.end, dDay)}</span>
                      </>
                    )}
                  </dd>
                  <dt className="text-muted">Luft</dt>
                  <dd data-testid="detail-slack">
                    {placement === "fixed" ? "fester Termin" : element.slack > 0 ? daysLong(element.slack) : "keine"}
                  </dd>
                </dl>
                {element.running ? (
                  <p className="mt-1 text-sm text-muted">
                    läuft seit {formatWeekdayShort(dayToDate(element.start, dDay))}
                  </p>
                ) : null}
              </div>
            )}
            {open ? (
              <div role="group" aria-label="Verschieben" className="grid grid-cols-4 gap-2 desk:hidden">
                {[-7, -1, 1, 7].map((delta) => (
                  <button
                    key={delta}
                    type="button"
                    onClick={() => void drag(element.id, "move", delta)}
                    className={SMALL_BUTTON}
                  >
                    {delta < 0 ? `−${-delta} T` : `+${delta} T`}
                  </button>
                ))}
              </div>
            ) : null}
          </Section>

          <Section title="Zuständig">
            <div key={version} className="flex flex-col gap-3">
              <Labeled label="AK" status={status("group")}>
                <select
                  defaultValue={element.workingGroupId ?? ""}
                  onChange={(event) =>
                    save("group", () =>
                      updateElement(element.id, { workingGroupId: event.target.value || null }, seen)
                    )
                  }
                  className={INPUT}
                >
                  <option value="">– ohne AK –</option>
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {displayGroupName(group.name)}
                    </option>
                  ))}
                </select>
              </Labeled>
              <Labeled label="Aufgabenbereich" status={status("department")}>
                <select
                  defaultValue={element.departmentId ?? ""}
                  onChange={(event) =>
                    save("department", () =>
                      updateElement(element.id, { departmentId: event.target.value || null }, seen)
                    )
                  }
                  className={INPUT}
                >
                  <option value="">– keiner –</option>
                  {groupDepartments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </select>
              </Labeled>
              <Labeled label="Verantwortlich" status={status("owner")}>
                <select
                  defaultValue={element.ownerId ?? ""}
                  onChange={(event) =>
                    save("owner", () => updateElement(element.id, { ownerId: event.target.value || null }, seen))
                  }
                  className={INPUT}
                >
                  <option value="">– niemand –</option>
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
                </select>
              </Labeled>
            </div>
          </Section>

          <Section title="Element">
            <div key={version} className="flex flex-col gap-3">
              <Labeled label="Name" status={status("name")}>
                <input
                  type="text"
                  defaultValue={element.name}
                  maxLength={120}
                  onBlur={(event) => {
                    const value = event.target.value;
                    if (value.trim() !== element.name) {
                      void save("name", () => updateElement(element.id, { name: value }, seen));
                    }
                  }}
                  aria-invalid={failed("name")}
                  className={INPUT}
                />
              </Labeled>
              <div role="group" aria-label="Art" className="flex overflow-hidden rounded-md border border-line">
                {(
                  [
                    ["milestone", "Meilenstein"],
                    ["task", "Vorgang"],
                  ] as const
                ).map(([kind, label]) => (
                  <button
                    key={kind}
                    type="button"
                    aria-pressed={element.kind === kind}
                    onClick={() => {
                      if (element.kind !== kind) void save("kind", () => updateElement(element.id, { kind }, seen));
                    }}
                    className="min-h-11 flex-1 font-medium not-first:border-l not-first:border-line aria-pressed:bg-primary aria-pressed:text-on-primary not-aria-pressed:hover:bg-surface-2"
                  >
                    {label}
                  </button>
                ))}
              </div>
              {status("kind")}
              {milestone ? null : (
                <Labeled label="Dauer in Tagen" status={status("duration")}>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={365}
                    defaultValue={element.durationDays}
                    onBlur={(event) => {
                      const value = toInt(event.target.value);
                      if (value !== element.durationDays) {
                        void save("duration", () => updateElement(element.id, { durationDays: value }, seen));
                      }
                    }}
                    aria-invalid={failed("duration")}
                    className={`${INPUT} w-28`}
                  />
                </Labeled>
              )}
            </div>
          </Section>

          <Section title="Status">
            <div key={version} className="flex flex-col">
              <label className="flex min-h-11 items-center gap-3">
                <input
                  type="checkbox"
                  defaultChecked={element.done}
                  onChange={(event) => act("status", () => setDone(element.id, event.target.checked, seen))}
                  className={CHECKBOX}
                />
                <span>Erreicht</span>
              </label>
              <label className="flex min-h-11 items-center gap-3 has-disabled:opacity-50">
                <input
                  type="checkbox"
                  defaultChecked={element.wobbly}
                  disabled={element.done}
                  onChange={(event) => save("wobbly", () => setWobbly(element.id, event.target.checked, seen))}
                  className={CHECKBOX}
                />
                <span>Wackelt (Einschätzung)</span>
              </label>
              {status("wobbly")}
              <FieldError message={errors.status} />
            </div>
          </Section>

          <TodoSection
            element={element}
            members={members}
            today={today}
            dDay={dDay}
            save={save}
            act={act}
            status={status}
            errors={errors}
          />

          <NoteSection element={element} save={save} act={act} status={status} errors={errors} />

          <Section title="Vorgänger">
            <LinkList
              rows={predecessors}
              direction="from"
              onSelect={onSelect}
              onLag={(row, lag) =>
                save(`link-${row.link.id}`, () => updateLinkLag(row.link.id, lag, { id: element.id, updatedAt: seen }))
              }
              onRemove={(row) =>
                act(`unlink-${row.link.id}`, () => removeLink(row.link.id, { id: element.id, updatedAt: seen }))
              }
              status={status}
              errors={errors}
              version={version}
              empty="Keine – frühestens ab heute."
            />
            <AddLink
              label="Vorgänger wählen"
              options={predecessorOptions}
              onAdd={(id, lag) =>
                save("add-predecessor", () => addLink(id!, element.id, lag, { id: element.id, updatedAt: seen }))
              }
              status={status("add-predecessor")}
            />
          </Section>

          <Section title="Nachfolger">
            <LinkList
              rows={successors}
              direction="to"
              onSelect={onSelect}
              onLag={(row, lag) =>
                save(`link-${row.link.id}`, () => updateLinkLag(row.link.id, lag, { id: element.id, updatedAt: seen }))
              }
              onRemove={(row) =>
                act(`unlink-${row.link.id}`, () => removeLink(row.link.id, { id: element.id, updatedAt: seen }))
              }
              status={status}
              errors={errors}
              version={version}
            />
            <AddLink
              label="Nachfolger wählen"
              options={successorOptions}
              onAdd={(id, lag) =>
                save("add-successor", () => addLink(element.id, id, lag, { id: element.id, updatedAt: seen }))
              }
              status={status("add-successor")}
            />
            <p className="text-sm text-muted">Nur Ende → Start. Kreise sind ausgeschlossen.</p>
            <p className="text-sm text-muted">Abstände sind Mindestabstände. 0 heißt: nur die Reihenfolge zählt.</p>
          </Section>

          <HistorySection elementId={element.id} updatedAt={element.updatedAt} />

          <section className="flex flex-col gap-2 border-t border-line pt-3">
            {confirmDelete ? (
              <div role="group" aria-label="Element löschen" className="flex flex-col gap-2 rounded-md border border-status-late p-3">
                <p className="font-semibold">„{element.name}“ löschen?</p>
                <p className="text-sm">
                  Vorgänger werden mit den Nachfolgern verbunden. {element.todos.length} To-dos und{" "}
                  {element.notes.length} Notizen werden mitgelöscht.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      if (await act("delete", () => deleteElement(element.id, seen))) onClose();
                    }}
                    className="min-h-11 rounded-md bg-status-late px-4 font-semibold text-on-status-late hover:opacity-90"
                  >
                    Löschen
                  </button>
                  <button type="button" onClick={() => setConfirmDelete(false)} className={SMALL_BUTTON}>
                    Abbrechen
                  </button>
                </div>
                <FieldError message={errors.delete} />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className={`${SMALL_BUTTON} self-start text-status-late`}
              >
                Element löschen
              </button>
            )}
          </section>
        </div>
      </aside>
    </>
  );
}

type Save = (field: string, call: () => Promise<PlanResult>) => Promise<boolean>;

/** An error message of the panel actions as a save outcome; the generic one adds nothing. */
function toOutcome(message: string | null): SaveOutcome {
  if (message === null) return { ok: true };
  return { ok: false, message: message === SAVE_ERROR ? undefined : message };
}

function LinkList({
  rows,
  direction,
  onSelect,
  onLag,
  onRemove,
  status,
  errors,
  version,
  empty,
}: {
  rows: LinkRow[];
  direction: "from" | "to";
  onSelect: (id: string) => void;
  onLag: (row: LinkRow, lag: number) => void;
  onRemove: (row: LinkRow) => void;
  status: FieldStatus;
  errors: Record<string, string | null>;
  version: string;
  /** Text without links; "Noch keine." by default. */
  empty?: string;
}) {
  if (rows.length === 0) return empty ? <p className="text-muted">{empty}</p> : EMPTY;
  return (
    <ul className="flex flex-col gap-1">
      {rows.map((row) => (
        <li key={row.link.id} className="flex flex-col">
          <div className="flex items-center gap-2">
            {row.id === null ? (
              <span className="flex min-h-11 min-w-0 flex-1 items-center">{row.name}</span>
            ) : (
              <button
                type="button"
                onClick={() => onSelect(row.id!)}
                className="flex min-h-11 min-w-0 flex-1 items-center rounded-sm text-left break-words text-primary underline-offset-2 hover:underline"
              >
                {row.name}
              </button>
            )}
            <label className="flex shrink-0 items-center gap-1 text-sm text-muted">
              mind.
              <input
                key={`${version}-${row.link.lagDays}`}
                type="number"
                inputMode="numeric"
                min={0}
                max={365}
                defaultValue={row.link.lagDays}
                aria-label={direction === "from" ? `Abstand von ${row.name} in Tagen` : `Abstand zu ${row.name} in Tagen`}
                onBlur={(event) => {
                  const value = toInt(event.target.value);
                  if (value !== row.link.lagDays) onLag(row, value);
                }}
                className={`${INPUT} w-16 text-text`}
              />
              {/* The element starts at least N days after a predecessor, ends at least N days before a successor. */}
              {direction === "from" ? "T danach" : "T davor"}
            </label>
            <button
              type="button"
              aria-label={`Verbindung mit ${row.name} lösen`}
              onClick={() => onRemove(row)}
              className={REMOVE_BUTTON}
            >
              ×
            </button>
          </div>
          {status(`link-${row.link.id}`)}
          <FieldError message={errors[`unlink-${row.link.id}`]} />
        </li>
      ))}
    </ul>
  );
}

function AddLink({
  label,
  options,
  onAdd,
  status,
}: {
  label: string;
  options: { id: string | null; name: string }[];
  /** `lag` = the minimum lag of the new link (spec 025, 0 by default). */
  onAdd: (id: string | null, lag: number) => Promise<boolean>;
  status: ReactNode;
}) {
  const [value, setValue] = useState("");
  const [lag, setLag] = useState("0");
  const valueOf = (id: string | null) => id ?? "dday";
  const chosen = options.find((option) => valueOf(option.id) === value);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap gap-2">
        <select
          aria-label={label}
          value={chosen ? value : ""}
          onChange={(event) => setValue(event.target.value)}
          className={`${INPUT} min-w-0 flex-1 basis-40`}
        >
          <option value="">{label} …</option>
          {options.map((option) => (
            <option key={valueOf(option.id)} value={valueOf(option.id)}>
              {option.name}
            </option>
          ))}
        </select>
        <label className="flex shrink-0 items-center gap-1 text-sm text-muted">
          mind.
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={365}
            value={lag}
            onChange={(event) => setLag(event.target.value)}
            aria-label={`${label}: Mindestabstand in Tagen`}
            className={`${INPUT} w-16 text-text`}
          />
          T
        </label>
        <button
          type="button"
          disabled={!chosen}
          onClick={async () => {
            if (chosen && (await onAdd(chosen.id, toInt(lag)))) {
              setValue("");
              setLag("0");
            }
          }}
          className={SMALL_BUTTON}
        >
          Verbinden
        </button>
      </div>
      {status}
    </div>
  );
}

/**
 * "Fest" (spec 025): variant "Tage vor der Krachparade" (N, saved when
 * leaving the field) or "Festes Datum" (saved as soon as a complete valid
 * date is entered). Both refer to the start of a task.
 */
function FixedEditor({
  element,
  variant,
  dDay,
  onVariant,
  onOffset,
  onDate,
  status,
  failed,
}: {
  element: PlanViewElement;
  variant: FixedVariant;
  dDay: string;
  onVariant: (variant: FixedVariant) => void;
  onOffset: (days: number) => void;
  onDate: (date: string) => void;
  status: ReactNode;
  failed: boolean;
}) {
  const task = element.kind === "task";
  return (
    <div className="flex flex-col gap-2">
      <div role="group" aria-label="Fest" className="flex overflow-hidden rounded-md border border-line">
        {(
          [
            ["offset", "Tage vor der Krachparade"],
            ["date", "Festes Datum"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={variant === value}
            onClick={() => {
              if (variant !== value) onVariant(value);
            }}
            className="min-h-11 flex-1 px-2 text-sm font-medium not-first:border-l not-first:border-line aria-pressed:bg-primary aria-pressed:text-on-primary not-aria-pressed:hover:bg-surface-2"
          >
            {label}
          </button>
        ))}
      </div>
      {variant === "offset" ? (
        <div className="flex flex-col gap-1">
          <label className="flex flex-wrap items-center gap-2">
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={365}
              defaultValue={element.fixedOffsetDays ?? 0}
              aria-label="Tage vor der Krachparade"
              aria-invalid={failed}
              onBlur={(event) => {
                const value = toInt(event.target.value);
                if (value !== element.fixedOffsetDays) onOffset(value);
              }}
              className={`${INPUT} w-24`}
            />
            <span>Tage vor der {D_DAY_NAME}</span>
          </label>
          <p data-testid="fixed-date-line" className="text-sm text-muted tabular-nums">
            {task ? "Start" : "Am"} {formatWeekdayDate(element.start, dDay)}
          </p>
        </div>
      ) : (
        <Labeled label="Festes Datum">
          <input
            type="date"
            defaultValue={element.fixedDate ?? dayToDate(element.start, dDay)}
            aria-invalid={failed}
            onChange={(event) => {
              const value = event.target.value;
              // Date fields only report complete, valid dates (or nothing).
              if (/^\d{4}-\d{2}-\d{2}$/.test(value) && value !== element.fixedDate) onDate(value);
            }}
            className={`${INPUT} w-48`}
          />
        </Labeled>
      )}
      {task ? <p className="text-sm text-muted">Bezieht sich auf den Start.</p> : null}
      {status}
    </div>
  );
}

function TodoSection({
  element,
  members,
  today,
  dDay,
  save,
  act,
  status,
  errors,
}: {
  element: PlanViewElement;
  members: readonly PlanOption[];
  today: number;
  dDay: string;
  save: Save;
  act: Save;
  status: FieldStatus;
  errors: Record<string, string | null>;
}) {
  const hintId = useId();
  // Kept in state for the due date line below the fields (spec 023).
  const [days, setDays] = useState("0");
  const [anchor, setAnchor] = useState<"start" | "end">("start");
  const daysBefore = toInt(days);
  const previewDue =
    Number.isInteger(daysBefore) && daysBefore >= 0 && daysBefore <= 365
      ? todoDueDay({ anchor, daysBefore }, { plannedStart: element.start, plannedEnd: element.end })
      : null;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    // Emptied inside the save, so that "nochmal" empties it too.
    await save("add-todo", async () => {
      const result = await addTodo(element.id, {
        text: String(data.get("text") ?? ""),
        ownerId: String(data.get("owner") ?? "") || null,
        anchor: data.get("anchor") === "end" ? "end" : "start",
        daysBefore: toInt(String(data.get("days") ?? "")),
      });
      if (result.ok) {
        form.reset();
        setDays("0");
        setAnchor("start");
      }
      return result;
    });
  };

  return (
    <Section title="To-dos & Voraussetzungen">
      {element.todos.length === 0 ? (
        EMPTY
      ) : (
        <ul className="flex flex-col gap-1">
          {element.todos.map((todo) => {
            const overdue = !todo.done && todo.due < today;
            return (
              <li key={todo.id} className="flex flex-col">
                <div className="flex items-start gap-2">
                  <label className="flex min-h-11 min-w-0 flex-1 items-start gap-3 py-2.5">
                    <input
                      key={`${todo.id}-${todo.done}`}
                      type="checkbox"
                      defaultChecked={todo.done}
                      aria-label={`Erledigt: ${todo.text}`}
                      onChange={(event) => act(`todo-${todo.id}`, () => toggleTodo(todo.id, event.target.checked))}
                      className={`${CHECKBOX} mt-0.5`}
                    />
                    <span className="min-w-0 flex-1">
                      <span className={`block break-words ${todo.done ? "text-muted line-through" : ""}`}>
                        {todo.text}
                      </span>
                      <span className={`block text-sm ${overdue ? "font-semibold text-status-late" : "text-muted"}`}>
                        {[todo.ownerName, dueText(todo, dDay)].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                  </label>
                  <button
                    type="button"
                    aria-label={`To-do löschen: ${todo.text}`}
                    onClick={() => act(`todo-${todo.id}`, () => deleteTodo(todo.id))}
                    className={REMOVE_BUTTON}
                  >
                    ×
                  </button>
                </div>
                <FieldError message={errors[`todo-${todo.id}`]} />
              </li>
            );
          })}
        </ul>
      )}
      <form onSubmit={submit} aria-label="To-do hinzufügen" className="flex flex-col gap-2">
        <input
          name="text"
          type="text"
          maxLength={200}
          required
          placeholder="Neues To-do"
          aria-label="Neues To-do"
          aria-describedby={hintId}
          className={INPUT}
        />
        <div className="flex flex-wrap gap-2">
          <select name="owner" aria-label="Wer?" defaultValue="" className={`${INPUT} min-w-0 flex-1`}>
            <option value="">wer? (optional)</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </select>
          <span className="flex items-center gap-2">
            <input
              name="days"
              type="number"
              inputMode="numeric"
              min={0}
              max={365}
              value={days}
              onChange={(event) => setDays(event.target.value)}
              aria-label="Tage vorher"
              className={`${INPUT} w-20`}
            />
            <span aria-hidden>Tage</span>
          </span>
          <select
            name="anchor"
            aria-label="Bezug"
            value={anchor}
            onChange={(event) => setAnchor(event.target.value === "end" ? "end" : "start")}
            className={`${INPUT} min-w-0`}
          >
            <option value="start">vor Start des Elements</option>
            <option value="end">vor Ende des Elements</option>
          </select>
        </div>
        <p data-testid="todo-due-preview" aria-live="polite" className="text-sm text-muted tabular-nums">
          {previewDue === null ? " " : `fällig am ${formatWeekdayShort(dayToDate(previewDue, dDay))}`}
        </p>
        <button type="submit" className={`${PRIMARY_BUTTON} self-start`}>
          Hinzufügen
        </button>
        <p id={hintId} className="text-sm text-muted">
          {PRIVACY_HINT}
        </p>
        {status("add-todo")}
      </form>
    </Section>
  );
}

function NoteSection({
  element,
  save,
  act,
  status,
  errors,
}: {
  element: PlanViewElement;
  save: Save;
  act: Save;
  status: FieldStatus;
  errors: Record<string, string | null>;
}) {
  return (
    <Section title="Notizen">
      <NoteHistory
        notes={element.notes}
        onAdd={(text) => addNote(element.id, text)}
        onUpdate={updateNote}
        onDelete={deleteNote}
        save={save}
        act={act}
        status={status}
        errors={errors}
      />
    </Section>
  );
}

type History = { entries: { id: string; text: string }[]; total: number } | { error: string } | null;

/** The last 10 plan changes, "Alle anzeigen" loads the rest (loaded from the server). */
function HistorySection({ elementId, updatedAt }: { elementId: string; updatedAt: string }) {
  const [showAll, setShowAll] = useState(false);
  const [history, setHistory] = useState<History>(null);

  useEffect(() => {
    let current = true;
    loadPlanHistory(elementId, showAll).then(
      (result) => {
        if (current) setHistory(result.ok ? { entries: result.entries, total: result.total } : { error: result.message });
      },
      () => {
        if (current) setHistory({ error: "Verlauf konnte nicht geladen werden." });
      }
    );
    return () => {
      current = false;
    };
  }, [elementId, updatedAt, showAll]);

  return (
    <Section title="Verlauf">
      {history === null ? (
        <p className="text-muted">Lade Verlauf …</p>
      ) : "error" in history ? (
        <p className="text-status-late">{history.error}</p>
      ) : history.entries.length === 0 ? (
        EMPTY
      ) : (
        <>
          <ul className="flex flex-col gap-1 text-sm">
            {history.entries.map((entry) => (
              <li key={entry.id} className="break-words">
                {entry.text}
              </li>
            ))}
          </ul>
          {history.total > history.entries.length ? (
            <button type="button" onClick={() => setShowAll(true)} className={`${SMALL_BUTTON} self-start`}>
              Alle anzeigen ({history.total})
            </button>
          ) : null}
        </>
      )}
    </Section>
  );
}
