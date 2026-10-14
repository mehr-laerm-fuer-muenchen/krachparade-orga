# SPEC 002 – Google-Login

Freigabe Franz: ☑
Zweig: `spec/002-google-login` · Risikoklasse C · lokal · DB: ja: neue Tabelle `members`

## Ziel

Nur eingeladene Personen der Kern-Orga kommen in die App. Sie melden sich mit ihrem Google-Konto an. Wer nicht eingeladen ist, sieht eine klare Absage statt eines Fehlers. Admins werden über die Umgebungsvariable `ADMIN_EMAILS` festgelegt, damit keine echte Adresse im Code oder in den Testdaten steht.

## Nicht in dieser Spec

- Personen einladen oder verwalten über die Oberfläche (kommt in 003)
- Rollen außer Admin / Mitglied
- Login auf Vorschau-Deployments (dort bleibt der Dev-Login aus 001)
- Andere Login-Wege (Magic Link, Passwort)

## Umsetzung

1. **Paket:** `next-auth@beta` (Auth.js v5) und `@auth/drizzle-adapter` nur falls nötig. Bevorzugt JWT-Sessions ohne Adapter-Tabellen. Neue Laufzeit-Pakete sind Klasse C, deshalb lokal. Falls Auth.js mit Next.js 16 nicht sauber läuft: stoppen, Fehler beschreiben, nichts umbauen.
2. **Tabelle `members`** in `src/db/schema.ts`:
   - `id` (uuid, Primärschlüssel), `email` (text, eindeutig, immer klein geschrieben), `name` (text), `is_admin` (boolean, Standard false), `active` (boolean, Standard true), `created_at`, `last_login_at` (timestamp, leer erlaubt)
3. **Konfiguration** `src/auth.ts`:
   - Provider Google, Scopes nur `openid email profile`.
   - `signIn`-Callback: erlaubt, wenn die E-Mail in `members` mit `active = true` steht **oder** in `ADMIN_EMAILS` (Komma-Liste) steht. Steht sie nur in `ADMIN_EMAILS`, wird beim ersten Login ein `members`-Eintrag mit `is_admin = true` und dem Namen aus Google angelegt.
   - Bei jedem Login `last_login_at` setzen; `is_admin` ist zusätzlich immer true für Adressen in `ADMIN_EMAILS`.
   - Session enthält `memberId`, `name`, `isAdmin`. Keine E-Mail-Adressen in Logs.
4. **Zugangsschutz** in `src/proxy.ts`: alle Seiten geschützt außer `/login`, `/api/auth/**`, statischen Dateien und dem Dev-Login (nur lokal/Vorschau). Nicht angemeldet → Weiterleitung auf `/login`.
5. **Seite `/login`**: App-Name „Krachparade Orga“, ein Button „Mit Google anmelden“, ruhiger Arbeits-Stil. Darunter in kleiner, gedämpfter Schrift der Datenschutzhinweis: „Die Anmeldung läuft über dein Google-Konto. Wir speichern nur deinen Namen und deine E-Mail-Adresse, damit du Zugang zur App bekommst. Dein Passwort sehen wir nie.“ Bei abgelehntem Login Hinweis: „Dieses Google-Konto ist nicht für die Krachparade Orga freigeschaltet. Melde dich bei einem Admin.“
6. **Abmelden**: Link „Abmelden“ auf der Startseite (in 003 wandert er in die Navigation).
7. **Dev-Login** aus 001 setzt eine Session für ein Test-Mitglied aus dem Seed, damit Vorschau und Klicktests ohne Google funktionieren.
8. **Seed** `src/db/seed.ts` (nur ohne `--prod`, production bekommt keine Test-Mitglieder): drei ausgedachte Mitglieder ohne echte Adressen: „Kim Brenner“ (`kim.brenner@example.org`, Admin), „Alex Rauch“ (`alex.rauch@example.org`), „Sascha Möller“ (`sascha.moeller@example.org`).
9. **Reine Funktion** `src/lib/access.ts`: `isAllowed(email, members, adminEmails)` und `parseAdminEmails(value)` (trimmen, klein schreiben, leere Einträge ignorieren) mit Vitest-Tests.
10. **Klicktest** `e2e/login.spec.ts`: nicht angemeldet → `/login`; nach Dev-Login → Startseite mit Namen „Kim Brenner“; Abmelden → wieder `/login`.

### Einrichtung durch Franz (vor dem Bauen, einmalig)

Google Cloud Console → neues Projekt `krachparade-orga` → „APIs & Dienste“ → OAuth-Zustimmungsbildschirm: Typ „Extern“, App-Name „Krachparade Orga“, nur Scopes `openid`, `email`, `profile`, Status vorerst „Test“ mit eingetragenen Testnutzern (für „In Produktion“ verlangt Google Startseite und Datenschutzerklärung auf eigener Domain – eigene Spec später); jede eingeladene Person muss zusätzlich in der Google Console als Testnutzer stehen → Anmeldedaten → OAuth-Client-ID, Typ „Webanwendung“, autorisierte Weiterleitungs-URIs:
- `http://localhost:3000/api/auth/callback/google`
- `https://krachparade-orga.vercel.app/api/auth/callback/google`

Client-ID und Secret in Bitwarden, dann in `.env.local` und Vercel (Production) als `AUTH_GOOGLE_ID` und `AUTH_GOOGLE_SECRET`. Dazu `AUTH_SECRET` und `ADMIN_EMAILS` (deine eigene Google-Adresse). Die Befehle dafür kommen im Bauauftrag.

## Akzeptanzkriterien

- Lokal: Login mit Franz' Google-Konto (aus `ADMIN_EMAILS`) klappt, ein `members`-Eintrag mit Admin entsteht
- Ein nicht eingeladenes Google-Konto bekommt die Absage-Meldung auf `/login`, keinen Fehlerbildschirm
- Der Datenschutzhinweis steht auf `/login` und ist bei 375 px lesbar
- Ohne Anmeldung ist keine Seite außer `/login` erreichbar (auch nicht per direkter URL)
- Vitest für `src/lib/access.ts` grün (eingeladen, deaktiviert, nur in `ADMIN_EMAILS`, Groß-/Kleinschreibung, Leerzeichen)
- Klicktest `e2e/login.spec.ts` grün bei 375 × 812 und 1280 × 800
- In Code, Seed und Tests steht keine echte E-Mail-Adresse; Logs enthalten keine E-Mail-Adressen
- `pnpm typecheck`, `lint`, `test`, `build` grün
- Nach dem Merge: Login auf `https://krachparade-orga.vercel.app` mit Franz' Konto klappt am iPhone

## Deploy

DB-Änderung: Neon-Backup-Zweig `backup-vor-002` → `pnpm db:push:prod` (kein Seed auf production) → `deploy --db-erledigt`. Vorher Vercel-Env für Production gesetzt: `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `ADMIN_EMAILS`.
