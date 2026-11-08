# SPEC 019 – Mitentwickler

Freigabe Franz: ☑
Zweig: `spec/019-mitentwickler` · Risikoklasse **C** (`.github/`, `CODEOWNERS`, `AGENTS.md`, README, Workflows, Secrets) · **lokal, Auto-Modus aus** · DB: nein

## Ziel

Thiago (und später weitere) können am Repo `dellingerfranz-dev/krachparade-orga` mitentwickeln, ohne dass sie an Franz' Geheimnisse kommen oder ungeprüft heikle Dateien ändern. Entscheidungen Sitzung 18 (Franz, 08.11.2026):

1. **Zugang:** Thiago wird Collaborator im persönlichen Repo. Er hat damit immer Schreibrecht, eine Rolle „Read“ gibt es dort nicht.
2. **Vorschau:** Vercel Hobby blockiert Deployments von Commits fremder Autoren. Bei PRs **ohne Vercel-Vorschau** bauen die Klicktests in GitHub die App selbst und testen dagegen, wie lokal auf Port 3100.
3. **Review:** Für normale Dateien reichen die Pflicht-Checks. Für **heikle Dateien** ist die Freigabe von Franz als Code Owner nötig. Franz darf die Regel als Admin umgehen (eigene Klasse-C-PRs).
4. **Secrets:** Claude-Token und Bot-Schlüssel ziehen in eine GitHub-Umgebung `agenten`, die nur Workflows auf `main` sehen. `DEV_DATABASE_URL` (ausgedachte Daten) und `VERCEL_AUTOMATION_BYPASS_SECRET` bleiben Repo-Secrets für die Klicktests auf PRs. `FEEDBACK_TRIAGE_DATABASE_URL` liegt schon in der Umgebung `feedback-triage`.
5. **Arbeitsweise:** Thiago arbeitet wie Franz nach Specs in `docs/specs/`. Den Haken „Freigabe“ setzt nur Franz. Kleinkram (Fehler, Texte, Tests) darf er ohne Spec per PR machen.
6. **Lokale Datenbank:** Thiago nimmt ein eigenes kostenloses Neon-Projekt und bekommt keine Adressen von Franz.
7. **Merge:** Im Repo sind nur Merge-Commits erlaubt. Thiagos PRs merged Franz, dann ist er Autor des Merge-Commits und Vercel deployed `main`.

## Nicht in dieser Spec

- Umzug in eine GitHub-Organisation, Vercel Pro
- Pflicht-Freigaben für Umgebungen (gibt es bei GitHub Pro nur für öffentliche Repos)
- Änderungen an App-Code in `src/` (außer wenn der Abgleich zeigt, dass die App lokal ohne Google-Werte nicht startet – dann nur berichten)
- Anleitung in der App (020)
- Build-Agent-Limit, Actions Node 24, `requireMember()` (Wartungspaket)
- `~/.zshrc` (`freigabe`/`deploy`) – nur Hinweise für Franz in „Deploy“

## Vorab: Abgleich mit dem Code

Prüfe zuerst und berichte im Chat. **Erst nach „Weiter“ von Franz** etwas ändern. Nur lesen: Dateien und `gh api` mit GET.

- **Workflows** in `.github/workflows/`: welche es gibt, welche Secrets jeder Job nutzt und in welchem Kontext er läuft (`pull_request`, `issues`, `workflow_run`, `push` auf `main`, `schedule` …, mit welchem `ref`). Für jeden Job mit `CLAUDE_CODE_OAUTH_TOKEN`, `KPORGA_BOT_CLIENT_ID` oder `KPORGA_BOT_PRIVATE_KEY`: Läuft er immer mit `ref` `main`? Würde eine Umgebung, die nur `main` zulässt, ihn blockieren (z. B. ein Fix-Agent auf einem PR-Zweig)?
- **Klicktests-Workflow:** Wie wartet er heute auf die Vercel-Vorschau, mit welchem Secret und welchem Zeitlimit? Was passiert, wenn es keine Vorschau gibt?
- **Branch-Schutz `main`:**
  - Was ist eingestellt (`gh api repos/dellingerfranz-dev/krachparade-orga/branches/main/protection`)?
  - Gibt es Rulesets (`gh api repos/dellingerfranz-dev/krachparade-orga/rulesets`)?
  - Welche Merge-Methoden sind erlaubt (`gh api repos/dellingerfranz-dev/krachparade-orga --jq '{allow_merge_commit,allow_squash_merge,allow_rebase_merge,allow_auto_merge,delete_branch_on_merge}'`)?
- **Code Owners und Admin-Umgehung:** Recherche in der GitHub-Doku, mit Quelle im Bericht:
  - Lässt sich „Code-Owner-Review erforderlich“ mit **0** Pflicht-Freigaben für sonstige Dateien kombinieren?
  - Wie verhält sich `gh pr merge --auto` bei einem Admin, der umgehen darf?
  - Merged `gh pr merge --merge --admin` nach grünen Checks?
- **Bestehende Dokumente:** `README.md` (noch create-next-app?), `AGENTS.md` (gibt es einen Abschnitt für Mitentwickler?), `.env.example` (welche Namen?), `docs/specs/_vorlage.md`.
- **Lokal ohne Franz' Werte:** Startet die App lokal mit eigenem Neon, eigenem `AUTH_SECRET` und Dev-Login, aber **ohne** `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET`? Nur am Code ablesen, nichts ausführen, was Werte ausgibt.
- **Build-Agent:** Wo wird geprüft, dass `go` nur von `dellingerfranz-dev` kommt? Gilt das auch für `spec`-Issues von anderen?
- **Risiko-Skript:** Stehen `CODEOWNERS` und `README.md` in `agents/risikoklassen.json`? Welche Klasse bekommen sie?

Weicht etwas grundlegend ab, z. B. weil die Admin-Umgehung mit `--auto` nicht funktioniert: **nichts umbauen**, Unterschied mit Vorschlag berichten und anhalten.

## Umsetzung

**1 · Klicktests ohne Vercel-Vorschau**

- Im Klicktests-Workflow entscheidet ein früher Schritt, ob für den PR eine Vercel-Vorschau zu erwarten ist. Regel: Ist der **Autor des HEAD-Commits** `dellingerfranz-dev` oder die Bot-App, wird wie heute auf die Vorschau gewartet. Sonst wird selbst gebaut. Die Erkennung läuft über die GitHub-API (Login des Commit-Autors), **nicht** über E-Mail-Adressen.
- **Selbst bauen:**
  - `pnpm install --frozen-lockfile`
  - `VERCEL_ENV=preview ENABLE_DEV_LOGIN=1 pnpm build` mit `DATABASE_URL` = `DEV_DATABASE_URL` und einem nur für den Lauf erzeugten `AUTH_SECRET` (zufällig, nie ausgegeben)
  - `AUTH_TRUST_HOST=1 VERCEL_ENV=preview ENABLE_DEV_LOGIN=1 pnpm start -p 3100` im Hintergrund, warten bis erreichbar
  - `BASE_URL=http://localhost:3100 pnpm e2e`
  - Werden für den Build weitere Variablen gebraucht (z. B. `ADMIN_EMAILS`), nur ausgedachte `@example.org`-Werte direkt im Workflow, keine neuen Secrets.
- Wartet der Workflow auf eine Vorschau, die nie kommt (Zeitlimit wie heute), schlägt er mit einem klaren Grund in der Job-Zusammenfassung fehl: „Keine Vercel-Vorschau – Autor nicht im Vercel-Team?“
- Der Name des Pflicht-Checks „Klicktests“ bleibt gleich.

**2 · `concurrency`**

- „Prüfungen“ und „Klicktests“ bekommen eine `concurrency`-Gruppe je PR (`${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}`) mit `cancel-in-progress: true`. Alte Läufe brechen ab, wenn neue Commits kommen.
- Agenten-Workflows nur, wenn der Abgleich zeigt, dass es passt (nicht abbrechen, was schon schreibt).

**3 · Umgebung `agenten` in den Workflows**

- Alle Jobs, die `CLAUDE_CODE_OAUTH_TOKEN`, `KPORGA_BOT_CLIENT_ID` oder `KPORGA_BOT_PRIVATE_KEY` brauchen, bekommen `environment: agenten`. Die Secrets selbst legt Franz an (siehe Deploy). Claude Code fasst keine Secrets an.
- Läuft ein solcher Job laut Abgleich nicht auf `main`: anhalten und mit Vorschlag berichten, statt ihn umzubauen.
- `permissions` je Job so knapp wie heute oder knapper, `persist-credentials: false` wo möglich.

**4 · `.github/CODEOWNERS`**

Code Owner für alle heiklen Pfade ist der Benutzer `dellingerfranz-dev` (in der Datei mit vorangestelltem At-Zeichen):

- `/.github/`, `/.claude/`, `/agents/`, `/scripts/`, `/AGENTS.md`, `/CLAUDE.md`
- `/src/proxy.ts`, Login- und Zugangsdateien (laut Abgleich, z. B. `src/auth*`, `src/app/dev/`, `src/app/login/`)
- `/package.json`, `/pnpm-lock.yaml`, `/next.config.*`, `/drizzle.config.*`, `/tsconfig.json`, `/eslint.config.*`, `/playwright.config.*`, `/vitest.config.*`, `/.env.example`, `/.node-version`
- `/src/db/schema.ts`
- `/.github/CODEOWNERS` selbst

Kein Eintrag für `*` (normale Dateien brauchen keine Freigabe).

**5 · README.md** (ersetzt create-next-app)

Grundlage ist der Entwurf `014-readme` (Projekt), mit diesen Korrekturen: Collaborator mit Schreibrecht statt „Read“, PRs im selben Repo statt Fork, Merge durch Franz.

Inhalt in dieser Reihenfolge, alles am Code belegt:

1. Zweck
2. Stack (Versionen aus `package.json`)
3. Ordner
4. **Lokal starten** mit eigenem Neon-Projekt, eigenem `AUTH_SECRET` und Dev-Login, Befehle vollständig. Wenn Google-Werte nötig sind, ehrlich angeben, was zu tun ist.
5. Befehle aus `package.json` als Tabelle, `:prod`-Skripte mit „nur Franz“
6. Daten-Regel: nur ausgedachte Daten auf `@example.org`, in Production keine Telefonnummern, Adressen oder Kontodaten
7. Wie gebaut wird:
   - Spec → Freigabe nur Franz → Bau → PR → Pflicht-Checks → Merge durch Franz (nur Merge-Commit) → live
   - Risikoklassen, Code Owners, Kleinkram ohne Spec
8. Beitragen:
   - Ideen und Fehler am besten über den Käfer in der App oder als Issue
   - Das Label `go` setzt nur Franz
   - Für Thiagos PRs gibt es keine Vercel-Vorschau, die Klicktests bauen selbst
9. Weiterlesen

Keine echten Namen außer dem GitHub-Konto von Franz. Keine Werte. Die öffentliche App-URL darf rein.

Ungenutzte Vorlagen-SVGs in `public/` (`file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg`) löschen, nur wenn sie nirgends referenziert sind.

**6 · AGENTS.md** – neuer kurzer Abschnitt **„Mitentwickeln“**:

- Specs nur mit „Freigabe Franz: ☑“ bauen, den Haken setzt nur Franz
- Kein Zugriff auf `:prod`-Skripte, keine fremden Datenbank-Adressen, keine Secrets in Code, Logs oder Issues
- Heikle Pfade nur mit Freigabe von Franz (Code Owners)
- Merge nur durch Franz, nur Merge-Commit
- Kleinkram ohne Spec erlaubt: Fehler, Texte, Tests, kein neues Datenmodell

**7 · Risiko-Skript:** `CODEOWNERS` ist Klasse C, `README.md` Klasse A, sofern das nicht schon so eingestuft ist. Mit Test.

**8 · Hilfsdateien für die Repo-Einstellungen** (keine Wirkung, bis Franz sie anwendet): `scripts/github/branch-schutz-main.json` mit der Branch-Schutz-Konfiguration laut Abgleich:

- bestehende Pflicht-Checks „Prüfungen“ und „Klicktests“
- „PR erforderlich“
- Code-Owner-Review
- 0 sonstige Freigaben, wenn möglich
- Admins dürfen umgehen
- keine Force-Pushes

Dazu eine kurze Anleitung `scripts/github/LIESMICH.md` mit den genauen `gh api`-Befehlen (PUT), die Franz ausführt.

## Akzeptanzkriterien

1. Bei einem PR, dessen HEAD-Commit nicht von Franz oder dem Bot stammt, bauen die Klicktests selbst auf Port 3100 und laufen grün. Bei Franz' PRs warten sie wie bisher auf die Vercel-Vorschau. Geprüft wird mit einem Test-PR von Franz (Vorschau-Weg) und, nach dem Merge, mit einem kleinen Test-PR von Thiago (Selbstbau-Weg).
2. „Prüfungen“ und „Klicktests“ brechen alte Läufe desselben PR ab.
3. Alle Jobs mit Claude-Token oder Bot-Schlüssel nutzen `environment: agenten`. Kein Workflow liest diese Secrets mehr als Repo-Secrets.
4. `.github/CODEOWNERS` deckt alle heiklen Pfade aus Punkt 4 ab, ohne `*`.
5. `README.md` und der Abschnitt in `AGENTS.md` nach Punkt 5 und 6, alle Befehle am Code belegt, keine Werte.
6. Das Risiko-Skript stuft `CODEOWNERS` als C ein, Test grün.
7. `scripts/github/branch-schutz-main.json` und `LIESMICH.md` sind vorhanden. Die Befehle sind vollständig und haben keine Platzhalter außer Thiagos GitHub-Namen.
8. `pnpm typecheck`, `lint`, `test`, `build` grün. Workflows sind syntaktisch gültig (`actionlint`, falls vorhanden, sonst sorgfältig gegenlesen). Keine App-Änderung, also kein neuer Klicktest. Bestehende Klicktests laufen in GitHub über den Vorschau-Weg grün.
9. Kein Secret-Wert in Dateien, Logs, Artefakten oder Issues.

## Deploy

Klasse C, durch Franz, **in dieser Reihenfolge** (sonst brechen die Agenten zwischendurch):

1. Diffs selbst prüfen: `.github/workflows/*`, `.github/CODEOWNERS`, `scripts/github/*` (per `pbcopy < datei` in den Chat zur Durchsicht).
2. **Umgebung `agenten` anlegen**, nur Zweig `main` (per `gh api`, wie bei `feedback-triage`).
3. **Secrets in die Umgebung** – 🔐 Bitwarden, Werte von dort, nie anzeigen: `CLAUDE_CODE_OAUTH_TOKEN`, `KPORGA_BOT_CLIENT_ID`, `KPORGA_BOT_PRIVATE_KEY` mit `gh secret set … --env agenten`.
4. `deploy` → Prüfungen grün. Meldet GitHub, dass das Code-Owner-Review fehlt (Franz' eigener PR), merged Franz als Admin: `gh pr merge spec/019-mitentwickler --merge --admin`.
5. Erst nach dem Merge: die drei **Repo-Secrets löschen** (`gh secret delete …`), Build-Agent einmal mit einem kleinen Test-Issue prüfen.
6. **Repo-Einstellungen:** nur Merge-Commits (`allow_squash_merge=false`, `allow_rebase_merge=false`), Branch-Schutz nach `scripts/github/LIESMICH.md`.
7. **Thiago einladen** (Collaborator, `push`) mit seinem GitHub-Namen. Danach ein kleiner Test-PR von Thiago (z. B. Tippfehler), um den Selbstbau-Weg der Klicktests zu prüfen.
8. Hinweis für die Übergabe: Eigene PRs, die heikle Dateien ändern, merged Franz nach grünen Checks mit `--admin`, falls `deploy` „Noch nicht gemergt“ meldet.

## Neuigkeiten

keiner (keine sichtbare Änderung in der App)

## Abweichungen beim Bau

(von Claude Code zu ergänzen; nie den Freigabe-Haken hier eintragen, stattdessen „(von Franz freigegeben)“)
