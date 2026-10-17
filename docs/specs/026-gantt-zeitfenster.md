# SPEC 026 – Gantt mit Zeitfenstern

Freigabe Franz: ☑
Zweig: `spec/026-gantt-zeitfenster` · Risikoklasse B (reine Funktionen, Komponenten, KP27-Vorlage, Klicktest; das Risiko-Skript kann `src/db/kp27-template.ts` höher einstufen – erwartbar) · lokal, Teil A/B · DB: nein

Stand 17.10.2026 (Sitzung 16). Baut auf 025-zeitfenster-rechnung auf (live, PR #25). Vorbild: Test-Layout v5 „KP27 Zeitfenster-Test“ (Artifact, Version 1, https://claude.ai/artifact/Bbg33z5LVqP8p9Zr1QBLcL) mit den Regeln aus 025 („so spät“ folgt dem geplanten Nachfolger). Entscheidungen aus den Auswahlfragen vom 17.10.2026 (Sitzung 16, nach 025).

## Ziel

Seit 025 rechnet die App mit Zeitfenstern, Lagen und Luft – der Gantt zeigt davon aber noch nichts. 026 macht es sichtbar:

1. **Fenster-Bänder** hinter Balken und Rauten (frühestens bis spätestens), per Schalter „Fenster“ aus- und einblendbar.
2. **Pin** bei festen Terminen, **„Luft N T“** im Label statt „Puffer“.
3. **Rahmen für kritisch** (pink, durchgezogen) und **knapp** (pink, gestrichelt) im Gantt und in der Wochenliste.
4. **Erklärzeile** zum Filter „Kritisch & knapp“ und eine **Legende**, die zum neuen Modell passt.
5. **Ursache bei Folge-Verzug:** Das Panel nennt den Auslöser, z. B. „wegen Kooperationsgespräch KVR/Polizei (fester Termin zu spät)“.
6. **Wochenliste am Handy** mit Fenster und Luft je Karte.
7. **KP27-Vorlage** nach Franz' Beispielen (nur für künftige, leere Ausgaben).

Damit ist Feedback #1 („Was zeigt der kritische Pfad?“) vollständig gelöst.

## Entscheidungen (Auswahlfragen 17.10.2026)

- Fenster-Bänder: **Schalter „Fenster“, Standard an**, pro Gerät gemerkt
- Folge-Verzug: **Ursache im Panel** „– wegen ‹Element›“ mit Link
- Wochenliste am Handy: **Fenster + Luft** je Karte
- KP27-Vorlage: **wie Test-Layout v5** (Lagen, „Wagenreihung steht“ neu, Abstände nur wo inhaltlich nötig)
- Kritisch/knapp-Rahmen: **Gantt + Wochenliste**; `/meine` und AK-Arbeitsbereich bleiben ruhig
- Erklärzeile: **bei aktivem Filter**
- production-Plan wird **nach 026 von Hand per Checkliste** umgebaut (keine Spec, kein Skript)

## Nicht in dieser Spec

- Änderungen an der Rechnung aus 025 (`computePlan`, Lagen, Status-Regeln, Ziehen-Logik) – nur nutzen, Fehler melden statt umbauen
- Umbau des production-Plans (Checkliste nach dem Deploy)
- Datenbank, Seed-Inhalt (`TEST_PLAN`), Übernahme-Skript
- Rahmen kritisch/knapp in `/meine` oder im AK-Arbeitsbereich
- Anleitung in der App (020)
- Änderungen an `src/proxy.ts`, `src/auth.ts`, Login, Configs, `.github/`, `.claude/`, `scripts/`; neue Laufzeit-Pakete

## Vorab: Abgleich mit dem Code

Bevor du etwas änderst, prüfe den Stand nach 025 und berichte **hier im Chat**. Dann stoppen und auf „Weiter“ warten.

- `src/components/plan/plan-gantt.tsx` und `src/lib/gantt-layout.ts`: wie Balken, Rauten, Label („Daten · 3/10 · Puffer“), 3-px-Fortschrittsleiste, Puffer-Strich, Filter „Kritisch & knapp“, Kopfzeile und Legende gebaut sind; wo Zoom (px/Tag) und `kp-plan-*`-Merker liegen.
- `src/components/plan/plan-week-list.tsx` und `src/components/plan/element-card.tsx`: Aufbau der Karte, wo Status und Fortschritt stehen.
- `src/components/plan/plan-view.tsx`: Werkzeugleiste (Umschalter, Filter), wie Filter und Kopfzeile an Gantt und Wochenliste gehen.
- `src/lib/plan-status.ts` (`statusLabel`, `reasonText`) und welche Felder `reasonDetail` aus 025 heute enthält.
- `src/components/plan/plan-detail.tsx`: Kopf (Grund-Zeile) und wie zu einem anderen Element gesprungen wird (Links bei Vorgänger/Nachfolger).
- `src/db/kp27-template.ts`: Elemente (Namen, Art, Dauer, AK, Aufgabenbereich), Verbindungen, To-dos, Notizen; ob es ein To-do „Wagenreihung …“ bei „Programm fertig“ gibt; wie `seedPlan` die Vorlage liest und ob sich die Vorlage ohne Datenbank als Daten in einen Vitest laden lässt.
- Vorhandene CSS-Variablen für Status, `--gantt-lane`, `--progress-*`, `--hint-*`; ob es schon Variablen für Fenster oder Akzent-Rahmen gibt.

Wenn etwas grundlegend anders ist als hier beschrieben: Unterschied beschreiben, nichts umbauen. Vorschläge aus dem Abgleich setzt du nur um, wenn Franz sie im „Weiter“ ausdrücklich freigibt; vermerke sie dann unter „Abweichungen beim Bau“ mit „(von Franz freigegeben)“.

## Umsetzung

**Grundregeln**

- Rechnung und „heute“ weiter nur auf dem Server; Merker (`localStorage`) erst nach dem Laden, in `try/catch`.
- Farbe nie allein: Kritisch/knapp und Fest haben zusätzlich Text (sichtbar oder `sr-only`).
- Neue Farben als CSS-Variablen mit hell und dunkel (wie bestehende Status-Variablen).
- Keine neuen Texte mit „D-Day“/„D-N“.

### Teil A – Logik und Vorlage

1. **Ursache bei Folge-Verzug** in `src/lib/plan-engine.ts` (oder eigener Datei in `src/lib/`, relative Importe), reine Funktion `findCause(result, elements, links, id)` mit Vitest:
   - Nur für nicht erreichte Elemente mit Status `late` und Grund `no_window` oder `too_late`, sowie `warn`/`before_predecessor`.
   - Verfolgt die **bindenden** Verbindungen: auf der frühen Seite den Vorgänger, dessen frühestes Ende + Mindestabstand das eigene `earliestStart` bestimmt; auf der späten Seite den Nachfolger, dessen spätester Start − Mindestabstand das eigene `latestFinish` bestimmt; bei `before_predecessor` den genannten Vorgänger.
   - Ursache ist das **nächste** Element auf diesem Weg, das selbst einen eigenen Grund hat: Lage fest mit `fixed_too_late`/`fixed_unreachable`, `overdue`, `too_late` (frei zu spät gelegt) oder erreicht deutlich nach dem eigenen spätesten Termin. Elemente mit `no_window` werden durchlaufen, nicht als Ursache genannt. Jedes Element höchstens einmal; nichts gefunden → keine Ursache.
   - Rückgabe `{ elementId, kind }` mit `kind` aus `fixed_late` · `overdue` · `placed_late` · `done_late`.
   - Tests: dev-Seed-Fall (Finaler Crosscheck und beide Briefings → Ursache Kooperationsgespräch KVR/Polizei, `fixed_late`); Beispiel aus 025 „Zusage fest 150“ (Auswahlkommission → Finale Zusage, `fixed_late`); „T-Shirt frei −30“ (Wagenpakete → T-Shirt-Bestellung, `placed_late`); „heute −137“ (Vortreffen → Voranmeldung, `overdue`); Element ohne Verzug → keine Ursache; Kreisfreiheit (Abbruch bei bereits besuchtem Element).
2. **Texte** in `src/lib/plan-status.ts` (Vitest):
   - `causeText(cause, name)` → „wegen ‹Name› (fester Termin zu spät)“ · „(überfällig)“ · „(zu spät gelegt)“ · „(spät erreicht)“.
   - `windowText(result)` für Wochenliste und Label: offen „Fenster 17.02.–19.03. · Luft 50 T“ bzw. „· keine Luft“; fest „fest · 60 T vorher“ bzw. „festes Datum“; erreicht „Erreicht am Mi 17.02.“. Datum über die vorhandenen Helfer, geschütztes Leerzeichen wie in 013.
   - `barLabel(result)` für den Gantt: „17.02.–19.03. · Luft 50 T · 3/5“, Meilenstein „24.02. · Luft 70 T“, fest „09.03. · fest · 60 T vorher“, erreicht „17.02. · erreicht“; „keine Luft“ statt „Luft 0 T“; x/y To-dos wie bisher angehängt.
3. **KP27-Vorlage** `src/db/kp27-template.ts` nach Test-Layout v5 (nur für künftige, leere Ausgaben; production hat einen Plan und bekommt nichts). Namen, Art, Dauer, AK, Aufgabenbereich, To-dos und Notizen bleiben, außer wie hier beschrieben:
   - **Neu:** Meilenstein „Wagenreihung steht“ (AK Programm, Aufgabenbereich wie „Programm fertig“, so spät). Gibt es bei „Programm fertig“ ein To-do zur Wagenreihung, entfällt es (im Abgleich nennen).
   - **Zahlungsfrist Kollektive:** Vorgang mit **30 Tagen** Dauer.
   - **Lagen:** fest N T vorher: Pressemitteilung Vorbericht 60 · Finale Zusage an Kollektive 80 · Briefing Abschnittsleitungen 14 · Gesamtbriefing Wagenverantwortliche 10 · Finales Vortreffen (Zoom) 3 · Soundkopplung · Termin 3 3. So früh: Zahlungsfrist Kollektive · Soundkopplung · Termin 1. Frei: Schildermalen −34 · Soundkopplung · Termin 2 −28 · T-Shirt-Bestellung −49. Alle anderen so spät.
   - **Verbindungen** (mind. N T; „Krachparade“ = Ziel leer), ersetzen die bisherigen vollständig:
     - Voranmeldung geöffnet → Vortreffen Kollektive (20) → Anmeldung offen (7) → Auswahlkommission (0) → Finale Zusage an Kollektive (0)
     - Finale Zusage → Zahlungsfrist Kollektive (0) · Soundkopplung · Termin 1 (7) · Wagenreihung steht (0)
     - Zahlungsfrist Kollektive → Krachparade (0)
     - Soundkopplung · Termin 1 → Termin 2 (0) → Termin 3 (0) → Krachparade (0)
     - Pressemitteilung Vorbericht → PR fertig (0) → Finaler Crosscheck (0)
     - Schildermalen → Krachparade (0)
     - Wagenreihung steht → Wagenpakete packen (0) · Programm fertig (0); Programm fertig → Finaler Crosscheck (0)
     - T-Shirt-Bestellung → Wagenpakete packen (21); Wagenpakete packen → Gesamtbriefing Wagenverantwortliche (0)
     - Rechtliches fertig · Sicherheitskonzept fertig · Logistik fertig → Finaler Crosscheck (je 0); Finaler Planungscheck → Finaler Crosscheck (7)
     - Finaler Crosscheck → Briefing Abschnittsleitungen (3) → Gesamtbriefing Wagenverantwortliche (4) → Krachparade (0)
     - Finales Vortreffen (Zoom) → Krachparade (0)
   - Notizen mit Learnings bleiben; bei „Zahlungsfrist Kollektive“, „Soundkopplung · Termin 2“, „Schildermalen“, „Wagenpakete packen“ und „Wagenreihung steht“ je eine kurze Notiz wie im Test-Layout v5 ergänzen (ohne Namen).
   - **Vitest** `src/db/kp27-template.test.ts` (ohne Datenbank, relative Importe): Vorlage durch `computePlan` mit Krachparade 08.05.2027 und heute 17.10.2026 → keine Kreise, **kein Element `late` oder `warn`**, nichts kritisch, nichts knapp; Voranmeldung geöffnet 21.12.2026; Finale Zusage 17.02.2027; Zahlungsfrist 17.02.–19.03.2027 (Luft 50); Soundkopplung · Termin 1 24.02.2027 (Luft 70); Wagenpakete packen 24.04.–28.04.2027; Briefing Abschnittsleitungen 24.04.2027; Gesamtbriefing 28.04.2027. Liegt die Vorlage nur als DB-Schreibcode vor, die Daten im Abgleich als exportierte Konstante vorschlagen.

Auftrag 1 endet mit „setze NUR Teil A um“. Teil A committen, nicht pushen.

### Teil B – Gantt, Wochenliste, Panel, Klicktest

4. **Fenster-Bänder im Gantt:** je offenem, nicht festem Element ein Band von `earliestStart` bis `latestFinish` hinter Balken/Raute (Optik wie Test-Layout v5: helle grüne Fläche, gestrichelter Rand; neue Variablen `--window`, `--window-edge` hell/dunkel), `aria-hidden`. Kein Band bei erreichten und festen Elementen. Bei „kein Fenster“ (frühestens > spätestens) kein Band. Schalter **„Fenster“** in der Werkzeugleiste (`aria-pressed`, Standard an, Merker `kp-plan-windows`). Der bisherige helle Puffer-Strich entfällt.
5. **Balken und Rauten:** Label über `barLabel`; feste Termine mit **Pin** (kleines SVG, `currentColor`, `sr-only` „fest“) vor dem Datum; **kritisch** = 2 px pinker Rahmen (`--accent`), **knapp** = 2 px pink gestrichelt, jeweils mit `sr-only` „kritisch“/„knapp“ im Label. Fortschrittsleiste und Status-Farben bleiben.
6. **Filter „Kritisch & knapp“** (aus 025) bekommt bei aktivem Filter die **Erklärzeile** in der Hinweisfläche über dem Gantt bzw. der Wochenliste: „**Kritisch** heißt keine Luft: Das Fenster ist nicht größer als das Element selbst. Wird es später fertig, ist etwas danach zu spät. **Knapp** heißt höchstens 7 Tage Luft.“ Ist nichts kritisch oder knapp: zusätzlich „Gerade hat alles noch Luft. Mit jedem Tag rückt „frühestens“ näher, die Fenster schrumpfen.“
7. **Legende** (unter der Werkzeugleiste, wie Test-Layout v5): Zeitfenster · On track · Erreicht · Wackelt / Zu früh · Verzug · Pin = fest · Rahmen = kritisch · gestrichelt = knapp · Linien Heute/Krachparade. Am Handy zusammenklappbar oder in einer Zeile umbrechend, nie waagrecht scrollend.
8. **Hinweis unter dem Gantt** (klein, gedämpft): „Antippen zeigt Abhängigkeiten und Details. Ziehen legt den Termin selbst fest (Lage „Frei im Fenster“); bei festen Terminen ändert es die Tage vor der Krachparade.“ Am Handy: „Antippen öffnet Details und Lage.“
9. **Wochenliste** (Laptop und Handy): je Karte unter der bisherigen Zeile `windowText` (mit Pin bei fest); kritisch/knapp als Rahmen wie im Gantt **plus** sichtbares Wort „kritisch“ bzw. „knapp“ in der Meta-Zeile. Abhaken, Fortschritt und „Als erreicht markieren?“ bleiben.
10. **Panel/Blatt:** Bei `late`/`warn` mit Ursache steht unter dem Grund „– wegen ‹Name› (…)“ über `causeText`; ‹Name› ist ein Link/Knopf, der dieses Element öffnet (wie die Links bei Vorgänger/Nachfolger).
11. **Klicktest** `e2e/gantt-zeitfenster.spec.ts` (Dev-Login als Kim Brenner; Seed-Elemente nur lesen, eigene „E2E …“-Elemente anlegen und am Ende löschen; `expectPageReady`):
    - 1280 × 800: Schalter „Fenster“ ist an; ein eigenes „so spät“-Element mit Vorgänger hat ein Band; Schalter aus → keine Bänder, nach Neuladen weiter aus; wieder an.
    - Eigenes Element auf „Fest · Tage vor der Krachparade“ → Label mit Pin und „fest · N T vorher“, kein Band.
    - „Finaler Crosscheck“ (Seed) öffnen → Status Verzug, Ursache „wegen Kooperationsgespräch KVR/Polizei (fester Termin zu spät)“; Klick auf den Namen öffnet das Kooperationsgespräch.
    - Filter „Kritisch & knapp“ an → Erklärzeile sichtbar; Elemente mit Rahmen tragen „kritisch“ bzw. „knapp“ (im Label per `sr-only`).
    - Legende enthält „Zeitfenster“, „fest“, „kritisch“, „knapp“.
    - 375 × 812: Wochenliste zeigt bei einem eigenen Element „Fenster … · Luft …“; ein kritisches Seed-Element zeigt sichtbar „kritisch“; keine waagrechte Scrollleiste.
    - Bestehende Klicktests anpassen, nicht löschen (`plan.spec.ts` u. a. bei „Puffer“-Texten im Label); alles andere melden.
12. **Neuigkeiten-Eintrag** (unten) als neuester Eintrag in `src/lib/news/entries.ts`.

Auftrag 2 beginnt mit „Teil A ist bereits umgesetzt – ändere daran nichts“.

## Akzeptanzkriterien

1. Fenster-Bänder für offene, nicht feste Elemente; Schalter „Fenster“ mit Merker; kein Puffer-Strich mehr.
2. Labels mit „Luft N T“ / „keine Luft“ / Pin und „fest · N T vorher“ / „erreicht“; kritisch/knapp-Rahmen mit Text für Screenreader.
3. Erklärzeile bei aktivem Filter, inkl. Text für „nichts kritisch“; Legende passend zum Modell; Hinweis unter dem Gantt.
4. Wochenliste mit `windowText` und sichtbarem „kritisch“/„knapp“; `/meine` und AK-Arbeitsbereich unverändert.
5. Panel nennt bei Folge-Verzug die Ursache mit Sprung zum Element; `findCause` mit Vitest (alle Fälle oben).
6. KP27-Vorlage nach Test-Layout v5; Vitest: nichts im Verzug, nichts zu früh, nichts kritisch/knapp, Erwartungsdaten stimmen; production unverändert.
7. Hell und dunkel lesbar; geprüft bei 375 × 812 und 1280 × 800; keine waagrechte Scrollleiste; keine Hydration-Warnungen; keine Konsolenfehler.
8. Keine neuen Texte mit „D-Day“/„D-N“.
9. Vitest grün; Klicktest `e2e/gantt-zeitfenster.spec.ts` und alle bisherigen grün, gegen `pnpm dev` **und** gegen den lokalen Production-Build (Port 3100).
10. `pnpm typecheck`, `lint`, `test`, `build` grün.

## Deploy

Keine DB-Änderung. Vorher lokal durchklicken (Chrome, Laptop und Geräteansicht: Bänder, Schalter, Pin, Filter mit Erklärzeile, Ursache beim Crosscheck). `deploy` → merged nach grünen Prüfungen automatisch. Danach Live-Check am iPhone (Wochenliste) und am Laptop (Gantt), dann Checkliste „Plan umbauen“ für production.

## Neuigkeiten

**Titel:** Zeitfenster im Gantt

- Hinter jedem Balken zeigt ein **helles Band** das Zeitfenster von frühestens bis spätestens. Über „Fenster“ blendest du die Bänder aus und ein.
- Im Label steht jetzt die **Luft**, feste Termine haben einen **Pin**.
- **Kritisch** (keine Luft) hat einen pinken Rahmen, **knapp** (höchstens 7 Tage) einen gestrichelten – im Gantt und in der Wochenliste. Der Filter „Kritisch & knapp“ erklärt, was das heißt.
- Ist etwas nur im Verzug, weil davor etwas klemmt, nennt das Element jetzt die **Ursache** – ein Tipp darauf führt direkt hin.

## Abweichungen beim Bau

(von Claude Code zu ergänzen; nie den Freigabe-Haken hier eintragen)

Teil A:

- **E1 (von Franz freigegeben):** `src/db/seed.ts` – Vorlagen-Typ `PlanTemplateElement` hat neu `fixedOffsetDays?: number`; `seedPlan` schreibt `fixed_offset_days` mit, ohne `placement` gilt „fest“ bei `fixedDate` oder `fixedOffsetDays` (Helfer `templatePlacement`). Kein anderer Seed-Inhalt, `TEST_PLAN` unverändert.
- **E2 (von Franz freigegeben):** `windowText` zeigt das echte Fenster von `earliestStart` bis `latestFinish` (wie die Bänder), ohne Fenster „kein Fenster mehr“. Das Beispiel oben ist damit korrigiert: Zahlungsfrist „Fenster 17.02.–08.05. · Luft 50 T“.
- **E3 (von Franz freigegeben):** `windowText(result, element, dDay)` und `barLabel(result, element, dDay, progress)` bekommen zusätzlich Element und Datum der Krachparade; festes Datum im Label „09.03. · fest“, in `windowText` „festes Datum“.
- **E4 (von Franz freigegeben):** `findCause` steht in `src/lib/plan-cause.ts`, als Breitensuche nach Abstand über beide Seiten gleichzeitig (Vorgänger, die den frühesten Start bestimmen; Nachfolger, die den spätesten Termin bestimmen; jeweils in derselben Richtung weiter), bei gleichem Abstand die frühe Seite zuerst. Bei `too_late` und `before_predecessor` zählen auf der frühen Seite die geplanten Enden der Vorgänger. „Spät erreicht“ = mindestens 1 Tag nach dem spätesten Ende, das die Nachfolger brauchen.
- KP27-Vorlage: To-do „Wagenreihung“ bei „Programm fertig“ entfällt (33 → 32 To-dos); „Wagenreihung steht“ ohne Aufgabenbereich, weil „Programm fertig“ keinen hat. 24 Elemente, 27 Verbindungen, 15 Notizen (Notiz-Texte von Franz vorgegeben). Der alte Vorlagen-Test (Stand Spec 010/025) ist durch die Erwartungen aus 026 ersetzt.
- Zusätzlicher `findCause`-Testfall „spät erreicht“ (Voranmeldung am −130 erreicht, heute −125).

Teil B:

- Die Ursache rechnet der Server (`loadPlanView` → Feld `cause` am Element), das Panel zeigt sie nur an.
- Gantt: Das SVG ist für Screenreader ein Bild („Gantt-Plan“), `sr-only` wirkt darin nicht. „fest“, „kritisch“ und „knapp“ stehen deshalb im `<title>` des Elements (zugleich Tooltip). In der Wochenliste sind es echte Texte.
- Gantt: Die rote Fläche „zu spät“ (Ende nach dem spätesten Ende) und der dunkle Rand fester, nicht kritischer Termine bleiben. Die Legende nennt nur die Punkte aus der Spec.
- Die Zieh-Vorschau (`previewPlan`) liefert zusätzlich Fenster, Luft, kritisch/knapp und Lage, damit Band und Label beim Ziehen mitgehen.
- Die Legende steht unter der Werkzeugleiste in beiden Ansichten und am Handy (bricht um).
- Die Wochen-Karte zeigt rechts weiter den bisherigen Puffer („−2 T“, „0 T“). Dieselbe Karte nutzt auch der AK-Arbeitsbereich, der ruhig bleiben soll. Offen für Franz.
- Tests: `news.test.ts` erwartet jetzt den Eintrag 026 als neuesten. In `plan-bearbeiten.spec.ts` prüft der Ziehen-Schritt statt „+5 T“, dass sich das Label ändert und nach „Rückgängig“ wieder stimmt. Die Testdaten in `plan-gantt.test.tsx` haben die Fenster-Felder bekommen.
- `--gantt-buffer` ist ungenutzt, aber stehen geblieben.
