# SPEC 033 – T-Shirt-Übersicht unter „Kollektive“

Freigabe Franz: ☑
Zweig: `spec/033-tshirt-uebersicht` (baut auf `spec/032-bestaetigungs-mail` auf) · Risikoklasse **A** (Komponenten, reine Funktion, bestehende Seite, Klicktest) · lokal · DB: nein

## Ziel

Unter `/kollektive` gibt es einen eigenen Bereich **„T-Shirts“**. Dort sieht die Orga auf einen Blick:

- wie viele Shirts insgesamt bestellt sind, je Art (Standard, Soli) und Größe,
- welches Kollektiv wie viele Shirts bestellt hat,
- wie viel Geld die Shirts einbringen.

Damit kann die Orga die Bestellung bei der Druckerei planen und weiß, mit welchen Einnahmen sie rechnen kann. Bisher stand das nur als eine Zeile im Klappbereich „Westen und T-Shirts“.

## Offene Fragen an Franz (vor der Freigabe klären)

1. **„Wie viel Geld wir machen“:** Die Spec zeigt bisher den **Umsatz**, also was die Kollektive für Shirts zahlen. Dazu kommt der Soli-Anteil. Den **Gewinn** können wir nur zeigen, wenn wir den **Einkaufspreis pro Shirt** kennen. Gibt es den schon? Dann kommt er als feste Zahl in `costs.ts`, ändern ginge dann per Spec. Sonst bleibt der Gewinn für später.
2. **Welche Anmeldungen zählen?** Vorschlag: zwei Zahlen nebeneinander:
   - **„Zugesagt“:** gilt sicher.
   - **„Erwartet“:** alle außer „Abgesagt“. So zählen auch die neuen Anmeldungen und die auf der Warteliste mit.

## Nicht in dieser Spec

- **Einkaufspreis und Gewinn:** nur, wenn Frage 1 mit Ja beantwortet ist
- **Eigener CSV-Export** für die Druckerei. Der bestehende CSV-Export enthält die Shirts schon.
- **Bezahlt-Haken** je Kollektiv (wer hat schon überwiesen)
- **Preise in der App ändern.** Sie bleiben im Code (`SHIRT_PRICE_EUR`).

## Umsetzung

### B1 · Reine Funktion `shirtOverview`

- **Neue Datei** `src/lib/collectives/shirts.ts` mit Tests (`shirts.test.ts`).
- **`shirtOverview(entries)`** bekommt die Anmeldungen (`id`, `collectiveName`, `status`, `shirts`) und gibt zurück:
  - **`confirmed` und `expected`** jeweils mit:
    - Stückzahl je Art und Größe
    - Summe je Art und Gesamtsumme
    - Umsatz je Art und gesamt in ganzen Euro, aus `SHIRT_PRICE_EUR`
    - Soli-Anteil: Anzahl Soli-Shirts × (Soli-Preis − Standard-Preis), also 10 € pro Soli-Shirt
  - **`byCollective`:** nur Kollektive mit mindestens einem Shirt, außer „Abgesagt“, sortiert nach Name. Je Eintrag:
    - `id`, `collectiveName`, `status`
    - Stückzahl je Art und Größe
    - Summe Shirts und Betrag
- **Die Preise** kommen nur aus `costs.ts`. So bleiben sie gleich mit der Danke-Seite und der Bestätigungs-Mail.
- **Tests:**
  - leere Liste
  - „Abgesagt“ zählt nicht mit
  - der Unterschied zwischen `confirmed` und `expected`
  - Beträge (z. B. 2 × Standard M + 1 × Soli L = 100 €, davon Soli-Anteil 10 €)
  - Sortierung, und Kollektive ohne Shirts fehlen in `byCollective`

### B2 · Bereich „T-Shirts“ auf `/kollektive`

- **Neue Komponente** `src/components/collectives/shirt-overview.tsx`. Sie steht auf `/kollektive` als eigener Abschnitt mit Überschrift „T-Shirts“, unter der Liste der Anmeldungen (geändert am 18.11.2026 auf Wunsch, vorher zwischen Kennzahlen und Liste).
- **Im Klappbereich „Westen und T-Shirts“** entfällt die Shirt-Zeile. Er heißt dann nur noch „Westen“.

**Teil 1 · Gesamt**

- Tabelle mit den Zeilen Standard, Soli, Gesamt und den Spalten S, M, L, XL, XXL, Summe.
- Zuerst die Zahlen für „Erwartet“, darunter klein: „davon zugesagt: ‹n› Shirts“.

**Teil 2 · Geld**

- Drei ruhige Kacheln:
  - „Umsatz Shirts (erwartet)“
  - „Umsatz Shirts (zugesagt)“
  - „davon Soli-Anteil (erwartet)“
- Darunter in einem Satz: „Standard 30 €, Soli 40 € pro Shirt“. Die Werte kommen aus `SHIRT_PRICE_EUR`.

**Teil 3 · Wer hat was bestellt**

- **Laptop (ab `md`):** Tabelle mit den Spalten Kollektiv, Status, Standard, Soli, Summe, Betrag.
  - Der Name verlinkt auf `/kollektive/[id]`.
  - Standard und Soli als Kurzform, z. B. „2 × M, 1 × L“, oder „–“ ohne Bestellung.
  - Letzte Zeile „Gesamt“.
- **Handy:** eine Karte je Kollektiv mit Name (Link), Status, den beiden Zeilen „Standard: …“ und „Soli: …“ sowie dem Betrag. Kein horizontales Scrollen.
- **Ohne Bestellungen:** Hat niemand Shirts bestellt, steht dort nur „Noch keine T-Shirts bestellt.“
- **Farben:** Status-Pill wie in der Liste (`RegistrationStatusPill`), sonst schlicht.

### B3 · Klicktest (Pflicht)

- **`e2e/kollektiv-anmeldung.spec.ts`** wird erweitert. Das E2E-Kollektiv bestellt dort schon 2 Standard-Shirts M. Nach dem Absenden prüft der Test auf `/kollektive` im Bereich „T-Shirts“:
  - Es gibt eine Zeile bzw. Karte für „E2E Testkollektiv …“ mit „2 × M“ und „60 €“.
  - Die Gesamtsummen werden nicht exakt geprüft, weil im Seed noch andere Anmeldungen stehen.
- **Aufräumen** wie bisher: Die Anmeldung wird am Ende gelöscht.

## Neuigkeiten

ID `033-tshirt-uebersicht`, Datum = Tag des Baus, Titel „T-Shirt-Übersicht“:

- **Alle Shirts auf einen Blick:** Unter „Kollektive“ siehst du, wie viele Shirts je Art und Größe bestellt sind.
- **Wer hat was bestellt:** Je Kollektiv Anzahl, Größen und Betrag.
- **Umsatz:** Was die Shirts einbringen, zugesagt und erwartet, mit dem Soli-Anteil.

## Akzeptanzkriterien

1. Unter `/kollektive` gibt es den Bereich „T-Shirts“ mit:
   - der Gesamttabelle (Art × Größe),
   - dem Umsatz (erwartet, zugesagt, Soli-Anteil),
   - der Liste je Kollektiv.
2. Abgesagte Anmeldungen zählen nirgends mit. „Zugesagt“ zählt nur Anmeldungen mit diesem Status.
3. Die Beträge stimmen mit den Shirt-Kosten auf der Danke-Seite und in der Bestätigungs-Mail überein, weil alle die Preise aus `costs.ts` nehmen.
4. `shirtOverview` ist mit Unit-Tests abgedeckt.
5. Der Klicktest prüft die Zeile des E2E-Kollektivs und ist grün.
6. `pnpm typecheck`, `pnpm lint`, `pnpm test` und `pnpm build` sind grün.
7. Bei 375 × 812 und 1280 × 800 geprüft: kein horizontales Scrollen, Tippflächen mindestens 44 px.

## Deploy

Datenbank-Änderung nein → nach Spec 031 und 032 `deploy`.
