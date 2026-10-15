# SPEC 010 – KP27-Vorlage

Freigabe Franz: ☑
Zweig: `spec/010-kp27-vorlage` · Risikoklasse C (Seed für production) · lokal, **Auto-Modus aus** · DB: nein (keine Schemaänderung), aber `db:seed:prod` legt Daten in production an

Stand 15.10.2026 (Sitzung 5). Vor 009 vorgezogen (Entscheidung Franz), weil production noch keinen Plan hat. Baut auf 006–008 auf (alle live).

## Ziel

Production bekommt den KP27-Plan als Startpunkt: die Abläufe aus dem KP26-Sheet mit den im Orga-Treffen vom 14.10.2026 beschlossenen Änderungen (Kommentare in Spalte I, Interpretation abgenommen am 15.10.2026). Danach pflegt die Kern-Orga den Plan in der App (008). Die Daten stehen in einer eigenen Datei als reine Daten, ein Vitest prüft die errechneten Termine. Der Seed legt die Vorlage nur an, wenn die aktuelle Ausgabe noch keinen Plan hat. dev behält den Testplan aus 006.

## Nicht in dieser Spec

- „Meine Aufgaben“ (009), Jahreswechsel/Vorlage für KP28 (R4)
- Elemente nach dem D-Day (Nachbesprechung intern, Nachbesprechung KVR) – die Engine rechnet nur bis zum D-Day
- Verantwortliche Personen (bleiben leer, die Kern-Orga trägt sich selbst ein); **keine Namen oder E-Mail-Adressen aus dem Sheet**
- Änderungen am Schema, an der Engine, an der Oberfläche
- Änderungen am dev-Testplan (`TEST_PLAN`)

## Vorab: Abgleich mit dem Code nach 008

Bevor du etwas änderst, prüfe den aktuellen Stand und berichte kurz:

- `src/db/seed.ts`: Aufbau, `--prod`-Zweig, `SEED_VERSION`, wie `TEST_PLAN` angelegt wird (Funktion wiederverwendbar für eine zweite Datenquelle?)
- Wie findet der Seed AKs und Aufgabenbereiche über ihren Namen (aus 005)?
- `parseAdminEmails` in `src/lib/access.ts` und wie `ADMIN_EMAILS` im Seed erreichbar ist
- Tabellen `plan_elements`, `plan_links`, `plan_todos`, `plan_notes` (Spaltennamen)

Wenn etwas davon grundlegend anders ist als hier beschrieben: stoppen, Unterschied beschreiben, nichts umbauen. Bestehende Helfer nutzen, keine zweiten bauen.

## Umsetzung

1. **Datendatei** `src/db/kp27-template.ts` (nur Daten, keine Datenbankzugriffe, gleiche Form wie `TEST_PLAN`, damit dieselbe Anlege-Funktion sie nutzen kann). AK und Aufgabenbereich als Namen; fehlt ein Name in der Ausgabe, bleibt das Feld leer. `shift_days` 0, keine Fixtermine, keine Personen. Reihenfolge = `sort_order`.

   **Elemente und Verbindungen** (Abstand in Tagen, „D-Day“ = `to_element_id` leer):

   | # | Element | Art | Dauer | AK | Aufgabenbereich | Nachfolger (Abstand) |
   |---|---|---|---|---|---|---|
   | 1 | Voranmeldung geöffnet | Meilenstein | – | Kommunikation | Kommunikation E-Mails | Vortreffen Kollektive (20) |
   | 2 | Vortreffen Kollektive | Meilenstein | – | Kommunikation | Kollektiv-Chats | Anmeldung offen (7) |
   | 3 | Anmeldung offen | Vorgang | 21 | Kommunikation | Kommunikation E-Mails | Auswahlkommission (0) |
   | 4 | Auswahlkommission | Vorgang | 10 | Demo & Route | Demoleitung | Finale Zusage an Kollektive (0) |
   | 5 | Finale Zusage an Kollektive | Meilenstein | – | Demo & Route | Demoleitung | Zahlungsfrist Kollektive (0), Soundkopplung · Termin 1 (7) |
   | 6 | Zahlungsfrist Kollektive | Vorgang | 23 | Finanzen | Finanzen | D-Day (57) |
   | 7 | Soundkopplung · Termin 1 | Meilenstein | – | Flächen & Technik | Bühne / Soundkopplung | Soundkopplung · Termin 2 (45) |
   | 8 | Soundkopplung · Termin 2 | Meilenstein | – | Flächen & Technik | Bühne / Soundkopplung | Soundkopplung · Termin 3 (25) |
   | 9 | Soundkopplung · Termin 3 | Meilenstein | – | Flächen & Technik | Bühne / Soundkopplung | D-Day (3) |
   | 10 | Pressemitteilung Vorbericht | Meilenstein | – | Kommunikation | Pressearbeit | D-Day (60) |
   | 11 | T-Shirt-Bestellung | Meilenstein | – | Flächen & Technik | Ressourcen / Material | D-Day (49) |
   | 12 | Schildermalen | Meilenstein | – | Kommunikation | Social Media | D-Day (34) |
   | 13 | Finaler Planungscheck | Meilenstein | – | Demo & Route | Demoleitung | Finaler Crosscheck (7) |
   | 14 | Rechtliches fertig | Meilenstein | – | Demo & Route | Demoleitung | Finaler Crosscheck (0) |
   | 15 | Sicherheitskonzept fertig | Meilenstein | – | Demo & Route | Demoleitung | Finaler Crosscheck (0) |
   | 16 | Programm fertig | Meilenstein | – | Programm | – | Finaler Crosscheck (0) |
   | 17 | Logistik fertig | Meilenstein | – | Flächen & Technik | Ressourcen / Material | Finaler Crosscheck (0) |
   | 18 | PR fertig | Meilenstein | – | Kommunikation | Pressearbeit | Finaler Crosscheck (0) |
   | 19 | Finaler Crosscheck | Meilenstein | – | Demo & Route | Demoleitung | Briefing Abschnittsleitungen (3) |
   | 20 | Briefing Abschnittsleitungen | Meilenstein | – | Demo & Route | Demoleitung | Gesamtbriefing Wagenverantwortliche (4) |
   | 21 | Wagenpakete packen | Vorgang | 4 | Flächen & Technik | Wagenpakete | Gesamtbriefing Wagenverantwortliche (0) |
   | 22 | Gesamtbriefing Wagenverantwortliche | Meilenstein | – | Demo & Route | Demoleitung | D-Day (10) |
   | 23 | Finales Vortreffen (Zoom) | Meilenstein | – | Demo & Route | Demoleitung | D-Day (3) |

   Das sind 23 Elemente (die Tabelle zählt sie vollständig auf) und 25 Verbindungen.

   **To-dos** (alle ohne Person; Anker `start`, Tage 0, wenn nicht anders angegeben):
   - **Rechtliches fertig:** Genehmigung Versammlung / Route · Aufstellungsmap Auftakt / Abschluss · Zeitplan Krachparade mit KVR abgestimmt
   - **Sicherheitskonzept fertig:** Sicherheitskonzept und Abschnittsleitungen · Anzahl Ordnerbinden · Anzahl Westen · Funkgeräte · Megaphone · Telegram-Gruppe Abschnittsleitungen · Sanitäter / Awareness · TÜV
   - **Programm fertig:** Wagenreihung · Zeitplan Auftakt- / Abschlussprogramm · Reden Politik · Bands / Bühnenacts musikalisch · Bühne · Soundkopplung · MLfM-Wagen · Audiokundgebungen · Moderation
   - **Logistik fertig:** Präsentation finales Briefing · Müllkonzept / Mülltonnen (AWM) · Packliste Demozentrale · Demofahrzeug (Auto / Fahrrad) · T-Shirt-Verkauf über die Demozentrale · Spendenkonto, PayPal und Verlinkung · Spendenboxen und Spendenschilder · Verpflegungsstrategie MLfM
   - **PR fertig:** SharePics · Pressearbeit / Presseplan inkl. fertiger Pressemitteilung · Podiumsdiskussion (Vorberichterstattung)
   - **Briefing Abschnittsleitungen:** Checkliste Democharakter (Anker `start`, 1 Tag vorher)
   - **Wagenpakete packen:** Schilder montieren (Anker `end`, 0)

   Das sind 33 To-dos.

   **Notizen** (Learnings aus KP26, ohne Namen):
   - Vortreffen Kollektive: „Learning KP26: eine Woche vor dem Anmeldestart.“
   - Anmeldung offen: „Learning KP26: Die Anmeldung endet 10 Tage vor der finalen Zusage, damit die Auswahlkommission Zeit hat.“
   - Auswahlkommission: „Learning KP26: Die Auswahl braucht Zeit – deshalb 10 Tage eingeplant.“
   - Finale Zusage an Kollektive: „Learning KP26: Zusage 80 statt 62 Tage vorher. So lassen sich Soundkopplung und Hauptbühne früher klären.“
   - Soundkopplung · Termin 1: „Learning KP26: 2026 gab es drei Termine (4 Wochen, 2 Wochen, 3 Tage vorher). Künftig mindestens drei, der erste so früh wie möglich nach der Zusage.“
   - Pressemitteilung Vorbericht: „Learning KP26: Erste Pressemitteilung zwei Monate vorher, danach weitere Termine. Vorberichterstattung stärkt den Kundgebungscharakter.“
   - Wagenpakete packen: „Learning KP26: 10–14 Tage vorher packen und mehr Leute einplanen.“
   - Briefing Abschnittsleitungen: „Learning KP26: Erst die Abschnittsleitungen briefen, dann die Wagenverantwortlichen.“
   - Gesamtbriefing Wagenverantwortliche: „Learning KP26: Mit allen Abschnittsleitungen, 10 Tage vorher.“
   - Finales Vortreffen (Zoom): „Learning KP26: Kurz vorher per Zoom hat sich bewährt.“

   Das sind 10 Notizen.
2. **Vitest** `src/db/kp27-template.test.ts` (rechnet mit `computePlan` und D-Day 08.05.2027, „heute“ 15.10.2026, ohne Datenbank):
   - Voranmeldung geöffnet D-138 (21.12.2026), Vortreffen Kollektive D-118, Anmeldung offen D-111 bis D-90, Auswahlkommission D-90 bis D-80, Finale Zusage D-80 (17.02.2027), Zahlungsfrist D-80 bis D-57, Soundkopplung D-73 / D-28 / D-3, Pressemitteilung D-60, T-Shirt-Bestellung D-49, Schildermalen D-34, Finaler Planungscheck D-24, die fünf Bereichs-Meilensteine und Finaler Crosscheck D-17, Briefing Abschnittsleitungen D-14, Wagenpakete D-14 bis D-10, Gesamtbriefing D-10, Finales Vortreffen D-3
   - Kritischer Pfad = Voranmeldung geöffnet → Vortreffen Kollektive → Anmeldung offen → Auswahlkommission → Finale Zusage an Kollektive → Zahlungsfrist Kollektive, Start D-138
   - Kein Kreis, kein Element ohne Nachfolger, alle Elemente Status `ok`
   - Anzahl: 23 Elemente, 25 Verbindungen, 33 To-dos, 10 Notizen
   - Kein Text in der Vorlage enthält „@“ (keine E-Mail-Adressen)
3. **Seed** `src/db/seed.ts`, `SEED_VERSION` + 1:
   - **Nur mit `--prod`** und nur, wenn die aktuelle Ausgabe **noch kein** Plan-Element hat: die Vorlage mit derselben Anlege-Funktion wie `TEST_PLAN` anlegen (Elemente, Verbindungen, To-dos, Notizen) und in `plan_changes` je Element „Angelegt (KP27-Vorlage)“ eintragen (`member_id` leer).
   - **Autor der Notizen:** das am frühesten angelegte **aktive** Mitglied, dessen Adresse in `ADMIN_EMAILS` steht (über `parseAdminEmails`). Gibt es keins, werden die Notizen nicht angelegt und der Seed meldet „Notizen übersprungen (kein Admin-Mitglied)“. Datum = Zeitpunkt des Seeds.
   - Ohne `--prod` ändert sich nichts (dev behält `TEST_PLAN`).
   - Ausgabe des Seeds nur mit Zahlen, nie mit Adressen: „KP27-Vorlage: 23 Elemente, 25 Verbindungen, 33 To-dos, 10 Notizen“ bzw. „KP27-Vorlage übersprungen (Plan existiert schon)“.
   - Ist die Ausgabe mit `--prod` schon gefüllt, passiert nichts – auch nicht bei wiederholtem Aufruf.
4. **Klicktests:** keine neuen, weil die Vorlage nur in production landet; alle bestehenden Klicktests bleiben grün. Stattdessen deckt der Vitest aus 2 die Termine ab.

## Akzeptanzkriterien

- `src/db/kp27-template.ts` enthält genau die Tabelle oben, ohne Namen und E-Mail-Adressen
- Vitest bestätigt alle D-Tage, den kritischen Pfad und die Anzahlen
- Seed mit `--prod` legt die Vorlage einmalig an, nur bei leerem Plan; ohne `--prod` keine Änderung
- Notizen-Autor nur aus `ADMIN_EMAILS` und aktiv; Ausgabe ohne Adressen
- Alle bisherigen Klicktests grün bei 375 × 812 und 1280 × 800 gegen `pnpm dev` und den lokalen Production-Build
- `pnpm typecheck`, `lint`, `test`, `build` grün

## Deploy

Keine Schemaänderung, aber Daten für production:
1. Neon-Backup-Zweig `backup-vor-010` von production anlegen
2. Auf dem Zweig `spec/010-kp27-vorlage`: `pnpm db:seed:prod` (Franz im eigenen Terminal). Erwartete Ausgabe: „KP27-Vorlage: 23 Elemente, 25 Verbindungen, 33 To-dos, 10 Notizen“
3. `deploy --db-erledigt`
4. Danach am Laptop und iPhone: Startseite zeigt den KP27-Plan, kritischer Pfad ab Mo 21.12.2026 (D-138), Panel „Finaler Crosscheck“ bzw. „Sicherheitskonzept fertig“ mit To-dos, Notiz bei „Soundkopplung · Termin 1“
