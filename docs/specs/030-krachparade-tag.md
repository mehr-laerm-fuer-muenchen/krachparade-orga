# SPEC 030 – Tag der Krachparade

Freigabe Franz: ☑
Zweig: `spec/030-krachparade-tag` · Risikoklasse B (neue Tabellen nur hinzufügend, neue Seiten, Server Actions, Seed/Vorlage) · **lokal, Teil A/B** · DB: ja (5 neue Tabellen)

Löst Thema #34 (Krachparade im Plan / Ablauf am Tag) im ersten, bewusst schlanken Schritt. Grundlage: Test-Layout **„KP27 Tag der Krachparade – Test-Layout“, Version 2** (abgenommen 07.11.2026, https://claude.ai/artifact/DRW5AFKRtVRXbmvodPHc93) und das Briefing Wagenverantwortliche KP26.

## Ziel

Die Kern-Orga plant den Tag der Krachparade selbst in der App, nicht mehr in Folien und Chats. Neue Seite **„Krachparade“** mit zwei Ansichten:

1. **Ablauf:** Tagesplan mit **Spalten für parallele Stränge**. Startspalten sind „Programm & Bühne“, „Demozug & Wägen“ und „Orga & Logistik“, das Team kann sie umbenennen, verschieben und ergänzen. Die Uhrzeit läuft senkrecht. Jeder Eintrag hat:
   - Uhrzeit von–bis (bis optional), wahlweise mit „ca.“
   - Ort
   - AK und Person (Mitglied oder Freitext)
   - Notiz
   - Checkliste
   - Am Laptop verschiebt man Einträge **per Drag & Drop** (5-Minuten-Raster, auch in eine andere Spalte) und ändert die Dauer am unteren Rand. Am Handy gibt es eine Liste nach Uhrzeit, verschoben wird mit „−15/−5/+5/+15 min“.
2. **Rollen:** Wer macht was am Tag, z. B. Versammlungsleitung, Abschnittsleitungen, Demozentrale. Jede Rolle hat Aufgabe, Kennzeichen, AK und mehrere Personen (Mitglied oder Freitext). Unbesetzte Rollen fallen auf.

In production startet die Seite mit dem Ablauf und den Rollen aus KP26 als Vorlage, ohne echte Namen.

## Nicht in dieser Spec

- „Jetzt“ / „Als Nächstes“ am Tag selbst (Entscheidung Sitzung 18: nur die Liste)
- Einträge, Rollen oder Checkpunkte unter „Meine“ (kommt mit 031 oder einer Ausbau-Spec)
- Uhrzeit an Checkpunkten (nur Person)
- Wagenliste, Aufstellung, Abschnitte mit Wagennummern, Soundcheck-Gruppen je Wagen (später mit R4 Kollektive)
- Mehrere Tage, Export, Druckansicht
- Verbindung zu Plan-Elementen (der Tagesplan ist eine eigene Tabelle, der Gantt rechnet weiter in Tagen)
- Konflikt-Hinweis „wurde gerade von … geändert“ (letzte Änderung gewinnt)
- Rückgängig nach dem Löschen (Rückfrage reicht, wie 029)
- Telefonnummern, Adressen oder andere Kontaktdaten (nur Namen)
- Login, `src/proxy.ts`, Configs, `.github/`, `.claude/`, `scripts/`

## Vorab: Abgleich mit dem Code

Prüfe zuerst und berichte kurz im Chat. **Erst nach „Weiter“ von Franz** etwas ändern.

- **Ausgabe:** Wie hängen Plan-Elemente an der Ausgabe (`editions`, `edition_id`)? Wie wird die aktuelle Ausgabe geladen, wo steht ihr Datum (`dday.ts`)?
- **AKs und Mitglieder:** Tabellen und Spalten von `working_groups` und `members`. Wie wählen Protokoll-To-dos heute „Wer: Mitglied oder Freitext“ (004)? Gibt es dafür einen Baustein, den Einträge und Rollen nutzen können?
- **Navigation:**
  - Wo steht die Hauptnavigation am Laptop (Reihenfolge heute: Plan · AKs · Protokolle · Meine · Einstellungen)?
  - Wo steht die untere Leiste am Handy (Plan · AKs · Protokolle · Meine · Mehr)?
  - Was zeigt `/einstellungen` bzw. „Mehr“ am Handy? Kommt dort ein Eintrag „Krachparade“ ohne Umbau dazu?
- **Plan:** Wo wird das Krachparade-Schild im Gantt gezeichnet (`plan-gantt.tsx`, SVG)? Wo steht die Woche der Krachparade in der Wochenliste (`plan-week-list.tsx`)? Kann dort ein Link hin?
- **Bausteine:** Welche gibt es für Detail-Panel (Laptop) und Blatt (Handy) (`plan-detail.tsx`, iOS-sichere Seitensperre aus 021), `TickBox`, `useUndoBar()`, `useSaveStatus()`, `FieldError`, `NoteHistory`? Welche davon passen für Einträge und Rollen?
- **Seed:** Wie legt `seedPlan` mit `--prod` die KP27-Vorlage nur bei leerem Plan an (`src/db/seed.ts`, `src/db/kp27-template.ts`)? Wie hoch ist `SEED_VERSION`?
- **Drag im Gantt:** Wie arbeitet `src/lib/plan-drag.ts` mit Pointer-Events? Gibt es ein Muster, das der Tagesplan übernehmen kann?
- **Klicktests:** Wie legen bestehende Tests eigene „E2E …“-Daten an und räumen sie auf?

Weicht der Code grundlegend ab (z. B. es gibt kein `edition_id`, oder AKs heißen anders): **nichts umbauen**, Unterschied berichten und anhalten.

## Umsetzung

### Teil A · Datenmodell, Logik, Actions, Vorlage (mit Übergangs-Oberfläche)

**A1 · Tabellen** (`src/db/schema.ts`, nur hinzufügend). Uhrzeiten als **Minuten seit 0:00 des Krachparade-Tages** (`integer`, 0–1439). Der Tag ist immer das Datum der Ausgabe, deshalb gibt es kein Datum und keine Zeitzone.

- `day_tracks`: `id` (uuid), `edition_id` (→ `editions`, Pflicht), `name` (text, 1–40), `position` (int), `created_at`, `updated_at`
- `day_entries`:
  - `id`, `edition_id`
  - `track_id` (→ `day_tracks`, `on delete restrict`)
  - `title` (1–120)
  - `start_minute` (int, null = ohne Uhrzeit, CHECK 0–1439)
  - `end_minute` (int, null = Zeitpunkt; CHECK `end_minute > start_minute` und ≤ 1439, nur wenn `start_minute` gesetzt)
  - `approx` (bool, Standard false)
  - `place` (≤ 120, null)
  - `working_group_id` (→ `working_groups`, null, `on delete set null`)
  - `person_member_id` (→ `members`, null)
  - `person_text` (≤ 80, null; CHECK: höchstens eines von beiden)
  - `note` (≤ 2000, null)
  - `created_by`, `updated_by` (→ `members`), `created_at`, `updated_at`
- `day_checks`: `id`, `entry_id` (→ `day_entries`, `on delete cascade`), `text` (1–200), `done` (bool), `done_at` (timestamptz, null), `member_id` (→ `members`, null), `position`, `created_at`
- `day_roles`: `id`, `edition_id`, `title` (1–80), `task` (≤ 500, null), `mark` (≤ 40, null, z. B. „Weste lila“), `working_group_id` (null, `on delete set null`), `position`, `created_at`, `updated_at`
- `day_role_people`: `id`, `role_id` (→ `day_roles`, `on delete cascade`), `member_id` (null), `name_text` (≤ 80, null; CHECK: genau eines von beiden), `position`
- Indizes: `day_entries (edition_id, track_id)`, `day_checks (entry_id)`, `day_role_people (role_id)`
- Namen für CHECK-Regeln eindeutig wählen (drizzle-kit vergleicht nur Namen)

**A2 · Reine Funktionen** `src/lib/day-plan.ts` mit Vitest (relativ importieren, Vitest kennt `@/` nicht):

- `timeToMinutes("11:15")`, `minutesToTime(675)`, `snapMinutes(m, 5)`
- `formatEntryTime(entry)` → „11:00–11:15“, „ca. 19:45“, „09:00“, „ohne Uhrzeit“
- `moveEntry(entry, deltaMinutes)` verschiebt Start und Ende gemeinsam, Dauer bleibt. Das Ergebnis bleibt in 0–1439, am Rand wird geklemmt, ohne die Dauer zu ändern.
- `resizeEntry(entry, newEnd)`: Ende mindestens Start + 5, höchstens 1439
- `layoutLanes(entries)`: Einträge einer Spalte, die sich überschneiden, bekommen nebeneinander `lane`/`laneCount`. Zeitpunkte zählen als 20 Minuten.
- `timelineRange(entries)`: Standard 08:00–24:00, erweitert auf die volle Stunde vor dem frühesten bzw. nach dem spätesten Eintrag
- `groupByHour(entries)` für die Handy-Liste („09 Uhr“, …, „Ohne Uhrzeit“ am Ende), sortiert nach Start, dann Ende
- `checkProgress(checks)` → `{done, total}` (gleiches Format wie `formatProgress`)
- `dayTemplate`-Prüfung: Vorlage gültig (alle Spalten vorhanden, Zeiten in Ordnung)

**A3 · Server Actions** `src/actions/day-plan.ts`. Jede Action prüft Anmeldung und aktives Mitglied aus der DB, nutzt die aktuelle Ausgabe und Zod und schreibt `updated_by`. Rechte: alle aktiven Mitglieder, wie bei Plan und Protokoll.

- Spalten: `createTrack`, `renameTrack`, `moveTrack` (links/rechts), `deleteTrack` (nur leer, sonst Fehlermeldung „Erst die Einträge verschieben“)
- Einträge:
  - `createEntry`
  - `updateEntry` für einzelne Felder, die beim Verlassen bzw. bei `change` speichern
  - `moveEntryTo(id, startMinute, trackId)`, Dauer bleibt
  - `resizeEntryTo(id, endMinute)`
  - `deleteEntry`
- Checkliste: `addCheck`, `toggleCheck` (setzt `done_at`), `deleteCheck`
- Rollen: `createRole`, `updateRole`, `deleteRole`, `addRolePerson` (Mitglied oder Freitext), `removeRolePerson`
- Nach Änderungen die Krachparade-Seiten neu validieren. Kein `revalidatePath("/", "layout")`.
- Texte nicht loggen.

**A4 · Vorlage und Seed**

- `src/db/day-template.ts`: Ablauf und Rollen aus KP26 wie im Test-Layout (13 Einträge, 3 Spalten, 6 Rollen, Checkpunkte), **ohne Personen**. AK-Zuordnung über den AK-Namen. Fehlt der AK, bleibt er leer.
- Seed dev (`TEST_PLAN`-Umfeld): drei Spalten, einige ausgedachte Einträge mit Checkpunkten, zwei Rollen mit `@example.org`-Mitgliedern. `SEED_VERSION` + 1.
- Seed `--prod`: legt die Vorlage nur an, wenn für die aktuelle Ausgabe **noch keine** `day_tracks` existieren. Sonst wird nichts geändert. Gleiche Anlege-Funktion für dev und prod (Muster `seedPlan`).
- Vitest: Vorlage hat 3 Spalten, 13 Einträge und 6 Rollen. Alle Zeiten sind gültig. Es gibt keine Person und keine E-Mail in der Vorlage.

**A5 · Übergangs-Oberfläche** (nur damit es baut und sich prüfen lässt): `/krachparade` zeigt den Ablauf als einfache Liste nach Uhrzeit. Teil B ersetzt sie.

Bei DB-Änderung in Teil A: vor `db:push` anhalten. Franz führt `pnpm db:push` und `pnpm db:seed` (dev) aus. Danach alle bestehenden Klicktests und `pnpm build` als Regressionscheck, dann Teil B.

### Teil B · Oberfläche nach Test-Layout v2

**B1 · Seite und Zugang**

- `/krachparade` (Ablauf) und `/krachparade/rollen`. Kopf: „Krachparade · Sa 08.05.2027“ (Datum der Ausgabe) und eine Zeile mit Zahlen: Einträge · Checklisten x/y · Rollen, dazu „N unbesetzt“ in Rot, falls es welche gibt. Rechts der Umschalter „Ablauf | Rollen“ als Links mit `replace` (wie 017).
- Laptop: Hauptnavigation bekommt **„Krachparade“** zwischen „Meine“ und „Einstellungen“.
- Handy: Die untere Leiste bleibt unverändert. Unter „Mehr“ kommt der Eintrag „Krachparade – Ablauf & Rollen“.
- Plan: Das Krachparade-Schild im Gantt öffnet beim Antippen ein kleines Fenster: Datum, „noch N T“, Link **„Ablauf am Tag ansehen ›“**, Zahl der Einträge und Rollen. In der Wochenliste steht in der Woche der Krachparade derselbe Link. Fällt die Woche nicht in die angezeigten Wochen, steht der Link oben unter der Kopfzeile.

**B2 · Tagesplan (Laptop, ab 1024 px)** `src/components/day/day-timeline.tsx`

- Kopfzeile: eine Spalte je `day_track` mit Name, Zahl der Einträge und „Ändern“. Darüber die Knöpfe „+ Eintrag“ und „+ Spalte“ und eine Hinweiszeile: „Blöcke ziehen = verschieben · unteren Rand ziehen = Dauer · antippen = Details“.
- Zeitachse links mit vollen Stunden. Stunden- und halbe Stundenlinien wie im Layout, Bereich aus `timelineRange`. Der Bereich scrollt in sich, max. ca. 760 px hoch, und startet beim ersten Eintrag minus 30 Minuten.
- Blöcke: Position aus Start und Ende, nebeneinander nach `layoutLanes`. Ein Block zeigt:
  - Uhrzeit, Titel, Ort · Person
  - rechts oben „x/y“ (Checkliste)
  - links einen Rand: grün, wenn alle Punkte erledigt sind; grau, wenn es keine Checkliste gibt
  - Zeitpunkte ohne Ende gestrichelt
  - Blöcke unter ca. 40 px einzeilig: Uhrzeit und Titel mit „…“
- **Drag & Drop** mit Pointer-Events:
  - Ab 4 px Bewegung beginnt das Ziehen, sonst gilt es als Klick und öffnet das Panel.
  - Verschieben im 5-Minuten-Raster, die Zielspalte wird beim Überfahren hervorgehoben, die Uhrzeit im Block läuft live mit.
  - Am unteren Rand (Block mit Ende) ändert man die Dauer.
  - Gespeichert wird **beim Loslassen** über `moveEntryTo` bzw. `resizeEntryTo`. Danach erscheint die Rückgängig-Leiste (`useUndoBar()`), 5 s: „Verschoben auf 11:30 · Spalte „Programm & Bühne““ bzw. „„Auftaktkundgebung“ jetzt bis 16:30“. Rückgängig stellt die alten Werte wieder her.
- Tastatur: Ein Block ist fokussierbar. Enter öffnet das Panel, Pfeil hoch/runter verschiebt um 5 Minuten, mit Rückgängig-Leiste.
- Einträge ohne Uhrzeit stehen unter dem Tagesplan in der Liste „Ohne Uhrzeit“.

**B3 · Liste (Handy, unter 1024 px)** `src/components/day/day-list.tsx`

- Gruppen nach Stunde („09 Uhr“, …), Karten im Stil der Element-Karte:
  - Uhrzeit und Spalten-Kennzeichen, Titel, Ort · Person
  - rechts die Pille „x/y ▾“; sie klappt die Checkliste auf, dort direkt abhaken (`TickBox`, Rückgängig)
- „+ Eintrag“ oben. Antippen öffnet das Blatt.

**B4 · Panel (Laptop) / Blatt (Handy) für Einträge**

- Kopf: Spalte · Uhrzeit · x/y Checkliste, darunter der Titel und „×“.
- Felder wie im Layout. Gespeichert wird beim Verlassen bzw. bei `change`, mit „Gespeichert ✓“ (`useSaveStatus()`):
  - Titel, Spalte
  - Uhrzeit von–bis (`type="time"`, `step=300`) und „ca.“
  - Ort, AK (mit „kein AK“)
  - Person: Niemand | Mitglied | Freitext
  - Notiz
  - Hinweis „Nur Namen – keine Telefonnummern oder Adressen.“
- Nur am Handy: „Verschieben“ mit „−15 min · −5 · +5 · +15 min“, mit Rückgängig.
- Checkliste:
  - Punkte abhaken, Punkt hinzufügen mit „Wer? (optional)“ (Mitglied)
  - Punkte löschen (Rückfrage nicht nötig)
- „Eintrag löschen“ mit Rückfrage `window.confirm` „Eintrag „…“ mit N Checkpunkten löschen?“
- Ein neuer Eintrag startet um 12:00–13:00 in der ersten Spalte, mit Fokus im Titel.

**B5 · Spalte bearbeiten** (Panel/Blatt): Name, „← nach links / nach rechts →“, „Spalte löschen“ nur bei leerer Spalte. Sonst steht dort der Hinweis „Löschen geht erst, wenn die Spalte leer ist (N Einträge verschieben).“

**B6 · Rollen** `/krachparade/rollen`

- Karten im Stil der AK-Karten:
  - Titel ›, Aufgabe, Chips „AK …“ und Kennzeichen
  - Fuß mit den Namen oder in Rot „noch niemand eingetragen“
- „+ Rolle“. Antippen öffnet Panel bzw. Blatt mit:
  - Rolle, Aufgabe, Kennzeichen, AK
  - Personen als Liste mit „×“
  - „Mitglied eintragen …“ (Auswahl) und „oder Name als Freitext“ + „Hinzufügen“
  - Datenschutz-Hinweis
  - „Rolle löschen“ mit Rückfrage

**B7 · Klicktest** `e2e/krachparade-tag.spec.ts`. Nur eigene „E2E …“-Spalte, -Einträge und -Rollen anlegen und ändern, am Ende alles löschen, auch wenn ein Schritt fehlschlägt.

- Laptop:
  - Spalte „E2E Spalte“ anlegen.
  - Eintrag „E2E Aufbau“ 10:00–11:00 darin anlegen.
  - Per Maus um ca. +30 min ziehen → 10:30–11:30, nach dem Neuladen gleich.
  - Rückgängig testen.
  - In eine andere Spalte ziehen.
  - Unteren Rand ziehen → neues Ende.
  - Pfeiltaste ↓ → +5 min.
- Panel: Checkpunkt anlegen, abhaken, x/y steigt. Person als Freitext setzen.
- Handy (375 × 812): Liste zeigt den Eintrag unter der richtigen Stunde. Im Blatt „+15 min“, Checkliste in der Liste aufklappen und abhaken.
- Rollen: „E2E Rolle“ anlegen → „noch niemand eingetragen“. Freitext-Person hinzufügen → Name steht auf der Karte.
- Zugang:
  - Laptop: Navigation „Krachparade“
  - Handy: über „Mehr“
  - Plan: Krachparade-Schild → „Ablauf am Tag ansehen“ führt zur Seite
- Leere Spalte löschen. Eine Spalte mit Eintrag lässt sich nicht löschen (Hinweis sichtbar).
- Neuigkeiten-Test über `latestNewsId`.

## Akzeptanzkriterien

1. Fünf neue Tabellen, nur hinzufügend, mit den CHECK-Regeln aus A1. Bestehende Tabellen bleiben unverändert.
2. `src/lib/day-plan.ts` mit Vitest für alle Funktionen aus A2, auch Grenzfälle: 0:00, 23:59, Zeitpunkt, Überschneidung von drei Einträgen.
3. Alle Actions prüfen Anmeldung, aktives Mitglied, Ausgabe und Eingabe (Zod). Spalten mit Einträgen lassen sich nicht löschen.
4. Laptop: Tagesplan mit Spalten wie im Test-Layout v2. Drag & Drop verschiebt im 5-Minuten-Raster und über Spalten, der untere Rand ändert die Dauer. Gespeichert wird beim Loslassen, mit 5 s Rückgängig. Klick ohne Ziehen öffnet das Panel. Tastatur funktioniert.
5. Handy: Liste nach Stunde mit Spalten-Kennzeichen, Checkliste aufklappbar und abhakbar. Im Blatt verschieben mit −15/−5/+5/+15 min.
6. Rollen mit mehreren Personen (Mitglied oder Freitext). Unbesetzte Rollen stehen rot da, die Zahl unbesetzter Rollen steht im Kopf.
7. Zugang: Laptop-Navigation „Krachparade“, Handy unter „Mehr“, Link am Krachparade-Schild im Gantt und in der Wochenliste.
8. production-Seed legt die KP26-Vorlage genau einmal an (nur ohne Spalten). Ein zweiter Lauf ändert nichts. dev-Seed nur mit ausgedachten Daten.
9. Kein waagrechtes Scrollen bei 375 × 812. Am Laptop scrollt der Tagesplan in sich, bei 1280 × 800 sind drei Spalten nebeneinander lesbar. Keine Hydration-Warnung.
10. `pnpm typecheck`, `lint`, `test`, `build` grün. Neuer Klicktest grün, alle bisherigen bleiben grün, gegen `pnpm dev` (frisch gestartet) und gegen den Production-Build auf 3100.
11. Neuigkeiten-Eintrag (unten) in `src/lib/news/entries.ts`.

## Deploy

Klasse B mit DB-Änderung, durch Franz (Ablauf wie 018/025):

1. `deploy` → hält wegen Schema/Seed an, der PR steht. `gh pr checks spec/030-krachparade-tag --watch`.
2. **Vorschau-Test am iPhone:** Vorschau-Adresse + `/dev/login`. Tagesplan im Querformat, Liste und Blatt im Hochformat, Rollen. Danach **ausdrücklich bestätigen**.
3. Neon: Backup-Zweig `backup-vor-030` von `production`.
4. `git branch --show-current` → `spec/030-krachparade-tag`.
5. `pnpm db:push:prod` (bei der Frage zu `departments_edition_name` wie immer „No, add the constraint without truncating the table“).
6. `pnpm db:seed:prod` → legt die KP26-Vorlage für den Tag an. Ausgabe prüfen: 3 Spalten, 13 Einträge, 6 Rollen.
7. `deploy --db-erledigt`.
8. Live-Check: `/krachparade` am Laptop und am iPhone, Link im Plan.

## Neuigkeiten

ID `030-krachparade-tag`, Datum = Tag des Baus.

**Titel:** Der Tag der Krachparade

- **Neue Seite „Krachparade“.** Ablauf des Tages mit Spalten für Programm, Demozug und Orga. Am Laptop verschiebst du Blöcke per Drag & Drop, am Handy mit ±15 min.
- **Checklisten am Ablauf.** Jeder Eintrag hat eine Checkliste zum Abhaken, z. B. „Schild „Ab hier Sound AUS“ gestellt“.
- **Rollen am Tag.** Wer macht Versammlungsleitung, Demozentrale & Co.? Unbesetzte Rollen siehst du sofort.
- **Startet mit dem Ablauf von 2026.** Passt ihn gemeinsam an.

## Abweichungen beim Bau

(von Claude Code zu ergänzen; nie den Freigabe-Haken hier eintragen, stattdessen „(von Franz freigegeben)“)

Aus dem Abgleich mit dem Code:

1. **Laptop-Navigation:** „Krachparade“ steht direkt nach „Plan“ (Plan · Krachparade · AKs · Protokolle · Meine Aufgaben · Kollektive (R3) · Einstellungen), nicht zwischen „Meine“ und „Einstellungen“. Am Handy der Link unter „Mehr“ wie in der Spec. (von Franz freigegeben)
2. **Person** bei Einträgen, Checkpunkten und Rollen über den bestehenden `OwnerPicker` (Name tippen, Mitglied wählen oder „Ohne Account: …“) statt eigener Knöpfe „Niemand | Mitglied | Freitext“; Rollen: `OwnerPicker` + „Hinzufügen“. `OwnerPicker` selbst bleibt unverändert. Dafür hat `day_checks` zusätzlich die Spalte `name_text` (≤ 80, höchstens eines von `member_id` und `name_text`, wie `owner_id`/`owner_name` im Protokoll). (von Franz freigegeben)
3. **iPhone-sichere Seitensperre** aus `news-button.tsx` wird in Teil B in einen kleinen gemeinsamen Baustein ausgelagert; die Neuigkeiten nutzen ihn unverändert weiter. (von Franz freigegeben)
4. **Neu laden nach Änderungen** mit `refresh()` wie im Plan statt `revalidatePath`. (von Franz freigegeben)
5. **Seed-Aufruf im `--prod`-Teil** von `src/db/seed.ts` ist gewollt, auch wenn das Skript dafür Klasse C meldet. (von Franz freigegeben)

Beim Bau von Teil A:

- `timelineRange` endet immer spätestens um 24:00, auch wenn ein Zeitpunkt kurz vor Mitternacht (zählt als 20 Minuten) darüber hinausreichen würde.
- Die Vorlage nutzt Uhrzeiten als Text („11:15“) und wird beim Anlegen in Minuten umgerechnet; der Seed legt alles in einem `db.batch` an, damit ein Fehler keine halbe Vorlage hinterlässt.
- Wird bei einem Eintrag die Uhrzeit entfernt, entfällt auch das Ende (ohne Beginn gibt es kein Ende).

Beim Bau von Teil B:

- **Teil A ergänzt (für B nötig):** `src/db/day-plan.ts` hat zusätzlich `loadDayOptions` (AKs und Namen für die Auswahl) und `countDayPlan` (Zahlen für das Fenster im Plan). Die Übergangs-Liste aus A5 ist durch den Tagesplan ersetzt.
- **Kopfleiste am Laptop:** Mit „Krachparade“ passen die sieben Navigationspunkte bei 1280 px nicht mehr neben Logo und Countdown. Die Navigation steht deshalb bis 1536 px in einer eigenen Zeile darunter (wie bisher schon zwischen 901 und 1279 px), statt umzubrechen.
- **Handy-Liste:** Unter der Liste gibt es zusätzlich den Abschnitt „Spalten“ mit „+ Spalte“ und je Spalte einem Knopf zum Bearbeiten, damit B5 auch am Handy erreichbar ist.
- **Neue Einträge, Spalten und Rollen** werden sofort mit einem Platzhalter angelegt („Neuer Eintrag“ 12:00–13:00, „Neue Spalte“, „Neue Rolle“); der Name ist danach markiert und wird überschrieben.
- **Uhrzeit-Felder** speichern beim Verlassen und zusätzlich 0,8 s nach einer Änderung, weil die Auswahlräder am Handy das Feld nicht immer verlassen.
- **Nach dem Ziehen** bleibt der Block an der neuen Stelle stehen, bis die Daten vom Server da sind (kein kurzes Zurückspringen).
- **Fenster am Krachparade-Schild** öffnet nach links, weil das Schild am rechten Rand des Gantt steht.
