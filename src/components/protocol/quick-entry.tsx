"use client";

import { useEffect, useId, useRef, useState, useTransition, type FormEvent } from "react";
import { createMeetingItem } from "@/actions/meetings";
import type { ItemKind } from "@/lib/protocol-rules";
import { ItemExtraFields, KindPicker, kindFromShortcut } from "./item-fields";
import { ownerFields } from "./owner-picker";
import { INPUT, PRIMARY_BUTTON, type DepartmentOption, type Owner, type Person } from "./types";

/**
 * Entry at the end of a TOP: kind (Alt+1 … Alt+4), text, Enter saves. The
 * text field is emptied and keeps the focus; kind and department stay.
 */
export function QuickEntry({
  meetingId,
  topic,
  people,
  departments,
  autoFocus,
}: {
  meetingId: string;
  topic: string;
  people: readonly Person[];
  departments: readonly DepartmentOption[];
  autoFocus: boolean;
}) {
  const id = useId();
  const textRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<ItemKind>("info");
  const [text, setText] = useState("");
  const [owner, setOwner] = useState<Owner>(null);
  const [dueDate, setDueDate] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (autoFocus) textRef.current?.focus();
  }, [autoFocus]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const value = text.trim();
    if (!value) return;
    const fields = {
      kind,
      text: value,
      ...ownerFields(kind === "todo" ? owner : null),
      dueDate: kind === "todo" && dueDate ? dueDate : null,
      departmentId: departmentId || null,
    };
    // Empty at once so the next item can be typed while this one saves.
    setText("");
    setOwner(null);
    setDueDate("");
    setError(null);
    textRef.current?.focus();
    startTransition(async () => {
      const result = await createMeetingItem(meetingId, topic, fields);
      if (!result.ok) {
        setError(result.message);
        setText((current) => current || value);
      }
    });
  }

  return (
    <form
      onSubmit={submit}
      onKeyDown={(event) => {
        const shortcut = kindFromShortcut(event);
        if (shortcut) {
          event.preventDefault();
          setKind(shortcut);
        }
      }}
      aria-label={`Neuer Punkt unter ${topic}`}
      className="flex flex-col gap-2 rounded-md border border-dashed border-line-strong bg-surface-2/50 p-3"
    >
      <KindPicker value={kind} onChange={setKind} />
      <div className="flex gap-2">
        <label htmlFor={`${id}-text`} className="sr-only">
          Text
        </label>
        <input
          ref={textRef}
          id={`${id}-text`}
          type="text"
          value={text}
          maxLength={2000}
          autoComplete="off"
          placeholder="Punkt eingeben, Enter speichert"
          onChange={(event) => setText(event.target.value)}
          className={INPUT}
        />
        <button type="submit" className={PRIMARY_BUTTON}>
          Speichern
        </button>
      </div>
      <ItemExtraFields
        kind={kind}
        people={people}
        departments={departments}
        owner={owner}
        onOwnerChange={setOwner}
        dueDate={dueDate}
        onDueDateChange={setDueDate}
        departmentId={departmentId}
        onDepartmentChange={setDepartmentId}
      />
      {error ? (
        <p role="alert" className="font-medium text-status-late">
          {error}
        </p>
      ) : null}
    </form>
  );
}
