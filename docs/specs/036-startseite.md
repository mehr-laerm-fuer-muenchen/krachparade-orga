# SPEC 036 – Öffentliche Startseite

Freigabe Franz: ☑
Go: Tiago im Chat, 25.11.2026
Zweig: `agent/036-startseite` · Risikoklasse C (`src/proxy.ts`: neue Seite ohne Anmeldung; Einschätzung, maßgeblich ist das Skript) · lokal · DB: nein

## Ziel

Google lehnt die Prüfung des OAuth-Brandings ab: Die Startseite `https://krachparade-orga.de/` beschreibe den Zweck der App nicht. Bisher leitet `/` ohne Anmeldung sofort auf `/login` weiter, wo nur ein Anmelde-Knopf steht. Danach zeigt `/` Besuchern ohne Anmeldung eine kurze öffentliche Seite: wer die App betreibt, wofür sie da ist, wer sie nutzen darf und wofür Google genutzt wird, mit Links zu Anmelden, Datenschutz und Impressum. Angemeldete Mitglieder sehen unter `/` wie bisher den Plan.

## Nicht in dieser Spec

- Indexierung: `robots: noindex` bleibt auch auf der Startseite. Google muss die Seite für die Prüfung nur abrufen können.
- Eigenes Impressum: steht auf krachparade.de, die Startseite verlinkt darauf.
- Änderungen an `/login` oder an anderen geschützten Seiten.

## Umsetzung

### B1 · Seite `/start`

- `src/app/start/page.tsx`: liegt außerhalb von `(public)` (dessen Kopfleiste heißt „Anmeldung“) und außerhalb von `(app)`. Eigene schlichte Forest-Kopfleiste mit Logo, „Krachparade Orga“ und „Mehr Lärm für München“. Breite `max-w-2xl`. Titel „Krachparade Orga – Planungs-App der Krachparade“.
- Inhalt:
  1. Überschrift „Krachparade Orga“ und ein Satz: interne Planungs-App der Kern-Orga der Krachparade in München, betrieben von der Initiative Mehr Lärm für München.
  2. **Wofür:** Planung der Krachparade 2027 (Zeitplan und Aufgaben, Arbeitskreise, Protokolle der Treffen, Anmeldung und Übersicht der teilnehmenden Kollektive).
  3. **Wer:** nur freigeschaltete Mitglieder der Orga. Ein öffentliches Konto gibt es nicht. Kollektive melden sich über das öffentliche Formular an.
  4. **Anmeldung mit Google:** nur zum Anmelden. Die App liest Name und E-Mail-Adresse, nutzt keine weiteren Google-Dienste und gibt keine Daten an Dritte weiter.
  5. Knopf „Anmelden“ (→ `/login`), Links „Datenschutzerklärung“ (→ `/datenschutz`) und „Impressum“ (→ https://krachparade.de).
- `src/proxy.ts`: `/start` zu `PUBLIC_PATHS`. Ohne Sitzung wird `/` per `NextResponse.rewrite` auf `/start` umgeschrieben (Status 200, Adresse bleibt `/`). Alle anderen geschützten Pfade leiten wie bisher auf `/login`.

### B2 · Klicktest (Pflicht)

- `e2e/startseite.spec.ts`: Ohne Anmeldung `/` öffnen → Adresse bleibt `/`, Überschrift, Zweck und Links sichtbar, kein horizontales Scrollen bei 375 px. „Anmelden“ führt zu `/login`.
- `e2e/login.spec.ts` anpassen: `/` zeigt ohne Anmeldung die Startseite statt `/login`; nach dem Abmelden zeigt `/` wieder die Startseite.

## Neuigkeiten

Keiner (für das angemeldete Team ändert sich nichts).

## Akzeptanzkriterien

1. `https://krachparade-orga.de/` zeigt ohne Anmeldung die Startseite mit allen Punkten aus B1, Status 200, ohne Weiterleitung.
2. Angemeldete Mitglieder sehen unter `/` den Plan wie bisher.
3. Alle anderen Seiten außer den bisher öffentlichen verlangen weiter eine Anmeldung.
4. Mindestens ein Klicktest in `e2e/` deckt die neue Seite ab und ist grün.
5. `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` grün; „Prüfungen“ und „Klicktests“ im PR grün.
6. Bei 375 × 812 und 1280 × 800 geprüft.

## Deploy

Datenbank-Änderung nein → `deploy`. Danach in der Google Auth Platform unter **Branding** → „Probleme aufrufen“ → „Ich habe die Probleme behoben“.
