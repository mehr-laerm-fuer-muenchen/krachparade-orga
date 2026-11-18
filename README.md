# Krachparade Orga

Planungs-App für die Kern-Orga der Krachparade (Mehr Lärm für München), erste Ausgabe: Krachparade 2027 am 08.05.2027. Die App enthält den Plan rückwärts von der Krachparade, die Arbeitskreise und Protokolle mit Beschlüssen und To-dos. Gebaut wird sie mit Claude Code nach Specs, siehe [Wie gebaut wird](#wie-gebaut-wird).

Live: https://krachparade-orga.vercel.app (Anmeldung nur für freigeschaltete Mitglieder der Kern-Orga)

## Stack

Versionen aus `package.json` bzw. `.node-version`:

- Next.js 16.4.0 (App Router, Server Components, Server Actions)
- React 19.3.0
- TypeScript 5 mit `strict`
- Tailwind CSS 4
- Drizzle ORM 0.45 mit Neon Postgres über `drizzle-orm/neon-http` (`@neondatabase/serverless` 1.2)
- Auth.js (`next-auth` 5.0.0-beta.32) mit Google-Login und Dev-Login
- Zod 4
- Vitest 5 (Tests), Playwright 1.64 (Klicktests)
- pnpm 12.6.0
- Node 24.21.0 (`.node-version`)

## Ordner

- `src/app` – Seiten und Routen (App Router), `src/app/dev/**` nur lokal und in der Vercel-Vorschau
- `src/actions` – Server Actions (schreiben in die Datenbank)
- `src/lib` – reine Funktionen ohne Datenbank; Datumsrechnungen bekommen „heute“ als Parameter
- `src/db` – Schema, Verbindung, Datenzugriff, Seed
- `src/components` – UI-Bausteine
- `docs/specs` – Specs, Vorlage `docs/specs/_vorlage.md`
- `e2e` – Klicktests (Playwright)
- `agents` – Risikoklassen maschinenlesbar (`risikoklassen.json`)
- `scripts` – `risikoklasse.ts` stuft geänderte Dateien ein

## Lokal starten

Du brauchst nur **eigene** Werte. Niemals Werte von Franz verwenden, und die `:prod`-Skripte sind nur für Franz.

1. Node in der Version aus `.node-version` (24.21.0) installieren, z. B. mit fnm oder nvm. pnpm in der Version aus `packageManager` in `package.json` kommt über Corepack:

   ```bash
   corepack enable
   pnpm install
   ```

2. Vorlage für die Umgebungsvariablen kopieren:

   ```bash
   cp .env.example .env.local
   ```

3. In `.env.local` eigene Werte eintragen:

   - `DATABASE_URL`: Verbindungs-Adresse eines **eigenen kostenlosen Neon-Projekts** (neon.tech → neues Projekt → Connection String). Ohne diesen Wert brechen `pnpm db:push`, `pnpm db:seed` und jede Seite mit „DATABASE_URL fehlt“ ab.
   - `AUTH_SECRET`: selbst erzeugen, z. B. mit

     ```bash
     openssl rand -base64 33
     ```

     Ohne diesen Wert klappt keine Anmeldung (Auth.js meldet `MissingSecret`).
   - `ADMIN_EMAILS`: eine ausgedachte Adresse wie `admin@example.org` (mehrere durch Komma getrennt).
   - `AUTH_GOOGLE_ID` und `AUTH_GOOGLE_SECRET`: für den lokalen Start **nicht nötig**, einfach leer lassen; du meldest dich über den Dev-Login an (Schritt 6). Nur der Knopf „Mit Google anmelden“ auf `/login` funktioniert dann nicht. Willst du den Google-Login selbst ausprobieren, brauchst du einen eigenen Google-OAuth-Client mit der Weiterleitung `http://localhost:3000/api/auth/callback/google`, und deine Google-Adresse muss in `ADMIN_EMAILS` stehen oder einem aktiven Mitglied gehören.

4. Tabellen anlegen und ausgedachte Testdaten einspielen (beides liest `.env.local`):

   ```bash
   pnpm db:push
   pnpm db:seed
   ```

5. Entwicklungsserver starten:

   ```bash
   pnpm dev
   ```

6. http://localhost:3000/dev/login öffnen und dich als Test-Mitglied aus dem Seed anmelden.

   Der Dev-Login ist aktiv, solange `NODE_ENV` nicht `production` ist, also bei `pnpm dev`. In der Vercel-Vorschau braucht er `ENABLE_DEV_LOGIN=1`, in Production ist er immer aus und `/dev/**` antwortet mit 404 (`src/lib/dev-login.ts`, `src/proxy.ts`). Er meldet nur aktive Mitglieder mit `@example.org`-Adresse an.

## Befehle

| Befehl | Zweck |
|---|---|
| `pnpm dev` | Entwicklungsserver auf http://localhost:3000 |
| `pnpm build` | Produktions-Build |
| `pnpm start` | Produktions-Build starten |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | TypeScript prüfen (`tsc --noEmit`) |
| `pnpm test` | Tests mit Vitest |
| `pnpm e2e` | Klicktests mit Playwright gegen die laufende App (Standard `http://localhost:3000`, sonst `BASE_URL`) |
| `pnpm db:push` | Schema auf die Datenbank aus `DATABASE_URL` übertragen |
| `pnpm db:seed` | Ausgedachte Testdaten einspielen |
| `pnpm db:reset:dev` | Dev-Datenbank leeren und neu seeden |
| `pnpm db:push:prod` | Schema auf Production – **nur Franz** |
| `pnpm db:seed:prod` | Stammdaten auf Production – **nur Franz** |

## Daten-Regel

- Seed, Tests und Vorschau nutzen nur ausgedachte Daten, E-Mails nur auf `@example.org`.
- In Production stehen keine Telefonnummern, Postadressen oder Kontodaten.

## Wie gebaut wird

1. Spec in `docs/specs/NNN-kurzname.md` nach der Vorlage `docs/specs/_vorlage.md`
2. Freigabe durch Franz in der Kopfzeile der Spec
3. Bau lokal mit Claude Code oder per Build-Agent in GitHub
4. Pull Request
5. Pflicht-Checks „Prüfungen“ (typecheck, lint, test, build) und „Klicktests“ (Playwright gegen die Vercel-Vorschau oder gegen einen eigenen Build, siehe [Mitentwickeln](#mitentwickeln))
6. Merge durch Franz, nur als Merge-Commit = live auf Vercel

Jede Änderung bekommt eine Risikoklasse: A läuft vollautomatisch, B automatisch nach Freigabe der Spec, C entscheidet immer Franz. Details in [`AGENTS.md`](AGENTS.md) und [`agents/risikoklassen.json`](agents/risikoklassen.json).

## Beitragen

- Ideen, Fehler und Spec-Vorschläge als Issue.
- Das Label `go` setzt nur Franz, und zwar nur auf Issues, die er selbst angelegt hat. Fremde Vorschläge übernimmt er in ein eigenes Issue.

## Mitentwickeln

Mitentwickelnde sind **Collaborator mit Schreibrecht** und arbeiten mit Zweigen im selben Repo, ohne Fork.

1. Spec in `docs/specs/` (Vorlage `docs/specs/_vorlage.md`)
2. Freigabe nur durch Franz („Freigabe Franz: ☑“ in der Kopfzeile)
3. Bau auf einem eigenen Zweig, lokal wie unter [Lokal starten](#lokal-starten) beschrieben, mit **eigenem Neon-Projekt**
4. Pull Request gegen `main`
5. Pflicht-Checks „Prüfungen“ und „Klicktests“
6. **Merge durch Franz, nur als Merge-Commit**, danach live auf Vercel

Kleinkram geht ohne Spec: Fehler beheben, Texte, Tests. Ein neues Datenmodell braucht immer eine Spec.

Für eigene PRs gibt es keine Vercel-Vorschau, weil Vercel nur Commits von Mitgliedern des Vercel-Teams baut. Die „Klicktests“ bauen die App dann selbst und testen dagegen (`.github/workflows/klicktests.yml`). Die Regeln für Mitentwickelnde stehen in [`AGENTS.md`](AGENTS.md), Abschnitt 13.

## Weiterlesen

- [`AGENTS.md`](AGENTS.md) – Regeln für Agenten und Ablauf
- [`docs/specs/`](docs/specs/) – alle Specs
- [`.env.example`](.env.example) – Namen der Umgebungsvariablen
