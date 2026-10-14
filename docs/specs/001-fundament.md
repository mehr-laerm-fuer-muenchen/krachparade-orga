# SPEC 001 – Fundament

Freigabe Franz: ☑
Zweig: `spec/001-fundament` · Risikoklasse C · lokal · DB: ja: Tabelle `app_meta` (Platzhalter für db:push-Test)

## Ziel

`krachparade-orga` bekommt dasselbe technische Fundament wie `~/Projekte/schladming2go`: Projektregeln, Schutz für Claude Code, Risikoklassen, GitHub-Workflows (Prüfungen, Klicktests, Build-Agent, Fix-Agent, Abschluss-Meldung), Spec-Vorlage, Skripte und ein Dev-Login für lokal und Vorschau. Danach läuft jede weitere Spec über `freigabe`/`deploy` oder den Build-Agent.

## Nicht in dieser Spec

- Echter Login (Spec 002)
- Gestaltung, Navigation, fachliche Seiten (ab Spec 003)
- Freeze-Logik aus schladming2go

## Umsetzung

Grundlage ist das Next.js-Projekt aus `pnpm create next-app` (Bauplan Abschnitt 3, Schritte 1–5 erledigt). Übernimm aus `~/Projekte/schladming2go` und passe an:

1. **`AGENTS.md`** – allgemeiner Teil (Stack, Ordner, Regeln, Risikoklassen, Ablauf) aus schladming2go; Projektteil neu:
   - App „Krachparade Orga“ – Planungs-App der Kern-Orga der Krachparade (Mehr Lärm für München), erste Ausgabe Krachparade 2027 am 08.05.2027.
   - Nutzer: Kern-Orga, Handy und Laptop gleichwertig. Oberfläche Deutsch, ruhiger Arbeits-Stil: helle Flächen, Forest-Kopfleiste mit Logo, Farbe nur für Status und Primär-Aktionen; keine Plakat-Optik.
   - Daten: In Production stehen echte Daten der Kern-Orga (Namen, E-Mail für den Login, Protokolle), aber **keine Telefonnummern, Postadressen oder Kontodaten**. Seed, Tests und Vorschau nutzen nur ausgedachte Daten mit `@example.org`-Adressen.
   - Datumslogik: reine Kalendertage ohne Uhrzeit, Berechnungen als reine Funktionen in `src/lib/` mit „heute“ als Parameter.
   - `CLAUDE.md` enthält nur `@AGENTS.md`.
2. **`.claude/settings.json`**: keine Lesezugriffe auf `.env*`, kein `git push --force`, kein `rm -rf` (wie schladming2go).
3. **`agents/risikoklassen.json`** und **`scripts/risikoklasse.ts`** samt Vitest-Tests übernehmen; Pfade an dieses Repo anpassen, Klassen laut Bauplan 7.2.
4. **`.github/workflows/`**: Prüfungen, Klicktests, Build-Agent, Fix-Agent, Abschluss-Meldung übernehmen.
   - Bot-Secrets umbenennen auf `KPORGA_BOT_CLIENT_ID` und `KPORGA_BOT_PRIVATE_KEY`.
   - Freeze-Logik entfernen.
   - Issue-Titel gegen `^[0-9]{3}-[a-z0-9-]+$` prüfen, Issue-Texte nie in `run:` einsetzen.
   - Den bekannten falschen Hinweis im `braucht-db`-Kommentar korrigieren: Er nennt die Schritte aus Bauplan 7.4 (Prüfungen grün abwarten, Neon-Backup, `git fetch`, `git switch agent/NNN-kurzname`, `pnpm db:push:prod`, `git switch main`, `gh pr merge <nr> --merge`, `git pull`).
5. **`docs/specs/_vorlage.md`** (Spec-Vorlage aus Bauplan 6), **`.github/PULL_REQUEST_TEMPLATE.md`**, **`.env.example`** nur mit Namen: `DATABASE_URL`, `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `ADMIN_EMAILS`.
6. **Datenbank**: `src/db/schema.ts` mit Tabelle `app_meta` (`key` text Primärschlüssel, `value` text), `src/db/index.ts` mit `drizzle-orm/neon-http`, `drizzle.config.ts`, `src/db/seed.ts` (schreibt `seed_version = 1`; nimmt ein Argument `--prod`, mit dem später nur Stammdaten ohne Test-Personen angelegt werden).
7. **Skripte** laut Bauplan 2: `dev`, `build`, `lint`, `typecheck`, `test`, `e2e`, `db:push`, `db:seed`, `db:push:prod`, `db:seed:prod` (ruft den Seed mit `--prod`); dazu `db:reset:dev` (leert alle App-Tabellen und seedet neu; bricht ab, wenn `VERCEL_ENV` gleich `production`).
8. **Dev-Login** wie in schladming2go: nur lokal und auf Vercel-Vorschau aktiv (`src/app/dev/**`), auf Production nicht erreichbar. In 002 wird er an die Mitglieder-Tabelle angebunden.
9. **Startseite** `src/app/page.tsx`: „Krachparade Orga – im Aufbau“.
10. **Klicktest** `e2e/fundament.spec.ts`: Startseite lädt und zeigt „Krachparade Orga“; Dev-Login-Seite lädt lokal.

## Akzeptanzkriterien

- `pnpm typecheck`, `lint`, `test`, `build` grün
- Vitest für `scripts/risikoklasse.ts` grün (mind. je ein Fall A, B, C und „höchste Klasse gewinnt“)
- `pnpm db:push` und `pnpm db:seed` laufen gegen die Dev-Datenbank, `app_meta` enthält `seed_version = 1`
- `pnpm db:reset:dev` läuft lokal und bricht mit `VERCEL_ENV=production` ab
- Klicktest grün bei 375 × 812 und 1280 × 800
- `CLAUDE.md` enthält nur `@AGENTS.md`; `AGENTS.md` enthält den Projektteil mit der Daten-Regel
- In keiner Datei stehen Werte von Secrets; `.env.example` enthält nur Namen
- Nach dem Merge: Production zeigt die Startseite, `/dev/…` liefert auf Production 404

## Deploy

DB-Änderung: Neon-Backup-Zweig `backup-vor-001` von production → `pnpm db:push:prod` → `pnpm db:seed:prod` → `deploy --db-erledigt`. Danach GitHub einrichten laut Bauplan 7.3 (Branch-Schutz, `CLAUDE_CODE_OAUTH_TOKEN`, eigene GitHub App mit Präfix `KPORGA`, Vercel-Bypass-Secret, `DEV_DATABASE_URL`, Repo-Variablen).
