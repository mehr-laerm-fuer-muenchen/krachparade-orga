# SPEC 034 – Hell oder dunkel wählen

Freigabe Franz: ☑
Zweig: `agent/034-dunkles-design` · Risikoklasse A (Styles, Komponente, Layout ohne `robots`, Klicktest; Einschätzung, maßgeblich ist das Skript) · lokal/Autopilot · DB: nein

## Ziel

Die App hat schon ein dunkles Design, aber es kommt nur, wenn das Handy oder der Laptop auf „dunkel“ steht. Wer die App anders sehen will als das Gerät, kann das bisher nicht einstellen. Danach gibt es unter **Einstellungen** einen Schalter mit Sonne und Mond, mit dem man zwischen hell und dunkel wechselt. Die Wahl gilt sofort, bleibt auf diesem Gerät gespeichert und flackert beim nächsten Laden nicht hell auf.

## Nicht in dieser Spec

- Neue Farben: Es werden nur die vorhandenen hellen und dunklen Farben aus `src/app/globals.css` benutzt, kein Feintuning der Palette.
- Speichern pro Person in der Datenbank (gilt dann auf allen Geräten). Hier gilt: pro Gerät/Browser.
- Die Dev-Login-Seite `src/app/dev/**` (Klasse C) mit ihren `dark:`-Klassen.
- Datenbank, Login/Zugang, Configs, `.github/`, `.claude/`, Skripte.

## Vorab: Abgleich mit dem Code

- `src/app/globals.css`: Die hellen Farben stehen auf `:root`, die dunklen in `@media (prefers-color-scheme: dark) { :root { … } }`.
- `src/app/layout.tsx`: setzt bisher nichts am `<html>` für das Design. Der `robots`-Eintrag (Klasse C) bleibt unverändert.
- `src/app/(app)/einstellungen/page.tsx`: Abschnitte als Karten (`SECTION`), Server-Komponente.

## Umsetzung

### B1 · Farben umschaltbar machen (`src/app/globals.css`)

- Die dunklen Werte gelten in zwei Fällen:
  - **System dunkel und keine eigene Wahl:** `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { … } }`
  - **Eigene Wahl dunkel:** `:root[data-theme="dark"] { … }`
- `:root[data-theme="light"]` erzwingt die hellen Werte (auch `color-scheme: light`), selbst wenn das System dunkel ist.
- Die dunklen Werte stehen nur **einmal** im Code. Sie werden nicht kopiert, sondern über einen gemeinsamen Selektor oder eine gemeinsame Regel eingebunden. Sollte Tailwind das nicht sauber erlauben, ist eine Kopie mit Kommentar „muss gleich bleiben wie …“ erlaubt. Das im PR erwähnen.
- Tailwind-Variante `dark:` für eigene Bausteine: `@custom-variant dark` so setzen, dass sie dieselben zwei Fälle abdeckt. Nur nötig, falls ein Baustein `dark:` braucht. Sonst weglassen.

### B2 · Kein Aufflackern beim Laden (`src/app/layout.tsx`)

- Ein kleines Inline-Skript im `<head>` liest vor dem ersten Zeichnen `localStorage["kp-theme"]` (`"light"` / `"dark"`) und setzt `data-theme` am `<html>`. Fehlt der Wert oder ist er ungültig, wird nichts gesetzt (= wie das Gerät). Der Zugriff steht in `try/catch` (privater Modus).
- `<html suppressHydrationWarning>`, weil das Skript das Attribut vor React setzt. Keine Hydration-Warnung in der Konsole (Regel 14).
- `metadata.robots` bleibt unangetastet.
- Vorher in `node_modules/next/dist/docs/` nachlesen, wie in dieser Next.js-Version ein Inline-Skript im Root-Layout eingebunden wird (`<script>` direkt oder `next/script` mit `beforeInteractive`), und das im PR festhalten.

### B3 · Schalter unter Einstellungen

- Neue Client-Komponente `src/components/settings/theme-switch.tsx`, eingebunden in `src/app/(app)/einstellungen/page.tsx` als eigener Abschnitt (gleiche Karte `SECTION`) **„Darstellung“**, direkt nach dem Seitentitel, für alle sichtbar auf allen Breiten.
- Inhalt:
  - Zeile „Dunkles Design“ mit einem Schalter (`role="switch"`, `aria-checked`, `aria-label="Dunkles Design"`). Links im Schalter eine Sonne, rechts ein Mond (SVG, `currentColor`). Der Knopf schiebt zur aktiven Seite. Tippfläche mindestens 44 × 44 px.
  - Darunter klein und gedämpft (`text-muted`): „Folgt dem Gerät“, solange keine eigene Wahl gespeichert ist; sonst ein Link-Knopf **„Wie das Gerät“**, der die eigene Wahl löscht.
- Verhalten:
  - Klick schaltet sofort um, setzt `data-theme` am `<html>` und speichert `kp-theme` in `localStorage`.
  - „Wie das Gerät“ entfernt `data-theme` und `kp-theme`.
  - Ohne eigene Wahl zeigt der Schalter, was das Gerät gerade nutzt, und folgt Änderungen live (`matchMedia("(prefers-color-scheme: dark)")`).
  - Der Zustand wird erst im Browser gelesen (`useSyncExternalStore` wie in `src/components/day/day-panel.tsx`). Beim Server-Rendern steht der Schalter neutral, damit es keine Hydration-Fehler gibt.
- Die Lese- und Schreiblogik (gültige Werte, Ableitung „aktiv dunkel?“ aus Wahl + System) als reine Funktion in `src/lib/theme.ts` mit Vitest.
- Bewegung: Der Knopf gleitet kurz (≤ 150 ms). Bei `prefers-reduced-motion` springt er ohne Animation (Regel 15).

### B4 · Klicktest (Pflicht)

`e2e/dunkles-design.spec.ts`, keine Daten in der Datenbank nötig:

- Anmelden über `/dev/login`, `/einstellungen` öffnen, Abschnitt „Darstellung“ und Schalter „Dunkles Design“ sind sichtbar.
- Mit `colorScheme: "light"`: Schalter aus → klicken → `html[data-theme="dark"]`, Schalter `aria-checked="true"`.
- Seite neu laden → bleibt dunkel, und zwar schon vor jeder Interaktion (`data-theme` direkt nach dem Laden gesetzt).
- „Wie das Gerät“ klicken → `data-theme` weg, Text „Folgt dem Gerät“ sichtbar.
- Mit `colorScheme: "dark"` ohne eigene Wahl: Schalter steht auf an.

## Neuigkeiten

**Titel:** Hell oder dunkel – du entscheidest

- **Neuer Schalter unter Einstellungen → Darstellung:** Mit Sonne und Mond wechselst du zwischen hellem und dunklem Design.
- **Gilt pro Gerät:** Die Wahl bleibt auf diesem Handy oder Laptop gespeichert. Mit „Wie das Gerät“ folgt die App wieder deiner Systemeinstellung.

## Akzeptanzkriterien

1. Unter Einstellungen gibt es den Abschnitt „Darstellung“ mit Schalter „Dunkles Design“ (Sonne/Mond, `role="switch"`, ≥ 44 × 44 px).
2. Umschalten wirkt sofort auf die ganze App, auch auf Kopfleiste, Gantt, Status- und Protokoll-Farben.
3. Die Wahl bleibt nach dem Neuladen erhalten, ohne helles Aufflackern; „Wie das Gerät“ stellt das alte Verhalten wieder her.
4. Ohne eigene Wahl verhält sich die App genau wie vorher (folgt dem System).
5. Keine Hydration-Warnungen in der Konsole; bei „Bewegung reduzieren“ keine Animation.
6. `src/lib/theme.ts` mit Vitest getestet; Klicktest `e2e/dunkles-design.spec.ts` grün.
7. `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` grün; „Prüfungen“ und „Klicktests“ im PR grün.
8. Bei 375 × 812 und 1280 × 800 geprüft, jeweils hell und dunkel.
9. Neuigkeiten-Eintrag (oben) als neuester Eintrag in `src/lib/news/entries.ts`.

## Deploy

Keine Datenbank-Änderung → `deploy`. Danach Live-Check durch Franz am iPhone und Laptop: Einstellungen → Darstellung umschalten, neu laden, „Wie das Gerät“.

## Abweichungen beim Bau

- **`data-theme` immer gesetzt (B1, B2, B4):** Das Inline-Skript setzt `data-theme` immer auf `light` oder `dark`, also auf die eigene Wahl, sonst auf das, was das Gerät nutzt. So stehen die dunklen Farben nur einmal in `globals.css` (`:root[data-theme="dark"]`), ohne Media-Query und ohne Kopie. „Wie das Gerät“ löscht nur `kp-theme`, `data-theme` springt dann auf den Wert des Geräts. Der Klicktest prüft das entsprechend.
- **`src/components/theme-sync.tsx`** im Root-Layout: folgt live dem Gerät, übernimmt Änderungen aus anderen Tabs und setzt `data-theme` nach dem Dev-Remount von React erneut (laut `node_modules/next/dist/docs/01-app/02-guides/preventing-flash-before-hydration.md`). Das Skript steht als `<script dangerouslySetInnerHTML>` direkt im `<head>`, wie es diese Anleitung empfiehlt.
- **`@custom-variant dark`** weggelassen: Kein eigener Baustein braucht `dark:`. Die Dev-Login-Seite (Klasse C) behält ihre `dark:`-Klassen und richtet sich weiter nach dem Gerät.
