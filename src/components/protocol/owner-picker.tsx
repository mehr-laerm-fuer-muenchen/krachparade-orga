"use client";

import { useId, useState, type KeyboardEvent } from "react";
import { INPUT, type Owner, type Person, personLabel } from "./types";

type Option = { key: string; label: string; owner: NonNullable<Owner> };

/**
 * "Wer" of a to-do: typing filters the active members; if none fits, the
 * typed name can be taken as "Ohne Account: …".
 */
export function OwnerPicker({
  people,
  value,
  onChange,
  label = "Wer",
}: {
  people: readonly Person[];
  value: Owner;
  onChange: (owner: Owner) => void;
  label?: string;
}) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);

  if (value) {
    const person = "memberId" in value ? people.find((entry) => entry.id === value.memberId) : undefined;
    const text =
      "memberId" in value ? (person ? personLabel(person) : "Unbekannt") : `Ohne Account: ${value.name}`;
    return (
      <div className="flex flex-col gap-1">
        <span id={`${id}-label`}>{label}</span>
        <div
          role="group"
          aria-labelledby={`${id}-label`}
          className="flex min-h-11 items-center justify-between gap-2 rounded-md border border-line-strong bg-surface-2 pl-3"
        >
          <span className="min-w-0 truncate">{text}</span>
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label={`${label}: ${text} entfernen`}
            className="flex size-11 shrink-0 items-center justify-center rounded-md text-lg text-muted hover:text-text"
          >
            ×
          </button>
        </div>
      </div>
    );
  }

  const typed = query.trim();
  const needle = typed.toLocaleLowerCase("de");
  const matches = people.filter(
    (person) => person.active && person.name.toLocaleLowerCase("de").includes(needle)
  );
  const options: Option[] = matches.slice(0, 8).map((person) => ({
    key: person.id,
    label: person.name,
    owner: { memberId: person.id },
  }));
  const exact = matches.some((person) => person.name.toLocaleLowerCase("de") === needle);
  if (typed && !exact) {
    options.push({ key: "free", label: `Ohne Account: ${typed.slice(0, 80)}`, owner: { name: typed.slice(0, 80) } });
  }
  const showList = open && options.length > 0;
  const active = Math.min(highlight, options.length - 1);

  function choose(option: Option) {
    onChange(option.owner);
    setQuery("");
    setOpen(false);
    setHighlight(0);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setHighlight((active + 1) % Math.max(options.length, 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      setHighlight((active - 1 + options.length) % Math.max(options.length, 1));
    } else if (event.key === "Enter" && showList && typed) {
      // Picks the highlighted entry instead of saving the item.
      event.preventDefault();
      choose(options[active]);
    } else if (event.key === "Escape" && open) {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
    }
  }

  return (
    <div className="relative flex flex-col gap-1">
      <label htmlFor={`${id}-input`}>{label}</label>
      <input
        id={`${id}-input`}
        type="text"
        role="combobox"
        aria-expanded={showList}
        aria-controls={`${id}-list`}
        aria-autocomplete="list"
        aria-activedescendant={showList ? `${id}-option-${active}` : undefined}
        autoComplete="off"
        placeholder="Name tippen"
        value={query}
        maxLength={80}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
          setHighlight(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        className={INPUT}
      />
      {showList ? (
        <ul
          id={`${id}-list`}
          role="listbox"
          aria-label={label}
          className="absolute top-full right-0 left-0 z-10 mt-1 max-h-72 overflow-auto rounded-md border border-line-strong bg-surface shadow-md"
        >
          {options.map((option, index) => (
            <li
              key={option.key}
              id={`${id}-option-${index}`}
              role="option"
              aria-selected={index === active}
              // mousedown keeps the focus in the input until the choice is made.
              onMouseDown={(event) => {
                event.preventDefault();
                choose(option);
              }}
              className={`flex min-h-11 cursor-pointer items-center px-3 ${
                index === active ? "bg-surface-2 font-medium" : ""
              }`}
            >
              {option.label}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function ownerFromItem(item: { ownerId: string | null; ownerName: string | null }): Owner {
  if (item.ownerId) return { memberId: item.ownerId };
  if (item.ownerName) return { name: item.ownerName };
  return null;
}

export function ownerFields(owner: Owner): { ownerId: string | null; ownerName: string | null } {
  if (!owner) return { ownerId: null, ownerName: null };
  return "memberId" in owner ? { ownerId: owner.memberId, ownerName: null } : { ownerId: null, ownerName: owner.name };
}
