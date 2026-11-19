# SPEC 019 – Mitentwickler (Fassung 2, schlank)

Freigabe Franz: ☑
Zweig: `spec/019-mitentwickler` · Risikoklasse **C** (`.github/workflows/`, `AGENTS.md`) · **lokal, Auto-Modus aus** · DB: nein

Fassung 2 ersetzt Fassung 1. Begründung (Franz, Sitzung 18): Tiago (GitHub `TiagoKocevar`, schon Collaborator mit Schreibrecht) ist voll vertrauenswürdig. Schutzmaßnahmen gegen einen böswilligen Mitentwickler entfallen: Code Owners, Rulesets für `agent/**`, Umgebung `agenten`, Härtung der Agenten. Übrig bleibt, was die Zusammenarbeit technisch braucht.

## Ziel

1. **Klicktests ohne Vercel-Vorschau:** Vercel Hobby blockiert Deployments von Commits, deren Autor nicht im Vercel-Team ist. Für Tiagos Zweige gibt es deshalb keine Vorschau, und der Pflicht-Check „Klicktests“ würde nach 10 Minuten rot. Künftig baut der Workflow die App in diesem Fall selbst und testet dagegen, wie lokal auf Port 3100.
2. **Nur Merge-Commits, Franz mergt:** Merged Franz einen PR per Merge-Commit, ist er Autor des Commits auf `main`, und Vercel deployed live. Squash und Rebase werden abgeschaltet.
3. **Dokumentation:** Das README stellt klar, wie Tiago mitarbeitet. `AGENTS.md` bekommt den Abschnitt „Mitentwickeln“.

## Nicht in dieser Spec

- Code Owners, zusätzliche Rulesets, Umgebung `agenten`, Prüfungen in Fix- oder Build-Agent (bewusst weggelassen, siehe oben). Als Backlog: Claude-Token und Bot-Schlüssel in eine Umgebung nur für `main` ziehen, falls später weitere Personen dazukommen.
- Vercel Pro, GitHub-Organisation
- Änderungen an App-Code in `src/`
- `~/.zshrc` (`freigabe`/`deploy`)

## Vorab: Abgleich mit dem Code

Kurz, der erste Abgleich (Fassung 1) ist bekannt. Prüfe nur, ob sich seitdem etwas geändert hat, und berichte. **Erst nach „Weiter“ von Franz** etwas ändern. Nur lesen, `gh api` nur mit GET.

- `klicktests.yml`: Ist das Warten auf die Vorschau noch so (Deployments-API, `^preview`, 600 s, `timeout-minutes: 20`, Job-Lock `dev-datenbank`)? Welche Variablen braucht `pnpm e2e` (`BASE_URL`, `VERCEL_AUTOMATION_BYPASS_SECRET` …)?
- Wie verhält sich `next build` bzw. Auth.js ohne `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET`? Muss für den Selbstbau etwas gesetzt werden? Nur am Code und in der Doku ablesen.
- Ruleset `main` (id 25068852): erlaubte Merge-Methoden. Repo-Einstellungen `allow_squash_merge`, `allow_rebase_merge`.
- `README.md` Zeilen zu Fork, Merge-Rechten und Rolle „Read“. Wo steht in `AGENTS.md` der Ablauf für `braucht-db` (Schritt 7)?

## Umsetzung

**1 · Klicktests: Vorschau oder Selbstbau**

- Ein früher Schritt entscheidet über die GitHub-API anhand des **Logins des Autors des HEAD-Commits**:
  - `dellingerfranz-dev` oder die Bot-App → **Vorschau-Weg** wie heute
  - jeder andere → **Selbstbau-Weg**
  - Keine E-Mail-Adressen verwenden. Das Ergebnis steht in der Job-Zusammenfassung („Vorschau“ / „Selbstbau, Autor nicht im Vercel-Team“).
- **Selbstbau-Weg**, im selben Job (Job-Lock `dev-datenbank` bleibt):
  - `pnpm install --frozen-lockfile`
  - `DATABASE_URL` aus `DEV_DATABASE_URL`, `AUTH_SECRET` für den Lauf zufällig erzeugt (`openssl rand -base64 32`, nie ausgegeben, als maskierte Variable)
  - `ADMIN_EMAILS` mit einer ausgedachten `@example.org`-Adresse, falls nötig
  - `VERCEL_ENV=preview ENABLE_DEV_LOGIN=1 pnpm build`
  - `AUTH_TRUST_HOST=1 VERCEL_ENV=preview ENABLE_DEV_LOGIN=1 pnpm start -p 3100` im Hintergrund, warten bis `http://localhost:3100` antwortet (max. 60 s)
  - `BASE_URL=http://localhost:3100 pnpm e2e`
  - Server am Ende beenden
- Der Vorschau-Weg bleibt unverändert. Der Name des Pflicht-Checks „Klicktests“ bleibt. Keine neuen Secrets.
- Bricht der Vorschau-Weg nach dem Zeitlimit ab, nennt die Fehlermeldung den Grund: „Keine Vercel-Vorschau – Autor nicht im Vercel-Team? Dann sollte der Selbstbau-Weg greifen.“

**2 · README.md korrigieren** (nur die betroffenen Stellen):

- Mitentwickelnde sind **Collaborator mit Schreibrecht** und arbeiten mit Zweigen im selben Repo. Kein Fork, keine Rolle „Read“.
- Ablauf: Spec in `docs/specs/` → Freigabe nur durch Franz → Bau → PR → Pflicht-Checks → **Merge durch Franz, nur Merge-Commit** → live
- Kleinkram ohne Spec erlaubt: Fehler, Texte, Tests, kein neues Datenmodell
- Für eigene PRs gibt es keine Vercel-Vorschau, die Klicktests bauen selbst. Lokal starten wie beschrieben, mit eigenem Neon-Projekt.

**3 · AGENTS.md – Abschnitt „Mitentwickeln“** (kurz):

- Specs nur mit „Freigabe Franz: ☑“ bauen, den Haken setzt nur Franz
- Keine `:prod`-Skripte, keine fremden Datenbank-Adressen, keine Secrets in Code, Logs oder Issues
- Eigene Datenbank für lokale Arbeit (eigenes Neon-Projekt). Seed, Tests und Vorschau nur mit ausgedachten Daten.
- Kein Selbst-Merge. Franz merged per Merge-Commit.
- Heikle Dateien (`.github/`, `.claude/`, `agents/`, `scripts/`, Login, Configs, `package.json`, Schema) nur nach Absprache mit Franz

**4 · Hilfsdatei** `scripts/github/LIESMICH.md` mit den vollständigen `gh`-Befehlen, die Franz einmal ausführt:

- Repo: `allow_squash_merge=false`, `allow_rebase_merge=false`
- Ruleset `main`: `allowed_merge_methods` nur `merge`. Den Ruleset-Inhalt per GET lesen und nur dieses Feld ändern. Als Datei `scripts/github/ruleset-main.json`, aus dem aktuellen Stand erzeugt.

## Akzeptanzkriterien

1. Bei Franz' PRs laufen die Klicktests wie bisher über die Vercel-Vorschau. Geprüft am PR dieser Spec.
2. Bei einem PR, dessen HEAD-Commit von Tiago stammt, bauen die Klicktests selbst und laufen grün. Geprüft nach dem Merge mit einem kleinen Test-PR von Tiago, z. B. einem Tippfehler im README.
3. Die Job-Zusammenfassung zeigt den gewählten Weg. Kein Secret-Wert in Logs.
4. README und `AGENTS.md` nach Punkt 2 und 3, alle Befehle am Code belegt.
5. `scripts/github/LIESMICH.md` und `ruleset-main.json` sind vorhanden. Die Befehle sind vollständig und haben keine Platzhalter.
6. `pnpm typecheck`, `lint`, `test`, `build` grün. Workflow gegengelesen (`actionlint`, falls vorhanden). Keine App-Änderung, also kein neuer Klicktest.

## Deploy

Klasse C ohne DB, durch Franz:

1. Diff selbst prüfen: `git --no-pager diff main -- .github/workflows/klicktests.yml` (per `pbcopy` in den Chat zur Durchsicht).
2. `deploy` → Prüfungen grün → Auto-Merge.
3. Repo-Einstellungen nach `scripts/github/LIESMICH.md`.
4. Tiago macht einen kleinen Test-PR. Die Klicktests müssen den Selbstbau-Weg nehmen und grün werden. Franz merged per Merge-Commit, Vercel deployed live.
5. Danach ist `deploy` für Franz unverändert nutzbar.

## Neuigkeiten

keiner

## Abweichungen beim Bau

(von Claude Code zu ergänzen; nie den Freigabe-Haken hier eintragen, stattdessen „(von Franz freigegeben)“)

- **Bot-Erkennung** (von Franz freigegeben): Vorschau-Weg, wenn der Login des HEAD-Commit-Autors `dellingerfranz-dev` ist oder GitHub den Autor als Bot führt (`author.type == "Bot"`). Alles andere, auch ein Commit ohne GitHub-Konto, nimmt den Selbstbau-Weg. Kein fester Bot-Name, weil der Name der App erst im Lauf bekannt ist.
- **`require_extra_approval_for_unattributed_changes: true`** (von Franz freigegeben): steht im Ruleset `main` und bleibt unverändert in `scripts/github/ruleset-main.json`.
- `ADMIN_EMAILS` wird im Selbstbau nicht gesetzt: Eine fehlende Variable ergibt eine leere Liste (`parseAdminEmails`), die Klicktests melden sich über den Dev-Login an.
- `AGENTS.md`: „Mitentwickeln“ ist neuer Abschnitt 13, damit sich die Nummern der bestehenden Abschnitte nicht verschieben.
- `actionlint` ist lokal nicht installiert, der Workflow wurde von Hand gegengelesen.
- **`timeout-minutes` des Jobs „Klicktests“ von 20 auf 35** (von Franz freigegeben): Der Selbstbau-Weg braucht Build und Start zusätzlich zu ca. 16 Minuten Klicktests. Das Warte-Limit für die Vercel-Vorschau (600 s) bleibt.
