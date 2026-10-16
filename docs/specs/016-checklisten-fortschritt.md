# SPEC 016 – Checklisten & Fortschritt

Freigabe Franz: ☑
Zweig: `spec/016-checklisten-fortschritt` · Risikoklasse B · lokal (Sichtprüfung, Teil A/B), Auto-Modus aus · DB: nein

Stand 16.10.2026 (Sitzung 12). Grundlage ist das erste Team-Feedback von Flo vom 15.10.2026 aus Telegram. Baut auf 004 (Protokoll), 007 (Wochenliste, Gantt), 008 (Panel/Blatt, To-dos, Rückgängig-Leiste), 009 (`/meine`, herausgelöste Rückgängig-Leiste) und 013 (Begriffe „N T vorher“) auf, alle live. Abgenommenes Test-Layout: Artifact „KP27 Checklisten-Test“ (Version 1, 16.10.2026).

## Entscheidungen (Franz, 16.10.2026)

1. Fortschritt „erledigt/gesamt“ der To-dos eines Elements im **Gantt** und in der **Wochenliste** (nicht in `/meine`, nicht als eigener Balken im Panel).
2. Gantt nach **Variante A**: schmale Leiste unter dem Balken plus Zahl „3/10“ rechts daneben; Meilensteine nur die Zahl.
3. **Abhaken in der Wochenliste:** Haken vor jedem Element = „Erreicht“; der Zähler „3/10“ klappt die To-dos auf, dort einzeln abhaken. Rückgängig wie in `/meine`.
4. Sind alle To-dos erledigt, fragt die App **„Als erreicht markieren?“**. Der Status bleibt eine bewusste Entscheidung, nichts wird automatisch erreicht.
5. „Erreicht“ ist auch mit offenen To-dos **erlaubt**. Die Rückgängig-Leiste sagt dann, wie viele noch offen sind.
6. Sichtbare Bestätigung **„Gespeichert ✓“ direkt am Feld**, verschwindet nach 2 s. Bei Fehler rot „Nicht gespeichert – nochmal“.
7. Im Protokoll überall **„Beschluss“** statt „Entscheidung“.

## Ziel

Das Team sieht im Plan auf einen Blick, wie weit ein Element ist, und kann direkt in der Wochenliste abhaken: das ganze Element oder einzelne To-dos. Sind alle To-dos erledigt, schlägt die App vor, das Element als erreicht zu markieren. Wer etwas eintippt, sieht am Feld, dass es gespeichert ist. Im Protokoll gibt es nur noch ein Wort für Festgelegtes: Beschluss.

## Nicht in dieser Spec

- Keine DB-Änderung, keine neue Tabelle oder Spalte. Die Werte der Spalte `meeting_items.kind` (`entscheidung`) bleiben, ebenso CSS-Variablen- und Code-Namen.
- Keine Änderung an `src/lib/plan-engine.ts`: Status und Puffer rechnen weiter wie bisher. Der Fortschritt ändert keinen Status.
- Kein automatisches „Erreicht“, keine „Sub-Ampel“-Farbe aus dem Fortschritt
- Kein Fortschritt auf `/meine`, auf `/arbeitskreise` oder als Balken im Panel-Kopf
- Kein Arbeitsbereich je AK, keine Checklisten auf der AK-Seite (eigene Spec später)
- Keine Tagesordnungs-Sammlung, keine Verknüpfung von Protokoll-To-dos mit Plan-Elementen (R3)
- Kein Abhaken im Gantt selbst (dort weiter über das Panel)
- Keine Änderung an `src/proxy.ts`, `src/auth.ts`, Login, `.claude/`, `.github/`, `agents/`, `scripts/`, Configs, `.env*`, `AGENTS.md`; keine neuen Laufzeit-Pakete

## Vorab: Abgleich mit dem Code

Vor dem Bau berichten, dann auf „Weiter“ warten:

1. **Wochenliste** (`src/components/plan/plan-week-list.tsx`, `weekAgenda` in `src/lib/gantt-layout.ts`): Welche Daten hat jede Karte? Sind die Plan-To-dos (`plan_todos`) dort schon geladen oder nur im Panel (`loadPlanDetails`)? Wie öffnet das Antippen das Panel bzw. Blatt?
2. **Abhaken in `/meine`** (009): Wie sieht die Abhak-Schaltfläche aus (Kreis oder Kästchen, Komponente, `aria-label`)? Wie ist die herausgelöste Rückgängig-Leiste eingebunden (Komponente, Dauer, Text)? Welche Actions nutzt sie (`setDone`, `toggleTodo`)?
3. **Gantt** (`plan-gantt.tsx`, `gantt-layout.ts`): Was steht rechts neben Balken und Meilensteinen (Puffer- bzw. Verzug-Text)? Wie hoch sind Zeile und Balken, ist unter dem Balken Platz für eine 3-px-Leiste ohne höhere Zeilen?
4. **Speichern von Textfeldern:** Liste aller Eingaben, die per Server Action beim Verlassen, per Enter oder per Knopf speichern, in Panel/Blatt (008), Protokoll (004, Kopf, Punkte, Notiz/Transkript) und AKs (005). Wie zeigen sie heute Erfolg und Fehler (z. B. „Gespeichert“ im Protokoll-Kopf)? Gibt es eine gemeinsame Komponente?
5. **„Entscheidung“ in der Oberfläche:** alle sichtbaren Stellen (`ItemKindBadge`, Schnell-Eingabe mit Alt+3, Punkt bearbeiten, Export `toTelegramText` und `toMarkdown`, Zählung auf `/protokolle`, Texte in Seed und Tests). Die Seite `/protokolle/beschluesse` heißt schon „Beschlüsse“.
6. Welche Klicktests Texte wie „Entscheidung“ prüfen oder auswählen und deshalb angepasst werden müssen.

Wenn etwas grundlegend anders ist als hier beschrieben: stoppen, Unterschied beschreiben, nichts umbauen. Bestehende Helfer und Komponenten nutzen, keine zweiten bauen.

## Umsetzung

**Grundregeln**

- Rechnen in `src/lib/` als reine Funktionen mit Vitest (relativ importieren, Vitest kennt `@/` nicht). Komponenten zeichnen nur.
- Abhaken nutzt die **bestehenden** Actions (`setDone`, `toggleTodo`), keine neuen. Neu laden wie bisher, **kein** `revalidatePath("/", "layout")`.
- Rechte wie bisher: alle aktiven Mitglieder dürfen abhaken, Mitglied wird bei jedem Aufruf aus der DB geladen.
- Neue Farben nur als CSS-Variablen in `src/app/globals.css`, hell und dunkel. Bestehende Variablen nicht ändern.
- Neue Texte nie mit „D-Day“/„D-N“.

### Teil A – Fortschritt-Logik, Gespeichert-Anzeige, Beschluss

1. **Reine Funktion** `src/lib/todo-progress.ts`:
   - `todoProgress(todos)` → `{ done, total, complete }` (`complete` nur bei `total > 0` und `done === total`)
   - `formatProgress(p)` → „3/10“, bei `complete` „10/10 ✓“, bei `total === 0` leer
   - `reachedWithOpenText(openCount)` → „Erreicht · 1 To-do noch offen“ / „Erreicht · 7 To-dos noch offen“; bei 0 nur „Erreicht“
   - Vitest: leer, teilweise, komplett, Einzahl/Mehrzahl, 0 offen
2. **Gespeichert-Anzeige** als eine gemeinsame Komponente (z. B. `src/components/save-status.tsx`), angehängt an alle unter Abgleich 4 gefundenen Textfelder in **Panel/Blatt, Protokoll und AKs**:
   - Während des Speicherns „Speichert …“ (gedämpft), danach **„Gespeichert ✓“** für 2 s direkt neben bzw. unter dem Feld, dann leer
   - Fehler: rot „Nicht gespeichert – nochmal“, „nochmal“ ist ein Knopf und wiederholt dieselbe Speicherung; die Eingabe bleibt im Feld stehen
   - Live-Region (`role="status"`, bei Fehler `role="alert"`), damit Screenreader es ansagen; ohne Animation bei „Bewegung reduzieren“
   - Bestehende Einzel-Meldungen (z. B. „Gespeichert“ im Protokoll-Kopf) durch diese Komponente ersetzen, nicht doppelt anzeigen
   - Abhaken (Kästchen, Haken) bekommt **keine** Gespeichert-Anzeige, dort bestätigt die Rückgängig-Leiste
3. **„Beschluss“ statt „Entscheidung“** in allen sichtbaren Texten aus Abgleich 5: Badge „Beschluss“, Typ-Auswahl „Beschluss“ (Alt+3 bleibt), Export-Abschnitt „Beschlüsse:“ und Präfix **Beschluss** im Markdown, Zählungen („2 Beschlüsse“). Werte in der DB, CSS-Variablen und Code-Namen bleiben. Vitest für den Export entsprechend anpassen.

Auftrag 1 endet mit „setze NUR Teil A um“. Teil A committen, nicht pushen.

### Teil B – Gantt, Wochenliste, Hinweis, Neuigkeiten, Tests

4. **Gantt (Variante A):**
   - Vorgänge mit To-dos: unter dem Balken eine 3 px hohe, abgerundete Leiste über die volle Balkenbreite (Hintergrund neue Variable `--progress-track`), gefüllt im Verhältnis erledigt/gesamt (`--progress-fill`). Zeilenhöhe bleibt.
   - Rechts neben Balken und Meilenstein die Zahl aus `formatProgress`, klein, `tabular-nums`; bei `complete` in Grün mit „✓“. Steht dort schon Puffer- oder Verzug-Text: Zahl davor, getrennt durch „ · “ (Reihenfolge im Abgleich bestätigen).
   - Ohne To-dos: weder Leiste noch Zahl.
   - Werte ändern sich nach Abhaken im Panel ohne Neuladen der Seite.
5. **Wochenliste (Laptop „Liste“ und Handy):**
   - **Haken vor jedem Element:** dieselbe Abhak-Schaltfläche wie auf `/meine` (Einheitlichkeit; im Test-Layout als Kreis gezeigt). Antippen setzt bzw. nimmt „Erreicht“ zurück (`setDone`). `aria-label` „‹Name› als erreicht markieren“ bzw. „‹Name› – erreicht zurücknehmen“. Tippfläche mindestens 44 × 44 px am Handy.
   - Danach die Rückgängig-Leiste aus 009, 5 s: „Erreicht“ bzw. mit offenen To-dos `reachedWithOpenText` (z. B. „Erreicht · 7 To-dos noch offen“); beim Zurücknehmen „Wieder offen“.
   - **Zähler** rechts unter der Status-Pill: Mini-Leiste + `formatProgress` + Pfeil, als Knopf mit `aria-expanded`. Antippen klappt die To-dos des Elements **in der Karte** auf: Kästchen, Text, Person, Fälligkeit (wie im Panel, überfällige rot). Abhaken per `toggleTodo` mit Rückgängig-Leiste „Erledigt: ‹Text›“ bzw. „Wieder offen: ‹Text›“. Aufgeklappt-Zustand nur für die Dauer des Seitenbesuchs, nicht gespeichert.
   - Antippen des übrigen Karteninhalts öffnet wie bisher Panel bzw. Blatt.
   - Erreichte Elemente: Name gedämpft, Haken gefüllt.
6. **Hinweis „Als erreicht markieren?“:**
   - Erscheint, wenn alle To-dos erledigt sind (`complete`) und das Element **nicht** erreicht ist: im Panel/Blatt oben (auf `/` und `/meine`) und in der Wochenliste unter den aufgeklappten To-dos. Wird das letzte To-do in der Wochenliste abgehakt, klappt die Karte auf, damit der Hinweis sichtbar ist.
   - Text: **„Alle To-dos erledigt. Als erreicht markieren?“**, Knöpfe „Erreicht“ (`setDone`, Rückgängig-Leiste) und „Noch nicht“ (blendet den Hinweis für dieses Element bis zum nächsten Seitenaufruf aus).
   - Hell rosa Fläche mit Pink-Rand (neue Variablen `--hint-bg`, `--hint-border`, hell und dunkel), `role="status"`.
7. **Neuigkeiten:** Eintrag aus dem Abschnitt unten in `src/lib/news/entries.ts`, ID `016-checklisten-fortschritt`, Datum = Tag des Baus. Vor dem Eintragen gegen die echten Bezeichnungen prüfen (Haken oder Kästchen, Feldnamen).
8. **Klicktest** `e2e/checklisten.spec.ts` (Dev-Login als Kim Brenner). **Seed-Elemente nie ändern**, nur ein eigenes, je Lauf eindeutig benanntes Element „E2E Checkliste ‹Zeit›“ anlegen und am Ende löschen; Prüfungen relativ.
   - 1280 × 800: Element über „+ Element“ anlegen (Vorgang, 5 T, in einer der nächsten Wochen, Nachfolger Krachparade). Im Panel zwei To-dos anlegen → „Gespeichert ✓“ erscheint; im Gantt steht „0/2“, die Leiste ist leer
   - Titel im Panel ändern → „Gespeichert ✓“ erscheint und verschwindet wieder
   - Speichern schlägt fehl (Server-Action-Anfrage per `page.route` abbrechen, falls machbar; sonst begründet vermerken) → „Nicht gespeichert – nochmal“; Route wieder freigeben, „nochmal“ → „Gespeichert ✓“
   - Ansicht „Liste“: Zähler „0/2“ antippen → To-dos sichtbar; eins abhaken → „1/2“, Rückgängig-Leiste; „Rückgängig“ → „0/2“
   - Beide abhaken → Hinweis „Als erreicht markieren?“; „Noch nicht“ → Hinweis weg; Panel öffnen → Hinweis im Panel; „Erreicht“ → Status „Erreicht“, Gantt zeigt „2/2 ✓“
   - „Wieder offen“ über den Haken, ein To-do zurücknehmen, Haken erneut setzen → Leiste zeigt „noch offen“
   - Protokoll: eigenes Treffen anlegen, Punkt mit Typ „Beschluss“ → Badge „Beschluss“, „Als Text kopieren“ enthält „Beschlüsse:“; kein sichtbares „Entscheidung“ auf der Seite. Treffen am Ende löschen
   - 375 × 812: Wochenliste, Haken und Zähler bedienbar (≥ 44 px), aufgeklappte To-dos ohne waagrechte Scrollleiste, Blatt zeigt den Hinweis
   - Aufräumen: eigenes Element löschen; keine Konsolenfehler; nach Seitenwechseln `expectPageReady`
   - Bestehende Klicktests nur anpassen, wo sie „Entscheidung“ auswählen oder prüfen
9. **Vitest** für `todo-progress.ts` und den angepassten Export.

Auftrag 2 beginnt mit „Teil A ist bereits umgesetzt – ändere daran nichts“.

## Neuigkeiten

ID `016-checklisten-fortschritt` · Datum: Tag des Baus · Titel „Abhaken und Fortschritt im Plan“

- **Fortschritt auf einen Blick.** Hat ein Element To-dos, zeigen Gantt und Wochenliste, wie viele davon erledigt sind, zum Beispiel „3/10“.
- **Abhaken in der Wochenliste.** Der Haken vor einem Element markiert es als erreicht. Über „3/10“ klappst du die To-dos auf und hakst sie einzeln ab.
- **Alles erledigt?** Ist das letzte To-do abgehakt, fragt die App, ob das Element erreicht ist.
- **„Gespeichert ✓“.** Neben jedem Feld siehst du kurz, dass deine Eingabe gespeichert ist.
- **Beschluss statt Entscheidung.** Im Protokoll heißt es jetzt überall „Beschluss“.

## Akzeptanzkriterien

- Gantt: Vorgänge mit To-dos zeigen Leiste und „x/y“, Meilensteine „x/y“, komplett „y/y ✓“ in Grün; ohne To-dos nichts; Zeilenhöhe unverändert
- Wochenliste (Laptop „Liste“ und Handy): Haken je Element setzt/nimmt „Erreicht“ mit 5 s Rückgängig; Zähler klappt To-dos auf, einzeln abhakbar mit Rückgängig
- „Erreicht“ mit offenen To-dos möglich, Leiste nennt die Zahl offener To-dos
- Hinweis „Als erreicht markieren?“ im Panel/Blatt (`/` und `/meine`) und in der Wochenliste, sobald alle To-dos erledigt und das Element nicht erreicht ist; „Noch nicht“ blendet ihn bis zum nächsten Seitenaufruf aus; kein automatisches „Erreicht“
- „Gespeichert ✓“ bzw. „Nicht gespeichert – nochmal“ an allen Textfeldern aus Abgleich 4 (Panel/Blatt, Protokoll, AKs), eine gemeinsame Komponente, keine doppelten Meldungen
- Keine sichtbare „Entscheidung“ mehr im Protokoll, im Export und auf `/protokolle`; DB-Werte unverändert
- Status, Puffer und kritischer Pfad unverändert (Engine nicht angefasst)
- Helles und dunkles Thema lesbar; Tastatur bedienbar; kein Hydration-Fehler (Production-Build)
- Neuigkeiten-Eintrag vorhanden, Vitest für `src/lib/news/` grün (kein „D-Day“)
- Vitest für `todo-progress.ts` grün; `e2e/checklisten.spec.ts` und alle bisherigen Klicktests grün bei 375 × 812 und 1280 × 800, gegen `pnpm dev` **und** gegen den lokalen Production-Build (Port 3100)
- `pnpm typecheck`, `lint`, `test`, `build` grün
- `scripts/risikoklasse.ts` (gegen den Freigabe-Commit) stuft A oder B ein, nicht C
- Abweichungen unter „Abweichungen beim Bau“ vermerkt, mit „(von Franz freigegeben)“

## Deploy

Keine DB-Änderung: `deploy` merged nach grünen Prüfungen automatisch. Deshalb **vorher** lokal durchklicken (Chrome-Geräteansicht 375 px und Laptop, hell und dunkel). Danach Live-Check am iPhone: Wochenliste, Haken mit Rückgängig, Zähler aufklappen, Hinweis, „Gespeichert ✓“ im Panel, „Beschluss“ im Protokoll.

## Abweichungen beim Bau

(von Claude Code zu ergänzen; nie den Freigabe-Haken hier eintragen, stattdessen „(von Franz freigegeben)“)

- **Welche Felder „Gespeichert ✓“ zeigen:** Text-, Zahl- und Datumsfelder, Textbereiche und Auswahllisten, die per Server Action speichern. Im Panel fällt das gemeinsame „Gespeichert“ im Kopf weg; dafür melden sich dort auch Art, Fixtermin und „Wackelt“ am Feld. „Erreicht“, das Abhaken von To-dos, Verbindung lösen und Löschen zeigen nur Fehler. (von Franz freigegeben)
- **Hinweis unten im Protokoll bleibt** für alles, was kein Textfeld ist (Anwesend, Entwurf/Final, „Kopiert“, „Erledigt“/„Wieder offen“, „Gelöscht“, Verschieben). Kopf-Felder, Notiz/Transkript, Schnell-Eingabe, Punkt bearbeiten und TOP umbenennen melden sich nur noch am Feld. (von Franz freigegeben)
- **Formulare, die nach dem Speichern zugehen** (Punkt bearbeiten, AK oder Aufgabenbereich umbenennen, TOP umbenennen): „Gespeichert ✓“ steht 2 s an der Zeile bzw. Überschrift, die danach sichtbar ist; bei Fehler bleibt das Formular offen mit „Nicht gespeichert – nochmal“. (von Franz freigegeben)
- **Gantt-Reihenfolge** rechts neben Balken und Meilenstein: „Daten · 3/10 · Puffer“. (von Franz freigegeben)
- **Wochenliste:** Abhak-Schaltfläche als Kästchen wie auf `/meine` statt Kreis, `aria-label` wie in der Spec. (von Franz freigegeben)
- **Wochenliste, To-do-Karten:** Die eigenen To-do-Karten bekommen dasselbe Kästchen zum Abhaken (`toggleTodo`, Rückgängig-Leiste). (von Franz freigegeben)
- **Klicktest `e2e/protokoll.spec.ts`:** Datentext „E2E Entscheidung …“ wird in Teil B zu „E2E Beschluss …“. (von Franz freigegeben)
- **Meldung vom Server:** Kommt vom Server eine konkrete Meldung (z. B. Prüffehler), zeigt die Gespeichert-Anzeige nur diese; „Nicht gespeichert – nochmal“ erscheint nur bei Verbindungs- oder Serverausfall. (von Franz freigegeben)
- **Aufgabenbereich in einen anderen AK verschieben:** Dabei entfällt „Gespeichert ✓“. (von Franz freigegeben)
- **„Noch nicht“ gilt je Ort:** In der Wochenliste blendet „Noch nicht“ den Hinweis nur dort aus, im Panel/Blatt nur dort (jeweils bis zum nächsten Seitenaufruf). So passt der Ablauf im Klicktest („Noch nicht“ in der Liste → Hinweis im Panel). (von Franz freigegeben)
- **Vorgang in zwei Wochen:** Steht ein Vorgang zweimal in der Wochenliste („startet …“ und „endet …“), klappen beide Karten gemeinsam auf und zu. (von Franz freigegeben)
- **Klicktest `e2e/neuigkeiten.spec.ts`:** Er hatte den neuesten Eintrag fest eingetragen (Titel, Text, `015-neuigkeiten`) und brach mit dem Eintrag von 016. Jetzt nimmt er neuesten und zweitneuesten Eintrag aus `NEWS` und die gesehene ID über `latestNewsId` aus `src/lib/news/`, damit künftige Einträge ihn nicht mehr brechen. (von Franz freigegeben)
- **Gespeichert-Anzeige außerhalb des Labels:** Im Panel stand die Anzeige aus Teil A im `<label>` des Felds, ein Screenreader las es z. B. als „Name Gespeichert ✓“. Jetzt steht sie als eigene Live-Region direkt unter dem Feld (AK, Aufgabenbereich, Verantwortlich, Name, Dauer); der Feldname ist nur noch der Name. Geprüft an Name, Dauer, Protokoll-Titel und AK-Überschrift. (von Franz freigegeben)
