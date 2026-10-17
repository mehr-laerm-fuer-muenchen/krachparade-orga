# SPEC 023 – Klarer machen (Fix-Paket A, Teil 1)

Freigabe Franz: ☑
Zweig: `agent/023-klarer-machen` · Risikoklasse B (Texte, Komponenten, reine Funktion, Klicktest; keine DB) · **Build-Agent** · DB: nein

## Ziel

Drei Stellen, die beim Testen unklar waren (Feedback von Flo, 16.10.2026, Feedback-Register Triage 1, Meldungen 2, 4, 5), werden verständlich:

1. Die **Fälligkeit von To-dos** an Plan-Elementen steht ausgeschrieben mit Datum da („fällig 18.12. (3 Tage vor Start)“) statt als Zahl mit „vor Start“.
2. Der **Fortschritt x/y To-dos** steht auch im Kopf von Panel und Blatt, neben Status und Puffer.
3. Der **Käfer** sagt klar, dass er für Feedback zur App ist.

## Nicht in dieser Spec

- Alles am kritischen Pfad, am Gantt und an der Plan-Rechnung (kommt mit der Gantt-Umstellung ab Spec 025)
- AK-Übersicht und AK-Arbeitsbereich (Spec 024)
- Learnings-Sammlung, Links-Seite
- Datenbank, Login/Zugang, `src/proxy.ts`, Configs, `.github/`, `.claude/`, Skripte

## Vorab: Abgleich mit dem Code

Prüfe zuerst und halte das Ergebnis kurz im PR-Text fest:

- Wo wird die Fälligkeit eines Plan-To-dos eingegeben (Panel/Blatt, vermutlich `src/components/plan/plan-detail.tsx`) und wo als Text angezeigt (Panel/Blatt, Wochenliste, `/meine`, AK-Arbeitsbereich)? Wie heißen die Felder und Texte heute, welche Funktion rechnet das Datum (`todoDueDay` in `src/lib/plan-engine.ts`)?
- Wo stehen Status und Puffer im Kopf von Panel und Blatt? Wie nutzen Gantt und Wochenliste `formatProgress` aus `src/lib/todo-progress.ts`?
- Wo stehen Titel, `aria-label` und Hinweistexte des Käfers (`src/components/feedback-button.tsx`) und der Eintrag „Feedback“ in `/einstellungen`?
- Welche Klicktests prüfen diese Texte heute?

Ist etwas grundlegend anders als hier beschrieben (z. B. es gibt keine Fälligkeit „vor Start/Ende“, oder sie wird nirgends als Text angezeigt): **nichts umbauen**, `AGENT_STOPP.md` mit dem Unterschied schreiben und aufhören.

## Umsetzung

**1 · Fälligkeit ausschreiben**

- Neue reine Funktion `formatTodoDue(days, anchor, dueDay)` in `src/lib/todo-due.ts` mit Vitest (Import in getesteten Dateien relativ, Vitest kennt `@/` nicht). Sie liefert:
  - Herkunft: „zum Start“ / „zum Ende“ bei 0, „1 Tag vor Start“, „3 Tage vor Ende“ …
  - Volltext: „fällig ‹TT.MM.› (‹Herkunft›)“, z. B. „fällig 18.12. (3 Tage vor Start)“, „fällig 21.12. (zum Start)“
  - Datum über die vorhandene Datums-Formatierung der App (Berliner Kalendertag, keine Uhrzeit).
- **Eingabe** im Panel/Blatt: Neben dem Zahlenfeld steht die Einheit „Tage“. Die Auswahl heißt „vor Start des Elements“ / „vor Ende des Elements“ (nur die Beschriftung, die Werte bleiben). Darunter steht eine Zeile mit dem errechneten Datum, z. B. „fällig am Fr 18.12.“. Sie aktualisiert sich beim Tippen ohne Speichern.
- **Anzeige** überall, wo die Fälligkeit eines Plan-To-dos als Text steht (Panel/Blatt, Wochenliste, `/meine`, AK-Arbeitsbereich): den Volltext aus `formatTodoDue` nutzen. Protokoll-To-dos mit festem Datum bleiben unverändert.

**2 · Fortschritt im Panel- und Blatt-Kopf**

- Hat ein Element To-dos, steht im Kopf neben Status und Puffer „‹erledigt›/‹gesamt› To-dos“ über `formatProgress`, bei allen erledigt mit Haken wie im Gantt. Ohne To-dos steht nichts.
- Nach Abhaken im Panel aktualisiert sich die Zahl sofort (gleicher Zustand wie die To-do-Liste im Panel, kein Neuladen der Seite).

**3 · Käfer: Feedback zur App**

- Dialog-Titel „Feedback zur App“ (bisher „Feedback geben“). `aria-label` des Knopfs „Feedback zur App geben“; bei Admins mit neuen Meldungen weiter mit der Zahl.
- Neue erste Zeile unter dem Titel: „Fehler gefunden oder Wunsch an die App? Hier rein. Inhaltliches zur Krachparade gehört in die Notizen am Element oder am AK.“
- Eintrag in `/einstellungen`: „Feedback zur App“. Überschrift von `/feedback` bleibt „Feedback“.

**4 · Klicktest** `e2e/klarer-machen.spec.ts` (nur eigene „E2E …“-Daten anlegen und ändern, Seed-Elemente höchstens öffnen):

- Eigenes E2E-Element mit To-do „3 Tage vor Start“ anlegen → Panel zeigt „fällig ‹Datum› (3 Tage vor Start)“ und die Datumszeile unter der Eingabe.
- To-do abhaken → Kopf zeigt „1/1“ mit Haken. Danach das E2E-Element wieder löschen.
- Käfer öffnen → Titel „Feedback zur App“ und Hinweiszeile sichtbar; schließen.
- Bestehende Klicktests mit alten Texten anpassen, nicht löschen. Neuigkeiten-Test über `latestNewsId`.

## Akzeptanzkriterien

1. Fälligkeiten von Plan-To-dos überall einheitlich „fällig TT.MM. (N Tage vor Start/Ende)“; Eingabe mit „Tage“ und Datumszeile; `formatTodoDue` mit Vitest (0, 1, N Tage; Start/Ende).
2. x/y To-dos im Kopf von Panel und Blatt, sofort aktualisiert nach Abhaken.
3. Käfer-Dialog „Feedback zur App“ mit Hinweiszeile; `/einstellungen`-Eintrag umbenannt.
4. Keine Änderung an Engine, Datenbank, Login, Configs.
5. Kopfleiste am Handy bleibt einzeilig; keine Hydration-Warnungen; kein `revalidatePath("/", "layout")`.
6. `pnpm typecheck`, `lint`, `test`, `build` grün; Klicktest in `e2e/` grün; „Prüfungen“ und „Klicktests“ im PR grün.
7. Neuigkeiten-Eintrag (unten) in `src/lib/news/entries.ts` als neuester Eintrag.

## Deploy

Keine DB-Änderung. Build-Agent → PR → Auto-Merge bei grünen Prüfungen. Danach Live-Check durch Franz am iPhone: Panel mit To-do, Käfer.

## Neuigkeiten

**Titel:** Fälligkeiten mit Datum, Fortschritt im Panel

- **Fälligkeiten von To-dos** stehen jetzt mit Datum da, z. B. „fällig 18.12. (3 Tage vor Start)“.
- **Fortschritt** siehst du auch oben im Panel, neben Status und Puffer.
- **Der Käfer** heißt jetzt „Feedback zur App“ – Inhaltliches zur Krachparade gehört in die Notizen.

## Abweichungen beim Bau

(vom Build-Agenten zu ergänzen; nie den Freigabe-Haken hier eintragen)

- Der Abgleich mit dem Code wurde lokal im Chat berichtet statt im PR-Text.
- `formatTodoDue(days, anchor, dueDay, dDay)` bekommt `dDay` als vierten Parameter, weil `dueDay` eine Tageszahl relativ zur Krachparade ist; Datum über `dayToDate`, Format TT.MM. (von Franz freigegeben)
- Überfällige Plan-To-dos (Wochenliste, `/meine`, AK-Arbeitsbereich) zeigen „war fällig TT.MM. (N Tage vor Start/Ende)“ über einen optionalen fünften Parameter `overdue` (von Franz freigegeben)
- `daysBefore` und `anchor` sind nur in den Anzeige-Typen ergänzt und durchgereicht (`AgendaTodo` in `src/lib/gantt-layout.ts`, `AkPlanTodo` in `src/db/ak-workspace.ts`), ohne Engine- oder DB-Änderung (von Franz freigegeben)
- Link-Test in `e2e/feedback.spec.ts` auf „Feedback zur App“ angepasst (von Franz freigegeben). Korrektur beim Bau: Der `/einstellungen`-Test ist „Einstellungen verlinken auf die Übersicht“ (`/^Feedback zur App/`); der Link „Feedback“ (exact) im Admin-Test ist der Zurück-Link der Meldungs-Seite und bleibt, weil die Überschrift „Feedback“ bleibt.
- Zusätzlich zur Spec: Hilfsfunktion `todoDueOrigin(days, anchor)` in `src/lib/todo-due.ts` für die Herkunft; Kopf-Anzeige „1/1 To-dos ✓“ (Haken hinter „To-dos“). Die Hinweiszeile im Käfer steht nur im Formular, nicht in der „Danke!“-Ansicht. Panel und Wochenkarte zeigen auch bei überfälligen To-dos „fällig …“ (rot hervorgehoben wie bisher). Unit-Test `src/lib/news/news.test.ts` erwartet jetzt `023-klarer-machen` als neuesten Eintrag (angepasst, nicht gelöscht).
