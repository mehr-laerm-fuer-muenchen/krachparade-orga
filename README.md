# Krachparade Orga

Planungs-App für die Kern-Orga der Krachparade (Mehr Lärm für München), erste Ausgabe: Krachparade 2027 am 08.05.2027. Die App enthält den Plan rückwärts von der Krachparade, die Arbeitskreise und Protokolle mit Beschlüssen und To-dos. Gebaut wird sie mit Claude Code nach Specs, siehe [Wie gebaut wird](#wie-gebaut-wird).

Demo: https://krachparade-orga.de (selbst gehostet mit Coolify, nur ausgedachte Testdaten, Anmeldung über `/dev/login`)

Dieses Repo (`mehr-laerm-fuer-muenchen/krachparade-orga`) ist eine Kopie des Original-Repos, die statt auf Vercel auf einem eigenen Server läuft. Was hier anders ist, steht in [`AGENTS.md`](AGENTS.md), Abschnitt 0.

## Stack

Versionen aus `package.json` bzw. `.node-version`:

- Next.js 16.4.5 (App Router, Server Components, Server Actions)
- React 19.3.0
- TypeScript 5 mit `strict`
- Tailwind CSS 4
- Drizzle ORM 0.45 mit Neon Postgres über `drizzle-orm/neon-http` (`@neondatabase/serverless` 1.2)
- Auth.js (`next-auth` 5.0.0-beta.32) mit Google-Login und Dev-Login
- Zod 4
- Vitest 5 (Tests), Playwright 1.64 (Klicktests)
- pnpm 12.6.0
- Node 24.21.0 (`.node-version`)

## Hosting

Die App läuft mit [Coolify](https://coolify.io) auf einem eigenen netcup-Server.

| Was | Wo |
|---|---|
| App | https://krachparade-orga.de |
| PR-Vorschau | `https://<PR-Nummer>.preview.krachparade-orga.de` |
| Coolify-Oberfläche | https://coolify.krachparade-orga.de (nur fürs Team) |
| Datenbank | eigenes Neon-Projekt, nur ausgedachte Daten |

- **Deploy:** Jeder Push auf `main` wird automatisch gebaut und ausgeliefert. Gebaut wird auf dem Server mit Railpack, das Node und pnpm aus `.node-version` und `package.json` nimmt.
- **Vorschau:** Jeder Pull Request gegen `main` bekommt eine eigene Vorschau unter der PR-Nummer. Neue Commits im PR bauen sie neu, beim Schließen wird sie entfernt. Die Vorschauen nutzen dieselbe Demo-Datenbank wie die App.
- **Umgebungsvariablen** trägt das Team direkt in Coolify ein, für Production und Vorschau getrennt, jeweils auch zur Build-Zeit: `DATABASE_URL`, `AUTH_SECRET`, `AUTH_TRUST_HOST=true`, `ADMIN_EMAILS`, `ENABLE_DEV_LOGIN=1` und vorerst `VERCEL_ENV=preview` (siehe [Dev-Login](#dev-login)).
- **Benachrichtigungen:** Fehlgeschlagene Deploys meldet Coolify per Mail an das Team.

## Ordner

- `src/app` – Seiten und Routen (App Router), `src/app/dev/**` nur lokal und in Vorschau bzw. Demo
- `src/actions` – Server Actions (schreiben in die Datenbank)
- `src/lib` – reine Funktionen ohne Datenbank; Datumsrechnungen bekommen „heute“ als Parameter
- `src/db` – Schema, Verbindung, Datenzugriff, Seed
- `src/components` – UI-Bausteine
- `docs/specs` – Specs, Vorlage `docs/specs/_vorlage.md`
- `e2e` – Klicktests (Playwright)
- `agents` – Risikoklassen maschinenlesbar (`risikoklassen.json`)
- `scripts` – `risikoklasse.ts` stuft geänderte Dateien ein

## Lokal starten

Du brauchst nur **eigene** Werte. Niemals fremde Datenbank-Adressen verwenden, und die `:prod`-Skripte sind tabu.

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

   - `DATABASE_URL`: Verbindungs-Adresse eines **eigenen kostenlosen Neon-Projekts** (neon.com → neues Projekt → Connect). Ohne diesen Wert brechen `pnpm db:push`, `pnpm db:seed` und jede Seite mit „DATABASE_URL fehlt“ ab.
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

### Dev-Login

Der Dev-Login meldet nur aktive Mitglieder mit `@example.org`-Adresse an, ohne Einladungslink. Er ist aktiv:

- lokal, solange `NODE_ENV` nicht `production` ist, also bei `pnpm dev`
- in Vorschau und Demo nur mit `ENABLE_DEV_LOGIN=1` **und** `VERCEL_ENV=preview`

In allen anderen Fällen ist er aus, und `/dev/**` antwortet mit 404 (`src/lib/dev-login.ts`, `src/proxy.ts`). Dass auf Coolify `VERCEL_ENV` gesetzt werden muss, ist ein Überbleibsel aus der Vercel-Zeit und wird noch durch eine eigene Variable ersetzt.

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
| `pnpm db:push:prod` | Schema auf Production – **nicht benutzen**, gehört zum Original-Repo |
| `pnpm db:seed:prod` | Stammdaten auf Production – **nicht benutzen**, gehört zum Original-Repo |

## Daten-Regel

- Seed, Tests, Vorschau und Demo nutzen nur ausgedachte Daten, E-Mails nur auf `@example.org`.
- In Production stehen keine Telefonnummern, Postadressen oder Kontodaten.

## Wie gebaut wird

1. Spec in `docs/specs/NNN-kurzname.md` nach der Vorlage `docs/specs/_vorlage.md`
2. Freigabe durch Franz oder Tiago in der Kopfzeile der Spec
3. Bau lokal mit Claude Code auf einem eigenen Zweig
4. Pull Request gegen `main`, Coolify baut automatisch eine Vorschau
5. Prüfen: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` lokal, dazu die Vorschau durchklicken. Die GitHub-Actions-Workflows sind in dieser Kopie abgeschaltet.
6. Merge durch Franz oder Tiago, nur als Merge-Commit, danach liefert Coolify `main` automatisch aus

Jede Änderung bekommt eine Risikoklasse: A ist unkritisch, B braucht eine freigegebene Spec, C entscheiden immer Franz oder Tiago. Details in [`AGENTS.md`](AGENTS.md) und [`agents/risikoklassen.json`](agents/risikoklassen.json).

## Mitentwickeln

Alle drei arbeiten gleichberechtigt mit Zweigen im selben Repo, ohne Fork.

1. Spec in `docs/specs/` (Vorlage `docs/specs/_vorlage.md`)
2. Freigabe durch Franz oder Tiago
3. Bau auf einem eigenen Zweig, lokal wie unter [Lokal starten](#lokal-starten) beschrieben, mit **eigenem Neon-Projekt**
4. Pull Request gegen `main`, die Vorschau-Adresse steht unter `https://<PR-Nummer>.preview.krachparade-orga.de`
5. Merge als Merge-Commit, danach ist der Stand live

Kleinkram geht ohne Spec: Fehler beheben, Texte, Tests. Ein neues Datenmodell braucht immer eine Spec.

Ideen und Fehler gern als Issue.

## Weiterlesen

- [`AGENTS.md`](AGENTS.md) – Regeln für Agenten und Ablauf
- [`docs/specs/`](docs/specs/) – alle Specs
- [`.env.example`](.env.example) – Namen der Umgebungsvariablen
