# SPEC 012 – Datei-Änderungen ohne Rückfrage für Claude Code

Freigabe Franz: ☑
Zweig: `spec/012-claude-edits` · Risikoklasse C · lokal, Auto-Modus aus · DB: nein

## Vorab: Abgleich mit dem Code

Bevor du etwas änderst, berichte kurz (nur Namen und Regeln, keine Werte aus `.env*`):

1. Alle Einträge in `.claude/settings.json` unter `permissions.allow`, `permissions.ask` und `permissions.deny`, die `Edit`, `Write`, `NotebookEdit`, `sed`, `perl` oder `python` betreffen – wörtlich.
2. Ob es eine `.claude/settings.local.json` gibt und ob sie `permissions` enthält (nur ja/nein und welche Schlüssel).
3. Welche Dateien unter `src/` zu **Login, Sitzung, Cookies oder Zugangsschutz** gehören (z. B. `src/proxy.ts`, `src/auth.ts`, `src/app/api/auth/**`, `src/app/login/**`, Helfer wie `requireMember`/`requireAdmin`). Liste die tatsächlichen Pfade auf.
4. Welche Config-Dateien im Repo-Stamm liegen (`*.config.*`, `tsconfig.json`, `package.json`, `pnpm-lock.yaml`, `.node-version` usw.).
5. Ob `AGENTS.md` ausdrücklich sagt, dass Claude Code die Zeile „Freigabe Franz“ in Specs nie ändert.

Dann warte auf Franz' „Weiter“.

## Ziel

Claude Code ändert und erstellt Dateien in `src/`, `e2e/` und `docs/specs/` ohne Rückfrage-Kasten. Alles Geschützte (Login, Zugang, Dev-Login, Configs, Workflows, Agenten, Skripte, `.claude/`, `.env*`) fragt weiter. Dateien werden nur noch über das Bearbeiten-Werkzeug geändert, nicht per Shell.

Hintergrund: Seit 011 stehen `Edit`/`Write` pauschal in `ask`. Weil Claude Code die Regeln in der Reihenfolge **deny → ask → allow** prüft und eine passende ask-Regel immer gewinnt, fragt jede Datei-Änderung nach. Bei jedem Bau sind das Dutzende Kästen.

## Nicht in dieser Spec

- Keine Änderung an Bash-Freigaben aus 011 außer den neuen Sperren unten (grep/rg bleiben mit Rückfrage).
- Keine Änderung an `.github/**` (concurrency-Gruppe für Klicktests kommt mit der Spec Mitentwickler).
- Keine Änderung an App-Code, Tests, Risiko-Skript oder `agents/risikoklassen.json`.
- Kein README (kommt mit der Spec Mitentwickler).

## Umsetzung

Nur `.claude/settings.json` (und ggf. ein Satz in `AGENTS.md`, siehe 4). Änderungen ausschließlich mit dem Bearbeiten-Werkzeug.

**Wichtig zur Schreibweise:** Pfad-Regeln nur als `Edit(...)`. Pfad-Regeln auf `Write(...)` oder `NotebookEdit(...)` wertet Claude Code in aktuellen Versionen nicht aus (nur Warnung beim Start); `Edit(...)` gilt für alle Datei-Werkzeuge. Ein führender `/` heißt „relativ zur Settings-Datei“, also zur Repo-Wurzel.

1. **ask aufräumen:** Die pauschalen Einträge `Edit` und `Write` (ohne Pfad) aus `ask` entfernen. Sonst nichts aus `ask` entfernen.

2. **allow ergänzen:**
   - `Edit(/src/**)`
   - `Edit(/e2e/**)`
   - `Edit(/docs/specs/**)`

3. **ask ergänzen** (geschützte Pfade fragen weiter, auch wenn „accept edits“ oder der Auto-Modus an ist):
   - `Edit(/.claude/**)`
   - `Edit(/.github/**)`
   - `Edit(/agents/**)`
   - `Edit(/scripts/**)`
   - `Edit(/AGENTS.md)`, `Edit(/CLAUDE.md)`
   - `Edit(/package.json)`, `Edit(/pnpm-lock.yaml)`, `Edit(/tsconfig.json)`, `Edit(/.node-version)`
   - je eine Regel für jede Config-Datei aus Abgleich-Punkt 4 (z. B. `Edit(/next.config.ts)`, `Edit(/drizzle.config.ts)`, `Edit(/vitest.config.ts)`, `Edit(/playwright.config.ts)`, `Edit(/eslint.config.mjs)`, `Edit(/postcss.config.mjs)`) – die tatsächlichen Namen, nicht diese Beispiele blind übernehmen
   - `Edit(/src/proxy.ts)`
   - `Edit(/src/app/dev/**)`
   - je eine Regel für die Login-/Zugangs-Dateien aus Abgleich-Punkt 3
   - `Edit(/.env*)`, falls `.env*` nicht schon über eine `Read`-deny-Regel gesperrt ist (eine `Read`-deny sperrt auch das Bearbeiten – dann nichts ergänzen)
   - `src/db/schema.ts`, `src/db/seed.ts` und `src/db/kp27-template.ts` bekommen **keine** ask-Regel (Entscheidung Franz; `deploy` bremst DB-Änderungen ohnehin).

4. **deny ergänzen** (Dateien nicht per Shell ändern):
   - `Bash(sed -i*)`, `Bash(sed --in-place*)`
   - `Bash(perl -i*)`, `Bash(perl -pi*)`, `Bash(perl -p -i*)`
   - `python3` bleibt wie bisher mit Rückfrage (nicht in allow, nicht in deny).
   - Schreibweise an die vorhandenen Regeln aus 011 anpassen; wenn eine dieser Formen in der Syntax nicht greift, melde das, statt eine breitere Sperre zu erfinden.

5. **AGENTS.md:** Nur falls Abgleich-Punkt 5 „nein“ ergibt: im Abschnitt zu Specs einen Satz ergänzen: „Die Zeile ‚Freigabe Franz' in Specs ändert nur Franz – nie Claude Code, auch nicht in `docs/specs/`." Sonst `AGENTS.md` nicht anfassen.

6. Vermerke unter „Abweichungen beim Bau“ in dieser Spec im Repo, jeweils mit „(von Franz freigegeben)“.

## Akzeptanzkriterien

Prüfung durch Franz in einer **neuen** Claude-Code-Sitzung nach `/clear` (Auto-Modus aus, normaler Modus):

1. Beim Start von Claude Code erscheint keine Warnung zu Regeln, die nicht ausgewertet werden.
2. `/permissions` zeigt die neuen allow-, ask- und deny-Regeln aus `.claude/settings.json`.
3. Claude Code fügt in einer Datei unter `src/lib/` einen Kommentar ein und entfernt ihn wieder – **kein Kasten**.
4. Dasselbe in einer Datei unter `e2e/` und in `docs/specs/_vorlage.md` – **kein Kasten**.
5. Claude Code legt `src/lib/__probe.ts` an (Inhalt: ein Kommentar) – **kein Kasten**. Danach löscht Franz die Datei selbst.
6. Versuch, `src/proxy.ts`, eine Datei unter `.github/`, `package.json` und eine der Login-Dateien aus Abgleich-Punkt 3 zu ändern – **jeweils Kasten**, Franz wählt „No“.
7. `sed -i` auf eine Datei in `src/` – **abgelehnt** (deny), ohne Kasten.
8. Ein `python3 -c "print(1)"` – **Kasten**, Franz wählt „No“.
9. `git status` ist nach den Tests sauber.
10. `pnpm typecheck`, `pnpm lint`, `pnpm test` und `pnpm build` grün. Kein neuer Klicktest nötig (keine Änderung an der App).
11. `.claude/settings.json` ist gültiges JSON; alle übrigen Regeln aus 011 sind unverändert (Diff von Franz geprüft).

## Neuigkeiten

keiner

## Deploy

Keine DB. Vor dem `deploy` prüft Franz den Diff von `.claude/settings.json` (und ggf. `AGENTS.md`) gegen `main`. Danach `deploy` – merged nach grünen Prüfungen automatisch.

## Abweichungen beim Bau

(von Claude Code auszufüllen)
