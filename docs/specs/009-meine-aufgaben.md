# SPEC 009 – Meine Aufgaben

Freigabe Franz: ☑
Zweig: `spec/009-meine-aufgaben` · Risikoklasse B · lokal (Sichtprüfung, Teil A/B) · DB: nein

Stand 15.10.2026 (Sitzung 7). Baut auf 004 (Protokoll-To-dos, `/meine`), 005 (AK-Teilnahmen), 006 (Engine), 007 (Wochenliste, Detail-Panel) und 008 (Bearbeiten, Rückgängig-Leiste) auf, alle live. Erst nach 011 bauen. Entscheidungen aus den Auswahlfragen vom 15.10.2026 (Sitzung 7).

## Ziel

`/meine` zeigt jeder Person auf einen Blick, was **sie** bis wann erledigen muss – aus dem Plan und aus den Protokollen, in **einer Zeitliste** wie die Wochenliste: oben „Überfällig & Verzug“, dann Woche für Woche. Alles lässt sich direkt abhaken (mit „Rückgängig“), Plan-Einträge öffnen das bearbeitbare Detail-Panel direkt auf der Seite. Darunter, zugeklappt: was in den eigenen AKs noch niemandem gehört (mit „Übernehmen“) und was zuletzt erledigt wurde. In der Navigation zeigt „Meine“ eine pinke Zahl, sobald bei der Person etwas überfällig oder im Verzug ist.

## Nicht in dieser Spec

- Änderungen am Schema, am Seed, an `src/lib/plan-engine.ts` (nur nutzen; Fehler melden statt umbauen)
- Verknüpfen von Protokoll-To-dos mit Plan-Elementen (R2)
- Benachrichtigungen, E-Mail, Kalender-Export
- Änderungen an der Startseite `/` (Gantt, Wochenliste, Filter „Meine AKs“), an `/protokolle/…`, `/arbeitskreise`
- Änderungen an `src/proxy.ts`, `src/auth.ts`, `getCurrentMember()`, `requireMember()`, Login, Configs; neue Laufzeit-Pakete

## Vorab: Abgleich mit dem Code nach 010

Bevor du etwas änderst, prüfe den aktuellen Stand und berichte kurz:

- `src/app/(app)/meine/page.tsx` aus 004: Datenabfrage, Darstellung, Hinweis „Meilenstein-Aufgaben kommen mit R1“; welche Klicktests `/meine` prüfen
- `src/db/plan.ts` (`loadPlan`, `loadPlanDetails`), `computePlan`, `todoDueDay`; wie die Startseite Plan, Details und „heute“ an `PlanDetail` übergibt
- `src/lib/gantt-layout.ts`: `weekAgenda`, `isoWeek`, `mondayOf` und die Texte für Gründe („Puffer negativ“ …), Wochen-Überschriften, Datumsformate – welche davon als eigene Helfer nutzbar sind
- `src/components/plan/plan-week-list.tsx`, `plan-detail.tsx`: Karten-Darstellung, wie das bearbeitbare Panel/Blatt aus 008 eingebunden wird, Rückgängig-Leiste aus 008 (Komponente, Dauer, Escape)
- Server Actions: `setDone`, `toggleTodo`, `updateElement` (`src/actions/plan.ts`), To-do erledigt umschalten (`src/actions/meetings.ts`); was sie per `revalidatePath` neu laden
- Helfer für AK-Teilnahmen des angemeldeten Mitglieds (005) und Zuordnung `departments.working_group_id`
- Navigation (Kopfleiste und Tab-Leiste): wo „Meine“ steht, wie der aktive Punkt bestimmt wird; ob das Layout `(app)` schon Daten außer dem Mitglied lädt
- Welche Test-Mitglieder in dev in welchen AKs eingetragen sind (für den Klicktest)

Wenn etwas davon grundlegend anders ist als hier beschrieben: stoppen, Unterschied beschreiben, nichts umbauen. Bestehende Helfer und Komponenten nutzen, keine zweiten bauen.

## Umsetzung

**Grundregeln**

- „Heute“ immer serverseitig über `todayInBerlin(new Date())`; Rechnung über `computePlan` auf dem Server. Im Browser wird nichts gerechnet.
- Alles gehört zur **aktuellen Ausgabe**.
- Rechte wie bisher: alle aktiven Mitglieder dürfen alles; jede Server Action lädt das handelnde Mitglied bei **jedem** Aufruf aus `members` und verlangt `active = true`, sonst „Kein Zugriff.“.
- Datumslogik und Gruppierung als reine Funktionen in `src/lib/` mit Vitest; Komponenten zeichnen nur.
- Keine E-Mail-Adressen in der Oberfläche, keine Inhalte aus To-dos oder Notizen in Logs.

**Was „meins“ ist** (angemeldetes Mitglied = ich)

| Art | Gehört mir, wenn … | Fälligkeit |
|---|---|---|
| Plan-Element (offen) | `owner_id` = ich | Meilenstein: Tag; Vorgang: Start (läuft er schon: in der aktuellen Woche „läuft bis …“) |
| Plan-To-do (offen) | `owner_id` = ich, **oder** `owner_id` leer und das Element gehört mir (Hinweis „an deinem Element“) | `todoDueDay` |
| Protokoll-To-do (offen) | `meeting_items.kind = 'todo'` und `owner_id` = ich | `due_date` (kann leer sein) |

To-dos an erledigten Elementen erscheinen weiter, solange sie offen sind.

**Was in „Aus meinen AKs – noch niemand eingetragen“ landet** (meine AKs = AK-Teilnahmen aus 005)

- offene Plan-Elemente mit `working_group_id` in meinen AKs und `owner_id` leer
- offene Plan-To-dos ohne `owner_id`, deren Element in meinen AKs liegt **und** selbst keine verantwortliche Person hat
- offene Protokoll-To-dos ohne `owner_id` und ohne `owner_name`, deren Aufgabenbereich (`department_id`) zu einem meiner AKs gehört

### Teil A – Logik, Datenzugriff, Server Actions

1. **Reine Funktionen** `src/lib/my-tasks.ts` mit Vitest (vorhandene Helfer aus `gantt-layout.ts` und `dday.ts` für Wochen, Datumsformate und Grund-Texte nutzen, nicht kopieren; was dort noch nicht exportiert ist, exportieren statt duplizieren):
   - `myAgenda({ computed, todos, meetingTodos, meId, myGroupIds, departmentGroups, today, dDay, weeks = 6 })` liefert:
     - `overdue`: offene eigene Plan-Elemente mit Status `late` (Text = Grund wie in der Wochenliste), eigene Plan-To-dos mit Fälligkeit vor heute („für ‹Element› · war fällig ‹Wochentag TT.MM.›“), eigene Protokoll-To-dos mit `isOverdue` („aus Treffen ‹TT.MM.› · war fällig ‹Wochentag TT.MM.›“); nach Datum sortiert
     - `weeks`: aktuelle Woche (immer, leer → „Nichts fällig.“) plus die folgenden Wochen bis insgesamt `weeks`, nur Wochen mit Einträgen; Meilensteine „Meilenstein · ‹Wochentag TT.MM.›“, Vorgänge mit Start in der Woche „startet ‹Wochentag TT.MM.› · n Tage“, in der aktuellen Woche bereits laufende Vorgänge „läuft bis ‹Wochentag TT.MM.›“, To-dos „fällig ‹Wochentag TT.MM.›“. Jeder Eintrag erscheint genau einmal; was in `overdue` steht, nicht nochmal. Überschriften wie die Wochenliste („Diese Woche“, „Nächste Woche“, „KW n“, rechts „TT.MM.–TT.MM. · D-x“).
     - `later`: alle Einträge nach diesen Wochen, mit denselben Wochen-Überschriften
     - `undated`: eigene Protokoll-To-dos ohne `due_date`
     - `unassigned`: Einträge für „Aus meinen AKs – noch niemand eingetragen“ (siehe oben), nach Datum, ohne Datum zuletzt
     - Sortierung innerhalb eines Tages: Elemente vor Plan-To-dos vor Protokoll-To-dos, dann Name/Text
   - `recentlyDone({ … , today, days = 14 })`: eigene Elemente, Plan-To-dos (gleiche Regel wie oben) und Protokoll-To-dos mit `done_at` in den letzten 14 Tagen (Berliner Datum, heute eingeschlossen), neueste zuerst
   - Jeder Eintrag trägt: Art (`element` | `plan_todo` | `meeting_todo`), ID, Titel, Zusatztext, Datum (Tag oder leer), AK-Name, bei Elementen Status und Puffer, bei Plan-To-dos Element-ID und Anker (`start` → „Voraussetzung“, `end` → „To-do“), bei Protokoll-To-dos Treffen-ID und -Datum, Kennzeichen „an deinem Element“
   - Tests: Zuordnung (eigenes Element, To-do mit eigener Person, To-do ohne Person an eigenem Element, To-do mit fremder Person an eigenem Element → nicht meins), Wochengrenzen So/Mo, laufender Vorgang nur in der aktuellen Woche, Verzug durch negativen Puffer vor dem Termin, überfälliges Plan- und Protokoll-To-do, `later` ab Woche 7, `undated`, `unassigned` mit allen drei Arten (inkl. To-do ohne Person an einem Element mit Person → nicht in `unassigned`), Element ohne AK nie in `unassigned`, `recentlyDone` mit Grenze 14 Tage
2. **Datenzugriff** `src/db/my-tasks.ts`: `loadMyAgenda(memberId, today)` lädt Plan (wie die Startseite), Plan-To-dos, Protokoll-To-dos der aktuellen Ausgabe (mit Treffen-Datum), AK-Teilnahmen und Zuordnung Aufgabenbereich → AK, ruft `myAgenda` und `recentlyDone` auf. Mit React `cache` pro Anfrage, damit Layout (Zähler) und Seite nicht doppelt laden. `countMyOverdue(memberId, today)` = Länge von `overdue`.
3. **Server Actions** `src/actions/my-tasks.ts` (Zod, Mitglied aus der Datenbank, aktuelle Ausgabe):
   - `claimItem({ kind, id })`: setzt mich als verantwortlich – Element `owner_id` (mit `updated_at`/`updated_by` und Verlaufseintrag „Verantwortlich: ‹Name›“ über `changeSummaries`), Plan-To-do `owner_id`, Protokoll-To-do `owner_id`. Nur wenn noch niemand eingetragen ist (bei Protokoll-To-dos auch `owner_name` leer); sonst nichts speichern und Meldung „Hat inzwischen ‹Name› übernommen.“
   - Abhaken nutzt die **bestehenden** Actions (`setDone`, `toggleTodo`, To-do umschalten aus 004), keine neuen.
   - Alle Actions aus 004/008, die Elemente, To-dos oder Protokoll-To-dos ändern, laden zusätzlich `/meine` und den Zähler in der Navigation neu (`revalidatePath`), ohne ihr sonstiges Verhalten zu ändern.

Auftrag 1 endet mit „setze NUR Teil A um“. Teil A committen, nicht pushen.

### Teil B – Seite, Navigation, Tests

4. **Seite `/meine`** (ersetzt die Seite aus 004; Hinweis „Meilenstein-Aufgaben kommen mit R1“ entfällt):
   - Kopf: Titel „Meine Aufgaben“, darunter „n offen · x überfällig“ (x nur, wenn > 0, in Verzug-Farbe).
   - **„Überfällig & Verzug (x)“**, dann die Wochen, dann zugeklappt **„Später (n)“**, dann **„Ohne Datum (n)“** (nur wenn vorhanden).
   - Darunter zugeklappt **„Aus meinen AKs – noch niemand eingetragen (n)“** mit Knopf „Übernehmen“ je Eintrag (danach wandert der Eintrag in meine Liste, Meldung „Übernommen“). Ohne AK-Teilnahme stattdessen „Du bist noch in keinem AK – trag dich unter AKs ein.“ mit Link.
   - Zuletzt zugeklappt **„Zuletzt erledigt (n)“** (14 Tage), Haken gesetzt; Haken entfernen öffnet den Eintrag wieder.
   - Zugeklappt-Zustand pro Gerät merken (`localStorage`, Schlüssel `kp-meine-collapsed`, in `try/catch`, erster Render mit Standardwerten).
   - **Einträge** als Karten wie in der Wochenliste: links Statusstreifen, Name/Text fett, darunter „AK ‹Name› · ‹Zusatztext›“; Elemente rechts `StatusPill` und Puffer; Plan-To-dos mit Vorsatz „Voraussetzung · “ bzw. „To-do · “ und „für ‹Element›“, ggf. „· an deinem Element“; Protokoll-To-dos mit Kennzeichen „Protokoll“ und „aus Treffen TT.MM.“.
   - **Abhaken** über ein Kästchen links in jeder Karte (eigene Schaltfläche, Tastatur bedienbar, `aria-label` „‹Titel› erledigt“). Danach die Rückgängig-Leiste aus 008 „Erledigt · Rückgängig“ für 5 Sekunden; der Eintrag wandert nach „Zuletzt erledigt“. Fehler → Meldung „Konnte nicht gespeichert werden.“, Eintrag bleibt.
   - **Antippen** (außer Kästchen und „Übernehmen“): Elemente und Plan-To-dos öffnen das **bearbeitbare** `PlanDetail` aus 008 für das Element (ab 901 px Panel rechts, 380 px, Seite bleibt 1024 px breit; bis 900 px Blatt von unten), mit denselben Daten wie auf der Startseite; Änderungen im Panel aktualisieren die Liste. Protokoll-To-dos verlinken auf `/protokolle/[id]` des Treffens.
   - Leerer Zustand (nichts Offenes): „Nichts offen bei dir.“ – die zugeklappten Abschnitte bleiben darunter.
5. **Navigation:** An „Meine“ (Kopfleiste und Tab-Leiste) eine kleine pinke Zahl mit `countMyOverdue`, nur wenn > 0 (`aria-label` „n überfällig“). Wird im Layout `(app)` serverseitig geladen; schlägt das Laden fehl, fehlt die Zahl, die Seite lädt trotzdem. Sonst keine Änderung an Navigation oder Layout.
6. **Klicktest** `e2e/meine.spec.ts` (Dev-Login als Kim Brenner). **Seed-Elemente nie ändern**, nur eigene, je Lauf eindeutig benannte Elemente und Treffen anlegen und am Ende löschen; Prüfungen relativ.
   - 1280 × 800: Auf `/` über „+ Element“ „E2E Meine ‹Zeit›“ anlegen (Vorgang 5 T, AK, in dem Kim im Seed eingetragen ist, Nachfolger D-Day, 20 T), keine verantwortliche Person
   - `/meine`: „Aus meinen AKs – noch niemand eingetragen“ aufklappen → Element sichtbar; „Übernehmen“ → Element erscheint in meiner Liste mit „startet …“
   - Im Panel des Elements (Antippen auf `/meine`) ein To-do ohne Person anlegen → erscheint in der Liste mit „an deinem Element“
   - Element abhaken → „Rückgängig“ → wieder offen; erneut abhaken → unter „Zuletzt erledigt“; dort Haken entfernen → wieder offen
   - Seed-Element „Kooperationsgespräch KVR/Polizei“ steht unter „Überfällig & Verzug“ (nur lesen); Navigation „Meine“ zeigt eine Zahl ≥ 1
   - Eigenes Treffen anlegen, To-do mit Wer = Kim Brenner und Datum gestern → steht unter „Überfällig & Verzug“ mit „Protokoll“; Antippen führt zum Treffen; dort abhaken → auf `/meine` unter „Zuletzt erledigt“
   - Dev-Login als Alex Rauch → „E2E Meine ‹Zeit›“ steht nicht in Alex’ Liste
   - 375 × 812: Liste sichtbar, Eintrag öffnet das Blatt, Kästchen bedienbar, keine waagrechte Scrollleiste
   - Aufräumen als Kim: eigenes Element und Treffen löschen
   - Keine Konsolenfehler; nach Seitenwechseln `expectPageReady`
   - Bestehende Klicktests (v. a. `e2e/protokoll.spec.ts` zu `/meine`) nur anpassen, soweit der weggefallene Hinweis oder der neue Titel es verlangen
7. **Vitest** für `my-tasks.ts` (siehe 1).

Auftrag 2 beginnt mit „Teil A ist bereits umgesetzt – ändere daran nichts“.

## Akzeptanzkriterien

- `/meine` zeigt eigene Plan-Elemente, eigene Plan-To-dos (inkl. To-dos ohne Person an eigenen Elementen) und eigene Protokoll-To-dos in einer Zeitliste: „Überfällig & Verzug“, aktuelle Woche immer, 6 Wochen, „Später“, „Ohne Datum“
- „Aus meinen AKs – noch niemand eingetragen“ mit „Übernehmen“; Übernehmen ist serverseitig gegen doppelte Übernahme geschützt und schreibt beim Element einen Verlaufseintrag
- Abhaken aller drei Arten direkt in der Liste mit 5 s „Rückgängig“; „Zuletzt erledigt“ zeigt 14 Tage und erlaubt Wieder-Öffnen
- Plan-Einträge öffnen das bearbeitbare Detail-Panel/Blatt auf `/meine`; Protokoll-To-dos führen zum Treffen
- Pinke Zahl an „Meine“ nur bei Überfälligem/Verzug, stimmt mit „Überfällig & Verzug“ überein
- „Heute“ und alle Rechnungen serverseitig; erster Render ohne Hydration-Fehler
- Deaktivierte Mitglieder können nichts übernehmen oder abhaken, auch mit gültigem Sitzungs-Cookie
- Keine E-Mail-Adressen; helles und dunkles Thema lesbar
- Vitest für `my-tasks` grün; Klicktest `e2e/meine.spec.ts` und alle bisherigen grün bei 375 × 812 und 1280 × 800, gegen `pnpm dev` **und** gegen den lokalen Production-Build
- `pnpm typecheck`, `lint`, `test`, `build` grün

## Abweichungen beim Bau

- Neu laden: Die Actions aus 004/008 rufen weiter `refresh()` auf; `revalidatePath` für `/meine` und für das Layout (Zähler an „Meine“) ist zusätzlich ergänzt (`src/actions/revalidate-my-tasks.ts`). (Freigabe Franz)
- `src/db/plan.ts`: `ownerId` der Plan-To-dos sowie `done_at` von Elementen und Plan-To-dos ergänzt, nur hinzufügend. (Freigabe Franz)
- Rückgängig-Leiste aus 008 herausgelöst: `useUndoBar` in `src/components/plan/plan-bar.tsx`, `run`/`drag` in `src/components/plan/use-plan-actions.ts`; Startseite und `/meine` nutzen beides, die Startseite verhält sich wie vorher. (Freigabe Franz)
- Einträge unter „Aus meinen AKs – noch niemand eingetragen“ haben kein Kästchen zum Abhaken, nur „Übernehmen“ (abgehakt würden sie sonst verschwinden, da „Zuletzt erledigt“ nur eigene Einträge zeigt). (Freigabe Franz)
- Kreis im Plan: `/meine` zeigt „Der Plan lässt sich nicht berechnen …“ statt abzustürzen, die Zahl an „Meine“ fehlt dann einfach; alle Seiten laden weiter. (Freigabe Franz)

## Deploy

Keine DB-Änderung: `deploy`. Danach am iPhone in production: „Meine“ öffnen, ein eigenes Element bzw. To-do abhaken und mit „Rückgängig“ zurücknehmen; Zahl an „Meine“ prüfen.
