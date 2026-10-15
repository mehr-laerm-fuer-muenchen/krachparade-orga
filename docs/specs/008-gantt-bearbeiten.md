# SPEC 008 – Gantt bearbeiten

Freigabe Franz: ☑
Zweig: `spec/008-gantt-bearbeiten` · Risikoklasse B · lokal (Sichtprüfung, Teil A/B) · DB: nein

Stand 15.10.2026 (Sitzung 5). Baut auf 006 (Engine, Tabellen) und 007 (Gantt, Wochenliste, Detail-Panel) auf, beide live. Vorbild: Test-Layout v4 (Artifact „KP27 Gantt-Plan“, Version 5). Entscheidungen aus den Auswahlfragen vom 15.10.2026.

## Ziel

Der Plan wird in der App gepflegt. Am Laptop lassen sich Balken und Rauten **ziehen** (das Element wandert mit allen Vorgängern) und Vorgänge an den **Rändern verlängern oder kürzen**. Gespeichert wird beim Loslassen, eine Leiste bietet kurz „Rückgängig“. Im Detail-Panel (Laptop) bzw. Blatt (Handy) lässt sich alles bearbeiten: Name, Art, Dauer, Zuständigkeit, Fixtermin, „Erreicht“, „Wackelt“, Vorgänger und Nachfolger mit Abstand, To-dos, Notizen. Am Handy wird statt Ziehen mit „−/+ Tage“-Knöpfen verschoben. Neue Elemente entstehen über ein Kurzformular, immer mit Nachfolger. Jede Plan-Änderung landet im Änderungsverlauf des Elements. Ändern zwei Personen gleichzeitig, gewinnt die letzte Änderung, und wer überschrieben hat, sieht einen Hinweis.

## Nicht in dieser Spec

- „Meine Aufgaben“ aus dem Plan (009), KP27-Vorlage für production (010)
- Verknüpfen von Protokoll-To-dos mit Plan-Elementen (R2)
- Änderungen am Schema, am Seed, an der Rückwärtsrechnung in `src/lib/plan-engine.ts` (die Bearbeiten-Funktionen dort nur nutzen; Fehler darin melden statt umbauen)
- Ziehen am Handy, Mehrfachauswahl, Kopieren von Elementen
- Benachrichtigungen
- Änderungen an `src/proxy.ts`, `src/auth.ts`, Login, Configs; neue Laufzeit-Pakete

## Vorab: Abgleich mit dem Code nach 007

Bevor du etwas änderst, prüfe den aktuellen Stand und berichte kurz:

- `src/lib/plan-engine.ts`: Signaturen von `moveElement`, `resizeFromEnd`, `resizeFromStart`, `wouldCreateCycle`, `todoDueDay`, `computePlan`
- `src/db/plan.ts` (`loadPlan`, `loadPlanDetails`), Schema der Plan-Tabellen (Spaltennamen, `updated_at`/`updated_by`)
- Komponenten `plan-gantt.tsx`, `plan-week-list.tsx`, `plan-detail.tsx`, Startseite: wie Auswahl, Filter, Zoom und Panel zusammenhängen
- Wie die Server Actions aus 004/005 das handelnde Mitglied prüfen (aus `members`, `active = true`) und wie sie neu laden (`revalidatePath` o. Ä.)
- Unterstützt der verwendete Drizzle-Treiber `db.batch` für mehrere Änderungen in einem Aufruf?

Wenn etwas davon grundlegend anders ist als hier beschrieben: stoppen, Unterschied beschreiben, nichts umbauen. Bestehende Helfer nutzen, keine zweiten bauen.

## Umsetzung

**Grundregeln**

- Rechte: **alle aktiven Mitglieder** bearbeiten alles. Jede Server Action lädt das handelnde Mitglied bei **jedem** Aufruf aus `members` und verlangt `active = true`, sonst „Kein Zugriff.“. Ausnahme: Notizen bearbeiten oder löschen nur, wer sie geschrieben hat („Nur eigene Notizen lassen sich ändern.“).
- Alles gehört zur **aktuellen Ausgabe**; Elemente, AKs, Aufgabenbereiche, Personen und Verbindungsziele werden serverseitig darauf geprüft, sonst Fehlermeldung, nichts speichern.
- Jede Eingabe mit Zod prüfen (Name 1–120, Dauer 1–365 bei Vorgängen, Abstand 0–365, To-do-Text 1–200, Tage 0–365, Notiz 1–2000, Datum gültig).
- **Kreise**: Jede neue Verbindung wird serverseitig mit `wouldCreateCycle` geprüft → „Das würde einen Kreis ergeben.“
- Mehrere Zeilen (Verschieben mit Vorgängern, Löschen mit Umhängen) in **einem** `db.batch`-Aufruf, wenn der Treiber das kann; sonst nacheinander und bei Fehler eine klare Meldung.
- Jede Änderung an einem Element setzt `updated_at` und `updated_by`.
- Nach jeder Änderung lädt die Startseite neu und zeigt die **Rechnung vom Server**. Nur **während des Ziehens** darf der Browser mit denselben Engine-Funktionen eine Vorschau rechnen; „heute“ kommt weiter vom Server.
- **Konflikt-Hinweis**: Der Client schickt bei jeder Element-Änderung das `updated_at`, das er zuletzt gesehen hat. Weicht es ab, wird trotzdem gespeichert (letzte gewinnt), die Antwort meldet aber, wer zuletzt geändert hat. Die Seite zeigt dann „Wurde gerade von ‹Name› geändert – Plan neu geladen.“ und lädt neu.
- **Datenschutz-Hinweis** unter den Eingabefeldern für Notizen und To-dos: „Keine Telefonnummern, Adressen oder Kontodaten eintragen.“
- Keine Inhalte aus Notizen oder To-dos in Logs, keine E-Mail-Adressen in der Oberfläche.

### Teil A – Logik und Server Actions

1. **Reine Funktionen** `src/lib/plan-edit.ts` mit Vitest:
   - `reconnectOnDelete(links, element)`: Für jede Kombination aus eingehender Verbindung (Vorgänger P, Abstand a) und ausgehender Verbindung (Nachfolger S oder D-Day, Abstand b) eine neue Verbindung P → S mit Abstand **a + Dauer + b** (Termine bleiben gleich). Gibt es P → S schon, gilt der größere Abstand. Ergebnis: zu löschende und anzulegende bzw. zu ändernde Verbindungen.
   - `changeSummaries(before, after, names)`: kurze deutsche Texte für den Verlauf, z. B. „Verschoben um +3 T“, „Dauer 21 → 28 Tage“, „Fixtermin gesetzt: Do 08.04.2027“, „Fixtermin entfernt“, „Erreicht“, „Wieder offen“, „Wackelt“, „Wackelt nicht mehr“, „Name geändert“, „AK: Programm → Finanzen“, „Aufgabenbereich: Route“, „Verantwortlich: Kim Brenner“, „Meilenstein → Vorgang“, „Vorgänger verbunden: Anmeldung offen (0 T)“, „Nachfolger gelöst: D-Day“, „Abstand zu Finaler Crosscheck: 15 → 10 T“, „Angelegt“. Bei „Verschieben mit Vorgängern“ bekommt das gezogene Element „Verschoben um +3 T“, jeder mitgezogene Vorgänger „Mitverschoben um +3 T (mit ‹Name›)“.
   - Tests: Umhängen bei 1:1, 2:2 und vorhandener Verbindung; D-Day als Nachfolger; Meilenstein (Dauer 0); alle Texte oben; Vorzeichen bei negativen Tagen („−3 T“).
2. **Server Actions** `src/actions/plan.ts` (Grundregeln beachten), jede schreibt passende Zeilen in `plan_changes` (nicht für To-dos und Notizen):
   - `createElement`: Name, AK, Art, Dauer (Vorgang), **Nachfolger Pflicht** (Element der Ausgabe oder D-Day), Abstand; `shift_days` 0, `sort_order` ans Ende; Verlauf „Angelegt“. Gibt die neue ID zurück.
   - `updateElement`: Name, Art (Meilenstein → Dauer 0; Vorgang → bisherige Dauer, sonst 7), Dauer, AK (passt der Aufgabenbereich nicht mehr zum AK, wird er geleert), Aufgabenbereich (muss zum AK gehören), verantwortliche Person (aktives Mitglied oder leer).
   - `moveElement(id, delta)`, `resizeElement(id, edge: 'start' | 'end', delta)`: über die Engine-Funktionen, alle geänderten Zeilen in einem Batch. Rückgabe: die vorherigen Werte aller geänderten Elemente (für „Rückgängig“).
   - `undoPlanChange(previousValues)`: setzt genau diese Werte zurück (nur `shift_days`, `fixed_date`, `duration_days`), Verlauf „Rückgängig gemacht“.
   - `resetShift(id)`: `shift_days` = 0 („Auf spätesten Termin“).
   - `setFixedDate(id, date | null)`: setzen (Standard: aktueller Start) oder entfernen; beim Entfernen `shift_days` = 0.
   - `setDone(id, done)` (setzt/leert `done_at`), `setWobbly(id, wobbly)`.
   - `addLink(fromId, toId | null, lag)`, `updateLinkLag(linkId, lag)`, `removeLink(linkId)`; Verlauf am Ausgangs- **und** Ziel-Element.
   - `deleteElement(id)`: Verbindungen über `reconnectOnDelete` umhängen, dann löschen (To-dos, Notizen, Verlauf laufen über die Kaskade mit; `meeting_items.plan_element_id` wird leer). Verlauf „Verbindung umgehängt (nach Löschen von ‹Name›)“ an den betroffenen Vorgängern.
   - To-dos: `addTodo` (Text, Person optional, Anker `start`/`end`, Tage), `toggleTodo` (setzt/leert `done_at`), `deleteTodo`.
   - Notizen: `addNote`, `updateNote` (nur Autor), `deleteNote` (nur Autor).
   - Alle Element-Aktionen nehmen das zuletzt gesehene `updated_at` an und melden einen Konflikt wie oben beschrieben.
3. **Datenzugriff** `src/db/plan.ts` ergänzen: `loadPlanChanges(elementId, limit)` (neueste zuerst, mit Name), Anzahl gesamt.

Auftrag 1 endet mit „setze NUR Teil A um“. Teil A committen, nicht pushen.

### Teil B – Oberfläche, Tests

4. **Ziehen im Gantt** (nur ab 901 px):
   - Balken bzw. Raute ziehen = verschieben (Element und alle Vorgänger ohne Fixtermin; Fixtermin bewegt nur sich selbst). Vorgänge zeigen beim Überfahren links und rechts Griffe (8 px breit, halb transparent): rechter Rand = Ende wandert, Start bleibt; linker Rand = Start wandert, Ende bleibt. Mindestens 1 Tag. Meilensteine haben keine Griffe.
   - Schritt = ganze Tage nach Zoom (px/Tag). Während des Ziehens: Vorschau mit Puffer/Zu-spät-Band und Beschriftung, Zeilenreihenfolge bleibt eingefroren, Mauszeiger `grab`/`grabbing` bzw. `ew-resize`.
   - Ein Klick ohne Bewegung (< 4 px) wählt nur aus wie in 007.
   - Loslassen speichert. Danach unten die Leiste „Verschoben · Rückgängig“ bzw. „Dauer geändert · Rückgängig“ für 5 Sekunden (Fokus erreichbar, Escape schließt). Fehler beim Speichern → Vorschau zurück, Meldung „Konnte nicht gespeichert werden.“
5. **Detail-Panel / Blatt bearbeitbar** (ersetzt die Nur-Lesen-Ansicht aus 007, Aufbau wie Test-Layout v4):
   - **Kopf** wie bisher (Status, Puffer, Name, AK · Aufgabenbereich · Art · Person).
   - **Termin**: Datum bzw. Start/Ende, „Spätestens“, Hinweistext wie 007; bei `shift_days ≠ 0` „Von Hand um n Tage vorgezogen/nach hinten geschoben“ mit Knopf „Auf spätesten Termin“. **Am Handy** zusätzlich Knöpfe „−7 T“, „−1 T“, „+1 T“, „+7 T“ (verschieben wie Ziehen, mit Rückgängig-Leiste).
   - **Zuständig**: AK (Auswahl), Aufgabenbereich (nur Bereiche dieses AK, „– keiner –“), Verantwortlich (aktive Mitglieder, „– niemand –“).
   - **Element**: Name, Art (Umschalter Meilenstein | Vorgang), Dauer in Tagen (nur Vorgang), Fixtermin (Schalter „extern festgelegt“ + Datumsfeld).
   - **Status**: „Erreicht“ (Haken), „Wackelt (Einschätzung)“ (Haken, deaktiviert wenn erreicht), darunter klein der automatische Grund.
   - **To-dos & Voraussetzungen**: Liste wie 007, aber abhakbar und mit „×“ zum Löschen; darunter Eingabe Text, „wer?“ (optional), Tage, „vor Start | vor Ende“, „Hinzufügen“, Datenschutz-Hinweis.
   - **Notizen**: Eingabefeld (mehrzeilig) + „Notiz speichern“, Datenschutz-Hinweis; Liste neueste oben; bei eigenen Notizen „Bearbeiten“ und „Löschen“, bearbeitete mit „· bearbeitet“.
   - **Vorgänger / Nachfolger**: je Zeile Name, Abstand als Zahlenfeld („T Abstand“), „×“ zum Lösen; darunter Auswahl + „Verbinden“. Die Auswahl zeigt nur Elemente, die keinen Kreis ergeben und noch nicht verbunden sind; bei Nachfolgern zusätzlich „D-Day“, falls noch nicht verbunden. Hinweis: „Nur Ende → Start. Kreise sind ausgeschlossen.“
   - **Verlauf**: letzte 10 Einträge „Name · TT.MM. HH:MM · Text“, „Alle anzeigen“ lädt den Rest.
   - **Element löschen**: Knopf unten; Bestätigung in der Seite (kein Browser-Dialog) mit „Löschen“ / „Abbrechen“ und Hinweis „Vorgänger werden mit den Nachfolgern verbunden. n To-dos und m Notizen werden mitgelöscht.“
   - Felder speichern beim Verlassen bzw. bei Auswahl, kurze Meldung „Gespeichert“. Fehlermeldungen aus den Actions direkt am Feld.
6. **Neues Element** („+ Element“ in der Werkzeugleiste am Laptop und oben in der Wochenliste am Handy): Kurzformular (Laptop: kleines Fenster in der Seite, Handy: Blatt) mit Name, AK (Standard: AK des ausgewählten Elements, sonst erster eigener AK, sonst erster AK), Art, Dauer (Vorgang, Standard 7), **Nachfolger** (Pflicht, Standard „D-Day“) und Abstand (Standard 0). „Anlegen“ speichert, wählt das neue Element aus und öffnet das Panel.
7. **Konflikt-Hinweis** als Leiste wie „Rückgängig“: „Wurde gerade von ‹Name› geändert – Plan neu geladen.“
8. **Klicktest** `e2e/plan-bearbeiten.spec.ts` (Dev-Login als Kim Brenner). **Nur mit eigenen, je Lauf eindeutig benannten Elementen arbeiten**, Elemente aus dem Seed nie ändern (die Klicktests aus 007 brauchen sie). Am Ende alle eigenen Elemente löschen.
   - 1280 × 800: drei Elemente anlegen: „A ‹Zeit›“ (Vorgang 10 T, Nachfolger D-Day, 40 T), „B ‹Zeit›“ (Meilenstein, Nachfolger A), „C ‹Zeit›“ (Vorgang 5 T, Nachfolger B, 3 T) → alle drei sichtbar
   - A am Balken 5 Tage nach rechts ziehen → A zeigt „−5 T“, B und C wandern mit; „Rückgängig“ → wieder wie vorher
   - A am rechten Rand verlängern → Dauer größer, Start gleich; am linken Rand → Ende gleich
   - Im Panel von C: Nachfolger-Auswahl enthält A und B nicht (Kreis); Abstand zu B auf 7 ändern → bleibt nach Neuladen
   - Fixtermin bei B setzen und Datum 3 Tage später → B zeigt Verzug; Fixtermin entfernen
   - „Erreicht“ bei C → Status „Erreicht“; To-do bei A anlegen (Person Alex Rauch, 2 T vor Start), abhaken, löschen
   - Notiz bei A schreiben, bearbeiten („· bearbeitet“ sichtbar); Dev-Login als Alex Rauch → bei Kims Notiz kein „Bearbeiten“/„Löschen“; zurück zu Kim, Notiz löschen
   - Verlauf von A enthält „Angelegt“ und „Verschoben um +5 T“
   - Zwei Seiten als Kim: Seite 2 ändert die Dauer von A, Seite 1 ändert danach den Namen → Seite 1 zeigt „Wurde gerade von Kim Brenner geändert“
   - B löschen (Bestätigung) → C ist mit A verbunden, Abstand = alter Abstand C→B + 0 + alter Abstand B→A
   - 375 × 812: Element über die Wochenliste öffnen, „+1 T“ → verschoben, „Rückgängig“; Formular „+ Element“ bedienbar; keine waagrechte Scrollleiste
   - Aufräumen: alle eigenen Elemente löschen
   - Keine Konsolenfehler; nach Seitenwechseln `expectPageReady`
9. **Vitest** für `plan-edit.ts`; Klicktests aus 007 (`e2e/plan.spec.ts`) bleiben grün, nur Texte anpassen, die sich durch „bearbeitbar“ ändern (z. B. Hinweis „Bearbeiten kommt mit dem nächsten Update.“ entfällt).

Auftrag 2 beginnt mit „Teil A ist bereits umgesetzt – ändere daran nichts“.

## Akzeptanzkriterien

- Ziehen, Ränder ziehen, „−/+ Tage“ am Handy, Rückgängig funktionieren und werden serverseitig gespeichert; danach zeigt die Seite die Server-Rechnung
- Alle Felder, Status, Fixtermin, Verbindungen, To-dos und Notizen sind bearbeitbar; Kreise werden serverseitig verhindert
- Neue Elemente haben immer einen Nachfolger; Löschen hängt Verbindungen terminerhaltend um
- Verlauf zeigt Plan-Änderungen (letzte 10, „Alle anzeigen“), nicht To-dos/Notizen
- Notizen nur vom Autor änderbar – serverseitig geprüft, nicht nur ausgeblendet
- Konflikt: letzte Änderung gewinnt, Hinweis erscheint
- Deaktivierte Mitglieder können nichts ändern, auch mit gültigem Sitzungs-Cookie
- Datenschutz-Hinweis an Notizen und To-dos; keine E-Mail-Adressen in der Oberfläche
- Vitest für `plan-edit` grün; Klicktests `e2e/plan-bearbeiten.spec.ts`, `e2e/plan.spec.ts` und alle bisherigen grün bei 375 × 812 und 1280 × 800, gegen `pnpm dev` **und** gegen den lokalen Production-Build
- `pnpm typecheck`, `lint`, `test`, `build` grün

## Deploy

Keine DB-Änderung: `deploy`. Danach am Laptop in production ein Test-Element anlegen, ziehen, Rückgängig, wieder löschen; am iPhone ein Element öffnen und „+1 T“ / „Rückgängig“ prüfen.
