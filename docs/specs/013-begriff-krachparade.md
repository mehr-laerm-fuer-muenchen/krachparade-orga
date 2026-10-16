# SPEC 013 – Begriff „Krachparade“ statt „D-Day“

Freigabe Franz: ☑
Zweig: `spec/013-begriff-krachparade` · Risikoklasse B (nur sichtbare Texte und kleine Format-Funktionen; Seed-Änderung stuft das Skript als C ein – erwartbar) · lokal, ein Auftrag, Auto-Modus aus · DB: nein (keine Schema-Änderung; nur Texte im dev-Seed und in der KP27-Vorlage)

## Ziel

„D-Day“ ist zu martialisch. Überall, wo die App etwas anzeigt, heißt der Tag ab jetzt **„Krachparade“**. Der Countdown in der Kopfleiste zeigt **„noch 204 T“** statt „D-204“, am Tag selbst **„heute!“**, danach **„vorbei“**. Relative Termine an Plan-Elementen heißen **„80 T vorher“** statt „D-80“ (am Tag selbst „Krachparade“, danach „3 T danach“). Code-Namen (`dday.ts`, Spalten, Funktionen, Variablen) bleiben. Die Kopfleiste bleibt am Handy bei 375 px einzeilig.

## Nicht in dieser Spec

- Code-Namen, Dateinamen, Spalten, Typen, Funktionsnamen (`dday.ts`, `dday`-Spalten usw.) – bleiben
- Schema-Änderungen, Datenmigrationen, Änderungen an Daten in production (das Plan-Element „D-Day“ in production benennt Franz nach dem Deploy selbst in der App um)
- Bereits gespeicherte Verlaufseinträge (`plan_changes`), Notizen, Protokolle, Feedback-Meldungen – bleiben, wie sie sind
- `AGENTS.md`, `.claude/**`, `.github/**`, Configs, Skripte, alte Specs in `docs/specs/` (Klasse C bzw. Historie)
- Walkthrough-Dokument (bereits angepasst)
- Neue Funktionen, neue Abhängigkeiten, neue Umgebungsvariablen
- Benachrichtigungs-Center, Release Notes

## Entscheidungen (Franz, 15./16.10.2026)

1. Begriff in der Oberfläche: **„Krachparade“** (Gantt-Linie, Standard-Nachfolger, Einstellungen, Hinweise).
2. Kopfleisten-Countdown überall **„noch N T“**. Passt das am Handy mit Käfer nicht einzeilig, darf der App-Name weiter gekürzt werden – notfalls bleibt bei schmalen Bildschirmen nur das Logo (Name dann nur für Screenreader).
3. Randfälle: am Tag selbst **„heute!“**, danach **„vorbei“** (bis eine neue Ausgabe angelegt ist).
4. Relative Termine an Elementen: **„N T vorher“**, am Tag **„Krachparade“**, danach **„N T danach“**.
5. Production-Element „D-Day“: Franz benennt es nach dem Deploy in der App um (kein Prod-Skript).
6. Neue Texte verwenden ab jetzt nie mehr „D-Day“ oder „D-N“.

## Vorab: Abgleich mit dem Code

Bevor du etwas änderst, prüfe und berichte kurz:

- **Wo steht „D-Day“, „DDay“, „D-“ + Zahl oder „D−“ (Unicode-Minus U+2212) + Zahl in sichtbarem Text?** Suche in `src/` und `e2e/` (mit deinem eigenen Such-Werkzeug, nicht per `grep`/`rg` in der Shell). Liste je Fundstelle: Datei, Kontext (Kopfleiste, Gantt, Wochenliste, Panel/Blatt, `/meine`, Einstellungen, Formular „+ Element“, Verlaufstexte, Fehlermeldungen, `aria-label`, `title`, Seitentitel/Metadaten, Seed, KP27-Vorlage, Tests). Code-Bezeichner gehören nicht in die Liste.
- **Wie wird das Ziel-Element („D-Day“) im Plan erkannt** – über ein Feld/Flag/eine feste ID, über den Fixtermin = Datum der Ausgabe, oder über den **Namen**? **Wird es irgendwo am Namen „D-Day“ erkannt: stoppen und berichten** (sonst bricht die Umbenennung in production die App).
- Wo entsteht der Countdown in der Kopfleiste (erwartet: Helfer in `src/lib/dday.ts`, „heute“ serverseitig über `todayInBerlin(now)`), und wo die relativen „D-N“-Angaben an Elementen (Gantt, Wochenliste, Panel/Blatt, `/meine`, Vorlage)? Gibt es schon eine gemeinsame Format-Funktion, oder wird an mehreren Stellen formatiert?
- Werden Verlaufstexte (`changeSummaries` in `src/lib/plan-edit.ts`) beim Speichern als Text in `plan_changes` abgelegt oder beim Anzeigen erzeugt?
- Woher kommt der vorbelegte Standard-Nachfolger im Formular „+ Element“ – Name des Ziel-Elements oder fester Text?
- Wie ist die Kopfleiste bei 375 px aufgebaut (Logo, „Krachparade…“, Käfer mit Zahl, Countdown), und wie viel Platz bleibt mit dem längeren Countdown „noch 365 T“ und der pinken Zahl am Käfer (Admin)?
- Führt `src/db/seed.ts` eine `SEED_VERSION` (erwartet: 7), und wie heißt das Ziel-Element in `TEST_PLAN` und in `src/db/kp27-template.ts`?

Wenn etwas grundlegend anders ist als hier beschrieben: stoppen, Unterschied beschreiben, nichts umbauen.

## Umsetzung

### 1 · Format-Funktionen (`src/lib/dday.ts` oder dort, wo die bestehende Formatierung liegt; mit Vitest)

Eine Stelle für alle Texte, keine verstreuten Formatierungen. `days` = Kalendertage bis zur Krachparade (positiv = davor), „heute“ wie bisher als Parameter, Rechnung unverändert.

| Funktion (Name nach Bestand) | Eingabe | Ausgabe |
|---|---|---|
| Countdown Kopfleiste | 204 · 1 · 0 · −1 | „noch 204 T“ · „noch 1 T“ · „heute!“ · „vorbei“ |
| Countdown `aria-label` | 204 · 1 · 0 · −1 | „Noch 204 Tage bis zur Krachparade“ · „Noch 1 Tag bis zur Krachparade“ · „Heute ist Krachparade“ · „Krachparade ist vorbei“ |
| Relativer Termin am Element | 80 · 1 · 0 · −3 · −1 | „80 T vorher“ · „1 T vorher“ · „Krachparade“ · „3 T danach“ · „1 T danach“ |

- Zwischen Zahl und „T“ ein geschütztes Leerzeichen (`\u00a0`), damit nie umbrochen wird. Tests prüfen das.
- Vitest für alle Zeilen der Tabelle. Getestete Dateien importieren `src/lib` relativ (Vitest kennt `@/` nicht).
- Bestehende „D-N“-Funktionen ersetzen, nicht doppelt stehen lassen. Rechnung (Tage, Zeitzone, „heute“ auf dem Server) nicht ändern.

### 2 · Oberfläche

Alle Fundstellen aus dem Abgleich umstellen, mindestens:

- **Kopfleiste:** Countdown mit den neuen Funktionen, `aria-label` wie oben.
- **Gantt:** Linien-Schild „Krachparade“ statt „D-Day“; relative Angaben in Beschriftungen/Tooltips mit der Element-Funktion. Prüfen, dass das längere Schild nicht mit „Heute“ kollidiert.
- **Wochenliste, Detail-Panel (Laptop), Blatt (Handy), `/meine`:** relative Angaben „N T vorher“ usw., z. B. „Mi 17.02.2027 · 80 T vorher“.
- **Formular „+ Element“:** Standard-Nachfolger zeigt „Krachparade“ (stammt er aus dem Elementnamen, reicht die Umbenennung; fester Text → ändern).
- **Einstellungen:** Feld/Überschrift „Datum der Krachparade“, Hinweise wie „Der Plan wandert mit, Fixtermine bleiben“ ohne „D-Day“.
- **Hinweise und Fehlermeldungen:** z. B. kritischer Pfad „längste Kette zur Krachparade“, Fixtermin-/Verzug-Hinweise, Kreis-Meldungen – nur Wortlaut, Sinn unverändert.
- **Verlaufstexte:** neue Einträge ohne „D-Day“/„D-N“. Sind die Texte gespeichert, bleiben alte Einträge unverändert (keine Datenänderung); werden sie beim Anzeigen erzeugt, gilt der neue Wortlaut automatisch.
- `aria-label`, `title`, Seitentitel und Metadaten ebenso.

### 3 · Kopfleiste bei 375 px einzeilig

- Ziel: Logo, App-Name, Käfer (mit pinker Zahl als Admin) und Countdown in **einer** Zeile bei 375 × 812, ohne Überlauf, ohne waagrechte Scrollleiste, Tippflächen weiter mindestens 44 × 44 px.
- Prüfen mit dem längsten realistischen Countdown „noch 365 T“ (zum Prüfen vorübergehend erzwingen, **nicht** committen) und als Admin mit Zahl am Käfer.
- Reicht der Platz nicht: Zuerst den App-Namen weiter kürzen; reicht das nicht, unter 400 px nur das Logo zeigen und den Namen als `sr-only` behalten. Countdown und Käfer nicht verkleinern, Schrift nicht unter die bestehende Größe.
- Laptop (1280 px) unverändert bis auf den Text.
- Kopfleiste bleibt auf `z-35`; sonst nichts an Ebenen und Abdunklung ändern.

### 4 · Seed und KP27-Vorlage (nur Texte)

- `TEST_PLAN` in `src/db/seed.ts` und `src/db/kp27-template.ts`: Ziel-Element heißt „Krachparade“; sichtbare Texte (Namen, Beschreibungen, To-dos, Notizen) ohne „D-Day“/„D-N“ – relative Angaben in Texten als „N T vorher“. Zahlen, Abstände, Verbindungen nicht ändern; der 010-Test der Tage bleibt grün.
- `SEED_VERSION` um eins erhöhen, falls die Seed-Logik das für geänderte Daten braucht. `--prod` unverändert (legt bei vorhandenem Plan nichts an).
- Nach der Seed-Änderung **anhalten** und Franz bitten, `pnpm db:reset:dev` und danach `pnpm db:seed` selbst auszuführen. Nicht selbst ausführen. Danach weiter mit den Tests.

### 5 · Tests

- Bestehende Klicktests, die „D-Day“/„D-N“-Texte prüfen, auf die neuen Texte umstellen. Keine Tests auf den Namen des Ziel-Elements stützen, wenn es einen stabileren Weg gibt.
- Neuer Klicktest `e2e/begriff-krachparade.spec.ts`:
  - Dev-Login als Kim Brenner (Admin) bei 375 × 812: Countdown in der Kopfleiste passt auf `^noch \d+ T$` (bzw. „heute!“/„vorbei“); Logo, Käfer und Countdown liegen in einer Zeile (senkrechte Bereiche überlappen, Kopfleistenhöhe wie vorher), `document.documentElement.scrollWidth` ≤ 375.
  - Dasselbe bei 1280 × 800.
  - Auf `/`, `/meine`, `/einstellungen`, `/feedback`, `/protokolle`, `/arbeitskreise` enthält der sichtbare Text weder „D-Day“ noch ein Muster `D-\d` oder `D−\d`.
  - Gantt (1280 px) zeigt das Linien-Schild „Krachparade“.
  - Nichts ziehen oder abhaken (Seed-Elemente nie ändern), nie `networkidle`, mit `expectPageReady` warten.

## Akzeptanzkriterien

1. Kein sichtbares „D-Day“, „D-N“ oder „D−N“ mehr in der App (Oberfläche, `aria-label`, `title`, Seitentitel, neue Verlaufstexte, Hinweise, Fehlermeldungen).
2. Kopfleiste: „noch N T“, am Tag „heute!“, danach „vorbei“; `aria-label` ausgeschrieben.
3. Elemente: „N T vorher“ / „Krachparade“ / „N T danach“ in Gantt, Wochenliste, Panel, Blatt und `/meine`.
4. Gantt-Linie heißt „Krachparade“ und kollidiert nicht mit „Heute“; Einstellungen zeigen „Datum der Krachparade“; Standard-Nachfolger „Krachparade“.
5. **Kopfleiste bei 375 × 812 einzeilig** – auch mit „noch 365 T“ und pinker Zahl am Käfer; keine waagrechte Scrollleiste; Tippflächen ≥ 44 px.
6. Code-Namen, Schema, Rechnung und gespeicherte Daten unverändert; `--prod` im Seed unverändert.
7. Vitest für die Format-Funktionen grün (inkl. geschütztem Leerzeichen); 010-Test der Tage grün.
8. `e2e/begriff-krachparade.spec.ts` und alle bestehenden Klicktests grün; Seed-Plan-Elemente nicht verändert.
9. `pnpm typecheck`, `lint`, `test`, `build` grün; `pnpm e2e` grün auch gegen den lokalen Production-Build (Port 3100); „Prüfungen“ und „Klicktests“ im PR grün.
10. Geprüft bei 375 × 812 und 1280 × 800, helles und dunkles Thema; keine Hydration-Warnungen; kein `revalidatePath("/", "layout")`.

## Deploy

Keine Schema-Änderung. Weil sich `src/db/seed.ts` ändert, hält `deploy` vor dem Merge an – **kein** `db:push:prod` und **kein** `db:seed:prod` nötig, kein Backup nötig. Ablauf: `deploy` → `gh pr checks spec/013-begriff-krachparade --watch` → Vorschau am iPhone über „Visit Preview“ im PR (Dev-Login) → `deploy --db-erledigt`.

Danach live, durch Franz in der App: Plan-Element „D-Day“ öffnen → Name „Krachparade“ → speichern. Optional: eigene Learning-Notizen mit „D-N“ in production auf „N T vorher“ umformulieren. Live-Check am iPhone: Kopfleiste einzeilig, Countdown, Gantt-Linie am Laptop, Einstellungen.

## Abweichungen beim Bau

(von Claude Code zu ergänzen; nie den Freigabe-Haken hier eintragen, stattdessen „(Freigabe Franz)“)
