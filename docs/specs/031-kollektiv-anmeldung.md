# SPEC 031 – Anmeldung der Kollektive

Freigabe Franz: ☑
Zweig: `spec/031-kollektiv-anmeldung` · Risikoklasse **C** (öffentliche Seite ohne Login: `src/proxy.ts`, `AGENTS.md`, `agents/risikoklassen.json`; neue Abhängigkeit `nodemailer`, `package.json`, `.env.example`, `docker/`) · **lokal, Teil A–F** · DB: ja (1 neue Tabelle, 2 neue Spalten an `editions`)

Enthält seit 18.11.2026 auch die früheren Specs **032 (Bestätigungs-Mail, Teil E)** und **033 (T-Shirt-Übersicht, Teil F)**. Beide waren einzeln freigegeben und gebaut und wurden auf Wunsch in diese Spec zusammengeführt.

Ersetzt das Google-Formular „Finale Anmeldung Krachparade 16.05.2026“ (KP26) durch ein Formular in der App. Grundlage: Fragen und Logik des Google-Formulars (Screenshots von Franz, 18.11.2026). Entscheidungen von Franz vom 18.11.2026:

- **Telefonnummern:** erlaubt, aber **nur** für die Kollektiv-Anmeldung. Dafür ändert sich die Daten-Regel in `AGENTS.md` (siehe C1).
- **Löschfrist:** Alle Anmeldungen samt Telefonnummern werden **3 Monate nach der Krachparade** gelöscht. Für KP27 ist das der 08.08.2027.
- **IBAN / PayPal:** werden **nicht** abgefragt. Das Pfand geht an das Konto zurück, von dem überwiesen wurde.
- **Datei-Uploads:** keine. Stattdessen ein Link-Feld und der Hinweis „oder per Mail schicken“.
- **Adresse:** `/anmeldung` auf der Domain der App.
- **Pfand:** 150 € für **alle** Kollektive, auch ohne Motor.
- **TÜV-Frage:** entfällt bei „nicht motorisiert“.
- **Westen-Größen:** S, L, XXL (wie im alten Formular).
- **Bestätigungs-Mail** (vormals 032): Versand per SMTP über das bestehende Gmail-Postfach `mehr.laerm.fuer.muenchen@gmail.com` mit App-Passwort, kein neuer Anbieter. Die Mail geht an die Hauptansprechperson, die oder der Wagenverantwortliche steht in CC.
- **T-Shirt-Übersicht** (vormals 033): Sie zeigt den Umsatz, keinen Gewinn, weil der Einkaufspreis noch fehlt. Es gibt zwei Zahlen: „zugesagt“ und „erwartet“ (alle außer abgesagt).

## Ziel

Kollektive melden sich für die Krachparade 2027 (08.05.2027) über **`/anmeldung`** an, **ohne Google-Konto** und ohne Login. Die Kern-Orga sieht unter **`/kollektive`** (nur mit Login) alle Anmeldungen. Dort kann sie filtern und eine Anmeldung zusagen, auf die Warteliste setzen oder absagen. Sie sieht Kennzahlen (Fahrzeuge, TÜV, Soundkopplung, Westen, T-Shirts, erwartete Zahlungen) und kann alles als CSV exportieren. Das Formular ist nur in einem Zeitfenster offen, das Admins in der App einstellen. Laut Plan liegt „Anmeldung offen“ ab D-111, also um den 17.01.2027.

Nach dem Absenden bekommt das Kollektiv eine **Bestätigungs-Mail** mit Zusammenfassung und Kosten (Teil E). Unter `/kollektive` zeigt ein eigener Bereich **„T-Shirts“** alle Shirt-Bestellungen: gesamt, je Kollektiv und mit dem Umsatz (Teil F).

## Nicht in dieser Spec

- **Voranmeldung** (Plan-Element „Voranmeldung geöffnet“, D-138). Das wird eine eigene Spec, wenn gewünscht.
- **Zusage-Mail** mit Zahlungsinfos und Frist (eigene Spec)
- **Bestätigungs-Mail erneut senden** aus `/kollektive`. Bei Bedarf schreibt die Orga von Hand.
- **Info-Mail an das Orga-Postfach** bei neuer Anmeldung
- **HTML-Design, Logo und Anhänge in der Mail.** Die Mail ist schlichter Text.
- **Einkaufspreis und Gewinn der T-Shirts,** eigener CSV-Export für die Druckerei, Bezahlt-Haken je Kollektiv
- **Datei-Uploads** (siehe oben)
- **Status-Häkchen je Kollektiv:** Zahlung, TÜV, Telegram, Briefing, Paket, Pfand (eigene Spec)
- **Ordner-Bedarf aus dem Fahrzeugmix.** Die Formel steht noch nicht fest.
- **Wagenreihung, Wagennummern, Verbindung zum Tagesplan (030)**
- **Bearbeiten der Anmeldung durch das Kollektiv** nach dem Absenden. Änderungen laufen per Mail an die Orga, die sie in der App einträgt.
- **Mehrere Sprachen**
- **IBAN, PayPal, Postadressen**

## Vorab: Abgleich mit dem Code

Prüfe zuerst und berichte kurz im Chat. **Erst nach „Weiter“ von Franz** etwas ändern.

- **Proxy und Layout:** Wie leitet `src/proxy.ts` ohne Sitzung auf `/login` um (`PUBLIC_PATHS`)? Lädt `src/app/layout.tsx` (Root) etwas, das eine Sitzung braucht? Kann eine neue Gruppe `src/app/(public)/` ohne `AppHeader`, `MemberGate` und `TabBar` auskommen?
- **Ausgabe:** Was liefert `getCurrentEdition()` (`src/db/editions.ts`) und `dday.ts`? Wie bekommen Seiten „heute“ in `Europe/Berlin` (`src/lib/date-time.ts`)?
- **Rechte:** Wie prüfen Actions heute Admin-Rechte (`src/lib/permissions.ts`, `requireMember().isAdmin`)?
- **Bausteine:** `FieldError`, `PageTitle`, `BackLink`, Status-Pills (`feedback-pills.tsx`, `status-pill.tsx`), Formular-Muster aus Feedback (014). Welche passen?
- **Klicktests:** Wie öffnen bestehende Tests eine Seite **ohne** Login (eigener Browser-Kontext ohne `storageState`)? Wie meldet `/dev/login` als Admin an?

Weicht der Code grundlegend ab, z. B. wenn eine Seite ohne Sitzung nicht ohne Umbau des Root-Layouts geht: **nichts umbauen**, Unterschied berichten und anhalten.

## Umsetzung

### Teil A · Datenmodell, Regeln, Action (ohne Oberfläche)

**A1 · Tabellen** (`src/db/schema.ts`, nur hinzufügend)

- `editions`: zwei neue Spalten `registration_opens_on` und `registration_closes_on` (`date`, nullable). Beide leer heißt: Anmeldung geschlossen.
- Neue Tabelle `collective_registrations`. Alle Texte werden getrimmt. Längen prüft Zod, siehe A2.
  - `id` (uuid), `edition_id` (→ `editions`, Pflicht)
  - `status` (text, Default `new`, Check: `new`, `accepted`, `waitlist`, `rejected`), `internal_note` (text, nullable)
  - **Hauptansprechpartner/in:** `contact_first_name`, `contact_last_name`, `contact_email` (klein geschrieben), `contact_phone`
  - **Kollektiv:**
    - `collective_name`, `display_name` (Schreibweise für Shirts und Plakate), `demands` (Forderungen)
    - `instagram`, `tiktok`, `files_link` (alle nullable)
    - `participated_before` (boolean)
    - `music_type` (Check: `live`, `dj`, `both`, `none`), `genres` (`text[]`, 0–3 Werte aus der Liste in A2)
    - `home_base` (Check: `munich`, `munich_area`, `bavaria`, `germany`, `abroad`), `event_size` (Check: `0`, `1-50`, `50-200`, `200-500`, `500-1000`, `1000+`)
  - **Wagen:**
    - `vehicle` (Check: `non_motorized`, `car`, `car_trailer`, `truck_small`, `truck_large`)
    - `tuev` (boolean, nullable, siehe A2), `awareness`, `sound_coupling` (boolean), `atmosphere`
    - `order_preference`, `joint_with`, `vehicle_files_link` (alle nullable)
  - **Freiwillige Abschnittsleitung (alles nullable):** `section_lead_first_name`, `section_lead_last_name`, `section_lead_email`, `section_lead_phone`, `section_lead_note`
  - **Wagenverantwortliche/r:** `vehicle_lead_first_name`, `vehicle_lead_last_name`, `vehicle_lead_email`, `vehicle_lead_size` (Check: `S`, `L`, `XXL`), `vehicle_lead_phone`
  - **T-Shirts:** `shirts` (`jsonb`, Form `{ standard: {S,M,L,XL,XXL}, soli: {S,M,L,XL,XXL} }`, je 0–100)
  - **Bestätigungen:** `stewards_confirmed_at` (timestamptz, Pflicht) und `privacy_confirmed_at` (timestamptz, Pflicht)
  - **Bestätigungs-Mail:** `confirmation_sent_at` (timestamptz, nullable), siehe Teil E
  - **Zeitstempel:** `created_at`, `updated_at`
  - Index auf `(edition_id, created_at)`; eindeutig pro Ausgabe: `lower(collective_name)` + `contact_email`

**A2 · Reine Funktionen** (`src/lib/collectives/`, mit Tests)

- `registration-schema.ts`: Zod-Schema für das Formular, mit deutschen Fehlermeldungen.
  - Pflicht und optional genau wie im Google-Formular. Optional sind: Instagram, TikTok, beide Links, Wunsch bei der Reihenfolge, Zusammenschluss, alle Felder der Abschnittsleitung.
  - `demands`: mindestens 75 Zeichen („Bitte formuliert eure Forderungen etwas ausführlicher.“).
  - Texte höchstens 2000 Zeichen, Namen höchstens 80, E-Mails gültig.
  - Telefon: nur Ziffern, Leerzeichen, `+`, `-`, `/` und `()`, 6–30 Zeichen.
  - Links nur `https://`.
  - Genres: 0–3 aus „Techno / Hardtech / Uptime“, „Drum & Bass / Jungle / Liquid“, „Melodic / House“, „Minimal / Tech House“, „Psy / Trance / Goa“, „Rock / Metal / Punk“, „Pop / Singer-Songwriter“, „A cappella / Gesang“, „Instrumental / Trommeln“, „Rap / Hip-Hop“, „Jazz / Funk“, „Latin / Salsa / Reggaeton“. Bei „Keine Musik“ ist Genre nicht Pflicht, sonst mindestens 1.
  - **Logik wie im Google-Formular:** Bei `non_motorized` gibt es keine Abschnittsleitung, die Felder werden verworfen. **Neu:** Bei `non_motorized` gibt es außerdem keine TÜV-Frage (`tuev` = null).
  - Die Ordner-Auflagen und den Datenschutz muss man bestätigen, sonst ist kein Absenden möglich.
- `costs.ts`: `registrationCosts(input)` gibt Pfand, TÜV, Shirts Standard, Shirts Soli und Summe in ganzen Euro zurück.
  - Preise als Konstanten: Pfand 150 €, TÜV 100 €, Standard 30 €, Soli 40 €.
  - Das Pfand gilt für alle Fahrzeuge, TÜV nur bei `tuev = true`.
- `retention.ts`: `retentionEnd(dDay)` gibt D-Day + 3 Monate als Kalendertag zurück (08.05.2027 → 08.08.2027). `isPastRetention(dDay, today)` liefert `true` ab diesem Tag.
- `window.ts`: `registrationState(edition, today)` gibt `not_configured`, `upcoming`, `open` oder `closed` zurück. Kalendertage, „heute“ ist ein Parameter, Grenzen sind inklusive.
- `summary.ts`: Kennzahlen aus einer Liste von Anmeldungen. Gezählt werden nur Anmeldungen mit Status ≠ `rejected`:
  - Anzahl je Status
  - Anzahl je Fahrzeug
  - TÜV ja
  - Soundkopplung ja
  - freiwillige Abschnittsleitungen
  - Westen je Größe (Wagenverantwortliche)
  - Shirts je Art und Größe
  - erwartete Zahlungen gesamt
- `csv.ts`: CSV mit Semikolon und UTF-8 mit BOM (damit Excel Umlaute richtig zeigt), Spalten in Formular-Reihenfolge. Gegen CSV-Injection beginnt kein Feld mit `=`, `+`, `-` oder `@`. Ist es doch so, kommt ein `'` davor.

**A3 · Action ohne Login** (`src/actions/collective-registration.ts`)

- `submitRegistration(formData)` ist eine **Ausnahme von Regel 8**: Diese Action prüft keine Anmeldung. Sonst ist sie streng:
  1. **Honeypot:** ein unsichtbares Feld `website`. Ist es gefüllt, tut die Action so, als wäre alles gespeichert, speichert aber nichts.
  2. **Mindestzeit:** Ein verstecktes Feld `startedAt` setzt der Browser nach dem Laden. Unter 20 Sekunden bis zum Absenden: Fehler „Bitte nimm dir etwas mehr Zeit.“
  3. **Zeitfenster:** `registrationState(…, heute) === "open"`, sonst Fehler „Die Anmeldung ist geschlossen.“
  4. **Zod-Prüfung** (A2)
  5. **Doppelte Anmeldung** (gleicher Name und gleiche Mail) → „Ihr seid schon angemeldet. Für Änderungen schreibt uns eine Mail.“
  6. **Obergrenze:** höchstens 300 Anmeldungen pro Ausgabe
  7. Speichern, dann Weiterleitung auf `/anmeldung/danke?id=…`
- Geloggt werden keine Inhalte, nur Fehlernamen.
- **Admin-Actions in derselben Datei** (oder `collective-registrations-admin.ts`). Alle mit `requireMember()`, IDs per Zod geprüft und gegen die Datenbank kontrolliert:
  - `setRegistrationStatus(id, status)` und `setRegistrationNote(id, note)`: jedes Mitglied
  - `deleteRegistration(id)`: nur Admins
  - `setRegistrationWindow(opensOn, closesOn)`: nur Admins. `opensOn` ≤ `closesOn`, beide ≤ D-Day.
  - `deleteAllRegistrations()`: nur Admins und erst ab `retentionEnd` (`isPastRetention`). Löscht alle Anmeldungen der aktuellen Ausgabe.

**A4 · Seed** (`src/db/seed.ts`, ohne `--prod`)

- Drei ausgedachte Kollektive: „Testkollektiv Lautstark“ (kleiner LKW, TÜV ja), „Bollerwagen-Bande“ (nicht motorisiert) und „Basskombinat Süd“ (großer LKW, Warteliste).
- Mails im Muster `…@example.org`, offensichtlich falsche Nummern im Muster `+49 000 0000001`.
- Das Zeitfenster bleibt in Dev leer.
- `SEED_VERSION` erhöhen.

### Teil B · Öffentliche Seite `/anmeldung`

**B1 · Rahmen**

- Neue Gruppe `src/app/(public)/` mit eigenem Layout: Forest-Kopfleiste mit Logo und dem Text „Krachparade 2027 · Anmeldung“. Keine Navigation, kein Personenname, keine Glocke, kein Feedback-Knopf.
- `robots: noindex` bleibt (Root-Layout). Die Seite lädt nichts von fremden Servern.
- `src/proxy.ts`: `/anmeldung` kommt zu `PUBLIC_PATHS`. **Sonst ändert sich nichts.**

**B2 · Seite `/anmeldung`**

- **Zeitfenster nicht offen:** nur ein Hinweis.
  - `upcoming`: „Die Anmeldung öffnet am 17.01.2027.“ (Datum aus der Ausgabe)
  - `closed` oder `not_configured`: „Die Anmeldung ist geschlossen. Fragen? Schreibt uns an mehr.laerm.fuer.muenchen@gmail.com.“
- **Offen:** eine Seite mit Abschnitten als Karten, in der Reihenfolge des Google-Formulars. Keine zehn Unterseiten.
  1. **Einleitung:** Text aus dem KP26-Formular, angepasst. Titel „Finale Anmeldung Krachparade 08.05.2027“. Erklärt die drei Rollen (Hauptansprechpartner/in, Wagenverantwortliche/r, Abschnittsleitung) sowie Wagen- und Demoordner. Darunter: „Die Teilnahme ist grundsätzlich kostenlos. Wir sammeln ein Pfand von 150 € für das Wagenpaket ein …“. Das Datum des Vortreffens fällt weg.
  2. **Hauptansprechpartner/in:** Vorname*, Nachname*, E-Mail*, Telefonnummer (mobil)*
  3. **Kollektiv / Initiative / Bündnis:**
     - Name*, Schreibweise*, Politische / kulturelle Forderungen* (mehrzeilig, mit Zähler „noch N Zeichen“)
     - Instagram, TikTok
     - „Link zu Dateien (Reden, Logos, Bilder)“ mit Hinweis „Drive, Dropbox o. Ä., oder per Mail an mehr.laerm.fuer.muenchen@gmail.com“
     - Schon mal teilgenommen?*, Live-Musik oder DJs?*, Genres (bis zu drei)*, Homebase*, Leute pro Event*
  4. **Wagen:**
     - „Wir nehmen teil mit:“*
     - TÜV-Frage* mit dem Kostentext aus dem Formular, nur bei motorisierten Fahrzeugen
     - Awareness / Code of Conduct* (mehrzeilig)
     - Soundkopplung* mit Text „Wall of Sound“
     - Atmosphäre* (mehrzeilig)
     - Wunsch bei der Wagenreihenfolge, Zusammenschluss mit, Link zu Dateien zum Wagen
  5. **Freiwillige Abschnittsleitung:** nur bei motorisierten Fahrzeugen sichtbar. Vorname, Nachname, E-Mail, Telefon, Anmerkung.
  6. **Wagenverantwortliche/r:** Vorname*, Nachname*, E-Mail*, Größe für die Warnweste* (S, L, XXL), Telefonnummer (mobil)*
  7. **T-Shirts:** Text aus dem Formular (30 € Grundpreis, 40 € Soli). Zehn Zahlenfelder, Standard und Soli je S–XXL, Start 0. Ein Bild des KP27-Designs kommt, sobald es da ist, als Datei in `public/` (Klasse A).
  8. **Ordner-Auflagen:**
     - Text mit Link https://mehrlaermfuermuenchen.jimdofree.com/demoorga/
     - Checkbox*: „Ich habe die Auflagen für die Ordner gelesen und verstanden. Mir ist bewusst, dass fehlende Ordner zu einem Ausschluss am Tag der Parade führen.“
     - Ohne Haken erscheint der Hinweis aus Abschnitt 10 des alten Formulars: „Ohne Ordner geht es nicht. Meldet euch bei uns per Mail oder Telegram, Kontakte auf www.krachparade.de.“
  9. **Datenschutz:**
     - Checkbox*: „Wir sind einverstanden, dass die Orga der Krachparade diese Angaben zur Planung der Krachparade 2027 speichert. Alle Angaben, auch die Telefonnummern, löschen wir drei Monate nach der Krachparade (am 08.08.2027). Eine Bestätigung schicken wir per E-Mail.“ Das Datum kommt aus `retentionEnd`.
  10. **Kostenübersicht** (live aus `registrationCosts`) und Knopf „Verbindlich anmelden“.
- Felder mit 16 px Schrift, Tippflächen mindestens 44 px, `autocomplete`-Attribute (`given-name`, `family-name`, `email`, `tel`).
- Fehler stehen am Feld (`FieldError`). Beim Absenden mit Fehlern springt die Seite zum ersten Fehler.
- **Entwurf im Browser:** Eingaben werden im `localStorage` gesichert (`try/catch`, erst nach dem Laden lesen, wegen Hydration) und nach erfolgreichem Absenden gelöscht. Der Hinweis dazu lautet: „Deine Eingaben bleiben auf diesem Gerät, bis du absendest.“
- Der Absende-Knopf ist während des Sendens gesperrt („Wird gesendet …“).

**B3 · Danke-Seite `/anmeldung/danke`**

- Zeigt „Danke, eure Anmeldung ist da!“, den Namen des Kollektivs, die Kostenübersicht und:
  - „Die Anmeldung ist verbindlich, sobald wir sie bestätigt haben. Überweist erst nach unserer Bestätigung.“
  - „Ihr bekommt gleich eine Bestätigung per E-Mail an die angegebene Adresse, die oder der Wagenverantwortliche in Kopie. Schaut auch im Spam-Ordner nach.“ (Teil E)
  - „Macht euch am besten trotzdem einen Screenshot dieser Seite.“
- Die Seite zeigt nur Name und Kosten. Sie lädt die Anmeldung nur, wenn sie jünger als 1 Stunde ist, sonst gibt es nur den Danke-Text. **Keine** Kontaktdaten.

### Teil C · Auswertung `/kollektive` und Regeln

**C1 · Regeln** (Klasse C, von dieser Spec ausdrücklich verlangt)

- `AGENTS.md`, Abschnitt 1 „Daten“ und Regel 9, ergänzt um: „Ausnahme: Handynummern von Ansprechpersonen der Kollektive in `collective_registrations` (Spec 031). Alle Anmeldungen werden 3 Monate nach der Krachparade gelöscht (Admin-Knopf unter `/kollektive`).“
- `AGENTS.md`, Regel 8, ergänzt um: „Ausnahme: `submitRegistration` (Spec 031) ist ohne Anmeldung erreichbar und schützt sich durch Honeypot, Mindestzeit, Zeitfenster und Obergrenze.“
- `AGENTS.md`, Abschnitt 5 Klasse C, und `agents/risikoklassen.json`: neue Pfade `src/app/(public)/**` und `src/actions/collective-registration.ts` („ohne Anmeldung erreichbar“).
- Seed und Tests: weiter nur ausgedachte Daten.

**C2 · Liste `/kollektive`** (ersetzt den Platzhalter)

- Oben Kennzahlen als ruhige Kacheln: Anmeldungen (je Status), Fahrzeuge, TÜV, Soundkopplung, Abschnittsleitungen, erwartete Zahlungen. Darunter klappbar: „Westen“ je Größe. Die Shirts stehen im eigenen Bereich, siehe Teil F.
- Darunter die Anmeldungen, danach der Bereich „T-Shirts“ (Teil F).
  - Am Laptop als Tabelle: Name, Fahrzeug, TÜV, Soundkopplung, Homebase, Status, Datum.
  - Am Handy als Karten.
  - Suche nach Name. Filter: Status, Fahrzeug, TÜV, Soundkopplung, Genre.
- Kopfzeile:
  - „CSV exportieren“: `src/app/(app)/kollektive/export/route.ts`, prüft `requireMember()`, Dateiname `kollektive-kp27-JJJJ-MM-TT.csv`
  - „Link zur Anmeldung kopieren“
  - Zeitfenster-Anzeige „Anmeldung offen bis 07.02.2027“
- **Nur Admins:**
  - Zeitfenster einstellen (zwei Datumsfelder)
  - „Alle Anmeldungen löschen“: erst ab dem 08.08.2027 (`retentionEnd`) aktiv, mit Rückfrage „Alle N Anmeldungen der Krachparade 2027 endgültig löschen? Exportiere vorher die CSV, falls du sie brauchst.“
  - Ab diesem Tag sehen alle oben auf `/kollektive` den Hinweis: „Löschfrist erreicht: Die Anmeldungen müssen gelöscht werden.“
- Das Kennzeichen „R3“ an Kollektive verschwindet: `src/app/(app)/einstellungen/page.tsx` sowie Navigation und `src/lib/nav.ts`, falls es dort steht.

**C3 · Detail `/kollektive/[id]`**

- Alle Angaben nach Abschnitten.
  - Mails als `mailto:`, Telefonnummern als `tel:`
- Status als Auswahl, interne Notiz (Speicherstatus wie bei anderen Notizen).
- Löschen nur für Admins, mit Rückfrage „Anmeldung von ‹Name› endgültig löschen?“.
- Kostenübersicht wie auf der Danke-Seite.

### Teil D · Klicktests (Pflicht)

`e2e/kollektiv-anmeldung.spec.ts`:

1. Als Admin per `/dev/login` anmelden, unter `/kollektive` das Zeitfenster so setzen, dass es heute einschließt. Den alten Wert merken.
2. In einem **neuen Browser-Kontext ohne Login** `/anmeldung` öffnen.
   - Mit leerem Formular absenden → Fehler am ersten Pflichtfeld.
   - Dann ausfüllen: „E2E Testkollektiv“, Mails `…@example.org`, Telefon `+49 000 0000099`, kleiner LKW, TÜV ja, 2 Standard-Shirts M.
   - Die Mindestzeit wird im Test per `page.clock` vorgespult.
   - Die Kostenübersicht zeigt 150 + 100 + 60 = **310 €**. Absenden → Danke-Seite mit 310 €.
3. Ohne Login `/kollektive` öffnen → Weiterleitung auf `/login`.
4. **Bestätigungs-Mail (Teil E):** Der Test fragt die Mailpit-API ab. Es gibt genau eine Mail:
   - an `robin.beispiel@example.org`, CC `kai.probe@example.org`,
   - im Betreff der Name,
   - im Text „Summe: 310 €“ und keine Telefonnummer.
   Danach wird die Mail gelöscht. Läuft Mailpit nicht (CI gegen die Vercel-Vorschau), wird dieser Teil mit Hinweis übersprungen.
5. **T-Shirts (Teil F):** In `/kollektive` zeigt der Bereich „T-Shirts“ das E2E-Kollektiv mit „2 × M“ und „60 €“. Die Gesamtsummen werden nicht exakt geprüft, wegen der Seed-Daten.
6. Als Admin: In `/kollektive` steht „E2E Testkollektiv“. Detail öffnen, „Bestätigungs-Mail: verschickt am …“ prüfen (nur mit Mailpit), Status „zugesagt“ setzen, Anmeldung löschen, altes Zeitfenster wiederherstellen.
7. „Nicht motorisiert“ blendet Abschnittsleitung und TÜV aus.
8. Bei 375 × 812 kein horizontales Scrollen auf `/anmeldung` und `/kollektive`.

Unit-Tests für alle Funktionen aus A2, besonders:
- die Logik bei `non_motorized`,
- die Grenzen des Zeitfensters,
- die Löschfrist (`retentionEnd`, auch bei Monatsenden, z. B. 31.05. → 31.08.),
- die Kosten,
- CSV-Injection,
- die Genre-Regel bei „Keine Musik“.

### Ergänzung · Lokale Test-Datenbank mit Docker (Franz, 18.11.2026 im Chat)

- Nur lokal entwickeln und testen, nichts pushen. Getestet wird gegen eine Docker-Datenbank statt gegen Neon. Klicktests laufen mit Playwright (statt Cypress, weil es schon im Projekt und in der Pflicht-Prüfung steckt).
- `docker/compose.yaml`: Postgres plus Neon-HTTP-Proxy (`ghcr.io/timowilhelm/local-neon-http-proxy`). `docker/local.env` enthält nur Fantasie-Werte. Anleitung in `docker/README.md`.
- `src/db/index.ts` (Klasse C): Ist `LOCAL_NEON_HTTP_ENDPOINT` gesetzt, zeigt es auf `localhost` und läuft die App nicht bei Vercel, gehen die Anfragen an den Proxy (`src/lib/local-db.ts` mit Test).
- `AGENTS.md` und `agents/risikoklassen.json`: `docker/**` und `src/lib/local-db.*` sind Klasse C. Gegen die Docker-Datenbank darf der Agent die App selbst starten.

### Teil E · Bestätigungs-Mail nach der Anmeldung (vormals Spec 032)

Nach dem Absenden bekommt das Kollektiv eine Bestätigungs-Mail. Absender und Antwort-Adresse ist das Orga-Postfach. Klappt der Versand nicht, bleibt die Anmeldung trotzdem gespeichert. Lokal fängt Mailpit in Docker alle Mails ab, es geht nie eine echte Mail raus.

**E1 · Versand-Baustein**

- **Abhängigkeit:** `nodemailer` 10.3.1 (vom 29.10.2026, also mindestens 2 Wochen alt). Begründung: Ein Standard-SMTP-Client ist sicherer als ein eigener.
  - `@types/nodemailer` gibt es nur für Version 8 und passt nicht zu v10. Die Typen kommen über `allowJs` direkt aus dem Paket.
- **Umgebungsvariablen** (Namen in `.env.example`, Werte setzt Franz bei Vercel):
  - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM`, `MAIL_ENABLED`
  - Production: `smtp.gmail.com`, Port `465`, `SMTP_USER` = Gmail-Postfach, `SMTP_PASSWORD` = Gmail-App-Passwort, `MAIL_FROM` = `Krachparade Orga <mehr.laerm.fuer.muenchen@gmail.com>`
- **`src/lib/mail/config.ts`:** reine Funktion `mailConfig(env)`, mit Tests.
  - Fehlt eine Variable, wird nichts verschickt, Log „[mail] nicht eingerichtet“.
  - Bei Vercel außerhalb von Production (Vorschau) wird nur mit `MAIL_ENABLED=1` verschickt, damit keine Mails aus Klicktests ins echte Postfach gehen.
  - Leerzeichen im App-Passwort werden entfernt. Benutzer und Passwort gibt es nur zusammen, die lokale Mailpit-Instanz braucht keins von beiden.
- **`src/lib/mail/send.ts`:** `sendMail({ to, cc, subject, text })` mit `nodemailer`.
  - Timeout 10 s, Reply-To ist die Absender-Adresse.
  - Bei Fehlern wird nur der Fehlername geloggt, nie Adressen, Inhalt oder Einstellungen.
  - Rückgabe `true` oder `false`.

**E2 · Inhalt der Mail**

- **Reine Funktion `confirmationMail(registration, dDay)`** in `src/lib/collectives/confirmation-mail.ts`, mit Tests. Sie gibt `{ to, cc, subject, text }` zurück.
- **Betreff:** „Eure Anmeldung zur Krachparade 08.05.2027: ‹Name›“
- **Text** in der Ihr-Form:
  - Begrüßung: „Hallo ‹Vorname›,“ und Dank für die Anmeldung
  - Hinweis: Die Anmeldung ist verbindlich, sobald wir sie bestätigt haben. Überweist erst danach.
  - Angaben:
    - Kollektiv und Schreibweise
    - Fahrzeug
    - TÜV (nur motorisiert)
    - Soundkopplung
    - Wagenverantwortliche/r (Name)
    - Abschnittsleitung ja/nein (nur motorisiert)
    - T-Shirts je Art und Größe
  - Kosten: Pfand, TÜV, Shirts Standard, Shirts Soli, Summe
  - Abschluss: „Änderungen oder Fragen? Antwortet einfach auf diese Mail …“, Gruß „Eure Krachparade-Orga – Mehr Lärm für München“
- **Keine** Telefonnummern, keine Forderungen und keine Freitexte. Damit kann das Formular nicht genutzt werden, um fremde Inhalte an Dritte zu schicken.
- **`to` und `cc`** kommen nur aus der mit Zod geprüften Anmeldung. Zeilenumbrüche und Steuerzeichen werden entfernt, damit niemand Kopfzeilen einschleusen kann. Sind beide Adressen gleich, gibt es kein CC.

**E3 · Versand nach dem Speichern**

- **`submitRegistration`:** Nach dem Speichern läuft der Versand über `after()` aus `next/server`. Das Formular wartet also nicht auf Gmail.
  - Klappt der Versand, wird `confirmation_sent_at` gesetzt.
  - Höchstens eine Mail pro Anmeldung. Bei Honeypot, Fehler oder Duplikat wird nichts verschickt.
- **Danke-Seite und Datenschutz-Text:** siehe B3 und B2 (Abschnitt 9). Die Adresse selbst wird nicht angezeigt.

**E4 · Sichtbar in `/kollektive`**

- **Detailseite:** Zeile „Bestätigungs-Mail: verschickt am ‹Datum, Uhrzeit›“ oder „nicht verschickt“.
- **Liste:** kein Kennzeichen. „Mail fehlt“ war gebaut und wurde am 18.11.2026 auf Wunsch wieder entfernt. Der Mail-Status steht nur auf der Detailseite und in der CSV.
- **CSV:** Spalte „Bestätigung verschickt“ (Datum oder „nein“).

**E5 · Lokal: Mailpit in Docker**

- **`docker/compose.yaml`:** Dienst `mailpit` (`axllent/mailpit:v1.33.0`).
  - SMTP auf `127.0.0.1:1026`, Weboberfläche auf `http://localhost:8026`
  - Die Ports sind absichtlich nicht 1025/8025, damit sie nicht mit einem anderen Mailpit kollidieren.
- **`docker/local.env`:** `SMTP_HOST=localhost`, `SMTP_PORT=1026`, Fantasie-Absender `orga@example.org`, ohne Passwort.
- **`docker/README.md`:** Abschnitt „Mails ansehen“.

### Teil F · T-Shirt-Übersicht unter `/kollektive` (vormals Spec 033)

Ein eigener Bereich „T-Shirts“ zeigt alle Bestellungen: gesamt, je Kollektiv und mit dem Umsatz. Damit kann die Orga die Bestellung bei der Druckerei planen.

**F1 · Reine Funktion `shirtOverview`** (`src/lib/collectives/shirts.ts`, mit Tests)

- Eingabe: Anmeldungen mit `id`, `collectiveName`, `status`, `shirts`.
- **`confirmed`** (nur „Zugesagt“) und **`expected`** (alle außer „Abgesagt“), jeweils mit:
  - Stückzahl je Art und Größe
  - Summe je Art und gesamt
  - Umsatz je Art und gesamt
  - Soli-Anteil (Soli-Shirts × 10 €)
- **`byCollective`:** nur Kollektive mit mindestens einem Shirt, ohne Abgesagte, nach Name sortiert, mit Stückzahlen, Summe und Betrag.
- Die Preise kommen nur aus `costs.ts` (`SHIRT_PRICE_EUR`). So stimmen sie mit der Danke-Seite und der Mail überein.
- `shirtSizesLabel` gibt die Kurzform „2 × M, 1 × L“ zurück, ohne Bestellung „–“.

**F2 · Bereich „T-Shirts“** (`src/components/collectives/shirt-overview.tsx`)

- Er steht auf `/kollektive` **unter der Liste der Anmeldungen**. Der Klappbereich bei den Kennzahlen heißt nur noch „Westen“.
- **Gesamt:** Tabelle mit den Zeilen Standard, Soli, Gesamt und den Spalten S bis XXL und Summe, für „erwartet“. Darunter „davon zugesagt: ‹n› Shirts“.
- **Geld:** drei Kacheln:
  - „Umsatz Shirts (erwartet)“
  - „Umsatz Shirts (zugesagt)“
  - „davon Soli-Anteil (erwartet)“
  Darunter die Preise pro Shirt.
- **Wer hat was bestellt:**
  - Laptop (`desk:`): Tabelle mit Kollektiv (Link), Status, Standard, Soli, Summe, Betrag und Gesamt-Zeile
  - Handy: eine Karte je Kollektiv
  - ohne Bestellungen: „Noch keine T-Shirts bestellt.“

## Neuigkeiten

Drei Einträge, so wie sie gebaut wurden (Datum 2026-11-18):

- `031-kollektiv-anmeldung`, „Anmeldung der Kollektive“:
  - **Eigenes Formular statt Google:** Kollektive melden sich unter /anmeldung an, ohne Google-Konto.
  - **Alles unter „Kollektive“:** Du siehst alle Anmeldungen mit Fahrzeugen, TÜV, Soundkopplung, Westen und Shirts.
  - **Zusagen und Warteliste:** Setze den Status direkt an der Anmeldung und schreib interne Notizen.
  - **CSV-Export:** Für die Auswahlkommission mit einem Klick.
- `032-bestaetigungs-mail`, „Bestätigungs-Mail für Kollektive“:
  - **Mail nach der Anmeldung:** Kollektive bekommen eine Bestätigung mit Kosten, die oder der Wagenverantwortliche in Kopie.
  - **Siehst du unter „Kollektive“:** An jeder Anmeldung steht, ob die Mail rausging.
- `033-tshirt-uebersicht`, „T-Shirt-Übersicht“:
  - **Alle Shirts auf einen Blick:** Unter „Kollektive“ siehst du, wie viele Shirts je Art und Größe bestellt sind.
  - **Wer hat was bestellt:** Je Kollektiv Anzahl, Größen und Betrag.
  - **Umsatz:** Was die Shirts einbringen, zugesagt und erwartet, mit dem Soli-Anteil.

## Akzeptanzkriterien

1. `/anmeldung` und `/anmeldung/danke` sind ohne Login erreichbar. Alle anderen Seiten leiten weiter wie bisher auf `/login`, auch `/kollektive` und der Export.
2. Fragen, Pflichtfelder und Logik entsprechen dem Google-Formular, mit diesen Abweichungen:
   - keine IBAN/PayPal,
   - Links statt Uploads,
   - keine TÜV-Frage bei „nicht motorisiert“,
   - Datenschutz-Checkbox.
3. Außerhalb des Zeitfensters lässt sich nichts absenden, auch nicht per direktem Aufruf der Action.
4. Honeypot, Mindestzeit, doppelte Anmeldung und Obergrenze greifen (Unit-Tests oder Klicktest).
5. `/kollektive` zeigt Liste, Filter, Kennzahlen und Detail. Status und Notiz speichern. Export liefert eine CSV, die Excel mit Umlauten richtig öffnet.
6. Löschen, Zeitfenster und „Alle Anmeldungen löschen“ gehen nur für Admins, und der Server prüft das. „Alle Anmeldungen löschen“ geht erst ab D-Day + 3 Monate.
7. Keine Kontaktdaten auf der Danke-Seite, keine Inhalte im Log.
8. `AGENTS.md` und `agents/risikoklassen.json` sind wie in C1 angepasst.
9. Mindestens ein Klicktest in `e2e/` deckt Anmeldung, Mail und Auswertung ab und ist grün.
10. `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` grün; „Prüfungen“ und „Klicktests“ im PR grün.
11. `/anmeldung`, `/anmeldung/danke`, `/kollektive` und `/kollektive/[id]` bei 375 × 812 und 1280 × 800 geprüft.
12. **Mail (Teil E):**
    - Nach einer Anmeldung geht genau eine Mail an die Hauptansprechperson, die oder der Wagenverantwortliche steht in CC.
    - Sie enthält Zusammenfassung und Kosten, aber keine Telefonnummern und keine Freitexte.
    - Scheitert der Versand, ist die Anmeldung trotzdem gespeichert, und `/kollektive` zeigt „nicht verschickt“.
    - Ohne SMTP-Variablen und in der Vorschau ohne `MAIL_ENABLED=1` geht nichts raus.
    - Geheimnisse und Adressen stehen nie im Log.
13. **T-Shirts (Teil F):**
    - Der Bereich „T-Shirts“ zeigt Gesamttabelle, Umsatz (erwartet, zugesagt, Soli-Anteil) und die Liste je Kollektiv.
    - Abgesagte zählen nirgends mit.
    - Die Beträge stimmen mit der Danke-Seite und der Mail überein.

## Deploy

Datenbank-Änderung ja (Klasse C, kein Auto-Merge):

1. **In Gmail** (Konto mehr.laerm.fuer.muenchen@gmail.com) die Bestätigung in zwei Schritten einschalten und ein **App-Passwort** anlegen (Google-Konto → Sicherheit → App-Passwörter).
2. **Bei Vercel** (Production) setzen: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM`. In der Vorschau **kein** `MAIL_ENABLED`.
3. Neon-Backup-Zweig `backup-vor-031` von production anlegen.
4. `pnpm db:push:prod` vom PR-Zweig ausführen (durch Franz).
5. Mergen.
6. `deploy --db-erledigt`
7. Danach in der App unter `/kollektive` das Zeitfenster setzen, Vorschlag 17.01.–07.02.2027 (D-111 bis D-90).
8. Einmal testen: Probe-Anmeldung mit eigener Adresse, Mail prüfen, danach in `/kollektive` löschen.
