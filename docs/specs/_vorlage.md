# SPEC NNN – Titel

Freigabe Franz: ☐
Zweig: `agent/NNN-kurzname` · Risikoklasse A/B/C (Einschätzung, maßgeblich ist das Skript) · lokal/Autopilot · DB: nein / ja: …

<!--
Als GitHub-Issue: Titel genau `NNN-kurzname` (z. B. `002-login`), Label `spec`,
dieser Text als Issue-Text. Freigabe = Label `go` setzen; der Workflow setzt den Haken
und schreibt den Go-Vermerk. Den Haken nie selbst setzen lassen.
-->

## Ziel

Was soll danach anders sein – für wen, und woran merkt man es? Zwei bis fünf Sätze.

## Nicht in dieser Spec

- Was bewusst weggelassen wird (später, eigene Spec).

## Umsetzung

### B1 · Erster Baustein

- Welche Dateien, Seiten, Komponenten, Tabellen oder Actions.
- Texte der Oberfläche wörtlich, falls wichtig.

### B2 · Klicktest (Pflicht)

- Mindestens ein Klicktest in `e2e/`, der die neue Funktion durchklickt.
- Test-Daten mit Präfix „E2E " anlegen und am Ende wieder löschen; nur ausgedachte Daten mit `@example.org`.

## Akzeptanzkriterien

1. …
2. Mindestens ein Klicktest in `e2e/` deckt die neue Funktion ab und ist grün.
3. `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` grün; „Prüfungen" und „Klicktests" im PR grün.
4. Bei 375 × 812 und 1280 × 800 geprüft.

## Deploy

Datenbank-Änderung nein → `deploy`.
Datenbank-Änderung ja → Neon-Backup-Zweig `backup-vor-NNN` von production → `pnpm db:push:prod` (vom PR-Zweig, durch Franz) → mergen → `deploy --db-erledigt`.
