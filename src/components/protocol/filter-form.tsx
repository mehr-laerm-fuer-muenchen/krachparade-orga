"use client";

import Form from "next/form";
import type { ReactNode } from "react";
import type { DepartmentOptionGroup } from "@/lib/department-groups";

const INPUT =
  "min-h-11 w-full rounded-md border border-line-strong bg-surface px-3 text-base text-text";

/** Filters as URL search params; choosing in a select applies it at once. */
export function FilterForm({
  action,
  hidden = {},
  children,
}: {
  action: string;
  hidden?: Record<string, string>;
  children: ReactNode;
}) {
  return (
    <Form
      action={action}
      replace
      scroll={false}
      onChange={(event) => {
        if (event.target instanceof HTMLSelectElement) event.currentTarget.requestSubmit();
      }}
      className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end"
    >
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {children}
      <button
        type="submit"
        className="min-h-11 shrink-0 rounded-md border border-line-strong bg-surface px-3 font-medium text-text hover:bg-surface-2"
      >
        Filtern
      </button>
    </Form>
  );
}

export function FilterSelect({
  label,
  name,
  value,
  options,
  emptyLabel,
}: {
  label: string;
  name: string;
  value: string;
  options: readonly { value: string; label: string }[];
  emptyLabel: string;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1 sm:w-56">
      <span>{label}</span>
      <select name={name} defaultValue={value} className={INPUT}>
        <option value="">{emptyLabel}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Departments as a filter, one `optgroup` per working group. */
export function FilterDepartmentSelect({
  name,
  value,
  groups,
}: {
  name: string;
  value: string;
  groups: readonly DepartmentOptionGroup[];
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1 sm:w-56">
      <span>Aufgabenbereich</span>
      <select name={name} defaultValue={value} className={INPUT}>
        <option value="">Alle Aufgabenbereiche</option>
        {groups.map((group) => (
          <optgroup key={group.label} label={group.label}>
            {group.options.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}

export function FilterSearch({ label, name, value }: { label: string; name: string; value: string }) {
  return (
    <label className="flex min-w-0 flex-1 flex-col gap-1 sm:min-w-56">
      <span>{label}</span>
      <input type="search" name={name} defaultValue={value} autoComplete="off" className={INPUT} />
    </label>
  );
}
