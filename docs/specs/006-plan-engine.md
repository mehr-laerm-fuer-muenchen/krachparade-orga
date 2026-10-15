# SPEC 006 – Plan-Engine

Freigabe Franz: ☑
Zweig: `spec/006-plan-engine` · Risikoklasse B (Risiko-Skript stuft wegen Seed-Änderung C ein – erwartbar) · lokal (Teil A/B, Seed) · DB: ja: neue Tabellen `plan_elements`, `plan_links`, `plan_todos`, `plan_notes`, `plan_changes`; neue Spalte `meeting_items.plan_element_id`

Stand 15.10.2026 (Sitzung 5). Baut auf 002–005 auf. Grundlage: Entscheidungen „Gantt statt Baum“ (Release-Plan, 15.10.2026), Test-Layout v4 (Artifact „KP27 Gantt-Plan“, Version 5) und die Auswahlfragen vom 15.10.2026.

## Ziel

Die App bekommt das Datenmodell und die Rechenlogik für den Gantt-Plan. Ein Plan besteht aus **Meilensteinen** (ohne Dauer) und **Vorgängen** (Dauer in Kalendertagen), verbunden über **Ende → Start mit Abstand in Tagen**. Alles wird **rückwärts vom D-Day** gerechnet: Jedes Element liegt standardmäßig auf seinem spätesten Termin, wird es länger, rutschen die Vorgänger nach vorn. Elemente lassen sich verschieben (mit allen Vorgängern), **Fixtermine** bleiben fest. Die Engine liefert je Element Start, Ende, spätesten Termin, Puffer und Status sowie den **kritischen Pfad**.

Zusätzlich legt 006 schon die Tabellen für Zuständigkeit (AK, Aufgabenbereich, verantwortliche Person), **To-dos** (mit Fälligkeit relativ zum Element), **Notizen** und einen **Änderungsverlauf** an. Die Oberfläche dafür kommt mit 007 (Gantt-Ansicht, Wochenliste) und 008 (Bearbeiten). In 006 zeigt die Startseite `/` nur eine einfache Vorschau-Tabelle, damit die Rechnung gegen echte Daten sichtbar und per Klicktest prüfbar ist.

## Nicht in dieser Spec

- Gantt-Ansicht, Wochenliste am Handy, Umbenennen der Navigation „Überblick“ → „Plan“ (007)
- Anlegen, Bearbeiten, Ziehen, Verbinden, To-dos abhaken, Notizen schreiben in der Oberfläche; Schreiben in `plan_changes` (008)
- „Meine Aufgaben“ aus dem Plan (009)
- KP27-Vorlage für production (010) – production bekommt in 006 **keine** Plan-Daten
- Verknüpfen von Protokoll-To-dos mit Plan-Elementen in der Oberfläche (R2) – hier nur die Spalte
- Arbeitstage, Feiertage, Wochenend-Logik (es gelten Kalendertage)
- Änderungen an `src/proxy.ts`, `src/auth.ts`, Login-Ablauf, `ADMIN_EMAILS`, `canManage()`, Navigation
- Neue Laufzeit-Pakete

## Vorab: Abgleich mit dem Code nach 005

Bevor du etwas änderst, prüfe den aktuellen Stand und berichte kurz:

- Layout `src/app/(app)/layout.tsx` lädt das Mitglied über `getCurrentMember()` (mit `await connection()`).
- Helfer für die aktuelle Ausgabe (`editions.is_current`, `d_day`) – Name und Ort.
- `src/lib/dday.ts`: `daysUntil`, `formatDLabel`, `todayInBerlin` – Signaturen und Datumsformat (String `YYYY-MM-DD` oder `Date`?).
- `src/components/status-pill.tsx` (Varianten `done`, `ok`, `warn`, `late`).
- Startseite `src/app/(app)/page.tsx` (Platzhalter „Weg zur Krachparade“).
- `src/db/schema.ts`: `working_groups`, `departments.working_group_id`, `meeting_items`, `members`.
- `src/db/seed.ts`: Unterscheidung `--prod`, Test-Mitglieder, Vorschlags-AKs aus 005, `SEED_VERSION`.
- `db:reset:dev`: Reihenfolge beim Leeren.

Wenn etwas davon grundlegend anders ist als hier beschrieben: stoppen, Unterschied beschreiben, nichts umbauen. Bestehende Helfer nutzen, keine zweiten bauen.

## Umsetzung

**Grundregeln**

- Alles hängt an der **aktuellen Ausgabe**.
- **Tage sind Kalendertage.** Intern rechnet die Engine mit ganzen Zahlen relativ zum D-Day (`0` = D-Day, `-80` = 80 Tage davor). Umrechnung Datum ↔ Tag nur über Helfer in `src/lib/`, ohne Uhrzeit und ohne lokale Zeitzone.
- „Heute“ immer serverseitig über `todayInBerlin(new Date())`; die Engine bekommt „heute“ als Parameter.
- Gespeichert wird **relativ**: Dauer, Abstände und Verschiebung in Tagen. Nur Fixtermine sind **absolute Daten**. Ändert ein Admin den D-Day, wandert damit der ganze Plan mit, Fixtermine bleiben stehen (und können dadurch rot werden).
- Keine Kreise in den Verbindungen. Die Engine prüft das und wirft bei einem Kreis einen eigenen Fehler.
- Keine Inhalte aus Notizen oder To-dos in Logs.

### Teil A – Datenmodell, Engine, Seed

1. **Tabellen** in `src/db/schema.ts` (nur hinzufügend):
   - `plan_elements`:
     - `id` uuid, `edition_id` → `editions` (Pflicht)
     - `working_group_id` → `working_groups` (leer erlaubt, beim Löschen `set null`; leer = Spur „Ohne AK“)
     - `department_id` → `departments` (leer erlaubt, `set null`)
     - `owner_id` → `members` (leer erlaubt; optionale verantwortliche Person)
     - `kind` text `milestone` | `task` (CHECK-Regel)
     - `name` text (1–120 Zeichen)
     - `duration_days` int, Standard 0; CHECK-Regel `plan_elements_duration`: `kind = 'milestone'` → 0, `kind = 'task'` → 1 bis 365
     - `shift_days` int, Standard 0 (Verschiebung gegenüber dem spätesten Termin; negativ = früher = Puffer, positiv = später = Verzug)
     - `fixed_date` date (leer erlaubt; gesetzt = Fixtermin, `shift_days` wird dann ignoriert)
     - `done` boolean Standard false, `done_at` timestamp
     - `wobbly` boolean Standard false („Wackelt“ als Einschätzung)
     - `sort_order` int, `created_by` → `members` (leer erlaubt), `updated_by` → `members` (leer erlaubt), `created_at`, `updated_at`
   - `plan_links` (Ende → Start):
     - `id` uuid, `edition_id` → `editions` (Pflicht)
     - `from_element_id` → `plan_elements` (Pflicht, löschen kaskadiert)
     - `to_element_id` → `plan_elements` (leer = **D-Day**, löschen kaskadiert)
     - `lag_days` int Standard 0, CHECK 0 bis 365
     - `created_at`
     - CHECK `plan_links_not_self`: `from_element_id <> to_element_id`
     - Eindeutig: (`from_element_id`, `to_element_id`) wenn `to_element_id` gesetzt; `from_element_id` allein wenn `to_element_id` leer (zwei Teil-Indizes)
   - `plan_todos`:
     - `id` uuid, `element_id` → `plan_elements` (Pflicht, löschen kaskadiert)
     - `text` text (1–200), `owner_id` → `members` (leer erlaubt)
     - `anchor` text `start` | `end` (CHECK, Standard `start`), `days_before` int Standard 0, CHECK 0 bis 365
     - `done` boolean Standard false, `done_at` timestamp, `sort_order` int, `created_by` → `members` (leer erlaubt), `created_at`, `updated_at`
   - `plan_notes`: `id` uuid, `element_id` → `plan_elements` (Pflicht, löschen kaskadiert), `author_id` → `members` (Pflicht), `text` text (1–2000), `created_at`, `updated_at`
   - `plan_changes`: `id` uuid, `element_id` → `plan_elements` (Pflicht, löschen kaskadiert), `member_id` → `members` (leer erlaubt), `summary` text (1–300, z. B. „Dauer 21 → 28 Tage“), `created_at`. Wird erst ab 008 beschrieben.
   - `meeting_items`: neue Spalte `plan_element_id` → `plan_elements` (leer erlaubt, beim Löschen `set null`). Wird in 006 nirgends gesetzt oder angezeigt.
2. **Datums-Helfer** in `src/lib/plan-days.ts` (reine Funktionen, Vitest), passend zum Datumsformat aus `dday.ts`:
   - `dateToDay(date, dDay)` → Tage relativ zum D-Day; `dayToDate(day, dDay)` → Datum
   - Tests: Monatswechsel, Jahreswechsel 2026/27, Sommerzeit-Ende 31.03.2027 (kein Versatz um einen Tag), D-Day selbst = 0
3. **Engine** in `src/lib/plan-engine.ts` (reine Funktionen, keine Datenbank, Vitest):
   - Eingaben: Elemente `{ id, kind, durationDays, shiftDays, fixedDay | null, done, wobbly, sortOrder }` (Fixtermin schon in Tage umgerechnet), Verbindungen `{ fromId, toId | null, lagDays }`, `today` als Tag relativ zum D-Day.
   - `computePlan(elements, links, today)` liefert je Element:
     - `latestFinish`: Minimum über alle ausgehenden Verbindungen von (Bezugstag des Nachfolgers − `lagDays`). Bezugstag = 0 bei D-Day, `fixedDay` bei einem Fixtermin-Nachfolger, sonst dessen `latestStart`. Ohne ausgehende Verbindung: 0.
     - `latestStart` = `latestFinish` − `durationDays`
     - `plannedStart` = `fixedDay` falls gesetzt, sonst `latestStart` + `shiftDays`; `plannedEnd` = `plannedStart` + `durationDays`
     - `buffer` = `latestStart` − `plannedStart` (negativ = zu spät)
     - `status` und `reason` in dieser Reihenfolge: `done` → `done`/`done` · `buffer < 0` → `late`/`fixed_too_late` (bei Fixtermin) bzw. `late`/`negative_buffer` · `plannedEnd < today` → `late`/`overdue` · `wobbly` → `warn`/`wobbly` · sonst `ok`/`ok`
     - Zusätzlich für die ganze Ausgabe: `criticalPath` (geordnete Liste von Element-IDs) und `latestProjectStart` (Tag).
   - **Kritischer Pfad** = die längste Kette zum D-Day: Start beim Element mit dem kleinsten `latestStart` (bei Gleichstand kleinste `sortOrder`, dann `id`). Von dort jeweils der ausgehenden Verbindung folgen, die „ohne Luft“ ist (Bezugstag − `lagDays` = `latestFinish` des aktuellen Elements; bei mehreren die mit kleinster `sortOrder` des Nachfolgers), bis der D-Day oder ein Element ohne solche Verbindung erreicht ist.
   - `wouldCreateCycle(links, fromId, toId)`: `true`, wenn `fromId === toId` oder `fromId` schon (direkt oder über andere) von `toId` abhängt. `toId = null` (D-Day) → nie ein Kreis.
   - `computePlan` wirft `PlanCycleError`, wenn die Verbindungen einen Kreis enthalten.
   - **Bearbeiten als reine Funktionen** (für 008, hier schon gebaut und getestet). Jede liefert nur die geänderten Werte zurück (`{ id, shiftDays?, fixedDay?, durationDays? }[]`):
     - `moveElement(plan, id, delta)`: Ist das Element ein Fixtermin, wandert nur sein `fixedDay` um `delta`. Sonst bekommen das Element **und alle seine Vorgänger** (transitiv, ohne Fixtermine) `shiftDays + delta`.
     - `resizeFromEnd(plan, id, delta)`: nur Vorgänge; neue Dauer = max(1, min(365, Dauer + delta)); der Start bleibt stehen: Element und alle Vorgänger (ohne Fixtermine) bekommen `shiftDays` + tatsächliche Änderung. Bei einem Fixtermin ändert sich nur die Dauer.
     - `resizeFromStart(plan, id, delta)`: nur Vorgänge; neue Dauer = max(1, min(365, Dauer − delta)); das Ende bleibt stehen, `shiftDays` bleibt gleich (die Vorgänger rutschen über die Rückwärtsrechnung von selbst mit). Bei einem Fixtermin wandert `fixedDay` um die tatsächliche Änderung.
     - Meilensteine: `resizeFrom…` gibt eine leere Liste zurück.
   - `todoDueDay(todo, computed)`: `anchor = start` → `plannedStart − daysBefore`, `anchor = end` → `plannedEnd − daysBefore`.
   - **Vitest** `src/lib/plan-engine.test.ts`, mindestens:
     - Einzelner Meilenstein, 10 Tage vor dem D-Day → `latestStart` −10, Puffer 0, Status `ok`
     - Kette: Dauer eines Vorgangs +7 → alle Vorgänger 7 Tage früher, Nachfolger unverändert
     - Mehrere Nachfolger → der früheste bestimmt `latestFinish`
     - Element ohne ausgehende Verbindung → `latestFinish` 0
     - Fixtermin 2 Tage später als nötig → Puffer −2, `late`/`fixed_too_late`; seine Vorgänger rechnen vom Fixtermin aus
     - `shiftDays` −10 → Puffer +10, Status `ok`; `shiftDays` +3 → Puffer −3, `late`/`negative_buffer`
     - Überfällig: `plannedEnd` gestern und nicht erledigt → `late`/`overdue`; `plannedEnd` heute → nicht überfällig; erledigt schlägt alles; `wobbly` → `warn`, aber `late` geht vor
     - Kreis: `wouldCreateCycle` für Selbstbezug, direkten und indirekten Rückbezug; D-Day als Ziel nie; `computePlan` wirft `PlanCycleError`
     - `moveElement`: Vorgänger wandern mit, Fixtermin-Vorgänger nicht; Fixtermin selbst bewegt nur `fixedDay`
     - `resizeFromEnd` / `resizeFromStart`: Start bzw. Ende bleibt stehen, Grenzen 1 und 365, Meilenstein → leere Liste
     - `todoDueDay` für `start` und `end`
     - **KP27-Beispiel** (Testdaten wie im Seed unten, D-Day 08.05.2027): „Voranmeldung geöffnet“ liegt auf 21.12.2026 (D-138), „Finale Zusage an Kollektive“ auf 17.02.2027 (D-80), „Kooperationsgespräch KVR/Polizei“ (Fixtermin 08.04.2027) hat Puffer −2; kritischer Pfad = Budget KP27 beschlossen → Voranmeldung geöffnet → Vortreffen Kollektive → Anmeldung offen → Auswahlkommission → Finale Zusage an Kollektive → Zahlungsfrist Kollektive, `latestProjectStart` = D-150 (09.12.2026)
     - D-Day-Wechsel: gleiche Elemente mit D-Day 15.05.2027 → relative Termine identisch, ein Fixtermin (absolutes Datum) liegt 7 Tage relativ früher
4. **Datenzugriff** `src/db/plan.ts`: `loadPlan(editionId)` lädt Elemente (mit AK, Aufgabenbereich, Name der verantwortlichen Person), Verbindungen und je Element die Anzahl offener To-dos. Umrechnung `fixed_date` → `fixedDay` über `plan-days.ts`. Keine Schreibfunktionen in 006.
5. **Seed** `src/db/seed.ts` (idempotent), `SEED_VERSION` + 1:
   - **Mit `--prod`: nichts Neues.**
   - **Nur ohne `--prod`**, und nur wenn die aktuelle Ausgabe noch **kein** Plan-Element hat: den Beispielplan aus Test-Layout v4 anlegen (nur ausgedachte Inhalte, Personen aus dem Test-Seed). AKs und Aufgabenbereiche über ihre Namen aus 005 zuordnen. Abstände = `lag_days`, Ziel „D-Day“ = `to_element_id` leer.

     | Element | AK | Art | Dauer | Aufgabenbereich | Verantwortlich | Nachfolger (Abstand) | Besonderheit |
     |---|---|---|---|---|---|---|---|
     | Budget KP27 beschlossen | Finanzen | Meilenstein | – | Finanzen | Noa Fink | Voranmeldung geöffnet (12) | |
     | Voranmeldung geöffnet | Kommunikation | Meilenstein | – | Kommunikation E-Mails | Mika Sonnleitner | Vortreffen Kollektive (20) | |
     | Vortreffen Kollektive | Kommunikation | Meilenstein | – | Kollektiv-Chats | Noa Fink | Anmeldung offen (7) | |
     | Anmeldung offen | Kommunikation | Vorgang | 21 | Kommunikation E-Mails | Mika Sonnleitner | Auswahlkommission (0) | |
     | Auswahlkommission | Programm | Vorgang | 10 | – | – | Finale Zusage an Kollektive (0) | |
     | Finale Zusage an Kollektive | Programm | Meilenstein | – | – | Mika Sonnleitner | Zahlungsfrist Kollektive (0), Soundkopplung · Termin 1 (7) | |
     | Zahlungsfrist Kollektive | Finanzen | Vorgang | 23 | Finanzen | Noa Fink | D-Day (57) | |
     | Route & Aufstellung ausarbeiten | Demo & Route | Vorgang | 28 | Route | Kim Brenner | Versammlungsanzeige beim KVR (0) | |
     | Versammlungsanzeige beim KVR | Demo & Route | Meilenstein | – | Demoleitung | Kim Brenner | Kooperationsgespräch KVR/Polizei (50) | |
     | Kooperationsgespräch KVR/Polizei | Demo & Route | Meilenstein | – | Demoleitung | Kim Brenner | Finaler Crosscheck (15) | Fixtermin 08.04.2027 |
     | Sicherheitskonzept & Abschnittsleitungen | Demo & Route | Vorgang | 30 | Demoleitung | Alex Rauch | Finaler Crosscheck (0) | |
     | Wagenreihung | Programm | Vorgang | 14 | – | Robin Tal | Finaler Crosscheck (0) | |
     | Finaler Crosscheck | Demo & Route | Meilenstein | – | Demoleitung | Kim Brenner | Briefing Abschnittsleitungen (3) | |
     | Briefing Abschnittsleitungen | Demo & Route | Meilenstein | – | Demoleitung | Kim Brenner | Gesamtbriefing Wagenverantwortliche (4) | |
     | Gesamtbriefing Wagenverantwortliche | Demo & Route | Meilenstein | – | Demoleitung | Kim Brenner | D-Day (10) | |
     | Finales Vortreffen (Zoom) | Demo & Route | Meilenstein | – | Demoleitung | – | D-Day (3) | |
     | Shirt-Umfrage aktiv | Flächen & Technik | Vorgang | 30 | Ressourcen / Material | Ivy Lamm | T-Shirts bestellt (0) | |
     | T-Shirts bestellt | Flächen & Technik | Meilenstein | – | Ressourcen / Material | Ivy Lamm | D-Day (49) | wackelt |
     | Soundkopplung · Termin 1 | Flächen & Technik | Meilenstein | – | Bühne / Soundkopplung | Sascha Möller | Soundkopplung · Termin 2 (45) | |
     | Soundkopplung · Termin 2 | Flächen & Technik | Meilenstein | – | Bühne / Soundkopplung | Sascha Möller | Soundkopplung · Termin 3 (25) | |
     | Soundkopplung · Termin 3 | Flächen & Technik | Meilenstein | – | Bühne / Soundkopplung | Sascha Möller | D-Day (3) | |
     | Westen, Binden & Funk zählen | Flächen & Technik | Vorgang | 14 | Ressourcen / Material | Alex Rauch | Wagenpakete packen (0) | |
     | Wagenpakete packen | Flächen & Technik | Vorgang | 4 | Wagenpakete | Alex Rauch | Gesamtbriefing Wagenverantwortliche (0) | |
     | Bands & Reden anfragen | Programm | Vorgang | 40 | Bühnenprogramm musikalisch | Mika Sonnleitner | Bühnenprogramm final (0) | |
     | Bühnenprogramm final | Programm | Meilenstein | – | Bühnenprogramm musikalisch | – | D-Day (14) | |
     | Social-Media-Plan | Kommunikation | Vorgang | 20 | Social Media | Luca Pfeffer | Pressemitteilung Vorbericht (0) | `shift_days` −10 |
     | Pressemitteilung Vorbericht | Kommunikation | Meilenstein | – | Pressearbeit | Jo Kranz | D-Day (60) | |
     | Schildermalen | Kommunikation | Meilenstein | – | Social Media | – | D-Day (34) | |
     | Teaser veröffentlicht | Kommunikation | Meilenstein | – | Teaser / Aftermovie | Ivy Lamm | D-Day (21) | `shift_days` −5 |
     | Spendenkonto & Boxen bereit | Finanzen | Meilenstein | – | Finanzen | – | D-Day (17) | |

   - To-dos (ausgedacht): bei „Finaler Crosscheck“ „Rechtliches geprüft“ (Kim Brenner), „Sicherheitskonzept geprüft“ (Alex Rauch), „Programm geprüft“ (Sascha Möller), „Logistik & Material geprüft“ (Alex Rauch), „PR geprüft“ (Jo Kranz) je `start`, 2 Tage vorher; „Ergebnis ins Plenum“ (Kim Brenner) `end`, 0. Bei „Auswahlkommission“ „Auswahlkriterien beschlossen“ (`start`, 14), bei „Wagenpakete packen“ „Mehr Helfende eingeteilt“ (`start`, 7), bei „Pressemitteilung Vorbericht“ „Presseverteiler aktualisiert“ (`start`, 14).
   - Notizen (ausgedacht): bei „Finaler Crosscheck“ zwei Notizen (Kim Brenner, Alex Rauch), bei „T-Shirts bestellt“ eine (Ivy Lamm). Kurze, harmlose Texte ohne Kontaktdaten.
   - `db:reset:dev` leert auch die neuen Tabellen (Reihenfolge wegen Fremdschlüsseln: `meeting_items.plan_element_id` vorher leeren oder `meeting_items` vorher löschen, dann `plan_changes`, `plan_notes`, `plan_todos`, `plan_links`, `plan_elements`).

Auftrag 1 endet mit „setze NUR Teil A um“. Teil A committen, nicht pushen.

### Teil B – Vorschau auf der Startseite, Klicktest, Vermerke

6. **Startseite `/`** (ersetzt den Platzhalter „Weg zur Krachparade“, Titel „Plan KP27“ bzw. Name der aktuellen Ausgabe), nur lesend, Rechnung über `computePlan` mit `todayInBerlin`:
   - Kopfzeile: Anzahl Elemente, Anzahl ohne Puffer, „Kritischer Pfad: n Elemente, Start spätestens ‹Wochentag TT.MM.› (D-x)“.
   - Je AK (in `sort_order`, Überschrift „AK ‹Name›“, am Ende „Ohne AK“ falls nötig) eine Tabelle, sortiert nach Start: Name, Art (Meilenstein/Vorgang), Start (TT.MM.JJJJ und D-x), Ende (nur Vorgänge), Puffer („+5 T“, „0 T“, „−2 T“ in Verzug-Farbe), `StatusPill`, Kennzeichen „Fix“ bei Fixterminen und „kritisch“ bei Elementen auf dem kritischen Pfad, verantwortliche Person, Anzahl offener To-dos.
   - Hinweis oben (ruhige Hinweisfläche): „Vorschau der Plan-Rechnung. Gantt-Ansicht und Bearbeiten kommen mit den nächsten Specs.“
   - Leerer Zustand (production bis 010): „Noch kein Plan. Die KP27-Vorlage kommt mit Spec 010.“
   - Handy: Tabellen in einer eigenen waagrechten Scrollfläche, die Seite selbst scrollt nie waagrecht.
   - Seite `/` ist mit `getCurrentMember()` geschützt wie alle Seiten unter `(app)`; keine E-Mail-Adressen.
7. **Klicktest** `e2e/plan.spec.ts` (Dev-Login als Kim Brenner); Seed-Daten vorausgesetzt, Prüfungen relativ und auf Namen bezogen:
   - `/` zeigt „Kooperationsgespräch KVR/Polizei“ mit Kennzeichen „Fix“ und Puffer „−2 T“ im Status „Verzug“
   - „Voranmeldung geöffnet“ zeigt 21.12.2026 und D-138; „Finale Zusage an Kollektive“ zeigt 17.02.2027 und D-80
   - „Social-Media-Plan“ zeigt Puffer „+10 T“
   - Die Kopfzeile nennt den kritischen Pfad mit Start D-150
   - Bei 375 × 812 keine waagrechte Scrollleiste der Seite
   - Bestehende Klicktests (`rahmen`, `protokoll`, `arbeitskreise`) nur anpassen, falls sie den alten Platzhalter-Titel „Weg zur Krachparade“ prüfen – sonst nicht anfassen
8. **Vermerke im Repo** (nur Doku, aus der Übergabe nachgezogen):
   - `docs/specs/004-protokoll.md`: Abschnitt „Abweichungen beim Bau“ ergänzen: „`e2e/rahmen.spec.ts` wartet nach jedem Seitenwechsel mit `expectPageReady` (React-Lücke `_retryCache` mit `<Activity>` in Next.js 16), Freigabe Franz.“
   - `docs/specs/005-arbeitskreise.md`: Abschnitt „Abweichungen beim Bau“ ergänzen: „`e2e/rahmen.spec.ts` an Navigation ‚AKs‘ angepasst, Test ‚Leitung eines Referats ändern‘ gestrichen; Admins können auch deaktivierte Personen aus einem AK austragen. Freigabe Franz.“

Auftrag 2 beginnt mit „Teil A ist bereits umgesetzt – ändere daran nichts“.

## Akzeptanzkriterien

- Neue Tabellen und die Spalte `meeting_items.plan_element_id` existieren, nur hinzufügend; CHECK-Regeln für Art/Dauer, Abstand, Anker und Selbstbezug greifen
- Engine rechnet rückwärts vom D-Day in Kalendertagen; Fixtermine absolut, alles andere relativ – D-Day-Wechsel verschiebt den Plan, Fixtermine bleiben
- Kreise werden erkannt (`wouldCreateCycle`, `PlanCycleError`)
- Status-Reihenfolge wie beschrieben; überfällig = `late`
- Kritischer Pfad = längste Kette zum D-Day; im Beispiel 7 Elemente ab D-150
- Vitest für `plan-days` und `plan-engine` grün (inkl. KP27-Beispiel und D-Day-Wechsel)
- Startseite zeigt die Vorschau mit den erwarteten Werten; production zeigt den leeren Zustand
- Seed: production bekommt nichts Neues; dev-Beispielplan nur mit ausgedachten Inhalten und Test-Personen, nur wenn noch kein Plan existiert
- Klicktest `e2e/plan.spec.ts` und alle bisherigen grün bei 375 × 812 und 1280 × 800, gegen `pnpm dev` **und** gegen den lokalen Production-Build
- Vermerke in `docs/specs/004-protokoll.md` und `docs/specs/005-arbeitskreise.md` ergänzt
- `pnpm typecheck`, `lint`, `test`, `build` grün

## Deploy

DB-Änderung: Neon-Backup-Zweig `backup-vor-006` von production → `pnpm db:push:prod` auf dem Zweig (Rückfrage von drizzle-kit zu `departments_edition_name` bzw. `meeting_attendees_…_pk` mit **„No, add the constraint without truncating the table“** beantworten, nie „truncate“) → **kein** `db:seed:prod` → `deploy --db-erledigt`. Danach am iPhone: Startseite zeigt „Noch kein Plan. Die KP27-Vorlage kommt mit Spec 010.“

## Abweichungen beim Bau

- **D-Day-Wechsel:** Die Vorgänger eines Fixtermins rechnen vom Fixtermin aus und wandern deshalb relativ mit ihm. Mit D-Day 15.05.2027 liegen „Kooperationsgespräch KVR/Polizei“, „Versammlungsanzeige beim KVR“ und „Route & Aufstellung ausarbeiten“ 7 Tage relativ früher; der Fixtermin hat dann +5 Tage Puffer. So in `src/lib/plan-engine.test.ts` getestet.
- **Kritischer Pfad:** Sind eine Verbindung zu einem Element und die Verbindung zum D-Day gleichzeitig „ohne Luft“, gewinnt das Element (der Pfad läuft weiter).
- **Beispielplan:** liegt als `TEST_PLAN` in `src/db/seed.ts` und wird vom Engine-Test (`src/lib/plan-engine.test.ts`) mitgenutzt, damit Seed und Test nicht auseinanderlaufen.
