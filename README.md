# Krachparade Orga

Planungs-App für die Kern-Orga der Krachparade (Mehr Lärm für München), erste Ausgabe: Krachparade 2027 am 08.05.2027. Die App enthält den Plan rückwärts von der Krachparade, die Arbeitskreise und Protokolle mit Beschlüssen und To-dos. Gebaut wird sie mit Claude Code nach Specs, siehe [Wie gebaut wird](#wie-gebaut-wird).

App: https://krachparade-orga.de (selbst gehostet mit Coolify, Anmeldung mit Google nur für freigeschaltete Mitglieder der Kern-Orga). Zum Ausprobieren mit ausgedachten Daten gibt es zu jedem Pull Request eine Vorschau mit Dev-Login.

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
| Datenbank | Neon: Projekt *Production* (echte Daten) für die App, Projekt *Krachparade Orga* (ausgedachte Daten) für Vorschauen |

- **Deploy:** Jeder Push auf `main` wird automatisch gebaut und ausgeliefert. Gebaut wird auf dem Server mit Railpack, das Node und pnpm aus `.node-version` und `package.json` nimmt.
- **Vorschau:** Jeder Pull Request gegen `main` bekommt eine eigene Vorschau unter der PR-Nummer. Neue Commits im PR bauen sie neu, beim Schließen wird sie entfernt. Die Vorschauen nutzen die Demo-Datenbank mit ausgedachten Daten, nie die Production-Datenbank.
- **Neue Tabellen oder Spalten:** Ändert ein PR `src/db/schema.ts`, bringt die Action „Schema Vorschau“ die Demo-Datenbank (und die Klicktest-Datenbank) automatisch auf den Stand des PRs. Nach dem Merge macht „Schema Production“ dasselbe mit Production, vorher legt sie in Neon einen Backup-Zweig an. Production lässt sich auch von Hand abgleichen: Actions → „Schema Production“ → Run workflow (mit „Nur anzeigen“ ohne Änderung). Beide führen nur hinzufügende Änderungen aus (neue Tabellen, Spalten, Indizes). Würde etwas gelöscht, umbenannt oder ein Typ geändert, brechen sie ab, ohne etwas zu ändern; dann von Hand klären. Die Klicktests laufen parallel und können beim ersten Lauf noch am alten Schema scheitern: dann einfach neu starten.
- **Umgebungsvariablen** trägt das Team direkt in Coolify ein, für Production und Vorschau getrennt, jeweils auch zur Build-Zeit. Beide: `DATABASE_URL`, `AUTH_SECRET`, `AUTH_TRUST_HOST=true`, `ADMIN_EMAILS`. **Kein** `AUTH_URL`/`NEXTAUTH_URL` setzen: Coolify gibt Production-Variablen auch an die Vorschauen weiter, dann landet der Login dort auf der Hauptdomain. Die App nimmt ihre Adresse aus der Anfrage (`src/lib/forwarded-url.ts`). Production zusätzlich `APP_ENV=production`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` und die `SMTP_*`-Variablen; Vorschau zusätzlich `APP_ENV=preview` und `ENABLE_DEV_LOGIN=1` (siehe [Dev-Login](#dev-login)). Der Umzug auf echte Daten steht in [`docs/betrieb/produktivgang.md`](docs/betrieb/produktivgang.md).
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
- in Vorschau und Demo nur mit `APP_ENV=preview` **und** `ENABLE_DEV_LOGIN=1`

In allen anderen Fällen ist er aus, und `/dev/**` antwortet mit 404 (`src/lib/dev-login.ts`, `src/proxy.ts`).

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
| `pnpm db:push:prod` | Schema auf Production (`DATABASE_URL_PROD`) – vorher Backup-Zweig in Neon, nur hinzufügend |
| `pnpm db:seed:prod` | Stammdaten auf Production – nur für eine leere Datenbank |

## Daten-Regel

- Seed, Tests, Vorschau und Demo nutzen nur ausgedachte Daten, E-Mails nur auf `@example.org`.
- In Production stehen keine Telefonnummern, Postadressen oder Kontodaten.

## Wie gebaut wird

1. Spec in `docs/specs/NNN-kurzname.md` nach der Vorlage `docs/specs/_vorlage.md`
2. Freigabe durch eine Entwicklerin oder einen Entwickler (Label `go` bzw. Kopfzeile der Spec)
3. Bau lokal mit Claude Code auf einem eigenen Zweig
4. Pull Request gegen `main`, Coolify baut automatisch eine Vorschau
5. Prüfen: GitHub-Actions „Prüfungen“ und „Klicktests“ müssen grün sein, dazu die Vorschau durchklicken
6. Eine **andere** Person gibt die PR frei (Approve), dann Merge als Merge-Commit; danach liefert Coolify `main` automatisch aus

Jede Änderung bekommt eine Risikoklasse: A ist unkritisch, B braucht eine freigegebene Spec, C braucht die ausdrückliche Freigabe einer anderen Entwicklerin oder eines anderen Entwicklers. Details in [`AGENTS.md`](AGENTS.md) und [`agents/risikoklassen.json`](agents/risikoklassen.json).

## Mitentwickeln

Bis zu vier Entwickler:innen arbeiten gleichberechtigt mit Zweigen im selben Repo, ohne Fork. **Nach `main` kommt nichts ohne Pull Request**, und jede PR braucht die Freigabe einer anderen Person. Einrichtung und Aufnahme neuer Leute: [`scripts/github/TEAM.md`](scripts/github/TEAM.md).

1. Spec in `docs/specs/` (Vorlage `docs/specs/_vorlage.md`)
2. Freigabe durch eine andere Entwicklerin oder einen anderen Entwickler
3. Bau auf einem eigenen Zweig, lokal wie unter [Lokal starten](#lokal-starten) beschrieben, mit **eigenem Neon-Projekt**
4. Pull Request gegen `main`, die Vorschau-Adresse steht unter `https://<PR-Nummer>.preview.krachparade-orga.de`
5. Eine andere Person prüft PR und Vorschau und klickt **Approve**
6. Merge als Merge-Commit, sobald alles grün ist, danach ist der Stand live

Kleinkram geht ohne Spec: Fehler beheben, Texte, Tests. Ein neues Datenmodell braucht immer eine Spec.

Ideen und Fehler gern als Issue.

## Weiterlesen

- [`AGENTS.md`](AGENTS.md) – Regeln für Agenten und Ablauf
- [`docs/specs/`](docs/specs/) – alle Specs
- [`.env.example`](.env.example) – Namen der Umgebungsvariablen
