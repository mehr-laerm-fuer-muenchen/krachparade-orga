# SPEC 024 – Fortschritt in den AKs (Fix-Paket A, Teil 2)

Freigabe Franz: ☑
Zweig: `agent/024-fortschritt-aks` · Risikoklasse B (reine Funktion, Komponenten, Klicktest; keine DB) · **Build-Agent** · DB: nein · erst nach 023 starten

## Ziel

Aus dem Feedback von Flo zum AK-Arbeitsbereich (16.10.2026, Feedback-Register Triage 1, Meldungen 9, 10, 11):

1. Die **Aufgabenbereiche** im AK-Arbeitsbereich sehen sichtbar aufklappbar aus.
2. AK-Karten und Bereichs-Köpfe zeigen den **Fortschritt** „erledigt/gesamt“ mit Leiste statt nur „offene Punkte“ – als positive Rückmeldung.
3. Ein Bereich, in dem alles erledigt ist, bekommt **„Alles erledigt ✓“**. Das wird aus den Daten abgeleitet, es gibt keinen Haken zum Setzen.

## Nicht in dieser Spec

- Manueller Haken „Bereich erledigt“ (bewusst nicht: abgeleitet statt doppelt gepflegt)
- „Ich unterstütze“ neben „Übernehmen“ (Backlog, braucht DB)
- Gantt, Plan-Rechnung, Panel (Spec 023 und ab 025)
- Datenbank, Login/Zugang, Configs, `.github/`, `.claude/`, Skripte

## Vorab: Abgleich mit dem Code

Prüfe zuerst und halte das Ergebnis kurz im PR-Text fest:

- Aufbau von `src/components/working-groups/overview.tsx` (AK-Karte: Lage-Pills, offene To-dos, nächster Termin) und `workspace.tsx` (Bereichs-Köpfe, Auf/Zu, `kp-ak-open`, `--gantt-lane`).
- Welche Daten liefern `loadAkOverview` / `loadAkWorkspace` (`src/db/ak-workspace.ts`) und `akSummary` / `groupByDepartment` (`src/lib/ak-workspace.ts`): Sind erledigte To-dos und erreichte Elemente enthalten oder nur offene?
- Wie zeichnen Gantt und Wochenliste die 3-px-Fortschrittsleiste (Variablen `--progress-track`, `--progress-fill`, `formatProgress`)?

Liefern die Abfragen nur offene Einträge und bräuchte die Zählung eine **neue Datenbank-Abfrage mit Schema-Änderung**: nichts umbauen, `AGENT_STOPP.md` schreiben und aufhören. Eine zusätzliche Lese-Abfrage ohne Schema-Änderung ist erlaubt.

## Umsetzung

**1 · Zählung als reine Funktion** in `src/lib/ak-workspace.ts` (mit Vitest, relative Importe):

- `areaProgress(area)` und `akProgress(ak)` liefern `{ todosDone, todosTotal, elementsDone, elementsTotal, allDone }`.
- Gezählt werden To-dos an Plan-Elementen und an „Laufende Aufgaben“ des Bereichs sowie Protokoll-To-dos, die dem Bereich zugeordnet sind. Elemente: Plan-Elemente des Bereichs (ohne das laufende Element), „erreicht“ = Status erreicht.
- `allDone` ist wahr, wenn es mindestens einen Eintrag gibt und alle To-dos erledigt und alle Elemente erreicht sind. Ein leerer Bereich ist nicht „alles erledigt“.

**2 · AK-Karte** (`/arbeitskreise`):

- Statt nur „N offene To-dos“: „‹erledigt›/‹gesamt› To-dos erledigt“ mit Fortschrittsleiste (gleiche Optik wie im Gantt, aber volle Kartenbreite, 4 px), darunter klein „‹x›/‹y› Plan-Elemente erreicht“.
- Lage-Pills (Verzug/wackelt/„Alles im Plan“) bleiben.
- Ohne To-dos und Elemente: „Noch nichts geplant“ statt Leiste.

**3 · Bereichs-Kopf** (`/arbeitskreise/[id]`):

- Der ganze Kopf ist ein Knopf (`aria-expanded`, mindestens 44 px hoch) mit Pfeil rechts (SVG, `currentColor`), der sich beim Aufklappen dreht; bei „Bewegung reduzieren“ ohne Animation. Hover/Fokus heben den Kopf leicht hervor (vorhandene Variablen), Fokus-Ring wie bei anderen Knöpfen.
- Im Kopf: „‹erledigt›/‹gesamt› To-dos“ mit schmaler Leiste. Ist `allDone`: Pille „Alles erledigt ✓“ in Erreicht-Farbe statt der Leiste.
- Getönte Köpfe (`--gantt-lane`), 24 px Abstand und Merken pro Gerät (`kp-ak-open`) bleiben unverändert.

**4 · Klicktest** `e2e/fortschritt-aks.spec.ts` (eigener „E2E AK …“ mit eigenem Bereich, Seed nicht ändern; am Ende aufräumen):

- Eigenen AK mit Bereich und einem Punkt ohne Termin anlegen → Karte und Bereichs-Kopf zeigen „0/1“.
- Punkt abhaken → Kopf zeigt „Alles erledigt ✓“, Karte „1/1 To-dos erledigt“.
- Bereichs-Kopf ist ein Knopf mit `aria-expanded`, Klick klappt auf und zu.
- Bestehende Klicktests zu `/arbeitskreise` anpassen, nicht löschen.

## Akzeptanzkriterien

1. AK-Karten zeigen „x/y To-dos erledigt“ mit Leiste und „x/y Plan-Elemente erreicht“; leere AKs „Noch nichts geplant“.
2. Bereichs-Köpfe als Knopf mit Pfeil und `aria-expanded`, mit Fortschritt bzw. „Alles erledigt ✓“; Merken pro Gerät unverändert.
3. `areaProgress`/`akProgress` mit Vitest (leer, teilweise, alles erledigt, laufende Aufgaben, Protokoll-To-dos).
4. Keine Schema-Änderung; geprüft bei 375 × 812 und 1280 × 800, hell und dunkel; keine Hydration-Warnungen.
5. `pnpm typecheck`, `lint`, `test`, `build` grün; Klicktest grün; „Prüfungen“ und „Klicktests“ im PR grün.
6. Neuigkeiten-Eintrag (unten) als neuester Eintrag in `src/lib/news/entries.ts`.

## Deploy

Keine DB-Änderung. Build-Agent → PR → Auto-Merge bei grünen Prüfungen. Danach Live-Check durch Franz am iPhone: AK-Übersicht, ein Arbeitsbereich.

## Neuigkeiten

**Titel:** Fortschritt in den AKs

- **AK-Karten** zeigen jetzt, wie viele To-dos schon erledigt sind – mit Fortschrittsleiste.
- **Aufgabenbereiche** erkennst du am Pfeil als aufklappbar; im Kopf steht ihr Fortschritt.
- **Alles erledigt ✓** erscheint, sobald in einem Bereich nichts mehr offen ist.

## Abweichungen beim Bau

(vom Build-Agenten zu ergänzen; nie den Freigabe-Haken hier eintragen)

Gebaut lokal mit Claude Code; der Abgleich mit dem Code wurde im Chat berichtet statt im PR-Text. Die Abfragen liefern bereits erledigte To-dos und erreichte Elemente – keine Schema-Änderung, keine neue Abfrage.

- Der Fortschritt zählt alle To-dos an allen Plan-Elementen (auch an erreichten), die To-dos der „Laufenden Aufgaben“ und die Protokoll-To-dos des Bereichs bzw. AKs (von Franz freigegeben).
- „Ohne Aufgabenbereich“ bekommt denselben Fortschritt im Kopf (von Franz freigegeben).
- Der Chip „N offen“ im Bereichs-Kopf ist durch „x/y To-dos“ mit Leiste ersetzt; die Lage-Pills bleiben (von Franz freigegeben).
- Der Bereichs-Kopf ist ein `<button aria-expanded>` mit `aria-controls` auf den Inhalt statt `<details>`; Bedienung per Enter/Leertaste, Merken in `kp-ak-open` mit denselben Schlüsseln wie bisher, ohne Eintrag offen (von Franz freigegeben).
- Bereiche ohne To-dos, die nicht „alles erledigt“ sind (leer oder nur Plan-Elemente ohne To-dos), zeigen im Kopf keine Leiste und keine Zahl.
- Der Fokus-Ring des Kopfs liegt innen (`-outline-offset-2!`), weil der Bereich `overflow-hidden` hat und der Ring sonst abgeschnitten würde.
- `src/lib/news/news.test.ts` erwartet jetzt `024-fortschritt-aks` als neuesten Eintrag (bisher 023).
- `akSummary.openTodos` bleibt berechnet, wird auf der Karte aber nicht mehr angezeigt.
