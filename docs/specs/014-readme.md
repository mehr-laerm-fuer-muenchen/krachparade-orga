# SPEC 014 – README für Mitlesende

Freigabe Franz: ☑
Zweig: `014-readme` · Risikoklasse A · lokal · DB: nein

## Ziel

Ein Entwickler mit Leserechten (Rolle **Read**) versteht ohne Rückfrage, was die App ist, wie sie gebaut wird und wie er sie lokal mit **eigenen** Werten startet, ohne ein Geheimnis von Franz. Das bisherige README ist der unveränderte Text von create-next-app und wird komplett ersetzt. Außerdem fliegen ungenutzte Vorlagen-Dateien raus.

## Nicht in dieser Spec

- Keine Änderung an Code, Workflows, `.github/`, `.claude/`, `AGENTS.md`, `agents/`, `scripts/`, Configs, `.env*` (auch nicht `.env.example`)
- Kein Umbau, damit die App lokal ohne Google-Werte startet. Falls das heute nicht geht: nur beschreiben und als Abweichung vermerken
- Keine Autor-Prüfung im Build-Agenten (kommt in die Spec „Mitentwickler“)
- Keine Änderung der Git-Historie oder der Commit-Autoren
- Keine Übersetzung anderer Doku

## Umsetzung

### 1. `README.md` neu schreiben (Deutsch)

Inhalt in dieser Reihenfolge. Alle Angaben **aus dem Code belegen**, nichts aus dem Gedächtnis:

1. **Titel und Zweck** in zwei bis drei Sätzen: Orga-App für die Kern-Orga der Krachparade (Mehr Lärm für München), erste Ausgabe Krachparade 2027. Plan rückwärts von der Krachparade, Arbeitskreise, Protokolle mit Beschlüssen und To-dos. Hinweis: Die App wird mit Claude Code nach Specs gebaut, siehe Abschnitt „Wie gebaut wird“.
2. **Stack** als kurze Liste mit Versionen aus `package.json`: Next.js (App Router), React, TypeScript strict, Tailwind, Drizzle mit Neon Postgres (`neon-http`), Auth.js mit Google, Zod, Vitest, Playwright, pnpm, Node-Version aus `.node-version`.
3. **Ordner** in einer kurzen Liste: `src/app`, `src/actions`, `src/lib` (reine Funktionen, „heute“ als Parameter), `src/db`, `src/components`, `docs/specs`, `e2e`, `agents`, `scripts`.
4. **Lokal starten**, Schritt für Schritt mit vollständigen Befehlen:
   - Node-Version aus `.node-version`, `pnpm install`
   - `.env.example` nach `.env.local` kopieren
   - Eigene Werte: **eigenes kostenloses Neon-Projekt** für `DATABASE_URL`; `AUTH_SECRET` selbst erzeugen (Befehl angeben, den das Projekt bzw. Auth.js dafür vorsieht); `ADMIN_EMAILS` mit einer ausgedachten `@example.org`-Adresse
   - Anmeldung lokal über den **Dev-Login** (`/dev/login`). Genau so beschreiben, wie der Code ihn lokal aktiviert. Prüfen, ob die App ohne `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET` startet. Wenn nicht: im README ehrlich angeben, was nötig ist (z. B. eigener Google-OAuth-Client), und als Abweichung vermerken
   - `pnpm db:push`, `pnpm db:seed`, `pnpm dev`
   - Deutlicher Hinweis: Niemals Werte von Franz verwenden; `:prod`-Skripte sind nur für Franz
5. **Befehle** als Tabelle aus `package.json` (`dev`, `build`, `lint`, `typecheck`, `test`, `e2e`, `db:push`, `db:seed`, `db:reset:dev` falls vorhanden; `:prod`-Skripte mit „nur Franz“).
6. **Daten-Regel:** Seed, Tests und Vorschau nur ausgedachte Daten, E-Mails auf `@example.org`. In Production keine Telefonnummern, Postadressen oder Kontodaten.
7. **Wie gebaut wird:** Spec in `docs/specs/NNN-kurzname.md` nach `docs/specs/_vorlage.md` → Freigabe durch Franz → Bau lokal oder per Build-Agent → PR → Pflicht-Checks „Prüfungen“ und „Klicktests“ → Merge auf `main` = live auf Vercel. Risikoklassen A/B/C in einem Satz, Verweis auf `AGENTS.md` und `agents/risikoklassen.json`.
8. **Beitragen:** Ideen, Fehler und Spec-Vorschläge als Issue. Das Label `go` setzt nur Franz, und zwar nur auf Issues, die er selbst angelegt hat. Fremde Vorschläge übernimmt er in ein eigenes Issue. Code-Vorschläge als PR aus einem Fork: Prüfungen laufen bei Fork-PRs nicht automatisch, Franz übernimmt Änderungen nach Review. Keine Merge-Rechte für Mitlesende.
9. **Weiterlesen:** Links auf `AGENTS.md`, `docs/specs/`, `.env.example`.

Stil: knapp, sachlich, Du-Form. Keine echten Namen oder E-Mails. Keine Werte von Umgebungsvariablen. Keine Produktions-Adressen der Datenbank. Die öffentliche App-URL darf genannt werden.

### 2. Ungenutzte Vorlagen-Dateien löschen

`public/file.svg`, `public/globe.svg`, `public/next.svg`, `public/vercel.svg`, `public/window.svg`, **nur wenn** sie weiterhin nirgends referenziert sind (Suche im ganzen Repo außer `node_modules` und `.next`). Ist eine davon doch in Benutzung: liegen lassen und als Abweichung vermerken.

## Akzeptanzkriterien

- `README.md` enthält alle neun Abschnitte; kein Text von create-next-app mehr, keine Erwähnung von npm, yarn oder bun
- Jeder Befehl im README existiert so in `package.json` bzw. funktioniert wie beschrieben
- Der Ablauf „Lokal starten“ ist gegen den Code geprüft. Claude Code nennt im Abschlussbericht, ob die App ohne Google-Werte startet
- Keine echten Namen, E-Mails oder Geheimnisse im README
- Die fünf SVGs sind gelöscht oder begründet vermerkt
- `scripts/risikoklasse.ts` stuft den Zweig als **A** ein
- Kein neuer Klicktest nötig (keine Oberflächenänderung). Bestehende Klicktests laufen grün, auch gegen den lokalen Production-Build (Port 3100)
- `pnpm typecheck`, `lint`, `test`, `build` grün
- Abweichungen in dieser Spec unter „Abweichungen beim Bau“ vermerkt, ohne das Freigabe-Muster

## Deploy

Keine DB. `deploy`.

## Abweichungen beim Bau

- **SVGs nicht gelöscht:** `public/file.svg`, `globe.svg`, `next.svg`, `vercel.svg` und `window.svg` sind weiterhin nirgends referenziert (Suche ohne `node_modules`, `.next`, `.git`). Das Löschen per `git rm` hat der Auto-Modus von Claude Code als unumkehrbar blockiert; auf Franz' Entscheidung bleiben sie liegen und fliegen in einer späteren Änderung raus.
- **Start ohne Google-Werte:** Die App startet ohne `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET`. Auth.js prüft beim Start nur `AUTH_SECRET` und vertrauenswürdigen Host, nicht die Client-ID des Google-Providers; der Dev-Login braucht keine Google-Werte. Nur „Mit Google anmelden“ funktioniert dann nicht. Kein Umbau nötig, im README so beschrieben.
- **`AUTH_SECRET`-Befehl:** Das Projekt sieht keinen eigenen Befehl vor. Das README nennt `openssl rand -base64 33` (in der Auth.js-Doku als Alternative zu `npx auth secret` genannt), weil das README weder npm noch npx erwähnen soll und `auth secret` selbst in `.env.local` schreiben würde.
- **Production-Build-Test:** Der Klicktest auf Port 3100 braucht einen Build mit `VERCEL_ENV=preview ENABLE_DEV_LOGIN=1`. Im normalen `pnpm build` wird `/dev/login` statisch als 404 vorgerendert, dann kann sich der Klicktest nicht anmelden.
