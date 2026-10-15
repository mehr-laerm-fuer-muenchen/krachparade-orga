# SPEC 007 – Gantt-Ansicht

Freigabe Franz: ☑
Zweig: `spec/007-gantt-ansicht` · Risikoklasse B · lokal (Sichtprüfung Design, Teil A/B) · DB: nein

Stand 15.10.2026 (Sitzung 5). Baut auf 006 (Plan-Engine, live) auf. Vorbild ist Test-Layout v4 (Artifact „KP27 Gantt-Plan“, Version 5), hier vollständig beschrieben. Entscheidungen aus den Auswahlfragen vom 15.10.2026.

## Ziel

Die Startseite zeigt den Plan der aktuellen Ausgabe als **Gantt** (Laptop) bzw. als **Wochenliste „Was steht an“** (Handy). Am Laptop lässt sich zwischen Gantt und Liste umschalten. Swimlanes sind die AKs, zuklappbar mit Sammelbalken. Ein angetipptes Element zeigt seine Abhängigkeiten als Pfeile und öffnet ein **Detail-Panel nur zum Lesen** (Termin, Puffer, Zuständigkeit, To-dos, Notizen, Vorgänger und Nachfolger). Die Navigation „Überblick“ heißt künftig „Plan“. Die Vorschau-Tabelle aus 006 entfällt.

## Nicht in dieser Spec

- Jede Änderung am Plan: Ziehen, Länge ändern, Anlegen, Verbinden, Abhaken, To-dos und Notizen schreiben, `plan_changes` (008)
- „Meine Aufgaben“ aus dem Plan (009), KP27-Vorlage für production (010)
- Änderungen an der Engine `src/lib/plan-engine.ts` (nur nutzen), am Schema, am Seed
- Änderungen an `src/proxy.ts`, `src/auth.ts`, Login, Configs
- Neue Laufzeit-Pakete (keine Gantt- oder Chart-Bibliothek; eigene SVG-Komponente mit Tailwind)

## Vorab: Abgleich mit dem Code nach 006

Bevor du etwas änderst, prüfe den aktuellen Stand und berichte kurz:

- Startseite `src/app/(app)/page.tsx` (Vorschau-Tabelle), `src/lib/plan-preview.ts`, `src/db/plan.ts` (`loadPlan`), `src/lib/plan-engine.ts` (`computePlan`, `criticalPath`, `todoDueDay`), `src/lib/plan-days.ts`
- Navigation (Kopfleiste und Tab-Leiste) – wo steht „Überblick“, wie wird der aktive Punkt bestimmt, wo der Seitentitel
- Wie kommen die AK-Teilnahmen des angemeldeten Mitglieds an (`working_group_members`)? Gibt es dafür einen Helfer aus 005?
- `StatusPill`, Farb-Variablen in `src/app/globals.css`
- Gibt es schon eine Stelle, an der `localStorage` gelesen wird? (Hydration-Muster)

Wenn etwas davon grundlegend anders ist als hier beschrieben: stoppen, Unterschied beschreiben, nichts umbauen. Bestehende Helfer nutzen, keine zweiten bauen.

## Umsetzung

**Grundregeln**

- Daten und Rechnung kommen vom Server: `loadPlan` + `computePlan` mit `todayInBerlin(new Date())`. Die Client-Komponente bekommt das fertige Ergebnis (Elemente mit Start, Ende, spätestem Termin, Puffer, Status, Grund, AK, Aufgabenbereich, Person, To-dos mit Fälligkeit, Notizen, Verbindungen, kritischer Pfad, „heute“ und D-Day als Tage). Im Browser wird nicht neu gerechnet und „heute“ nie aus der Browser-Uhr bestimmt.
- Nur lesen: keine Server Actions in dieser Spec.
- Keine E-Mail-Adressen, nur Namen.
- Darstellungs-Logik (Zeilen, Zeitachse, Wochen) als reine Funktionen in `src/lib/` mit Vitest; die Komponenten zeichnen nur.
- `localStorage` nur für Ansichts-Vorlieben pro Gerät, jeder Zugriff in `try/catch`; erster Render immer mit den Standardwerten (keine Hydration-Fehler), danach im Browser anwenden.

### Teil A – Darstellungs-Logik, Gantt, Navigation

1. **Farb-Variablen** in `src/app/globals.css` ergänzen (hell / dunkel), bestehende nicht ändern:
   - Puffer-Strich `#9FB3A7` / `#5C7266`
   - Zu-spät-Band `#F3C9D2` / `#5A2531`
   - Spur-Hintergrund (AK-Zeile) `#E9EEEA` / `#1E2622`
   - D-Day-Linie = Primärfarbe; Heute-Linie und Auswahl = Pink-Akzent (vorhanden)
2. **Reine Funktionen** `src/lib/gantt-layout.ts` mit Vitest:
   - `isoWeek(day, dDay)` und `mondayOf(day, dDay)` (Wochen Mo–So, ISO-Kalenderwoche)
   - `timeRange(elements, today)`: Beginn = Montag vor (min(frühester Start, heute) − 7), Ende = D-Day + 21
   - `xOf(day, range, pxPerDay)`
   - `monthTicks(range, dDay)` (jeder Monatserste, Beschriftung „Mär 27“) und `weekTicks(range, dDay)` (jeder Montag mit „KW n“)
   - `buildRows(elements, groups, { collapsed, criticalOnly, openOnly, criticalPath })`: je AK in `sort_order` eine Spur-Zeile (Name „AK ‹Name›“, sichtbare Anzahl / Gesamtzahl), darunter – wenn nicht zugeklappt – die Elemente sortiert nach Start, dann Ende, dann Name. Elemente ohne AK in einer Spur „Ohne AK“ am Ende (nur wenn vorhanden). Filter „Kritischer Pfad“ = nur Elemente aus `criticalPath`; „Nur offene“ = nur nicht erledigte. Spuren bleiben auch ohne sichtbare Elemente stehen.
   - `laneSummary(elements)`: frühester Start, spätestes Ende, schlechtester Status der offenen Elemente (Rang `late` > `warn` > `ok`; alle erledigt → `done`)
   - Tests: KW über den Jahreswechsel (KW 53/1), Monatserste, Filter-Kombinationen, Sortierung, „Ohne AK“, Sammelbalken mit allen erledigt
3. **Komponente `PlanGantt`** (`src/components/plan/plan-gantt.tsx`, Client-Komponente, SVG + Tailwind), Maße wie Test-Layout v4:
   - Aufbau: links eine Namensspalte (240 px, HTML-Buttons), rechts die Zeitachse als SVG in einer eigenen waagrechten Scrollfläche. Kopfzeile 40 px (Monate oben, Kalenderwochen darunter), Spur-Zeile 34 px, Element-Zeile 30 px. Zeilen links und rechts exakt auf gleicher Höhe.
   - Spur-Zeile: Hintergrund Spur-Farbe, links Pfeil zum Auf-/Zuklappen, „AK ‹Name›“ und Anzahl; rechts ein Sammelbalken (8 px hoch, runde Enden) vom frühesten Start bis zum spätesten Ende in der Farbe des schlechtesten Status.
   - Vorgang: Balken 14 px hoch, Ecken 3 px, Breite = Dauer × px/Tag (mind. 3 px). Meilenstein: Raute (7 px Halbdiagonale) am Tag. Farbe nach Status (Erreicht, On track mit dunkler Kontur, Wackelt, Verzug – Werte aus 003).
   - Fixtermin: zusätzlich 2 px Kontur in Textfarbe; in der Namensspalte Kennzeichen „Fix“.
   - Puffer (offen, Puffer > 0): 3 px Strich in Puffer-Farbe vom geplanten Ende bis zum spätesten Ende. Zu spät (offen, Puffer < 0): Band 18 px hoch in Zu-spät-Farbe vom spätesten Ende bis zum geplanten Ende, hinter dem Balken.
   - Beschriftung rechts neben Balken/Raute bzw. Puffer: „TT.MM.“ (Meilenstein) oder „TT.MM.–TT.MM.“ (Vorgang), bei offenen Elementen „ · +n T“ bzw. „ · −n T“ (Verzug in Verzug-Farbe, fett).
   - Namensspalte je Element: Name (abgeschnitten mit „…“, voller Name als `title`), ggf. „Fix“, rechts klein „D-x“ des Starts.
   - Senkrechte Linien über die ganze Höhe: Monatserste (durchgezogen, Linienfarbe), Montage ab Zoom „Monat“ (gestrichelt); **Heute** in Pink (2 px) mit Beschriftung „Heute“ links daneben; **D-Day** gestrichelt in Primärfarbe mit „D-Day“ rechts daneben. Beschriftungen mit Flächen-Hintergrund, damit sie nichts überlagern.
   - Zoom: „Quartal“ 3 px/Tag, „Monat“ 6 px/Tag (Standard), „Woche“ 12 px/Tag (dann jede KW beschriftet, sonst jede zweite).
   - Auswahl: Antippen von Balken, Raute oder Name wählt das Element (nochmal antippen wählt ab). Ausgewählt: Ring in Pink um Balken/Raute, Namenszeile hervorgehoben (linker Pink-Strich); **Pfeile** in Pink von jedem Vorgänger (Ende) zum Element (Start) und vom Element zu jedem Nachfolger, als rechtwinklige Linie mit Pfeilspitze; Nachfolger „D-Day“ → Pfeil bis zur D-Day-Linie. Pfeile nur bei Auswahl.
   - Beim Öffnen scrollt die Zeitachse so, dass „Heute“ etwa 160 px vom linken Rand steht.
   - Barrierefreiheit: Namens-Buttons per Tastatur bedienbar (Enter wählt), sichtbarer Fokus, SVG mit `aria-label` „Gantt-Plan“; Escape schließt die Auswahl.
4. **Navigation:** „Überblick“ heißt in Kopfleiste und Tab-Leiste **„Plan“** (Ziel weiter `/`), Seitentitel „Plan“. Sonst keine Änderung an der Navigation. Klicktests nur so weit anpassen, wie es der neue Name verlangt.

Auftrag 1 endet mit „setze NUR Teil A um“. Teil A committen, nicht pushen. In Teil A darf die Startseite noch die Vorschau-Tabelle zeigen; `PlanGantt` wird mit einem Vitest/Render-Test oder in Teil B eingebunden.

### Teil B – Startseite, Wochenliste, Detail-Panel, Tests

5. **Startseite `/`** (ersetzt die Vorschau-Tabelle aus 006; nicht mehr genutzte Teile von `plan-preview.ts` entfernen, genutzte Helfer wie Puffer-Text behalten):
   - Kopf: Titel „Plan KP27“ (aus dem Ausgaben-Namen wie in 006), darunter „Rückwärts gerechnet vom D-Day · n Elemente · x in Verzug“ und, wenn der Filter „Kritischer Pfad“ aktiv ist, „· Kritischer Pfad: n Elemente, Start spätestens ‹Wochentag TT.MM.› (D-x)“.
   - Werkzeugleiste (Laptop): Umschalter **„Gantt | Liste“**, Filter-Knöpfe „Kritischer Pfad“ und „Nur offene“ (gedrückter Zustand sichtbar), Zoom „Quartal | Monat | Woche“, „Alle AKs zu“ bzw. „Alle AKs auf“.
   - Legende (eine Zeile, umbrechend): Erreicht, On track, Wackelt, Verzug, Meilenstein, Puffer, zu spät, Fixtermin, Heute, D-Day.
   - Hinweis unter dem Gantt: „Antippen zeigt Abhängigkeiten und Details. Bearbeiten kommt mit dem nächsten Update.“
   - **Bis 900 px Breite** immer die Wochenliste, Umschalter, Zoom und AK-Knöpfe ausgeblendet. **Ab 901 px** Start mit Gantt, Umschalter auf „Liste“ zeigt die Wochenliste in voller Breite.
   - Merken pro Gerät (`localStorage`, Schlüssel `kp-plan-view`, `kp-plan-zoom`, `kp-plan-collapsed` mit AK-IDs): Ansicht, Zoom, zugeklappte AKs. Filter werden nicht gemerkt.
   - Leerer Zustand (production bis 010): „Noch kein Plan. Die KP27-Vorlage kommt mit Spec 010.“ ohne Werkzeugleiste.
   - Enthält der Plan einen Kreis: Fehlermeldung wie in 006 statt Absturz.
6. **Reine Funktion** `weekAgenda(plan, today, { weeks, myGroupIds })` in `src/lib/gantt-layout.ts` mit Vitest:
   - Abschnitt **„Überfällig & Verzug“**: alle offenen Elemente mit Status `late` (Text = Grund: „Puffer negativ“, „Fixtermin liegt n Tage zu spät“, „Termin vorbei, nicht abgehakt“) und alle offenen To-dos mit Fälligkeit vor heute („für ‹Element› · war fällig ‹Wochentag TT.MM.›“), nach Datum sortiert.
   - Danach Wochen (Mo–So) ab der aktuellen Woche: Meilensteine am Tag („Meilenstein · Mi 17.02.“), Vorgänge mit Start in der Woche („startet Mo 08.02. · 21 Tage“), sonst mit Ende in der Woche („endet Mi 17.02.“), in der **aktuellen** Woche zusätzlich laufende Vorgänge („läuft bis Mi 17.02.“), offene To-dos mit Fälligkeit in der Woche ab heute („für ‹Element› · fällig ‹Wochentag TT.MM.› · ‹Person›“). Elemente aus „Überfällig & Verzug“ erscheinen nicht nochmal.
   - Die aktuelle Woche wird immer gezeigt (leer: „Nichts fällig.“), weitere Wochen nur mit Einträgen, bis `weeks` Wochen erreicht sind oder die Woche des D-Day vorbei ist. Ergebnis enthält, ob es noch weitere Wochen gibt.
   - Filter `myGroupIds`: nur Elemente (und deren To-dos) aus diesen AKs; Elemente ohne AK nur ohne Filter.
   - Wochen-Überschrift: „Diese Woche“, „Nächste Woche“, sonst „KW n“, rechts „TT.MM.–TT.MM. · D-x“.
   - Tests: Wochengrenzen So/Mo, laufender Vorgang nur in der aktuellen Woche, überfälliges To-do, Filter mit und ohne AK, „weitere Wochen“.
7. **Komponente `PlanWeekList`** (`src/components/plan/plan-week-list.tsx`):
   - Oben Umschalter **„Alle | Meine AKs“** (Meine AKs = AK-Teilnahmen des angemeldeten Mitglieds aus 005; ohne Teilnahme Hinweis „Du bist noch in keinem AK – trag dich unter AKs ein.“ mit Link).
   - Einträge als Karten: links 4 px Statusstreifen, Name (fett), darunter „AK ‹Name› · Person · ‹Text›“, rechts `StatusPill` und Puffer („+5 T“, „0 T“, „−2 T“ in Verzug-Farbe). To-do-Einträge mit Vorsatz „Voraussetzung · “ bzw. „To-do · “ (je nach Anker `start` / `end`) und rechts „AK ‹Name›“.
   - Erst 6 Wochen, Knopf „Weitere Wochen“ lädt 6 weitere.
   - Antippen öffnet das Detail-Panel des Elements.
8. **Komponente `PlanDetail`** (`src/components/plan/plan-detail.tsx`), **nur lesen**:
   - Laptop: Panel rechts neben dem Gantt (380 px, klebt beim Scrollen), in der Liste ebenfalls rechts. Handy: Blatt von unten (max. 88 % Höhe, eigener Scroll, dunkler Hintergrund dahinter schließt beim Antippen). Schließen mit „×“ oder Escape.
   - Kopf: `StatusPill`, Puffer-Text („+n T Puffer“ / „0 T Puffer“ / „−n T Verzug“ bzw. „erledigt“), Name, darunter „AK ‹Name› · ‹Aufgabenbereich› · Meilenstein|Vorgang · ‹Person›“ (fehlende Teile entfallen).
   - **Termin:** Datum bzw. Start und Ende (Wochentag TT.MM.JJJJ und D-x), „Spätestens“, Hinweistext: bei Verzug „Liegt n Tage zu spät für die Nachfolger.“, bei Puffer „n Tage Luft bis zum spätesten Termin.“, sonst „Liegt auf dem spätesten Termin. Jede Verzögerung schiebt Nachfolger.“; bei Fixtermin „Fixtermin (extern festgelegt)“; bei `wobbly` „Wackelt (Einschätzung)“.
   - **To-dos & Voraussetzungen:** je To-do Haken-Symbol (nicht klickbar), Text, Person, Fälligkeit „Wochentag TT.MM. · n T vor Start|Ende“ bzw. „zum Start“; überfällig in Verzug-Farbe, erledigt durchgestrichen. Leer: „Noch keine.“
   - **Notizen:** neueste oben, „Name · Wochentag TT.MM.“ und Text (Zeilenumbrüche erhalten). Leer: „Noch keine.“
   - **Vorgänger** und **Nachfolger** mit Abstand („Finaler Crosscheck · 15 T Abstand“, „D-Day · 10 T Abstand“); Antippen eines Vorgängers/Nachfolgers wählt dieses Element.
   - Unten Hinweis: „Bearbeiten kommt mit dem nächsten Update.“
9. **Klicktest** `e2e/plan.spec.ts` ersetzen (Dev-Login als Kim Brenner, Seed-Daten, Prüfungen relativ und auf Namen bezogen; vorher `localStorage` leeren):
   - 1280 × 800: Navigation zeigt „Plan“; Gantt sichtbar mit Spur „AK Demo & Route“; „Heute“-Linie im sichtbaren Bereich
   - „Kooperationsgespräch KVR/Polizei“ antippen → Panel zeigt „Verzug“, „−2 T Verzug“, „Fixtermin“, Nachfolger „Finaler Crosscheck · 15 T Abstand“; Pfeile sind gezeichnet; Escape schließt
   - „Finaler Crosscheck“ → Panel zeigt das To-do „Rechtliches geprüft“ mit „Kim Brenner“ und mindestens eine Notiz
   - Filter „Kritischer Pfad“ → genau die sieben Elemente der Kette, „Schildermalen“ ist weg; Kopfzeile nennt D-150
   - „AK Demo & Route“ zuklappen → Elemente der Spur weg, Sammelbalken da; neu laden → bleibt zugeklappt; wieder aufklappen
   - Umschalter „Liste“ → Wochenliste sichtbar; neu laden → Liste bleibt; zurück auf „Gantt“
   - 375 × 812: Wochenliste statt Gantt, kein Umschalter; „Überfällig & Verzug“ enthält „Kooperationsgespräch KVR/Polizei“; „Meine AKs“ blendet „Budget KP27 beschlossen“ (AK Finanzen) aus; Eintrag antippen öffnet das Blatt; keine waagrechte Scrollleiste der Seite
   - Keine Konsolenfehler (wie bisher streng); nach Seitenwechseln `expectPageReady`
10. **Vitest** für `gantt-layout.ts` (siehe 2 und 6).

Auftrag 2 beginnt mit „Teil A ist bereits umgesetzt – ändere daran nichts“.

## Akzeptanzkriterien

- Startseite zeigt am Laptop den Gantt mit AK-Spuren, Balken, Rauten, Puffer, Zu-spät-Band, Fixtermin-Kontur, Heute- und D-Day-Linie, Sammelbalken; am Handy die Wochenliste; am Laptop umschaltbar
- Auswahl zeigt Pfeile zu Vorgängern und Nachfolgern und das Detail-Panel mit Termin, To-dos, Notizen, Vorgängern, Nachfolgern – nur lesend
- Filter „Kritischer Pfad“ zeigt die längste Kette aus der Engine; „Nur offene“ blendet Erledigtes aus
- Zoom, Ansicht und zugeklappte AKs bleiben pro Gerät erhalten; erster Render ohne Hydration-Fehler
- Navigation heißt „Plan“; production zeigt den leeren Zustand
- Keine neue Bibliothek, keine Rechnung und kein „heute“ im Browser
- Helles und dunkles Thema lesbar
- Vitest für `gantt-layout` grün; Klicktest `e2e/plan.spec.ts` und alle bisherigen grün bei 375 × 812 und 1280 × 800, gegen `pnpm dev` **und** gegen den lokalen Production-Build
- `pnpm typecheck`, `lint`, `test`, `build` grün

## Deploy

Keine DB-Änderung: `deploy`. Danach am Laptop und am iPhone: Navigation „Plan“, leerer Zustand „Noch kein Plan …“ in production.

## Abweichungen beim Bau

- `timeRange` bekommt den D-Day als dritten Wert (`timeRange(elements, today, dDay)`), weil der Montag vor dem Beginn nur mit dem Kalenderdatum bestimmt werden kann. Freigabe Franz.
- `src/components/plan/plan-gantt.tsx` importiert `src/lib` per relativem Pfad, weil Vitest den Kürzel `@/` nicht kennt (Render-Test). Freigabe Franz.
- Zeilenhöhe im Gantt 30 px (Element) / 34 px (Spur) statt 44 px Tippfläche, weil der Gantt erst ab 901 px Breite erscheint (Maus und Tastatur, am Handy die Wochenliste). Freigabe Franz.
- Die Filter „Kritischer Pfad“ und „Nur offene“ wirken auch auf die Wochenliste (sie bleiben am Handy sichtbar). Freigabe Franz.
- Die Startseite `/` darf am Laptop bis 1400 px breit werden, damit neben dem Detail-Panel genug Zeitachse bleibt; alle anderen Seiten behalten ihre Breite. Umgesetzt über `src/components/app-main.tsx` im Layout `(app)`. Freigabe Franz.
- Eine KW-Beschriftung, die unter dem Schild „Heute“ oder „D-Day“ läge, entfällt. Freigabe Franz.
- Im Gantt kein „· 0 T“ bei Puffer 0 (Freigabe Franz).
