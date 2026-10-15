"use client";

import { useEffect, useState, type FormEvent } from "react";
import { createElement } from "@/actions/plan";
import type { GanttGroup } from "@/lib/gantt-layout";
import { displayGroupName } from "@/lib/working-groups";

const INPUT = "min-h-11 rounded-md border border-line-strong bg-surface px-3 text-base";

/**
 * Short form for a new plan element (spec 008): a small window on laptops,
 * a sheet on phones. Every element gets a successor (default: the D-Day).
 */
export function PlanNewElement({
  groups,
  elements,
  defaultGroupId,
  onCreated,
  onClose,
}: {
  groups: readonly GanttGroup[];
  elements: readonly { id: string; name: string }[];
  defaultGroupId: string | null;
  onCreated: (id: string) => void;
  onClose: () => void;
}) {
  const [kind, setKind] = useState<"milestone" | "task">("task");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const successors = [...elements].sort((a, b) => a.name.localeCompare(b.name, "de"));

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const number = (key: string) => {
      const value = String(data.get(key) ?? "").trim();
      return value === "" ? Number.NaN : Number(value);
    };
    setPending(true);
    try {
      const result = await createElement({
        name: String(data.get("name") ?? ""),
        workingGroupId: String(data.get("group") ?? "") || null,
        kind,
        durationDays: kind === "task" ? number("duration") : undefined,
        successorId: data.get("successor") === "dday" ? null : String(data.get("successor") ?? ""),
        lagDays: number("lag"),
      });
      if (result.ok) onCreated(result.id);
      else setError(result.message);
    } catch {
      setError("Konnte nicht gespeichert werden.");
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <div aria-hidden onClick={onClose} className="fixed inset-0 z-40 bg-black/50" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Neues Element"
        className="fixed inset-x-0 bottom-0 z-50 max-h-[88dvh] overflow-y-auto rounded-t-xl border-t border-line bg-surface desk:inset-x-auto desk:top-24 desk:bottom-auto desk:left-1/2 desk:w-[420px] desk:-translate-x-1/2 desk:rounded-md desk:border desk:shadow-xl"
      >
        <form
          onSubmit={submit}
          className="flex flex-col gap-3 px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] desk:pb-4"
        >
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Neues Element</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Formular schließen"
              className="flex size-11 items-center justify-center rounded-md text-2xl leading-none text-muted hover:bg-surface-2"
            >
              ×
            </button>
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-sm text-muted">Name</span>
            <input name="name" type="text" required maxLength={120} autoFocus className={INPUT} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm text-muted">AK</span>
            <select name="group" defaultValue={defaultGroupId ?? ""} className={INPUT}>
              <option value="">– ohne AK –</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {displayGroupName(group.name)}
                </option>
              ))}
            </select>
          </label>
          <div role="group" aria-label="Art" className="flex overflow-hidden rounded-md border border-line">
            {(
              [
                ["milestone", "Meilenstein"],
                ["task", "Vorgang"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={kind === value}
                onClick={() => setKind(value)}
                className="min-h-11 flex-1 font-medium not-first:border-l not-first:border-line aria-pressed:bg-primary aria-pressed:text-on-primary not-aria-pressed:hover:bg-surface-2"
              >
                {label}
              </button>
            ))}
          </div>
          {kind === "task" ? (
            <label className="flex flex-col gap-1">
              <span className="text-sm text-muted">Dauer in Tagen</span>
              <input
                name="duration"
                type="number"
                inputMode="numeric"
                min={1}
                max={365}
                defaultValue={7}
                className={`${INPUT} w-28`}
              />
            </label>
          ) : null}
          <div className="flex gap-2">
            <label className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="text-sm text-muted">Nachfolger</span>
              <select name="successor" required defaultValue="dday" className={INPUT}>
                <option value="dday">D-Day</option>
                {successors.map((element) => (
                  <option key={element.id} value={element.id}>
                    {element.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm text-muted">Abstand (T)</span>
              <input
                name="lag"
                type="number"
                inputMode="numeric"
                min={0}
                max={365}
                defaultValue={0}
                className={`${INPUT} w-24`}
              />
            </label>
          </div>
          {error ? (
            <p role="alert" className="font-medium text-status-late">
              {error}
            </p>
          ) : null}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pending}
              className="min-h-11 rounded-md bg-primary px-4 font-semibold text-on-primary hover:opacity-90 disabled:opacity-50"
            >
              Anlegen
            </button>
            <button
              type="button"
              onClick={onClose}
              className="min-h-11 rounded-md border border-line bg-surface px-4 font-medium hover:bg-surface-2"
            >
              Abbrechen
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
