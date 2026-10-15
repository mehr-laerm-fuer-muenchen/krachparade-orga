"use client";

import { useId, type KeyboardEvent } from "react";
import { groupDepartmentOptions } from "@/lib/department-groups";
import { ITEM_KIND_LABELS, ITEM_KINDS, type ItemKind } from "@/lib/protocol-rules";
import { OwnerPicker } from "./owner-picker";
import { INPUT, type DepartmentOption, type Owner, type Person } from "./types";

/**
 * Alt+1 … Alt+4 picks the kind. `code` instead of `key`: on a Mac, Option+1
 * types "¡", the physical key stays "Digit1".
 */
export function kindFromShortcut(event: KeyboardEvent): ItemKind | null {
  if (!event.altKey || event.ctrlKey || event.metaKey) return null;
  const match = /^(?:Digit|Numpad)([1-4])$/.exec(event.code);
  return match ? ITEM_KINDS[Number(match[1]) - 1] : null;
}

/** Kind as a row of radio buttons with the shortcut as hint. */
export function KindPicker({ value, onChange }: { value: ItemKind; onChange: (kind: ItemKind) => void }) {
  const name = useId();
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="sr-only">Typ</legend>
      <div className="grid grid-cols-2 gap-1 sm:flex sm:flex-wrap">
        {ITEM_KINDS.map((kind, index) => (
          <label
            key={kind}
            title={`Alt+${index + 1}`}
            className={`flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-md border px-3 font-medium has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent ${
              value === kind
                ? "border-primary bg-primary text-on-primary"
                : "border-line-strong bg-surface text-text hover:bg-surface-2"
            }`}
          >
            <input
              type="radio"
              name={name}
              value={kind}
              checked={value === kind}
              onChange={() => onChange(kind)}
              className="sr-only"
            />
            {ITEM_KIND_LABELS[kind]}
            <span className={`hidden text-xs desk:inline ${value === kind ? "opacity-80" : "text-muted"}`}>
              Alt+{index + 1}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Wer, Bis wann (to-dos only) and Aufgabenbereich (grouped by working group). */
export function ItemExtraFields({
  kind,
  people,
  departments,
  owner,
  onOwnerChange,
  dueDate,
  onDueDateChange,
  departmentId,
  onDepartmentChange,
}: {
  kind: ItemKind;
  people: readonly Person[];
  departments: readonly DepartmentOption[];
  owner: Owner;
  onOwnerChange: (owner: Owner) => void;
  dueDate: string;
  onDueDateChange: (date: string) => void;
  departmentId: string;
  onDepartmentChange: (id: string) => void;
}) {
  const id = useId();
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {kind === "todo" ? (
        <>
          <OwnerPicker people={people} value={owner} onChange={onOwnerChange} />
          <div className="flex flex-col gap-1">
            <label htmlFor={`${id}-due`}>Bis wann</label>
            <input
              id={`${id}-due`}
              type="date"
              value={dueDate}
              onChange={(event) => onDueDateChange(event.target.value)}
              className={INPUT}
            />
          </div>
        </>
      ) : null}
      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-department`}>Aufgabenbereich</label>
        <select
          id={`${id}-department`}
          value={departmentId}
          onChange={(event) => onDepartmentChange(event.target.value)}
          className={INPUT}
        >
          <option value="">– kein Aufgabenbereich –</option>
          {groupDepartmentOptions(departments).map((group) => (
            <optgroup key={group.label} label={group.label}>
              {group.options.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
    </div>
  );
}
