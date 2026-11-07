"use client";

import { useId, useOptimistic, useState, useTransition, type FormEvent } from "react";
import { deleteMeetingItem, moveMeetingItem, setTodoDone, updateMeetingItem } from "@/actions/meetings";
import { ItemKindBadge } from "@/components/item-kind-badge";
import { useSaveStatus, type FieldStatus, type TrackSave } from "@/components/save-status";
import { formatGermanDate } from "@/lib/dday";
import { departmentLabel } from "@/lib/department-groups";
import { isOverdue, type ItemKind } from "@/lib/protocol-rules";
import { ItemExtraFields, KindPicker, kindFromShortcut } from "./item-fields";
import { ItemTextArea } from "./item-text-area";
import { ownerFields, ownerFromItem } from "./owner-picker";
import {
  ICON_BUTTON,
  PRIMARY_BUTTON,
  SECONDARY_BUTTON,
  personLabel,
  type DepartmentOption,
  type ItemData,
  type Owner,
  type Person,
  type Report,
} from "./types";

/** One item: click on the text to edit it; to-dos can be ticked off directly. */
export function ItemRow({
  item,
  people,
  departments,
  today,
  isFirst,
  isLast,
  report,
}: {
  item: ItemData;
  people: readonly Person[];
  departments: readonly DepartmentOption[];
  today: string;
  isFirst: boolean;
  isLast: boolean;
  report: Report;
}) {
  const [editing, setEditing] = useState(false);
  // Here and not in the editor: "Gespeichert ✓" stays at the row after the editor closes.
  const { track, status } = useSaveStatus();
  const [pending, startTransition] = useTransition();
  // Ticks at once; the server result follows.
  const [done, setDone] = useOptimistic(item.done);
  const owner = item.ownerId ? people.find((person) => person.id === item.ownerId) : undefined;
  const department = departments.find((entry) => entry.id === item.departmentId);
  const overdue = isOverdue({ ...item, done }, today);

  if (editing) {
    return (
      <li className="border-b border-line px-3 py-3 last:border-b-0">
        <ItemEditor
          item={item}
          people={people}
          departments={departments}
          isFirst={isFirst}
          isLast={isLast}
          report={report}
          track={track}
          status={status}
          onClose={() => setEditing(false)}
        />
      </li>
    );
  }

  return (
    <li className="flex items-start gap-2 border-b border-line px-1 py-1 last:border-b-0">
      {item.kind === "todo" ? (
        <label className="flex size-11 shrink-0 cursor-pointer items-center justify-center">
          <input
            type="checkbox"
            checked={done}
            disabled={pending}
            onChange={(event) => {
              const next = event.target.checked;
              startTransition(async () => {
                setDone(next);
                report(await setTodoDone(item.id, next), next ? "Erledigt" : "Wieder offen");
              });
            }}
            aria-label={`Erledigt: ${item.text}`}
            className="size-5 accent-primary"
          />
        </label>
      ) : (
        <span className="size-11 shrink-0" aria-hidden />
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label={`Bearbeiten: ${item.text}`}
          className="flex min-h-11 min-w-0 flex-col items-start gap-1 rounded-md px-2 py-2 text-left hover:bg-surface-2"
        >
          <span className="flex flex-wrap items-center gap-2">
            <ItemKindBadge kind={item.kind} />
            <span className={`whitespace-pre-line break-words [overflow-wrap:anywhere] ${done ? "text-muted line-through" : ""}`}>
              {item.text}
            </span>
          </span>
          {item.kind === "todo" || department ? (
            <span className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
              {item.kind === "todo" && owner ? <span>Wer: {personLabel(owner)}</span> : null}
              {item.kind === "todo" && item.ownerName ? <span>Wer: {item.ownerName} (ohne Account)</span> : null}
              {item.kind === "todo" && item.dueDate ? (
                <span className={overdue ? "font-semibold text-status-late" : ""}>
                  bis {formatGermanDate(item.dueDate)}
                  {overdue ? " · überfällig" : ""}
                </span>
              ) : null}
              {department ? <span>Aufgabenbereich: {departmentLabel(department)}</span> : null}
            </span>
          ) : null}
        </button>
        <div className="px-2">{status("edit")}</div>
      </div>
    </li>
  );
}

function ItemEditor({
  item,
  people,
  departments,
  isFirst,
  isLast,
  report,
  track,
  status,
  onClose,
}: {
  item: ItemData;
  people: readonly Person[];
  departments: readonly DepartmentOption[];
  isFirst: boolean;
  isLast: boolean;
  report: Report;
  track: TrackSave;
  status: FieldStatus;
  onClose: () => void;
}) {
  const id = useId();
  const [kind, setKind] = useState<ItemKind>(item.kind);
  const [text, setText] = useState(item.text);
  const [owner, setOwner] = useState<Owner>(ownerFromItem(item));
  const [dueDate, setDueDate] = useState(item.dueDate ?? "");
  const [departmentId, setDepartmentId] = useState(item.departmentId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  /** "Gespeichert ✓" at the row; on an error the editor stays open with "nochmal". */
  function save(event: FormEvent) {
    event.preventDefault();
    const fields = {
      kind,
      text,
      ...ownerFields(kind === "todo" ? owner : null),
      dueDate: kind === "todo" && dueDate ? dueDate : null,
      departmentId: departmentId || null,
    };
    setError(null);
    void track("edit", async () => {
      const result = await updateMeetingItem(item.id, fields);
      if (result.ok) onClose();
      return result;
    });
  }

  function run(action: () => Promise<{ ok: true } | { ok: false; message: string }>, success?: string) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) report(result, success);
      else setError(result.message);
    });
  }

  return (
    <form
      onSubmit={save}
      onKeyDown={(event) => {
        const shortcut = kindFromShortcut(event);
        if (shortcut) {
          event.preventDefault();
          setKind(shortcut);
        } else if (event.key === "Escape") {
          event.preventDefault();
          onClose();
        }
      }}
      aria-label="Punkt bearbeiten"
      className="flex flex-col gap-2"
    >
      <KindPicker value={kind} onChange={setKind} />
      <label htmlFor={`${id}-text`} className="sr-only">
        Text
      </label>
      <ItemTextArea id={`${id}-text`} value={text} onChange={setText} autoFocus />
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
      {status("edit")}
      {error ? (
        <p role="alert" className="font-medium text-status-late">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={pending} className={PRIMARY_BUTTON}>
          Speichern
        </button>
        <button type="button" onClick={onClose} className={SECONDARY_BUTTON}>
          Abbrechen
        </button>
        <button
          type="button"
          disabled={pending || isFirst}
          onClick={() => run(() => moveMeetingItem(item.id, "up"))}
          aria-label="Punkt nach oben"
          className={ICON_BUTTON}
        >
          ↑
        </button>
        <button
          type="button"
          disabled={pending || isLast}
          onClick={() => run(() => moveMeetingItem(item.id, "down"))}
          aria-label="Punkt nach unten"
          className={ICON_BUTTON}
        >
          ↓
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (window.confirm("Diesen Punkt wirklich löschen?")) {
              run(() => deleteMeetingItem(item.id), "Gelöscht");
            }
          }}
          className={`${SECONDARY_BUTTON} ml-auto text-status-late`}
        >
          Löschen
        </button>
      </div>
    </form>
  );
}
