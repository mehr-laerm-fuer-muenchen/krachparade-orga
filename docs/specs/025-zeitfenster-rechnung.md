# SPEC 025 – Zeitfenster-Rechnung

Freigabe Franz: ☑
Zweig: `spec/025-zeitfenster-rechnung` · Risikoklasse C (Übernahme-Skript in `scripts/`, Einträge in `package.json`; fachlich B) · lokal, Teil A/B, Auto-Modus aus · DB: ja: neue Spalten `plan_elements.placement`, `plan_elements.fixed_offset_days`, `plan_elements.free_start_day` + einmalige Daten-Übernahme per Skript

Stand 17.10.2026 (Sitzung 16). Baut auf 006 (Engine), 008 (Bearbeiten), 010 (KP27-Vorlage), 016–018, 023, 024 auf, alle live. Vorbild: Test-Layout v5 „KP27 Zeitfenster-Test“ (Artifact, Version 1, abgenommen 17.10.2026) mit den Abweichungen aus den Auswahlfragen vom 17.10.2026 (unten unter „Entscheidungen“). Plan und Spec-Schnitt: `claude/025-gantt-umstellung-plan.md`. Danach folgt 026-gantt-zeitfenster (Optik im Gantt).

## Ziel

Die Plan-Rechnung kennt bisher nur den spätesten Termin: Jedes Element liegt darauf, nichts hat Luft, Abstände wirken fest, und der „kritische Pfad“ zeigt nur die früheste Kette. Ab 025 hat jedes Element ein **Zeitfenster** (frühestens–spätestens) und eine **Lage**, die festlegt, wo es im Fenster liegt. Abstände zwischen Elementen sind **Mindestabstände**. Daraus ergeben sich **Luft**, die neuen Status **„Zu früh“** und genauere **Verzug**-Gründe sowie die Kennzeichen **kritisch** (keine Luft) und **knapp** (höchstens 7 T Luft).

Teil A baut Datenmodell, Rechnung, Bearbeiten-Logik und die Übernahme der bestehenden Daten. Teil B macht es im Detail-Panel (Laptop) bzw. Blatt (Handy) bedienbar und stellt die Status-Texte überall um. Der Gantt behält bis 026 seine Optik, rechnet aber neu.

**Nach dem Deploy sehen alle offenen Termine in production genauso aus wie vorher.** Einzige sichtbare Verschiebung: Erreichte Elemente stehen am Tag, an dem sie abgehakt wurden.

## Entscheidungen (Auswahlfragen 17.10.2026)

- **Vier Lagen** mit diesen Namen: **Fest** · **So früh wie möglich** · **So spät wie möglich** · **Frei im Fenster**
- **Fest** in zwei Varianten: **„N Tage vor der Krachparade“** (wandert mit dem Datum der Ausgabe) und **„festes Datum“** (= bisheriger Fixtermin, bleibt stehen). N bezieht sich bei Vorgängen auf den **Start**, genau wie das feste Datum.
- **Frühestens ohne Vorgänger = heute**; kein eigenes Feld „frühestens ab“.
- **Knapp** = höchstens **7 T** Luft.
- **Übernahme:** alles „So spät wie möglich“, Fixtermine → „Fest, festes Datum“, von Hand verschobene → „Frei im Fenster“ auf ihrem bisherigen Termin. Abstände werden Mindestabstände. Offene Termine bleiben gleich.
- **Erreichte Elemente sind eingefroren:** Ihr Ende liegt auf dem Tag, an dem sie abgehakt wurden; Nachfolger rechnen ab dort. „Heute“ zählt für sie nicht mehr.
- **„Zu früh“** ist ein eigener gelber Status (gleiche Farbe wie „Wackelt“), nicht Verzug.
- **Neue Verbindungen** haben standardmäßig **mind. 0 T** (= nur Reihenfolge).
- **„So spät wie möglich“ richtet sich nach dem geplanten Start der Nachfolger** (nie später als der eigene späteste Termin). Wird ein Nachfolger früher gelegt, rücken solche Vorgänger mit. *Abweichung vom Test-Layout v5, von Franz entschieden.*
- **Ziehen-Logik schon in 025:** Ziehen, Ränder ziehen und „−/+ T“ stellen die Lage auf „Frei im Fenster“ (bei „Fest“ ändern sie N bzw. das Datum) und schieben nur Nachbarn mit Lage „Frei im Fenster“, wenn sonst die Reihenfolge verletzt wäre. Fenster-Bänder, Pin, Ringe und Erklärzeile im Gantt kommen mit 026.

## Nicht in dieser Spec

- Gantt-Optik: Fenster-Bänder, Pin bei festen Terminen, „Luft“ im Balken-Label, kritisch/knapp-Ringe, Erklärzeile zum Filter, Wochenliste am Handy mit Fenster/Luft (026)
- Inhaltlicher Umbau der KP27-Vorlage `src/db/kp27-template.ts` nach dem neuen Modell (026) – in 025 nur so angepasst, dass sie gültige Zeilen anlegt
- Umbau des production-Plans nach Franz' Beispielen (Checkliste nach 026, keine Spec)
- Feld „frühestens ab“ je Element
- Löschen der Altspalte `shift_days` (bleibt stehen, wird nicht mehr gelesen; kein `DROP`)
- Anleitung in der App (020)
- Änderungen an `src/proxy.ts`, `src/auth.ts`, Login, `.github/`, `.claude/`, `AGENTS.md`; neue Laufzeit-Pakete

## Vorab: Abgleich mit dem Code

Bevor du etwas änderst, prüfe den aktuellen Stand und berichte **hier im Chat**. Dann stoppen und auf „Weiter“ warten.

- `src/lib/plan-engine.ts`: Signaturen und Rückgabe-Felder von `computePlan`, `moveElement`, `resizeFromEnd`, `resizeFromStart`, `wouldCreateCycle`, `todoDueDay`, `PlanCycleError`; welche Felder (`buffer`, `criticalPath`, `latestProjectStart`, `reason`-Codes) wo gelesen werden – **alle Aufrufer** mit Datei auflisten (Gantt, Wochenliste, Panel/Blatt, `/meine`, AK-Arbeitsbereich und -Übersicht, `gantt-layout.ts`, `my-tasks.ts`, `ak-workspace.ts`, Kopfzeile/Filter der Startseite, Klicktests).
- `src/db/plan.ts` (`loadPlan`, `loadElementContext`, `loadPlanDetails`): wie `fixed_date`, `shift_days`, `done`, `done_at` in Engine-Eingaben umgerechnet werden; wie „heute“ und das Datum der Ausgabe hineinkommen.
- `src/actions/plan.ts`: `moveElement`, `resizeElement`, `undoPlanChange` (welche Spalten werden zurückgesetzt?), `resetShift`, `setFixedDate`, `setDone`, `addLink`, `updateLinkLag`, `createElement`; wo `changeSummaries` (`src/lib/plan-edit.ts`) aufgerufen wird.
- `src/lib/todo-due.ts` und alle Stellen, die `todoDueDay` nutzen.
- Panel/Blatt `src/components/plan/plan-detail.tsx`: Aufbau der Abschnitte „Termin“, „Element“ (Fixtermin-Schalter), „Vorgänger/Nachfolger“ (Abstands-Feld), Kurzformular „+ Element“.
- `StatusPill` und alle Stellen mit Status-Texten oder Zählungen nach Status (z. B. Lage-Pills „Verzug/wackelt“ auf AK-Karten, „Überfällig & Verzug“ in Wochenliste und `/meine`).
- `src/db/seed.ts` (`TEST_PLAN`, `SEED_VERSION` = 9, Anlege-Funktion für `TEST_PLAN` und KP27-Vorlage), `db:reset:dev`.
- Wie die bestehenden `:prod`-Skripte in `package.json` die Datenbank-Adresse wählen (`DATABASE_URL_PROD` aus `.env.local`) und wie `scripts/` aufgebaut ist.
- Wie `todayInBerlin` aus einem Zeitstempel (`done_at`) den Kalendertag in Berlin bildet.
- Gibt es in der dev-Datenbank Elemente mit `done = true` und `done_at` leer? (nur Anzahl)

Wenn etwas grundlegend anders ist als hier beschrieben: Unterschied beschreiben, nichts umbauen. Bestehende Helfer nutzen, keine zweiten bauen. Vorschläge aus dem Abgleich setzt du nur um, wenn Franz sie im „Weiter“ ausdrücklich freigibt; vermerke sie dann in dieser Spec unter „Abweichungen beim Bau“ mit „(von Franz freigegeben)“.

## Begriffe und Rechenregeln

Alle Tage sind Kalendertage relativ zur Krachparade (`0` = Krachparade, `-80` = 80 Tage vorher), wie bisher. Die Krachparade ist kein Plan-Element (Verbindung mit `toElementId = null`).

**Lage** (`placement`):

| Wert | Oberfläche | Geplanter Start |
|---|---|---|
| `fixed` | Fest | `-fixedOffsetDays` (Variante „N Tage vor der Krachparade“) **oder** `fixedDay` (Variante „festes Datum“) |
| `asap` | So früh wie möglich | Ohne Vorgänger: heute. Mit Vorgängern: Maximum über alle Vorgänger von (geplantes Ende des Vorgängers + Mindestabstand) |
| `alap` | So spät wie möglich | Ende = Minimum über alle Nachfolger von (Bezug − Mindestabstand); Krachparade: Bezug 0. Bezug eines Nachfolgers mit Lage `asap` = dessen spätester Start; sonst min(dessen geplanter Start, dessen spätester Start). Start = Ende − Dauer |
| `free` | Frei im Fenster | `freeStartDay` (relativ zur Krachparade, wandert mit dem Datum der Ausgabe) |

**Erreicht** (`done`): Ende = Kalendertag (Berlin) von `done_at` relativ zur Krachparade (`doneDay`), Start = Ende − Dauer. Gilt vor jeder Lage. Frühestens = spätestens = dieser Start.

**Zeitfenster:**

- **Spätestens** (Rückwärtsrechnung, umgekehrte topologische Reihenfolge): `latestFinish` = Minimum über alle ausgehenden Verbindungen von (spätester Start des Nachfolgers − Mindestabstand), Krachparade = 0, ohne ausgehende Verbindung 0. `latestStart` = `latestFinish` − Dauer. Bei `fixed`: `latestStart` = fester Start (der berechnete Wert wird nur für den Konflikt gemerkt). Bei erreichten: eingefrorener Start.
- **Frühestens** (Vorwärtsrechnung, topologische Reihenfolge): `earliestPred` = Maximum über alle Vorgänger von (frühestes Ende + Mindestabstand), ohne Vorgänger −∞. `earliestStart` = max(heute, `earliestPred`). Ausnahmen: `fixed` → fester Start; erreicht → eingefrorener Start; **laufend** (nicht erreicht, geplanter Start < heute ≤ geplantes Ende) → geplanter Start. `earliestFinish` = `earliestStart` + Dauer.
- **Luft** (`slack`) = `latestStart` − `earliestStart`. Bei `fixed` und erreichten nicht angezeigt.
- **`buffer`** (bleibt für den Gantt bis 026, gleiche Bedeutung wie bisher) = `latestStart` − geplanter Start.

**Reihenfolge der Rechnung** (so gibt es keinen Kreis zwischen „früh“ und „spät“):

1. Rückwärts: `latestStart`/`latestFinish` für alle.
2. Rückwärts: geplanter Start für `fixed`, `free`, erreichte und `alap` (braucht nur Nachfolger aus Schritt 1/2).
3. Vorwärts: geplanter Start für `asap`, dann je Element „laufend“, `earliestStart`, `earliestFinish`.
4. Status, Grund, kritisch, knapp.

**Status und Grund** (erste passende Zeile gewinnt):

| # | Bedingung | `status` | `reason` | Text im Panel |
|---|---|---|---|---|
| 1 | erreicht | `done` | `done` | Erreicht am ‹Wt TT.MM.› |
| 2 | `fixed` und `earliestPred` > fester Start | `late` | `fixed_unreachable` | Vorgänger werden frühestens ‹Wt TT.MM.› fertig – zu spät für den festen Termin |
| 3 | `fixed` und fester Start > berechneter spätester Start | `late` | `fixed_too_late` | Nachfolger brauchen es spätestens ‹Wt TT.MM.› – der feste Termin ist zu spät |
| 4 | geplantes Ende < heute | `late` | `overdue` | Überfällig seit ‹Wt TT.MM.› |
| 5 | `earliestStart` > `latestStart` | `late` | `no_window` | Kein Fenster mehr: frühestens ‹…›, spätestens ‹…› |
| 6 | geplanter Start > `latestStart` | `late` | `too_late` | Zu spät geplant: N Tage nach dem spätesten Start |
| 7 | geplanter Start < `earliestStart` | `warn` | `too_early` | Zu früh geplant: frühestens ‹Wt TT.MM.› |
| 8 | nicht `fixed` und ein Vorgänger endet (+ Mindestabstand) nach dem geplanten Start | `warn` | `before_predecessor` | Liegt vor dem Ende von ‹Name› (mind. N T danach) |
| 9 | `wobbly` | `warn` | `wobbly` | Wackelt (Einschätzung) |
| 10 | sonst | `ok` | `ok` | – |

Status-Namen in der Oberfläche: `done` Erreicht · `ok` On track · `warn` mit `wobbly` **Wackelt**, mit `too_early`/`before_predecessor` **Zu früh** · `late` **Verzug**. Laufende Elemente bekommen im Panel zusätzlich „läuft seit ‹Wt TT.MM.›“.

**Kritisch** = nicht erreicht und (bei `fixed`: Status `late`; sonst: Luft ≤ 0 oder Status `late`). **Knapp** = nicht kritisch, nicht erreicht, nicht `fixed`, 0 < Luft ≤ 7. Die Grenze 7 als benannte Konstante `TIGHT_SLACK_DAYS`.

## Umsetzung

### Teil A – Datenmodell, Rechnung, Bearbeiten-Logik, Übernahme

1. **Schema** `src/db/schema.ts` (nur hinzufügend), Tabelle `plan_elements`:
   - `placement` text, Pflicht, Standard `'alap'`, CHECK `plan_elements_placement`: `fixed`, `asap`, `alap`, `free`
   - `fixed_offset_days` int, leer erlaubt, CHECK `plan_elements_fixed_offset`: 0 bis 365
   - `free_start_day` int, leer erlaubt, CHECK `plan_elements_free_start`: −730 bis 0
   - `shift_days` bleibt unverändert stehen, wird ab 025 nirgends mehr gelesen. Jede Änderung der Lage setzt es auf 0.
   - Keine Regel über mehrere Spalten in der DB (sonst scheitert `db:push` vor der Übernahme); die Gültigkeit sichern Zod und die Actions: `fixed` braucht genau eins von `fixed_offset_days`/`fixed_date`, `free` braucht `free_start_day`, bei allen anderen Lagen sind die drei leer.
2. **Engine** `src/lib/plan-engine.ts` (reine Funktionen, keine DB, relative Importe):
   - Eingabe je Element: `{ id, name, kind, durationDays, placement, fixedDay | null, fixedOffsetDays | null, freeStartDay | null, done, doneDay | null, wobbly, sortOrder }`; Verbindungen `{ fromId, toId | null, minDays }` (bisher `lagDays` – Name im Code nach Abgleich, DB-Spalte `lag_days` bleibt); `today`.
   - Ungültige Kombination (z. B. `fixed` ohne beide Werte, `free` ohne Start) → wie `alap` rechnen, keine Ausnahme werfen (Vitest).
   - `computePlan(elements, links, today)` liefert je Element: `earliestStart`, `earliestFinish`, `latestStart`, `latestFinish`, `plannedStart`, `plannedEnd`, `slack`, `buffer`, `running`, `status`, `reason`, `reasonDetail` (Tage/Element-ID für die Texte), `critical`, `tight`. Für die Ausgabe: `counts` `{ critical, tight, late, warn }`.
   - `criticalPath` und `latestProjectStart` entfallen; alle Aufrufer (siehe Abgleich) umstellen.
   - `wouldCreateCycle`, `PlanCycleError` unverändert.
   - `todoDueDay` unverändert in der Bedeutung (nutzt den neuen geplanten Start/das neue Ende).
   - Konstante `TIGHT_SLACK_DAYS = 7`.
3. **Bearbeiten als reine Funktionen** in `src/lib/plan-engine.ts`. Jede liefert nur geänderte Werte `{ id, placement?, fixedOffsetDays?, fixedDay?, freeStartDay?, durationDays? }[]`; erreichte Elemente werden nie geändert (leere Liste, wenn das Ziel erreicht ist):
   - `moveElement(plan, id, delta)`: Lage `fixed` mit N → `fixedOffsetDays` = N − delta (Grenzen 0–365); `fixed` mit Datum → `fixedDay` + delta; sonst → `placement: 'free'`, `freeStartDay` = geplanter Start + delta, höchstens −Dauer (Ende nie nach der Krachparade). Danach **Schieben**.
   - `resizeFromEnd(plan, id, delta)`: nur Vorgänge; Dauer = max(1, min(365, Dauer + delta)); Start bleibt: bei `fixed` nur Dauer, sonst `placement: 'free'` mit `freeStartDay` = bisheriger geplanter Start. Danach Schieben.
   - `resizeFromStart(plan, id, delta)`: nur Vorgänge; Dauer = max(1, min(365, Dauer − delta)); Ende bleibt: neuer Start = bisheriges Ende − neue Dauer; bei `fixed` N bzw. Datum entsprechend, sonst `placement: 'free'` mit diesem Start. Danach Schieben.
   - Meilensteine: `resizeFrom…` → leere Liste.
   - **Schieben** (`pushFreeNeighbours`, intern): Nur Nachbarn mit Lage `free`, nicht erreicht. Vorgänger P: endet P (+ Mindestabstand) nach dem neuen Start → P neu = neuer Start − Mindestabstand − Dauer(P). Nachfolger S: beginnt S vor neuem Ende + Mindestabstand → S neu = min(neues Ende + Mindestabstand, −Dauer(S)). Weiter von P bzw. S aus (transitiv), jedes Element höchstens einmal. Andere Lagen werden nie geschoben, sie folgen über die Rechnung.
   - `setPlacementValues(plan, id, placement, variant?)` (für die Action): `fixed` + `offset` → N = −geplanter Start (0–365); `fixed` + `date` → `fixedDay` = geplanter Start; `free` → `freeStartDay` = geplanter Start; `asap`/`alap` → alle drei leer.
4. **Vitest** `src/lib/plan-engine.test.ts` neu aufgebaut (alte Fälle zum kritischen Pfad und zu `shiftDays` entfallen, die übrigen auf das neue Modell umschreiben) plus **`src/lib/plan-engine.examples.test.ts`** mit **Franz' Beispielen**. Testdaten „KP27 Beispiele“ (nur Plan-Namen, keine Personen), Krachparade 08.05.2027, heute = −203 (17.10.2026):

   | Element | Art/Dauer | Lage | Verbindungen (mind.) |
   |---|---|---|---|
   | Voranmeldung geöffnet | Meilenstein | so spät | → Vortreffen Kollektive (20) |
   | Vortreffen Kollektive | Meilenstein | so spät | → Anmeldung offen (7) |
   | Anmeldung offen | Vorgang 21 | so spät | → Auswahlkommission (0) |
   | Auswahlkommission | Vorgang 10 | so spät | → Finale Zusage (0) |
   | Finale Zusage | Meilenstein | fest 80 T vorher | → Zahlungsfrist (0), → Soundkopplung 1 (7), → Wagenreihung steht (0) |
   | Zahlungsfrist Kollektive | Vorgang 30 | so früh | → Krachparade (0) |
   | Soundkopplung 1 | Meilenstein | so früh | → Soundkopplung 2 (0) |
   | Soundkopplung 2 | Meilenstein | frei, −28 | → Soundkopplung 3 (0) |
   | Soundkopplung 3 | Meilenstein | fest 3 T vorher | → Krachparade (0) |
   | Pressemitteilung Vorbericht | Meilenstein | fest 60 T vorher | → PR fertig (0) |
   | PR fertig | Meilenstein | so spät | → Finaler Crosscheck (0) |
   | Schildermalen | Vorgang 1 | frei, −34 | → Krachparade (0) |
   | Wagenreihung steht | Meilenstein | so spät | → Wagenpakete packen (0), → Programm fertig (0) |
   | Programm fertig | Meilenstein | so spät | → Finaler Crosscheck (0) |
   | T-Shirt-Bestellung | Meilenstein | frei, −49 | → Wagenpakete packen (21) |
   | Wagenpakete packen | Vorgang 4 | so spät | → Gesamtbriefing (0) |
   | Finaler Planungscheck | Meilenstein | so spät | → Finaler Crosscheck (7) |
   | Rechtliches fertig · Sicherheitskonzept fertig · Logistik fertig | je Meilenstein | so spät | je → Finaler Crosscheck (0) |
   | Finaler Crosscheck | Meilenstein | so spät | → Briefing Abschnittsleitungen (3) |
   | Briefing Abschnittsleitungen | Meilenstein | fest 14 T vorher | → Gesamtbriefing (4) |
   | Gesamtbriefing | Meilenstein | fest 10 T vorher | → Krachparade (0) |
   | Finales Vortreffen | Meilenstein | fest 3 T vorher | → Krachparade (0) |

   Erwartete Werte (Start · frühestens · spätestens · Luft · Status; Tage relativ):

   - **Grundfall heute −203:** Voranmeldung −138 (21.12.2026) · −203 · −138 · 65 · ok. Anmeldung −111 · −176 · −111 · 65. Auswahlkommission −90 · −155 · −90 · 65. Zahlungsfrist −80 bis −50 (17.02.–19.03.2027) · −80 · −30 · 50. Soundkopplung 1 −73 (24.02.2027) · −73 · −3 · 70. Soundkopplung 2 −28 · −73 · −3 · 70. Schildermalen −34 · −203 · −1 · 202. T-Shirt −49 · −203 · −35 · 168. Wagenreihung −17 · −80 · −17 · 63. Wagenpakete −14 bis −10 (24.04.–28.04.2027) · −80 · −14 · 66. Finaler Crosscheck −17 · −60 · −17 · 43. Feste: Zusage −80, Pressemitteilung −60, Briefing AL −14, Gesamtbriefing −10, Vortreffen −3, Soundkopplung 3 −3. **Alle ok, nichts kritisch, nichts knapp.**
   - **T-Shirt frei −30:** T-Shirt `late`/`too_late` (spätestens −35), kritisch; Wagenpakete bleibt −14, `warn`/`before_predecessor` (T-Shirt).
   - **Soundkopplung 2 frei −80:** `warn`/`too_early` (frühestens −73); Soundkopplung 1 ok.
   - **Zusage fest 60 statt 80:** Auswahlkommission −70, Zahlungsfrist startet −60 (Luft 30), Soundkopplung 1 −53 (Luft 50).
   - **Zusage fest 150:** Zusage `late`/`fixed_unreachable` (Vorgänger frühestens −145); Auswahlkommission −160, `late`/`no_window` (frühestens −155), beide kritisch.
   - **Briefing Abschnittsleitungen fest 5:** `late`/`fixed_too_late` (Nachfolger brauchen es spätestens −14), kritisch; Finaler Crosscheck rückt auf −8.
   - **Finaler Crosscheck frei −30:** PR fertig, Programm fertig, Wagenreihung, Rechtliches, Sicherheitskonzept, Logistik rücken auf −30, Planungscheck auf −37; alle ok, kein „Zu früh“.
   - **Wagenreihung frei −40:** Programm fertig bleibt −17, Wagenpakete bleibt −14, alle ok.
   - **Heute −150, Voranmeldung erreicht am −140:** Voranmeldung `done`, Start −140; Vortreffen frühestens −120, Luft 2, **knapp**; Anmeldung Luft 2, knapp.
   - **Heute −150, nichts erreicht:** Voranmeldung, Vortreffen, Anmeldung je Luft 12, ok, nicht knapp.
   - **Heute −137, Voranmeldung nicht erreicht:** Voranmeldung `late`/`overdue`; Vortreffen `late`/`no_window` (frühestens −117, spätestens −118); beide kritisch.
   - **Heute −95, erreicht: Voranmeldung −138, Vortreffen −118, Anmeldung −90:** Auswahlkommission −90, Luft 0, ok, **kritisch**.
   - **Heute −85, gleiche Erreichte:** Auswahlkommission **läuft** (Start −90), frühestens −90, ok, kritisch.
   - **Heute −40, erreicht bis einschließlich Zusage −80:** Pressemitteilung, Zahlungsfrist (Ende −50), Soundkopplung 1 je `late`/`overdue`.
   - **Heute −24, erreicht: alles bis Zusage, Zahlungsfrist −50, Soundkopplung 1 −73, Pressemitteilung −60, T-Shirt −49:** Schildermalen und Soundkopplung 2 `late`/`overdue`; Planungscheck und Crosscheck Luft 0, kritisch; Wagenreihung und Programm Luft 7, **knapp**; Wagenpakete Luft 10, nicht knapp.

   Zusätzlich in `plan-engine.test.ts`: `so früh` ohne Vorgänger = heute; „so spät“ hinter einem „so früh“-Nachfolger fällt auf dessen spätesten Start; ungültige Lage-Kombination rechnet wie „so spät“; Kreis → `PlanCycleError`; `moveElement` (fest N, festes Datum, Umstellen auf frei, Ende nie nach der Krachparade, erreichtes Ziel → leer); Schieben (nur freie Nachbarn, transitiv, nicht bei erhaltener Reihenfolge, nie erreichte); `resizeFromEnd`/`resizeFromStart` (Start bzw. Ende bleibt, Grenzen 1 und 365, Meilenstein → leer, fest bleibt fest); `setPlacementValues` (alle vier Lagen, beide Fest-Varianten); **Datumswechsel** der Ausgabe von 08.05.2027 auf 15.05.2027: „fest N T“, „frei“, „so früh/spät“ relativ gleich, „festes Datum“ und erreichte liegen 7 Tage relativ früher; `todoDueDay` für `start`/`end` an einem erreichten Element.
5. **Datenzugriff** `src/db/plan.ts`: `loadPlan` (und alle anderen Lade-Funktionen, die Engine-Eingaben bauen) liefert `placement`, `fixedOffsetDays`, `freeStartDay`, `fixedDay` (aus `fixed_date`), `doneDay` (Berliner Kalendertag von `done_at` über den vorhandenen Helfer, relativ zur Krachparade); `shift_days` wird nicht mehr gelesen. Ist `done` gesetzt und `done_at` leer, gilt `updated_at`.
6. **Server Actions** `src/actions/plan.ts` (Grundregeln aus 008 gelten weiter: aktives Mitglied aus der DB, aktuelle Ausgabe, Zod, `updated_at`/`updated_by`, Konflikt-Hinweis, `db.batch`):
   - `moveElement`, `resizeElement` über die neuen Engine-Funktionen; Rückgabe der vorherigen Werte **inkl. `placement`, `fixed_offset_days`, `fixed_date`, `free_start_day`, `duration_days`** für alle geänderten Elemente.
   - `undoPlanChange` setzt genau diese Spalten zurück.
   - **Neu** `setPlacement(id, placement, variant?)` über `setPlacementValues`; setzt `shift_days` = 0. Abgelehnt bei erreichten Elementen („Erreichte Elemente haben keine Lage.“).
   - **Neu** `setFixedOffset(id, days)` (0–365) und `setFixedDate(id, date)` (nur bei Lage `fixed`; setzt die jeweils andere Variante leer).
   - `resetShift` und das alte `setFixedDate(id, date | null)` entfallen; Aufrufer auf die neuen Actions umstellen.
   - `addLink`: Abstand optional, Standard 0. `createElement`: Lage `alap`, Abstand Standard 0.
   - Neue Elemente aus Seed und KP27-Vorlage: Anlege-Funktion setzt `placement` = `fixed` bei `fixed_date`, sonst `alap`.
7. **Verlauf** `changeSummaries` (`src/lib/plan-edit.ts`) ergänzen (mit Vitest):
   - „Lage: So spät wie möglich → Frei im Fenster“ (alle Kombinationen über die Oberflächen-Namen)
   - „Fest: 60 T vor der Krachparade“, „Fest: 60 → 55 T vor der Krachparade“, „Festes Datum: Do 08.04.2027“, „Festes Datum: Do 08.04. → Mo 12.04.2027“
   - „Verschoben um +3 T (Lage jetzt Frei im Fenster)“ bzw. ohne Klammer, wenn es schon frei war; geschobene Nachbarn „Mitgeschoben um +3 T (mit ‹Name›)“
   - „Mindestabstand zu ‹Name›: 0 → 7 T“ (ersetzt „Abstand zu …“), „Vorgänger verbunden: ‹Name› (mind. 0 T)“
   - Gespeicherte alte Verlaufstexte bleiben unverändert.
8. **Übernahme bestehender Daten**
   - Reine Funktion `src/lib/plan-legacy.ts` mit Vitest:
     - `legacyPlannedStart(elements, links)`: rechnet den geplanten Start nach dem **alten** Modell aus 006 (spätester Termin über die Nachfolger, Fixtermin-Nachfolger mit `fixedDay`, Krachparade 0; `plannedStart` = `fixedDay` oder `latestStart` + `shiftDays`; `done` spielt keine Rolle).
     - `legacyToPlacement(elements, links, today)`: 1) `fixed_date` gesetzt → `fixed` (Datum bleibt); 2) `shift_days` ≠ 0 → `free` mit `freeStartDay` = alter geplanter Start; 3) alle übrigen `alap`; 4) neue Rechnung durchführen; jedes nicht erreichte Element, dessen neuer geplanter Start vom alten abweicht, wird `free` auf seinem alten Start; 5) Schritt 4 wiederholen, bis nichts mehr abweicht. Ergebnis: Änderungen je Element und eine Liste „erreicht – steht jetzt am Abhak-Tag“ (alter vs. neuer Start).
     - Tests: Fixtermin, verschobenes Element mit verschobenen Vorgängern (Ergebnis: alle frei, gleiche Termine), Vorgänger eines früher gelegten Elements ohne eigene Verschiebung (wird frei auf altem Termin), erreichtes Element, zweiter Lauf ändert nichts.
   - Skript `scripts/plan-lage-uebernahme.ts`, in `package.json` als **`db:lage`** (dev-Datenbank) und **`db:lage:prod`** (wie die anderen `:prod`-Skripte):
     - Ohne Zusatz nur **Vorschau**: Tabelle Name · bisher (Datum, Fixtermin/Verschiebung) · neue Lage · Termin vorher · Termin nachher · gleich?; darunter die erreichten Elemente mit altem und neuem Termin; Zählung „n fest, m frei, k so spät“; Schlusszeile „Nichts geändert. Zum Schreiben: pnpm db:lage --schreiben“ (bzw. `:prod`).
     - Mit **`--schreiben`**: schreibt nur Elemente mit `placement = 'alap'` und (`fixed_date` gesetzt oder `shift_days` ≠ 0) bzw. die in Schritt 4 frei gewordenen; setzt bei erreichten Elementen ohne `done_at` den Wert aus `updated_at`; ein `db.batch`; danach Kontrolle mit der neuen Engine: „Alle offenen Termine unverändert ✓“ oder Liste der Abweichungen. `shift_days` bleibt unangetastet (die noch laufende alte Version liest es bis zum Merge weiter).
     - Zweiter Lauf: „Nichts zu übernehmen.“
     - Ausgabe nur Element-Namen und Daten, keine Personen, keine Notizen/To-dos, keine Umgebungswerte.
     - Ein Eintrag in `plan_changes` je umgestelltem Element: „Lage übernommen: ‹Lage›“ (`member_id` leer).
9. **Seed** `src/db/seed.ts`: `TEST_PLAN` setzt die Lage ausdrücklich (Kooperationsgespräch KVR/Polizei → fest, festes Datum 08.04.2027; Social-Media-Plan → frei auf seinem bisherigen Termin; Teaser veröffentlicht → frei auf seinem bisherigen Termin; alle anderen so spät), sodass alle Termine gleich bleiben. `SEED_VERSION` = 10. Mit `--prod` weiter nichts Neues. KP27-Vorlage nur so weit, dass sie gültige Zeilen anlegt (Inhalt mit 026).

**Teil A endet vor `db:push`:** Halte an und schreib Franz die Befehle für die dev-Datenbank in dieser Reihenfolge auf: `pnpm db:push` (bei Rückfragen von drizzle-kit „No, add the constraint without truncating the table“, nie „truncate“) → `pnpm db:lage` (Vorschau; erwartet für den frischen Test-Plan: 1 fest, 2 frei, alle offenen Termine gleich) → `pnpm db:lage --schreiben` → bei Bedarf `pnpm db:seed`. Danach alle bestehenden Klicktests und `pnpm build` als Regressionscheck. Klicktests, die wegen der neuen Rechnung brechen, nur anpassen, wenn die Änderung in dieser Spec beschrieben ist (z. B. Ziehen in `plan-bearbeiten.spec.ts`); sonst melden.

Auftrag 1 endet mit „setze NUR Teil A um“. Teil A committen, nicht pushen.

### Teil B – Panel, Blatt, Status-Texte, Klicktest

10. **Status-Texte zentral** `src/lib/plan-status.ts` (Vitest): `statusLabel(status, reason)` (Erreicht · On track · Wackelt · Zu früh · Verzug), `reasonText(result, names, dDay)` mit den Texten aus der Tabelle oben (Datum „Wt TT.MM.“ über die vorhandenen Helfer, geschütztes Leerzeichen wie in 013). Alle Stellen mit Status-Namen nutzen das (Panel/Blatt, Wochenliste, `/meine`, AK-Arbeitsbereich, AK-Karten, Gantt-Tooltip falls vorhanden). `StatusPill` behält die Farben; „Zu früh“ in Gelb wie „Wackelt“.
11. **Zählungen:** Wo bisher `warn` als „wackelt“ gezählt wird (z. B. Lage-Pills auf AK-Karten): „wackelt“ zählt nur `reason = wobbly`; neu „N zu früh“ in gleicher Optik. „Überfällig & Verzug“ umfasst alle `late`.
12. **Panel (Laptop) / Blatt (Handy)** nach Test-Layout v5:
    - **Kopf:** Status-Pille, daneben neutrale Pille „Luft N T“ / „keine Luft“ / „fest · N T vorher“ / „festes Datum“ / „erreicht“, x/y To-dos wie bisher, Pille „Kritisch“ (pinker Ring) bzw. „Knapp“ (pink gestrichelt); darunter klein der Grund (`reasonText`), wenn Status nicht `ok`.
    - **Lage** (ersetzt die Fixtermin-Zeile im Abschnitt „Element“ und den Hinweis „Von Hand um n Tage …“ mit „Auf spätesten Termin“): vier Knöpfe 2 × 2 (mind. 44 px hoch, `aria-pressed`): Fest · So früh wie möglich · So spät wie möglich · Frei im Fenster; darunter eine Erklärzeile je Lage:
      - Fest: „Liegt immer auf diesem Termin. Für gewollte Termine wie Pressemitteilung oder Gesamtbriefing.“
      - So früh wie möglich: „Startet, sobald die Vorgänger fertig sind (plus Mindestabstand). Wandert mit, wenn sich die Vorgänger verschieben.“
      - So spät wie möglich: „Liegt auf dem letzten Termin, der nichts danach gefährdet. So hat die App bisher alles gerechnet.“
      - Frei im Fenster: „Ihr legt den Termin selbst, zum Beispiel durch Ziehen. Liegt er außerhalb des Fensters, wird er gelb oder rot.“
      - Bei **Fest**: Umschalter „Tage vor der Krachparade | Festes Datum“; Zahlenfeld „[N] Tage vor der Krachparade“ (0–365, `inputmode="numeric"`, 16 px Schrift) mit Datumszeile darunter („Start Di 09.03.2027“) bzw. Datumsfeld. Bei Vorgängen Hinweis „bezieht sich auf den Start“.
      - Bei erreichten Elementen sind die Knöpfe deaktiviert, Hinweis „Erreicht – die Lage gilt wieder, wenn du den Haken entfernst.“
      - Speichern bei Auswahl bzw. beim Verlassen des Felds, „Gespeichert ✓“ wie bisher.
    - **Zeitfenster** (ersetzt den bisherigen Termin-Block): Kasten mit Frühestens · Spätestens (bei Vorgängen „(Ende ‹…›)“) · Geplant (Start bzw. Start–Ende) · Luft („N Tage“, „keine“, bei Fest „fester Termin“); laufende zusätzlich „läuft seit ‹…›“; erreichte nur „Erreicht am ‹Wt TT.MM.›“. Am Handy bleiben „−7 T“, „−1 T“, „+1 T“, „+7 T“ (nicht bei erreichten).
    - **Vorgänger/Nachfolger:** je Zeile Name (Link zum Element), „mind. [N] T danach“ bzw. „mind. [N] T davor“, „×“; Krachparade als Nachfolger ohne Link. Ohne Vorgänger: „Keine – frühestens ab heute.“ Neue Verbindung: Abstand-Feld mit Vorgabe 0 und Beschriftung „mind. … T“. Hinweis unten: „Abstände sind Mindestabstände. 0 heißt: nur die Reihenfolge zählt.“
    - **Kurzformular „+ Element“:** Abstand-Feld als „mind. [0] T“; Lage wird nicht abgefragt (immer „So spät wie möglich“).
13. **Ziehen und „−/+ T“** nutzen die neuen Actions. Die Rückgängig-Leiste sagt bei einem Wechsel der Lage „Verschoben · Lage jetzt „Frei im Fenster“ · Rückgängig“ (bzw. „Dauer geändert · …“); sonst wie bisher. Rückgängig stellt Lage und Werte wieder her. Die Vorschau während des Ziehens rechnet mit denselben Engine-Funktionen.
14. **Gantt bis 026:** Optik bleibt. Der Filter „Kritischer Pfad“ heißt **„Kritisch & knapp“** und zeigt Elemente mit `critical` oder `tight` (Filter wirkt wie bisher auch auf die Wochenliste). Die Kopfzeilen-Angabe zum kritischen Pfad wird zu „‹n› kritisch · ‹m› knapp“ (bei 0/0: „nichts kritisch“). Alles andere im Gantt unverändert.
15. **Klicktest** `e2e/zeitfenster.spec.ts` (Dev-Login als Kim Brenner, nur eigene, je Lauf eindeutig benannte „E2E …“-Elemente, Seed-Elemente nie ändern, am Ende alles Eigene löschen, nach Seitenwechseln `expectPageReady`):
    - 1280 × 800: „E2E A ‹Zeit›“ anlegen (Vorgang 5 T, Nachfolger Krachparade, mind. 30) → Panel zeigt Lage „So spät wie möglich“ (gedrückt), Zeitfenster mit „Frühestens“ = heute, Pille „Luft …“
    - „E2E B ‹Zeit›“ anlegen (Meilenstein, Nachfolger A, mind. 0) → im Panel von B: Nachfolger A mit „mind. 0 T davor“; Mindestabstand auf 7 → bleibt nach Neuladen, Verlauf „Mindestabstand zu E2E A …: 0 → 7 T“
    - B auf „So früh wie möglich“ → Geplant = heute; Verlauf „Lage: So spät wie möglich → So früh wie möglich“
    - A auf „Fest“, Variante „Tage vor der Krachparade“ → Feld zeigt den bisherigen Abstand; auf 20 ändern → Datumszeile ändert sich, Kopf „fest · 20 T vorher“; Variante „Festes Datum“ → Datumsfeld vorbelegt mit dem Start
    - B im Gantt nach rechts hinter den Start von A ziehen → B Status „Verzug“, Rückgängig-Leiste nennt „Lage jetzt „Frei im Fenster““; „Rückgängig“ → B wieder „So früh wie möglich“
    - B „Erreicht“ → Zeitfenster „Erreicht am ‹heute›“, Lage-Knöpfe deaktiviert; Haken entfernen → Lage wieder wählbar
    - Filter „Kritisch & knapp“ ist da und lässt sich ein- und ausschalten
    - 375 × 812: A über die Wochenliste öffnen → Blatt zeigt Lage-Knöpfe und Zeitfenster; ein eigenes „so spät“-Element mit „+1 T“ → Leiste „Lage jetzt „Frei im Fenster““, „Rückgängig“; keine waagrechte Scrollleiste
    - Aufräumen; keine Konsolenfehler
    - Bestehende Klicktests anpassen, nicht löschen: `plan-bearbeiten.spec.ts` (Ziehen: A **früher** ziehen → A „Frei im Fenster“, B und C (so spät) rücken mit; „Fixtermin“-Schritte über „Fest · Festes Datum“), `plan.spec.ts` (Kopfzeile kritischer Pfad), weitere laut Abgleich; `src/lib/news/news.test.ts` wie gewohnt.
16. **Neuigkeiten-Eintrag** (unten) als neuester Eintrag in `src/lib/news/entries.ts`.

Auftrag 2 beginnt mit „Teil A ist bereits umgesetzt – ändere daran nichts“.

## Akzeptanzkriterien

1. Neue Spalten nur hinzufügend; `shift_days` bleibt; CHECK-Regeln greifen.
2. Engine rechnet Zeitfenster, Lage, Luft, Status/Grund, kritisch/knapp wie oben; alle Erwartungswerte aus Franz' Beispielen in `plan-engine.examples.test.ts` grün.
3. Erreichte Elemente stehen am Abhak-Tag; „so spät“ folgt dem geplanten Start der Nachfolger; „so früh“ ohne Vorgänger = heute; laufende Vorgänge sind nicht wegen „heute“ im Verzug.
4. Ziehen, Ränder, „−/+ T“ stellen auf „Frei im Fenster“ (bei Fest: N bzw. Datum), schieben nur freie Nachbarn bei verletzter Reihenfolge; Rückgängig stellt die Lage wieder her.
5. Übernahme-Skript: Vorschau ohne Schreiben; `--schreiben` setzt Lagen so, dass **alle offenen Termine unverändert** sind (Kontrolle im Skript), zweiter Lauf ändert nichts; Vitest für `plan-legacy.ts` grün.
6. Panel/Blatt mit Lage, Fest-Varianten, Zeitfenster-Kasten, „mind. N T“; Status-Namen überall über `plan-status.ts`; „Zu früh“ gelb; Zählungen „wackelt“/„zu früh“ getrennt.
7. Filter „Kritisch & knapp“ und Kopfzeile „n kritisch · m knapp“; sonst Gantt-Optik unverändert.
8. Neue Texte ohne „D-Day“/„D-N“.
9. Vitest für `plan-engine`, `plan-legacy`, `plan-edit`, `plan-status` grün; Klicktest `e2e/zeitfenster.spec.ts` und alle bisherigen grün bei 375 × 812 und 1280 × 800, gegen `pnpm dev` **und** gegen den lokalen Production-Build (Port 3100); hell und dunkel geprüft; keine Hydration-Warnungen.
10. `pnpm typecheck`, `lint`, `test`, `build` grün.

## Deploy

DB-Änderung + Übernahme. Vor dem Deploy: Screenshot vom Gantt in production (Laptop, alle AKs aufgeklappt) als Vergleich.

`deploy` (hält vor der DB an) → `gh pr checks spec/025-zeitfenster-rechnung --watch` → Vorschau-Test am iPhone („Visit Preview“: ein Element öffnen, Lage wechseln, Rückgängig) → **Franz bestätigt die Vorschau** → Neon-Backup-Zweig `backup-vor-025` von production → `git branch --show-current` → `pnpm db:push:prod` (Rückfragen von drizzle-kit mit „No, add the constraint without truncating the table“) → `pnpm db:lage:prod` (Vorschau prüfen: offene Termine gleich, erreichte am Abhak-Tag) → `pnpm db:lage:prod --schreiben` (muss „Alle offenen Termine unverändert ✓“ melden) → `deploy --db-erledigt` → Live-Check: Gantt mit dem Screenshot vergleichen, ein Element öffnen (Lage, Zeitfenster), Glocke zeigt den Eintrag.

## Neuigkeiten

**Titel:** Zeitfenster statt fester Abstände

- Jedes Plan-Element hat jetzt ein **Zeitfenster** von frühestens bis spätestens und eine **Lage**: fest, so früh wie möglich, so spät wie möglich oder frei im Fenster. Du findest beides im Element.
- **Abstände sind Mindestabstände** („mind. 7 T danach“). 0 heißt: nur die Reihenfolge zählt.
- **Luft** zeigt, wie weit etwas noch rutschen kann. Der Filter heißt jetzt **„Kritisch & knapp“**: kritisch = keine Luft, knapp = höchstens 7 Tage.
- Neuer Status **„Zu früh“** (gelb), wenn etwas vor seinem Vorgänger liegt. Erreichte Elemente bleiben an dem Tag, an dem sie abgehakt wurden.
- **Ziehen legt den Termin selbst fest** (Lage „Frei im Fenster“). Deine bisherigen Termine sind gleich geblieben; die Fenster im Gantt kommen mit dem nächsten Update.

## Abweichungen beim Bau

(von Claude Code zu ergänzen; nie den Freigabe-Haken hier eintragen)

Teil A:

1. **Übergangslösung bis Teil B** (von Franz freigegeben): Filter „Kritischer Pfad“ behält den Namen, filtert aber auf `critical || tight`; Kopfzeile bei aktivem Filter „n kritisch · m knapp“; Fixtermin-Kästchen ruft `setPlacement(fixed, date)` bzw. `setPlacement(alap)` auf, das Datumsfeld das neue `setFixedDate`; „Auf spätesten Termin“ nur bei Lage „frei“ (mit dem Hinweis „Von Hand gelegt“), ruft `setPlacement(alap)` auf; `reasonText` und `lateText` haben Ersatztexte für die neuen Gründe, „Zu früh“ heißt bis Teil B noch „Wackelt“.
2. **Name `lagDays` im Code bleibt**, keine Umbenennung in `minDays` (von Franz freigegeben).
3. **`today` als 4. Parameter** für `moveElement`, `resizeFromEnd`, `resizeFromStart` und `setPlacementValues` (von Franz freigegeben). `setPlacementValues(plan, id, placement, variant, today)`.
4. **Typ `Status` liegt jetzt in `src/lib/plan-engine.ts`**, `src/components/status-pill.tsx` importiert und exportiert ihn von dort (von Franz freigegeben).
5. Auslegung: `buffer` behält für feste Elemente die bisherige Bedeutung (berechneter spätester Start aus den Nachfolgern − geplanter Start), ebenso `latestFinish`. So zeigt ein zu später fester Termin im Gantt wie bisher „−N T Verzug“ („Gantt behält bis 026 seine Optik“). Für alle anderen Elemente gilt wörtlich `latestStart` − geplanter Start.
6. Auslegung: `shiftText` (`src/lib/plan-panel.ts`) entfällt, weil `shift_days` nicht mehr gelesen wird; `RowOptions.criticalPath` heißt jetzt `criticalIds`, `PlanViewData` liefert `counts` statt `criticalPath`/`latestProjectStart`, `PlanViewElement` hat zusätzlich `critical` und `tight`.
7. Auslegung: Der Seed behält bei Social-Media-Plan und Teaser `shift_days` (−10 / −5) neben der neuen Lage „frei“ (−90 / −26), damit das alte Modell (noch laufende Version, `db:lage`-Vorschau) dieselben Termine rechnet.
8. **Klicktest `plan-bearbeiten.spec.ts`, Schritt „Fixtermin für B“:** Nach dem Eintragen des Datums wird das Feld ausdrücklich verlassen (`blur`), dann wie bisher „−3 T Verzug“ geprüft. Tab springt in Chrome nur zwischen Tag, Monat und Jahr des Datumsfelds und speichert nicht (von Franz freigegeben).
9. Angepasste Klicktests nach der neuen Rechnung: `plan-bearbeiten.spec.ts` zieht A **früher** („+5 T“, B und C rücken mit; im Verlauf „Verschoben um −5 T (Lage jetzt Frei im Fenster)“ nach Punkt 7 der Umsetzung); `plan.spec.ts` prüft beim Filter „Kritischer Pfad“ die Kopfzeile „n kritisch · m knapp“ und dass genau so viele Elemente im Gantt stehen.
10. Hinweis: Im Seed stehen Finaler Crosscheck, Briefing Abschnittsleitungen und Gesamtbriefing nach der neuen Rechnung auf Verzug (`no_window`), weil das feste Kooperationsgespräch (−30, mind. 15 T) dem Crosscheck nur „frühestens −15, spätestens −17“ lässt. Termine unverändert.

Für Teil B:

1. **Datumsfeld „Festes Datum“ speichert, sobald ein vollständiges gültiges Datum eingetragen ist (change)**, nicht erst beim Verlassen; der Klicktest prüft das ohne `blur` (von Franz freigegeben).
