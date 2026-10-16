# SPEC 018 – AK-Arbeitsbereich

Freigabe Franz: ☑
Zweig: `spec/018-ak-arbeitsbereich` · Risikoklasse B (Risiko-Skript stuft wegen Seed-Änderung ggf. C ein – erwartbar) · lokal (Sichtprüfung, Teil A/B), Auto-Modus aus · DB: ja: neue Spalte `plan_elements.is_ongoing`, neuer Teil-Index, neue Tabelle `working_group_notes`

Stand 16.10.2026 (Sitzung 14). 017-protokoll-lesen ist live. Baut auf 005 (AKs), 006/008 (Plan, Panel, Notizen, Kurzformular), 009 (`/meine`, Rückgängig-Leiste), 015 (Neuigkeiten), 016 (`tick-box.tsx`, `save-status.tsx`, `todo-progress.ts`, Wochenlisten-Karte, Hinweis „Als erreicht markieren?“) und 017 (Leseansicht Protokoll) auf. Abgenommenes Test-Layout: Artifact „KP27 AK-Arbeitsbereich“ (Version 2, 16.10.2026).

## Entscheidungen (Franz, 16.10.2026)

1. **Ein Datenbestand, mehrere Sichten:** Der Arbeitsbereich zeigt nur vorhandene Daten (Plan-Elemente, Plan-To-dos, Protokoll-To-dos, Beschlüsse). Ein Haken gilt überall.
2. **`/arbeitskreise` wird die Übersicht:** je AK eine Karte mit Lage (Verzug/wackelt), offenen To-dos, nächstem Termin, Bereichen, Teilnehmenden und „Mach ich mit“. Die Karte öffnet den Arbeitsbereich `/arbeitskreise/[id]`.
3. **Die bisherige Zuordnung** (AKs anlegen, Aufgabenbereiche verschieben, Personen eintragen, „beschlossen“) zieht um nach **`/arbeitskreise/verwalten`**, verlinkt klein oben auf der Übersicht. Funktionen und Rechte wie bisher.
4. **Aufbau Arbeitsbereich:** oben **„Braucht Aufmerksamkeit“**, darunter **„Notizen zum AK“**, darunter je Aufgabenbereich ein aufklappbarer Abschnitt mit **Plan**, **Laufende Aufgaben**, **Aus Protokollen**, **Beschlüsse** (letzte 5 + „Alle“) und **Notizen**.
5. **„Laufende Aufgaben“** = je Aufgabenbereich ein normales Plan-Element mit Kennzeichen, entsteht **beim ersten Punkt ohne Termin oder der ersten Notiz** im Bereich. Es ist **im Plan ausgeblendet** (kein Gantt, keine Wochenliste, kein kritischer Pfad, kein Verzug). Seine To-dos haben kein Datum.
6. **Neu anlegen im Arbeitsbereich:** „Punkt ohne Termin“ (To-do an „Laufende Aufgaben“, optional mit Person) und **„+ Plan-Element“** (bekanntes Kurzformular, AK und Aufgabenbereich vorbelegt).
7. **Freie Notizen als Verlauf** an zwei Stellen: **je AK** (neue Tabelle) und **je Aufgabenbereich** (Notizen des Elements „Laufende Aufgaben“). Name, Datum, neueste oben, letzte 3 + „Alle“, eigene bearbeiten und löschen, Datenschutz-Hinweis.

## Ziel

Jeder AK hat eine eigene Seite, auf der er sieht, was bei ihm ansteht: was brennt, was im Plan liegt, was aus den Treffen offen ist, was beschlossen wurde, und Platz für Notizen. Abgehakt wird direkt dort. Punkte ohne Termin („Laufende Aufgaben“) bekommen einen festen Platz, ohne den Gantt-Plan zu verfälschen. Die Seite „AKs“ zeigt auf einen Blick die Lage aller AKs; die Zuordnung rückt in den Hintergrund.

## Nicht in dieser Spec

- Keine Leitung oder Rollen in AKs (Plenum offen)
- Keine Verknüpfung von Protokoll-To-dos mit Plan-Elementen (R3); Protokoll-Punkte werden dem AK nur über ihren Aufgabenbereich zugeordnet
- Keine Tagesordnungs-Sammlung, keine Hinweise pro Person
- Keine Änderung an `src/lib/plan-engine.ts` (Laufende Aufgaben werden **vor** der Rechnung herausgefiltert)
- Kein Link vom Gantt-Swimlane-Kopf zum Arbeitsbereich, kein neuer Navigationspunkt
- Keine Änderung an KP27-Vorlage (`src/db/kp27-template.ts`) und production-Daten
- Keine Änderung an `src/proxy.ts`, `src/auth.ts`, Login, `.claude/`, `.github/`, `agents/`, `scripts/`, Configs, `.env*`, `AGENTS.md`; keine neuen Laufzeit-Pakete
- Kein `revalidatePath("/", "layout")`
- Keine Änderung an `save-status.tsx` und `tick-box.tsx` außer rein hinzufügenden, optionalen Props (im Abgleich melden)

## Vorab: Abgleich mit dem Code

Vor dem Bau berichten, dann auf „Weiter“ warten:

1. **AK-Seite (005):** Aufbau von `src/app/(app)/arbeitskreise/page.tsx` und ihrer Client-Komponenten; Actions in `src/actions/working-groups.ts` (insbesondere Aufgabenbereich verschieben und löschen, `canDeleteDepartment`); Link in `/einstellungen` („Auf der Seite AKs pflegen“); wie die Navigation Unterseiten als „AKs“ markiert.
2. **Alle Verbraucher von Plan-Elementen:** `loadPlan`, `loadPlanDetails`, `loadPlanView`, `loadMyAgenda`, `countMyOverdue`, Gantt, Wochenliste, Kopfzeile („x in Verzug“), kritischer Pfad, Vorgänger-/Nachfolger-Auswahl im Panel, Nachfolger-Auswahl im Kurzformular „+ Element“, Löschen mit Umhängen. Wo genau muss ein Filter „nicht laufend“ greifen, damit Laufende Aufgaben nirgends im Plan auftauchen? Gibt es eine zentrale Stelle?
3. **Plan-Actions** in `src/actions/plan.ts`: Liste aller Actions, die ein Element ändern (Verschieben, Ränder, Dauer, Fixtermin, Erreicht, Wackelt, Verbinden, Lösen, Löschen, Zuständig). Welche To-do- und Notiz-Actions gibt es (anlegen, abhaken, löschen, Person; Notiz anlegen, bearbeiten, löschen) und prüfen sie das Element?
4. **Kurzformular „+ Element“ (008):** Komponente, Felder, Vorbelegung des AK; kann es einen Aufgabenbereich vorbelegt bekommen (Action-Parameter `departmentId` vorhanden?); was passiert nach „Anlegen“ (Panel öffnet)?
5. **Panel/Blatt außerhalb der Startseite:** Wie öffnet `/meine` das bearbeitbare Panel (Datenquelle `loadPlanView`, Komponente)? Lässt sich dasselbe Muster auf `/arbeitskreise/[id]` nutzen?
6. **Wochenlisten-Karte (016):** Ist die Karte mit Kästchen, Zähler, aufklappbaren To-dos und Hinweis „Als erreicht markieren?“ als eigene Komponente nutzbar, oder fest in `plan-week-list.tsx`? Vorschlag melden (herauslösen statt zweite Karte bauen).
7. **Notizen im Panel (008):** Ist die Notiz-Liste (anlegen, bearbeiten „· bearbeitet“, löschen, Datenschutz-Hinweis) eine eigene Komponente? Wie wird gelöscht (Bestätigung, Rückgängig)? Vorschlag, wie dieselbe Komponente für AK-Notizen und Bereichs-Notizen genutzt wird, ohne das Panel zu ändern.
8. **`/meine` (009):** Wie werden Plan-To-dos einsortiert (Fälligkeit über `todoDueDay`)? Gibt es „Ohne Datum“ schon für Plan-To-dos oder nur für Protokoll-To-dos? Wohin führt Antippen eines Plan-To-dos? Wie entsteht „Aus meinen AKs – noch niemand eingetragen“?
9. **Protokoll-Punkte:** Felder von `meeting_items` für To-dos und Beschlüsse (Art, Aufgabenbereich, Wer, Bis wann, erledigt, Reihenfolge), Datum des Treffens, Action zum Abhaken (`setTodoDone`), `isOverdue`, `sortTodos`.
10. **Seed und Reset:** `SEED_VERSION` (derzeit 8), wie der Test-Plan und die Test-AKs angelegt sind, Reihenfolge in `db:reset:dev`.
11. Welche bestehenden Klicktests `/arbeitskreise` öffnen und dort Zuordnungs-Funktionen erwarten (`e2e/arbeitskreise.spec.ts`, `e2e/rahmen.spec.ts` u. a.).

Wenn etwas grundlegend anders ist als hier beschrieben: stoppen, Unterschied beschreiben, nichts umbauen. Bestehende Helfer und Komponenten nutzen, keine zweiten bauen.

## Umsetzung

**Grundregeln**

- Alles hängt an der **aktuellen Ausgabe**.
- Rechnen und Zusammenstellen in `src/lib/` als reine Funktionen mit Vitest (relativ importieren, Vitest kennt `@/` nicht). Komponenten zeichnen nur. „Heute“ serverseitig über `todayInBerlin`.
- Rechte wie bisher: alle aktiven Mitglieder dürfen alles; jede Server Action lädt das handelnde Mitglied bei jedem Aufruf aus `members`, `active = true`, sonst „Kein Zugriff.“. Notizen ändern und löschen nur Autor:innen – serverseitig geprüft.
- Abhaken über die **bestehenden** Actions (Element erreicht, Plan-To-do, Protokoll-To-do) mit `tick-box.tsx` und `useUndoBar()` (5 s Rückgängig). Keine zweiten Abhak-Actions.
- E-Mail-Adressen erscheinen nirgends, nur Namen.
- Neue Farben nur als CSS-Variablen in `src/app/globals.css`, hell und dunkel; bestehende Variablen nicht ändern.
- Neue Texte nie mit „D-Day“/„D-N“, sondern „Krachparade“, „N T vorher“; im Protokoll „Beschluss“.
- „Gespeichert ✓“ nie ins Feld-Label.

### Teil A – Datenmodell, Logik, Actions, Ausblenden im Plan, Seed

1. **Datenmodell** in `src/db/schema.ts` (nur hinzufügend):
   - `plan_elements.is_ongoing` boolean, Standard `false`, nicht leer.
   - Eindeutiger **Teil-Index** `plan_elements_ongoing_department` auf (`edition_id`, `department_id`) mit Bedingung `is_ongoing = true` – höchstens ein Element „Laufende Aufgaben“ je Aufgabenbereich und Ausgabe.
   - Neue Tabelle `working_group_notes`: `id` uuid, `working_group_id` → `working_groups` (Pflicht, löschen kaskadiert), `author_id` → `members` (Pflicht), `text` text (CHECK 1–2000 Zeichen), `created_at`, `updated_at`.
2. **Element „Laufende Aufgaben“** (Regeln, in Actions und Loadern umgesetzt):
   - `is_ongoing = true`, `kind = milestone`, `duration_days = 0`, `name = "Laufende Aufgaben"` (angezeigt wird „Laufende Aufgaben · ‹Bereich›“), `department_id` = Bereich, `working_group_id` = AK des Bereichs, **keine Verbindungen**, `owner_id` leer.
   - Seine To-dos haben **kein Datum**: Loader setzen die Fälligkeit für To-dos an laufenden Elementen auf `null` (`todoDueDay` selbst bleibt unverändert).
   - **Wird herausgefiltert**, bevor `computePlan` rechnet und überall, wo der Plan gezeigt oder ausgewählt wird (Ergebnis aus Abgleich 2): Gantt, Wochenliste, Kopfzeile, kritischer Pfad, Vorgänger-/Nachfolger-Auswahl, Nachfolger im Kurzformular, Umhängen beim Löschen, Panel. Am besten an einer zentralen Stelle (z. B. `loadPlan` liefert nur `is_ongoing = false`, ein eigener Loader die laufenden).
   - **Server-Schutz:** Alle Actions, die ein Element selbst ändern (Abgleich 3: verschieben, Ränder, Dauer, Fixtermin, Erreicht, Wackelt, Verbinden, Lösen, Löschen, Zuständig), lehnen ein laufendes Element ab: „Laufende Aufgaben lassen sich nicht im Plan bearbeiten.“ To-do- und Notiz-Actions bleiben erlaubt.
3. **Aufgabenbereiche (005) anpassen:**
   - **Verschieben in einen anderen AK** (oder „Ohne AK“): Das laufende Element des Bereichs bekommt denselben `working_group_id`.
   - **Löschen:** zusätzlich gesperrt, wenn das laufende Element des Bereichs To-dos oder Notizen hat: „Hat laufende Aufgaben oder Notizen – stattdessen umbenennen oder verschieben.“ Ist es leer, wird es beim Löschen des Bereichs mitgelöscht. `canDeleteDepartment` entsprechend erweitern (Vitest).
4. **Reine Funktionen** `src/lib/ak-workspace.ts` (Vitest):
   - `attentionItems({ elements, planTodos, meetingTodos }, today)` → Liste für „Braucht Aufmerksamkeit“: Plan-Elemente des AK mit Status `late`, überfällige offene Plan-To-dos an nicht erreichten Elementen, überfällige offene Protokoll-To-dos der Bereiche des AK, Plan-Elemente mit Status `warn`. Reihenfolge: Verzug (nach Termin), überfällige To-dos (nach Fälligkeit), wackelt (nach Termin). Laufende Elemente erscheinen nie selbst (ihre To-dos haben kein Datum).
   - `groupByDepartment(departments, elements, ongoing, meetingTodos, decisions)` → je Bereich (Reihenfolge `sort_order`): offene und erreichte Plan-Elemente (nach Start), laufendes Element (oder `null`) mit offenen und erledigten To-dos, offene und erledigte Protokoll-To-dos (`sortTodos`), Beschlüsse (neueste Treffen zuerst, innerhalb eines Treffens in Reihenfolge der Punkte). Plan-Elemente des AK ohne Bereich **oder** mit einem Bereich, der nicht (mehr) zu diesem AK gehört, kommen in eine Gruppe „Ohne Aufgabenbereich“ (bei fremdem Bereich mit dessen Namen in der Unterzeile); die Gruppe gibt es nur, wenn sie nicht leer ist, und sie hat nur „Plan“.
   - `akSummary(...)` → `{ late, warn, openTodos, next }`: `late`/`warn` = Plan-Elemente des AK mit diesem Status; `openTodos` = offene Plan-To-dos an nicht erreichten Elementen (inkl. laufender) + offene Protokoll-To-dos der Bereiche; `next` = nächster Termin ≥ heute unter nicht erreichten Elementen: Meilenstein-Datum, Vorgang-Start (wenn in der Zukunft, Text „startet“) bzw. Vorgang-Ende (wenn er läuft, Text „endet“), sonst `null`.
   - `ongoingDisplayName(departmentName)` → „Laufende Aufgaben · ‹Bereich›“.
   - Vitest: Reihenfolge der Aufmerksamkeit, leere Fälle, fremder Bereich → „Ohne Aufgabenbereich“, Beschluss-Reihenfolge, `next` mit startet/endet/Meilenstein/keinem, laufendes Element zählt zu `openTodos`, aber nie zu `late`/`warn`.
5. **Daten laden** `src/db/ak-workspace.ts` (React `cache`): `loadAkOverview()` (alle AKs der Ausgabe mit Bereichen, Teilnehmenden, `akSummary`) und `loadAkWorkspace(workingGroupId)` (AK, Bereiche, Teilnehmende, Plan-Elemente mit To-dos und Fortschritt, laufende Elemente mit To-dos und Notizen, Protokoll-To-dos und Beschlüsse der Bereiche aus Treffen der aktuellen Ausgabe, AK-Notizen mit Namen). Rechnung über die gefilterte `computePlan`-Ausgabe wie auf `/`.
6. **Server Actions** `src/actions/ak-workspace.ts` (Zod, Mitglied aktiv, AK/Bereich der aktuellen Ausgabe, `updated_at` setzen):
   - `addOngoingTodo(departmentId, text, ownerId?)`: Text getrimmt 1–200; `ownerId` muss ein aktives Mitglied sein. Legt bei Bedarf das laufende Element an (**gegen doppeltes Anlegen geschützt** über den Teil-Index: anlegen „on conflict do nothing“, dann lesen) und hängt das To-do an. Rückgabe sagt, ob das Element neu angelegt wurde.
   - `addOngoingNote(departmentId, text)`: Text getrimmt 1–2000; legt bei Bedarf das laufende Element an wie oben, dann Notiz in `plan_notes`. Bearbeiten/Löschen der Bereichs-Notizen über die **bestehenden** Notiz-Actions.
   - `createGroupNote(workingGroupId, text)`, `updateGroupNote(noteId, text)`, `deleteGroupNote(noteId)`: Text 1–2000; Bearbeiten/Löschen nur Autor:in („Nur eigene Notizen lassen sich ändern.“).
   - Ein Bereich ohne AK hat keinen Arbeitsbereich; `addOngoing…` mit einem Bereich ohne AK → Fehlermeldung, nichts speichern.
7. **„+ Plan-Element“ mit Bereich:** Die Anlege-Action aus 008 bekommt einen optionalen Parameter für den Aufgabenbereich (muss zum gewählten AK gehören, sonst Fehlermeldung). Sonst unverändert.
8. **`/meine` (009):** To-dos an laufenden Elementen erscheinen wie andere Plan-To-dos, aber unter **„Ohne Datum“**, mit Herkunft „Laufende Aufgaben · ‹Bereich›“. „Aus meinen AKs – noch niemand eingetragen“ enthält auch To-dos ohne Person an laufenden Elementen. Antippen führt zum Arbeitsbereich des AK (nicht ins Panel). `countMyOverdue` zählt sie nie.
9. **Seed** (nur ohne `--prod`, idempotent), `SEED_VERSION` 9:
   - Für zwei Aufgabenbereiche aus AK Demo & Route je ein laufendes Element mit ausgedachten To-dos (eins mit Kim Brenner, eins ohne Person, eins erledigt) und einer ausgedachten Notiz; nur anlegen, wenn es dort noch keins gibt.
   - Zwei ausgedachte AK-Notizen bei AK Demo & Route (Kim Brenner, Robin Tal), nur wenn der AK noch keine hat. Kurze, harmlose Texte ohne Kontaktdaten.
   - Mit `--prod` nichts. `db:reset:dev` leert `working_group_notes` vor `working_groups`.

Auftrag 1 endet mit „setze NUR Teil A um“. **Vor `db:push` anhalten** – Franz führt `pnpm db:push` selbst aus. Teil A committen, nicht pushen.

### Teil B – Seiten, Komponenten, Neuigkeiten, Tests

10. **Seiten und Navigation:**
    - `/arbeitskreise` = **Übersicht** (neu), `/arbeitskreise/verwalten` = bisherige AK-Seite **unverändert in Funktion**, Titel „AKs verwalten“, oben Link „‹ Alle AKs“. `/arbeitskreise/[id]` = Arbeitsbereich; unbekannte oder ungültige ID (kein UUID, anderer Ausgabe, gelöscht) → Inhalt „Diesen AK gibt es nicht.“ mit Link „‹ Alle AKs“.
    - Navigation „AKs“ bleibt; alle drei Seiten markieren „AKs“. `/einstellungen` verlinkt auf `/arbeitskreise/verwalten`. `/referate` leitet weiter wie bisher auf `/arbeitskreise`.
    - Seitenbreite wie andere Seiten (1024 px).
11. **Übersicht `/arbeitskreise`:**
    - Kopf: Titel „AKs“, Unterzeile „Lage je Arbeitskreis. Antippen öffnet den Arbeitsbereich.“, rechts klein Link **„AKs verwalten“**.
    - Hinweis zur offenen AK-Definition wie bisher (Text aus 005, solange nicht beschlossen); „Als beschlossen markieren“ nur auf `/arbeitskreise/verwalten`.
    - Je AK eine Karte (Raster, Laptop 2–3 Spalten, Handy 1 Spalte), in `sort_order`: oberer Teil als **ein Link** auf den Arbeitsbereich mit „AK ‹Name›“ und Pfeil, Lage-Pills („n Verzug“ rot, „n wackelt“ gelb, sonst „Alles im Plan“ hellgrün), Chip „n offene To-dos“, „Nächster Termin: ‹Name› · startet/endet ‹Wochentag TT.MM.›“ bzw. „–“, „Bereiche: …“. Unterer Teil: Namen der Teilnehmenden (deaktivierte ausgegraut) bzw. „Noch niemand“ und Knopf „Mach ich mit“ / „Austreten“ (bestehende Action).
    - Leerer Zustand: „Noch keine AKs.“ mit Link „AKs verwalten“.
12. **Arbeitsbereich `/arbeitskreise/[id]`** (Aufbau nach Test-Layout v2):
    - Kopf: Link „‹ Alle AKs“, Titel „AK ‹Name›“, Teilnehmende, Knopf „Mach ich mit“ / „Austreten“.
    - **„Braucht Aufmerksamkeit“** (Block, bei Inhalt mit Verzug-Rand und rosa Kopf über bestehende Variablen bzw. `--hint-bg`): Plan-Elemente als Karten (siehe unten, mit Bereich in der Unterzeile), darunter überfällige To-dos als Zeilen mit Kästchen, Text, Wer, „an ‹Element›“ bzw. „aus ‹Treffen›“, Fälligkeit rot. Leer: „Nichts überfällig, nichts wackelt.“ Dieselben Einträge stehen zusätzlich in ihrem Bereich; ein Haken gilt an beiden Stellen.
    - **„Notizen zum AK“** (Block): Verlauf wie unter 13.
    - **Je Aufgabenbereich** ein `<details>`-Abschnitt; Kopf: Name, Pills „n Verzug“/„n wackelt“, Chip „n offen“. Auf/Zu wird pro Gerät gemerkt (`localStorage` `kp-ak-open`, erst nach dem Laden lesen, try/catch), Standard: alle offen. Inhalt in dieser Reihenfolge:
      - **Plan:** rechts Knopf „+ Plan-Element“ → Kurzformular aus 008 mit AK und Aufgabenbereich vorbelegt (Laptop: Fenster in der Seite, Handy: Blatt). Offene Elemente als Karten wie in der Wochenliste (016): Kästchen = „Erreicht“, Name, Art · Termin („N T vorher“) · verantwortliche Person, Status-Pill, Zähler „x/y“ klappt To-dos auf (einzeln abhakbar), Hinweis „Alle To-dos erledigt. Als erreicht markieren?“. Antippen des Namens öffnet das **bearbeitbare Panel bzw. Blatt direkt auf dieser Seite** (Muster `/meine`); nach Änderungen im Panel aktualisiert sich der Arbeitsbereich. Erreichte zugeklappt: „Erreicht (n)“. Leer: „Keine offenen Plan-Elemente.“
      - **Laufende Aufgaben** (Unterzeile „ohne Termin“): offene To-dos mit Kästchen, Text, Person; Löschen „×“ wie im Panel. Erledigte zugeklappt „Erledigt (n)“. Darunter Eingabe „Punkt ohne Termin hinzufügen“ (max. 200), Auswahl „Wer? (optional)“ (Teilnehmende des AK zuerst, dann alle aktiven Mitglieder), Knopf „Hinzufügen“, Enter speichert. Leer: „Noch keine Punkte.“ Beim ersten Punkt erscheint in der Rückgängig-Leiste „Laufende Aufgaben angelegt (im Plan ausgeblendet)“.
      - **Aus Protokollen:** offene Protokoll-To-dos mit Kästchen, Text, Wer, „aus ‹Treffen› ‹TT.MM.›“ (Link ins Treffen), Fälligkeit (überfällig rot). Erledigte zugeklappt. Leer: „Keine offenen To-dos aus Treffen.“
      - **Beschlüsse:** Liste mit Badge „Beschluss“, Text, darunter Link „‹Treffen› ‹TT.MM.›“ ins Treffen. Die letzten 5, bei mehr Knopf „Alle (n)“ / „Nur die letzten 5“. Leer: „Noch keine Beschlüsse.“
      - **Notizen:** Verlauf wie unter 13 (Notizen des laufenden Elements). Die erste Notiz legt das laufende Element an.
    - **„Ohne Aufgabenbereich“** am Ende, nur wenn nötig, nur mit „Plan“ (ohne „+ Plan-Element“).
    - Käfer-Kontext (014): Seite setzt `data-feedback-context` auf „AK ‹Name›“, falls das Muster passt.
13. **Notizen-Verlauf** (eine Komponente für AK- und Bereichs-Notizen; bevorzugt die aus dem Panel, siehe Abgleich 7): neueste oben, je Eintrag Name · TT.MM. (· bearbeitet), Text mit Zeilenumbrüchen; bei eigenen „Bearbeiten“ und „Löschen“ (Verhalten wie im Panel). Die letzten 3 sichtbar, bei mehr „Alle (n)“ / „Nur die letzten 3“. Eingabe mehrzeilig, Platzhalter „Notiz schreiben …“, Knopf „Notiz speichern“, Hinweis „Keine Telefonnummern, Adressen oder Kontodaten.“; „Gespeichert ✓“ über `save-status.tsx`. Leer: „Noch keine Notizen.“
14. **Handy (375 px):** alle Abschnitte untereinander, Kästchen und Knöpfe ≥ 44 px, keine waagrechte Scrollleiste, Eingabezeile „Punkt ohne Termin“ bricht sauber um.
15. **Neuigkeiten:** Eintrag aus dem Abschnitt unten in `src/lib/news/entries.ts` (oben), ID `018-ak-arbeitsbereich`, Datum = Tag des Baus; vorher gegen die echten Bezeichnungen prüfen. Tests über `latestNewsId`.
16. **Klicktest** `e2e/ak-arbeitsbereich.spec.ts` (Dev-Login als Kim Brenner). **Seed-Daten nie ändern**; eigener AK „E2E AK ‹Zeit›“ mit Bereich „E2E Bereich ‹Zeit›“ über `/arbeitskreise/verwalten`, am Ende aufräumen; Prüfungen relativ; nach Seitenwechseln `expectPageReady`, nie `networkidle`:
    - `/arbeitskreise` zeigt Karten mit „AK Demo & Route“, Lage-Pill, „offene To-dos“; Link „AKs verwalten“ führt zu `/arbeitskreise/verwalten`, dort eigenen AK und Bereich anlegen, „Mach ich mit“
    - Karte des eigenen AK öffnet `/arbeitskreise/[id]`; „Braucht Aufmerksamkeit“ zeigt „Nichts überfällig, nichts wackelt.“
    - „Punkt ohne Termin“ mit Person Kim Brenner → erscheint unter „Laufende Aufgaben“, Rückgängig-Leiste nennt „Laufende Aufgaben angelegt“; zweiter Punkt ohne Person → kein zweites Element (Anzahl Laufende-Aufgaben-Elemente bleibt 1)
    - `/` (Gantt und Liste): kein „Laufende Aufgaben“ sichtbar; `/meine`: der Punkt steht unter „Ohne Datum“ mit „Laufende Aufgaben · E2E Bereich …“, Antippen führt zum Arbeitsbereich
    - Punkt abhaken → zugeklappt „Erledigt (1)“, Rückgängig-Leiste; „Rückgängig“ → wieder offen
    - Bereichs-Notiz schreiben → „Gespeichert ✓“, erscheint oben mit „Kim Brenner“; bearbeiten → „· bearbeitet“
    - AK-Notiz schreiben; Dev-Login als Alex Rauch → bei Kims Notizen kein „Bearbeiten“/„Löschen“; serverseitig: Ändern einer fremden Notiz über die Action wird abgelehnt
    - „+ Plan-Element“ → Kurzformular mit eigenem AK und Bereich vorbelegt; Meilenstein „E2E Element ‹Zeit›“ anlegen → erscheint unter „Plan“ im Bereich; Kästchen → „Erreicht (1)“, Rückgängig
    - Eigenes Treffen „E2E Treffen ‹Zeit›“ mit To-do (Bereich = eigener Bereich, fällig gestern) und Beschluss → im Arbeitsbereich steht das To-do unter „Braucht Aufmerksamkeit“ **und** „Aus Protokollen“, der Beschluss unter „Beschlüsse“; abhaken an einer Stelle → an beiden erledigt
    - Bereich löschen ist gesperrt („Hat laufende Aufgaben oder Notizen …“), solange To-dos/Notizen da sind
    - Ungültige ID `/arbeitskreise/abc` → „Diesen AK gibt es nicht.“
    - 375 × 812: Übersicht und Arbeitsbereich bedienbar, keine waagrechte Scrollleiste
    - Aufräumen: Treffen löschen, Plan-Element löschen, Punkte und Notizen löschen, Bereich löschen (laufendes Element verschwindet mit), AK löschen; keine Konsolenfehler
    - Bestehende Klicktests (`e2e/arbeitskreise.spec.ts` u. a. aus Abgleich 11) nur auf `/arbeitskreise/verwalten` umstellen, sonst nicht anfassen
17. **Vitest** für `ak-workspace.ts`, erweitertes `canDeleteDepartment` und den Filter „nicht laufend“ (z. B.: Plan mit laufendem Element liefert denselben kritischen Pfad wie ohne).

Auftrag 2 beginnt mit „Teil A ist bereits umgesetzt – ändere daran nichts“.

## Neuigkeiten

ID `018-ak-arbeitsbereich` · Datum: Tag des Baus · Titel „Arbeitsbereich für jeden AK“

- **AKs auf einen Blick.** Die Seite „AKs“ zeigt für jeden AK, was in Verzug ist, was wackelt, wie viele To-dos offen sind und was als Nächstes ansteht.
- **Arbeitsbereich je AK.** Tipp eine AK-Karte an: Oben steht, was Aufmerksamkeit braucht, darunter je Aufgabenbereich Plan, To-dos aus Treffen und Beschlüsse. Abhaken geht direkt dort.
- **Laufende Aufgaben.** Punkte ohne Termin trägst du im Aufgabenbereich ein. Sie stehen nicht im Gantt, aber in „Meine“ unter „Ohne Datum“.
- **Notizen.** Freie Notizen gibt es jetzt für den ganzen AK und für jeden Aufgabenbereich.
- **AKs verwalten.** Wer in welchem AK ist und welche Bereiche dazugehören, pflegst du über „AKs verwalten“ oben auf der Seite.

## Akzeptanzkriterien

- `/arbeitskreise` zeigt je AK Lage, offene To-dos, nächsten Termin, Bereiche, Teilnehmende und „Mach ich mit“; Karte öffnet `/arbeitskreise/[id]`
- `/arbeitskreise/verwalten` kann alles, was `/arbeitskreise` vorher konnte, mit denselben Rechten; `/einstellungen` verlinkt dorthin
- Arbeitsbereich mit „Braucht Aufmerksamkeit“, „Notizen zum AK“ und je Bereich Plan, Laufende Aufgaben, Aus Protokollen, Beschlüsse (5 + „Alle“), Notizen; „Ohne Aufgabenbereich“ nur bei Bedarf
- Abhaken von Elementen, Plan-To-dos und Protokoll-To-dos über die bestehenden Actions, mit 5 s Rückgängig; ein Haken gilt auf allen Seiten
- Laufende Aufgaben: höchstens eins je Bereich (DB-Index), entsteht beim ersten Punkt oder der ersten Notiz, erscheint nie in Gantt, Wochenliste, Kopfzeile, kritischem Pfad oder Auswahllisten; Element-Actions lehnen es serverseitig ab; To-dos ohne Datum, in `/meine` unter „Ohne Datum“
- Kritischer Pfad, Puffer und Status des Plans unverändert (Engine nicht angefasst)
- Aufgabenbereich verschieben nimmt das laufende Element mit; löschen gesperrt, solange es To-dos oder Notizen hat
- AK- und Bereichs-Notizen: alle schreiben, nur Autor:in bearbeitet und löscht (serverseitig), Datenschutz-Hinweis, „Gespeichert ✓“ nicht im Label
- „+ Plan-Element“ belegt AK und Aufgabenbereich vor; Panel öffnet auf der Seite
- Deaktivierte Mitglieder können nichts speichern, auch mit gültigem Sitzungs-Cookie
- Keine E-Mail-Adressen, kein „D-Day“, kein „Entscheidung“; helles und dunkles Thema lesbar; Tastatur bedienbar; kein Hydration-Fehler (Production-Build)
- Neuigkeiten-Eintrag vorhanden, Vitest für `src/lib/news/` grün
- Vitest für `ak-workspace.ts`, `canDeleteDepartment` und den Filter grün; `e2e/ak-arbeitsbereich.spec.ts` und alle bisherigen Klicktests grün bei 375 × 812 und 1280 × 800, gegen `pnpm dev` **und** gegen den lokalen Production-Build (Port 3100: `VERCEL_ENV=preview ENABLE_DEV_LOGIN=1 pnpm build`, `AUTH_TRUST_HOST=1 VERCEL_ENV=preview ENABLE_DEV_LOGIN=1 pnpm start -p 3100`, `BASE_URL=http://localhost:3100 pnpm e2e`)
- `pnpm typecheck`, `lint`, `test`, `build` grün
- Abweichungen unter „Abweichungen beim Bau“ vermerkt, mit „(von Franz freigegeben)“

## Deploy

DB-Änderung (nur hinzufügend: Spalte, Teil-Index, Tabelle). `deploy` → hält vor der DB an, PR steht → `gh pr checks spec/018-ak-arbeitsbereich --watch` → Vorschau am iPhone über „Visit Preview“ (Dev-Login, dev-Datenbank) → Neon-Backup `backup-vor-018` von production → `git branch --show-current` (muss `spec/018-ak-arbeitsbereich` zeigen) → `pnpm db:push:prod` (Rückfrage von drizzle-kit: immer „No, add the constraint without truncating the table“, nie „truncate“; im Zweifel Text erst an Claude im Chat) → `deploy --db-erledigt`. Meldet `deploy` „Noch nicht gemergt“: `gh pr checks spec/018-ak-arbeitsbereich --watch`, dann `gh pr view spec/018-ak-arbeitsbereich --json state`, bei `MERGED` `git switch main` und `git pull`. Kein `db:seed:prod`. Danach Live-Check am iPhone: „AKs“ öffnen, einen AK antippen, Punkt ohne Termin und Notiz anlegen, im Plan prüfen, dass „Laufende Aufgaben“ nicht auftaucht, in „Meine“ unter „Ohne Datum“ nachsehen.

## Abweichungen beim Bau

(von Claude Code zu ergänzen; nie den Freigabe-Haken hier eintragen, stattdessen „(von Franz freigegeben)“)
