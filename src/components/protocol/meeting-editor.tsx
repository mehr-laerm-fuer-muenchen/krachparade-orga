"use client";

import { useCallback, useEffect, useId, useOptimistic, useRef, useState, useTransition } from "react";
import {
  deleteMeeting,
  moveTopic,
  renameTopic,
  saveMeetingNotes,
  saveMeetingSummary,
  setAttendance,
  setMeetingStatus,
  updateMeetingHead,
  type MeetingHeadInput,
} from "@/actions/meetings";
import { useSaveStatus, type FieldStatus, type TrackSave } from "@/components/save-status";
import { SUMMARY_MAX, summaryCounter } from "@/lib/protocol-read";
import { groupByTopic, type MeetingStatus } from "@/lib/protocol-rules";
import { ExportButtons } from "./export-buttons";
import { ItemRow } from "./item-row";
import { QuickEntry } from "./quick-entry";
import {
  ICON_BUTTON,
  INPUT,
  PRIMARY_BUTTON,
  SECONDARY_BUTTON,
  personLabel,
  type DepartmentOption,
  type ItemData,
  type MeetingData,
  type Person,
  type Report,
} from "./types";

type Notice = { ok: boolean; message: string; id: number } | null;

/** The whole meeting page below the tabs (spec 004). */
export function MeetingEditor({
  meeting,
  attendeeIds,
  items,
  people,
  departments,
  today,
  canDelete,
}: {
  meeting: MeetingData;
  attendeeIds: readonly string[];
  items: readonly ItemData[];
  people: readonly Person[];
  departments: readonly DepartmentOption[];
  today: string;
  canDelete: boolean;
}) {
  const [notice, setNotice] = useState<Notice>(null);
  const report = useCallback<Report>((result, success = "Gespeichert") => {
    setNotice({
      ok: result.ok,
      message: result.ok ? success : result.message,
      id: Date.now(),
    });
  }, []);

  // Successes disappear after a moment, errors stay until the next save.
  useEffect(() => {
    if (!notice?.ok) return;
    const timer = window.setTimeout(() => setNotice(null), 2500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  return (
    <div className="flex flex-col gap-6">
      <MeetingHead
        meeting={meeting}
        attendeeIds={attendeeIds}
        people={people}
        canDelete={canDelete}
        report={report}
      />
      <ExportButtons
        meeting={meeting}
        attendeeIds={attendeeIds}
        items={items}
        people={people}
        report={report}
      />
      <div className="flex flex-col gap-6 desk:grid desk:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] desk:items-start">
        <NotesPanel meetingId={meeting.id} initialNotes={meeting.rawNotes} />
        <Topics
          meetingId={meeting.id}
          items={items}
          people={people}
          departments={departments}
          today={today}
          report={report}
        />
      </div>
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 flex justify-center px-4 desk:bottom-6"
      >
        {notice ? (
          <span
            className={`rounded-md px-4 py-2 font-medium shadow-md ${
              notice.ok ? "bg-primary text-on-primary" : "bg-status-late text-on-status-late"
            }`}
          >
            {notice.message}
          </span>
        ) : null}
      </div>
    </div>
  );
}

// --- Head -------------------------------------------------------------------

function MeetingHead({
  meeting,
  attendeeIds,
  people,
  canDelete,
  report,
}: {
  meeting: MeetingData;
  attendeeIds: readonly string[];
  people: readonly Person[];
  canDelete: boolean;
  report: Report;
}) {
  const id = useId();
  const [, startTransition] = useTransition();
  const { track, status } = useSaveStatus();
  // Last saved values, so leaving an unchanged field does not save.
  const saved = useRef<Record<string, string>>({});

  /** Saves a head field with "Gespeichert ✓" at it (spec 016). */
  function saveField(field: keyof MeetingHeadInput, value: string, initial: string) {
    const last = saved.current[field] ?? initial;
    if (value === last) return;
    void track(field, async () => {
      saved.current[field] = value;
      let ok = false;
      try {
        const result = await updateMeetingHead(meeting.id, { [field]: value });
        ok = result.ok;
        return result;
      } finally {
        if (!ok) saved.current[field] = last;
      }
    });
  }

  const selectable = (selectedId: string | null) =>
    people.filter((person) => person.active || person.id === selectedId);
  const attendees = people.filter((person) => person.active || attendeeIds.includes(person.id));

  return (
    <section aria-label="Kopf" className="flex flex-col gap-4 rounded-md border border-line bg-surface p-4">
      <div className="grid gap-3 sm:grid-cols-[10rem_minmax(0,1fr)]">
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-date`}>Datum</label>
          <input
            id={`${id}-date`}
            type="date"
            required
            defaultValue={meeting.date}
            onBlur={(event) => {
              if (event.target.value) saveField("date", event.target.value, meeting.date);
            }}
            className={INPUT}
          />
          {status("date")}
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-title`}>Titel</label>
          <input
            id={`${id}-title`}
            type="text"
            required
            maxLength={200}
            defaultValue={meeting.title}
            onBlur={(event) => saveField("title", event.target.value.trim(), meeting.title)}
            className={`${INPUT} font-semibold`}
          />
          {status("title")}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-place`}>Ort</label>
          <input
            id={`${id}-place`}
            type="text"
            maxLength={200}
            defaultValue={meeting.place}
            onBlur={(event) => saveField("place", event.target.value.trim(), meeting.place)}
            className={INPUT}
          />
          {status("place")}
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-moderator`}>Moderation</label>
          <select
            id={`${id}-moderator`}
            defaultValue={meeting.moderatorId ?? ""}
            onChange={(event) => saveField("moderatorId", event.target.value, meeting.moderatorId ?? "")}
            className={INPUT}
          >
            <option value="">– niemand –</option>
            {selectable(meeting.moderatorId).map((person) => (
              <option key={person.id} value={person.id}>
                {personLabel(person)}
              </option>
            ))}
          </select>
          {status("moderatorId")}
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-minutes`}>Protokoll</label>
          <select
            id={`${id}-minutes`}
            defaultValue={meeting.minuteTakerId ?? ""}
            onChange={(event) =>
              saveField("minuteTakerId", event.target.value, meeting.minuteTakerId ?? "")
            }
            className={INPUT}
          >
            <option value="">– niemand –</option>
            {selectable(meeting.minuteTakerId).map((person) => (
              <option key={person.id} value={person.id}>
                {personLabel(person)}
              </option>
            ))}
          </select>
          {status("minuteTakerId")}
        </div>
      </div>

      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1">Anwesend</legend>
        <ul className="grid grid-cols-1 gap-x-3 sm:grid-cols-2 lg:grid-cols-3">
          {attendees.map((person) => (
            <li key={person.id}>
              <label className="flex min-h-11 cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  defaultChecked={attendeeIds.includes(person.id)}
                  onChange={(event) => {
                    const present = event.target.checked;
                    startTransition(async () =>
                      report(await setAttendance(meeting.id, person.id, present))
                    );
                  }}
                  className="size-5 accent-primary"
                />
                {personLabel(person)}
              </label>
            </li>
          ))}
        </ul>
      </fieldset>

      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-guests`}>Gäste (ohne Account)</label>
        <input
          id={`${id}-guests`}
          type="text"
          maxLength={1000}
          defaultValue={meeting.guests}
          placeholder="z. B. Namen, mit Komma getrennt"
          onBlur={(event) => saveField("guests", event.target.value.trim(), meeting.guests)}
          className={INPUT}
        />
        {status("guests")}
      </div>

      <SummaryField meetingId={meeting.id} initial={meeting.summary} track={track} status={status} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <StatusSwitch meetingId={meeting.id} status={meeting.status} report={report} />
        {canDelete ? <DeleteMeetingButton meetingId={meeting.id} report={report} /> : null}
      </div>
    </section>
  );
}

/** "Kurzfassung" (spec 017): saved on leaving, "Gespeichert ✓" below the field. */
function SummaryField({
  meetingId,
  initial,
  track,
  status,
}: {
  meetingId: string;
  initial: string;
  track: TrackSave;
  status: FieldStatus;
}) {
  const [summary, setSummary] = useState(initial);
  // Last saved value, so leaving an unchanged field does not save.
  const saved = useRef(initial.trim());
  const counter = summaryCounter(summary.length);

  function save(value: string) {
    const next = value.trim();
    const last = saved.current;
    if (next === last) return;
    void track("summary", async () => {
      saved.current = next;
      let ok = false;
      try {
        const result = await saveMeetingSummary(meetingId, next);
        ok = result.ok;
        return result;
      } finally {
        if (!ok) saved.current = last;
      }
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor="kurzfassung">Kurzfassung</label>
      <textarea
        id="kurzfassung"
        rows={3}
        maxLength={SUMMARY_MAX}
        value={summary}
        onChange={(event) => setSummary(event.target.value)}
        onBlur={(event) => save(event.target.value)}
        placeholder="Ein paar Sätze: Worum ging es, was ist rausgekommen?"
        aria-describedby="kurzfassung-hinweis"
        className="min-h-24 w-full resize-y rounded-md border border-line-strong bg-surface p-3 text-base text-text field-sizing-content"
      />
      {status("summary")}
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <p id="kurzfassung-hinweis" className="text-xs text-muted">
          Erscheint oben in der Leseansicht. Keine Telefonnummern, Adressen oder Kontodaten.
        </p>
        {counter ? <span className="text-xs text-muted tabular-nums">{counter}</span> : null}
      </div>
    </div>
  );
}

function StatusSwitch({
  meetingId,
  status,
  report,
}: {
  meetingId: string;
  status: MeetingStatus;
  report: Report;
}) {
  const [pending, startTransition] = useTransition();
  const [current, setCurrent] = useOptimistic(status);
  const options: { value: MeetingStatus; label: string }[] = [
    { value: "entwurf", label: "Entwurf" },
    { value: "final", label: "Final" },
  ];
  return (
    <div role="group" aria-label="Status" className="flex rounded-md border border-line-strong p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={current === option.value}
          disabled={pending}
          onClick={() => {
            if (current === option.value) return;
            startTransition(async () => {
              setCurrent(option.value);
              report(await setMeetingStatus(meetingId, option.value));
            });
          }}
          className={`min-h-11 rounded px-4 font-medium ${
            current === option.value ? "bg-primary text-on-primary" : "text-text hover:bg-surface-2"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function DeleteMeetingButton({ meetingId, report }: { meetingId: string; report: Report }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!window.confirm("Dieses Treffen mit allen Punkten wirklich löschen?")) return;
        startTransition(async () => {
          // On success the action leads back to /protokolle.
          const result = await deleteMeeting(meetingId);
          if (!result.ok) report(result);
        });
      }}
      className={`${SECONDARY_BUTTON} text-status-late`}
    >
      Treffen löschen
    </button>
  );
}

// --- TOPs -------------------------------------------------------------------

function Topics({
  meetingId,
  items,
  people,
  departments,
  today,
  report,
}: {
  meetingId: string;
  items: readonly ItemData[];
  people: readonly Person[];
  departments: readonly DepartmentOption[];
  today: string;
  report: Report;
}) {
  const id = useId();
  // New TOPs live only here until their first item is saved.
  const [drafts, setDrafts] = useState<string[]>([]);
  const [focusTopic, setFocusTopic] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newTopic, setNewTopic] = useState("");
  // Here and not per TOP: after renaming, the TOP comes back under its new name.
  const { track, status } = useSaveStatus();

  const saved = groupByTopic(items);
  const savedNames = new Set(saved.map((entry) => entry.topic));
  const topics = [
    ...saved,
    ...drafts.filter((name) => !savedNames.has(name)).map((topic) => ({ topic, items: [] as ItemData[] })),
  ];
  const activePeople = people.filter((person) => person.active);

  function addTopic() {
    const name = newTopic.trim().slice(0, 200);
    if (!name) return;
    if (!topics.some((entry) => entry.topic === name)) setDrafts((current) => [...current, name]);
    setFocusTopic(name);
    setNewTopic("");
    setAdding(false);
  }

  return (
    <section aria-label="TOPs" className="flex min-w-0 flex-col gap-4">
      {topics.length === 0 ? (
        <p className="rounded-md border border-line bg-surface px-4 py-3 text-muted">
          Noch keine TOPs. Leg den ersten TOP an.
        </p>
      ) : null}

      {topics.map((entry, index) => (
        <TopicSection
          key={entry.topic}
          meetingId={meetingId}
          topic={entry.topic}
          items={entry.items}
          isDraft={!savedNames.has(entry.topic)}
          isFirst={index === 0}
          isLast={index === saved.length - 1 || !savedNames.has(entry.topic)}
          people={people}
          activePeople={activePeople}
          departments={departments}
          today={today}
          autoFocus={focusTopic === entry.topic}
          report={report}
          track={track}
          status={status}
          onRenameDraft={(name) => {
            setDrafts((current) => current.map((draft) => (draft === entry.topic ? name : draft)));
            setFocusTopic(name);
          }}
        />
      ))}

      {adding ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            addTopic();
          }}
          className="flex flex-col gap-1 rounded-md border border-line bg-surface p-3"
        >
          <label htmlFor={`${id}-topic`} className="font-medium">
            Überschrift des neuen TOPs
          </label>
          <div className="flex gap-2">
            <input
              id={`${id}-topic`}
              type="text"
              autoFocus
              maxLength={200}
              value={newTopic}
              onChange={(event) => setNewTopic(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") setAdding(false);
              }}
              className={INPUT}
            />
            <button type="submit" className={PRIMARY_BUTTON}>
              Anlegen
            </button>
          </div>
        </form>
      ) : (
        <div>
          <button type="button" onClick={() => setAdding(true)} className={SECONDARY_BUTTON}>
            + TOP hinzufügen
          </button>
        </div>
      )}
    </section>
  );
}

function TopicSection({
  meetingId,
  topic,
  items,
  isDraft,
  isFirst,
  isLast,
  people,
  activePeople,
  departments,
  today,
  autoFocus,
  report,
  track,
  status,
  onRenameDraft,
}: {
  meetingId: string;
  topic: string;
  items: readonly ItemData[];
  isDraft: boolean;
  isFirst: boolean;
  isLast: boolean;
  people: readonly Person[];
  activePeople: readonly Person[];
  departments: readonly DepartmentOption[];
  today: string;
  autoFocus: boolean;
  report: Report;
  track: TrackSave;
  status: FieldStatus;
  onRenameDraft: (name: string) => void;
}) {
  const id = useId();
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(topic);
  /** New name while renaming; its save state shows here until the TOP comes back under it. */
  const [target, setTarget] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function rename() {
    const next = name.trim();
    if (!next || next === topic) {
      setRenaming(false);
      return;
    }
    if (isDraft) {
      setRenaming(false);
      onRenameDraft(next);
      return;
    }
    // The form stays open on an error, with "nochmal".
    setTarget(next);
    void track(`rename:${next}`, async () => {
      const result = await renameTopic(meetingId, topic, next);
      if (result.ok) setRenaming(false);
      return result;
    });
  }

  return (
    <section aria-labelledby={`${id}-heading`} className="flex flex-col gap-2 rounded-md border border-line bg-surface p-3">
      <div className="flex items-start gap-2">
        {renaming ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              rename();
            }}
            className="flex min-w-0 flex-1 gap-2"
          >
            <label htmlFor={`${id}-name`} className="sr-only">
              Überschrift von {topic}
            </label>
            <input
              id={`${id}-name`}
              type="text"
              autoFocus
              maxLength={200}
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setName(topic);
                  setRenaming(false);
                }
              }}
              className={INPUT}
            />
            <button type="submit" className={SECONDARY_BUTTON}>
              OK
            </button>
          </form>
        ) : (
          <h2 id={`${id}-heading`} className="min-w-0 flex-1 py-2 text-lg font-semibold break-words">
            {topic}
          </h2>
        )}
        {renaming ? null : (
          <div className="flex shrink-0 gap-1">
            <button
              type="button"
              onClick={() => {
                setName(topic);
                setRenaming(true);
              }}
              aria-label={`${topic} umbenennen`}
              title="Umbenennen"
              className={ICON_BUTTON}
            >
              ✎
            </button>
            <button
              type="button"
              disabled={pending || isDraft || isFirst}
              onClick={() => startTransition(async () => report(await moveTopic(meetingId, topic, "up")))}
              aria-label={`${topic} nach oben`}
              className={ICON_BUTTON}
            >
              ↑
            </button>
            <button
              type="button"
              disabled={pending || isDraft || isLast}
              onClick={() => startTransition(async () => report(await moveTopic(meetingId, topic, "down")))}
              aria-label={`${topic} nach unten`}
              className={ICON_BUTTON}
            >
              ↓
            </button>
          </div>
        )}
      </div>
      {status(`rename:${target ?? topic}`)}

      {items.length > 0 ? (
        <ul aria-label={`Punkte zu ${topic}`} className="flex flex-col">
          {items.map((item, index) => (
            <ItemRow
              key={item.id}
              item={item}
              people={people}
              departments={departments}
              today={today}
              isFirst={index === 0}
              isLast={index === items.length - 1}
              report={report}
            />
          ))}
        </ul>
      ) : null}

      <QuickEntry
        meetingId={meetingId}
        topic={topic}
        people={activePeople}
        departments={departments}
        autoFocus={autoFocus}
      />
    </section>
  );
}

// --- Note or transcript -------------------------------------------------------

const NOTES_MAX = 200_000;
const NOTE_FILES = /\.(txt|md|vtt)$/i;

function NotesPanel({ meetingId, initialNotes }: { meetingId: string; initialNotes: string }) {
  const id = useId();
  const [open, setOpen] = useState(true);
  const [notes, setNotes] = useState(initialNotes);
  const [error, setError] = useState<string | null>(null);
  const saved = useRef(initialNotes);
  const { track, status } = useSaveStatus();

  function save(value: string) {
    if (value === saved.current) return;
    if (value.length > NOTES_MAX) {
      setError("Die Notiz ist zu lang (höchstens 200 000 Zeichen).");
      return;
    }
    const last = saved.current;
    setError(null);
    void track("notes", async () => {
      saved.current = value;
      let ok = false;
      try {
        const result = await saveMeetingNotes(meetingId, value);
        ok = result.ok;
        return result;
      } finally {
        if (!ok) saved.current = last;
      }
    });
  }

  async function loadFile(file: File | undefined) {
    if (!file) return;
    if (!NOTE_FILES.test(file.name)) {
      setError("Nur .txt-, .md- oder .vtt-Dateien.");
      return;
    }
    // Read in the browser only; nothing is uploaded.
    const content = await file.text();
    const next = notes.trim() ? `${notes}\n\n${content}` : content;
    setNotes(next);
    save(next);
  }

  return (
    <details
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
      className="rounded-md border border-line bg-surface desk:sticky desk:top-36 desk:order-2 desk:flex desk:max-h-[calc(100dvh-10rem)] desk:flex-col desk:overflow-auto"
    >
      <summary className="flex min-h-11 cursor-pointer items-center px-4 font-semibold">
        Notiz oder Transkript
      </summary>
      <div className="flex min-h-0 flex-col gap-2 px-4 pb-4">
        <label htmlFor={`${id}-notes`} className="sr-only">
          Notiz oder Transkript
        </label>
        <textarea
          id={`${id}-notes`}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          onBlur={(event) => save(event.target.value)}
          placeholder="Notiz oder Transkript hier einfügen"
          className="h-48 w-full resize-y rounded-md border border-line-strong bg-surface p-3 text-base text-text desk:h-[calc(100dvh-24rem)] desk:min-h-48"
        />
        {status("notes")}
        <div className="flex flex-wrap items-center gap-2">
          <label className={`${SECONDARY_BUTTON} inline-flex cursor-pointer items-center has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent`}>
            Datei laden
            <input
              type="file"
              accept=".txt,.md,.vtt,text/plain,text/markdown,text/vtt"
              onChange={(event) => {
                void loadFile(event.target.files?.[0]);
                event.target.value = "";
              }}
              className="sr-only"
            />
          </label>
          <span className="text-xs text-muted">.txt, .md oder .vtt – wird im Browser gelesen und ins Feld übernommen, nicht hochgeladen.</span>
        </div>
        <p className="text-xs text-muted">Keine Telefonnummern, Adressen oder Kontodaten einfügen.</p>
        {error ? (
          <p role="alert" className="font-medium text-status-late">
            {error}
          </p>
        ) : null}
      </div>
    </details>
  );
}
