# SPEC 032 – Bestätigungs-Mail nach der Anmeldung

Freigabe Franz: ☑
Zweig: `spec/032-bestaetigungs-mail` (baut auf `spec/031-kollektiv-anmeldung` auf) · Risikoklasse **C** (neue Abhängigkeit `nodemailer`, `package.json`, `.env.example`, `docker/`, öffentliche Action) · **lokal** · DB: ja (1 neue Spalte)

Entscheidungen von Franz vom 18.11.2026:

- **Versand per SMTP über das bestehende Gmail-Postfach** `mehr.laerm.fuer.muenchen@gmail.com`. Es kommt kein neuer Anbieter dazu. Gmail bekommt ein App-Passwort.
- **Empfänger:** an den oder die Hauptansprechpartner/in, die oder der Wagenverantwortliche in CC.
- **Zusage-Mail** (bei Status „Zugesagt“, mit Zahlungsinfos): später, eigene Spec.

## Ziel

Nach dem Absenden auf `/anmeldung` bekommt das Kollektiv eine **Bestätigungs-Mail**. Sie enthält eine Zusammenfassung der wichtigsten Angaben und die Kostenübersicht. Die Mail kommt von eurem bekannten Orga-Postfach, Antworten landen direkt dort. Klappt der Versand nicht, bleibt die Anmeldung trotzdem gespeichert. Unter `/kollektive` sieht die Orga, bei welcher Anmeldung die Mail rausging. Lokal fängt Mailpit in Docker alle Mails ab, es geht nie eine echte Mail raus.

## Nicht in dieser Spec

- **Zusage-Mail** mit Zahlungsinfos und Frist (eigene Spec)
- **Erneut senden** aus `/kollektive` heraus. Bei Bedarf schreibt die Orga von Hand.
- **Info-Mail an das Orga-Postfach** bei neuer Anmeldung
- **HTML-Design, Logo und Anhänge.** Die Mail ist schlichter Text.
- **Telefonnummern in der Mail**

## Vorab: Abgleich mit dem Code

Prüfe zuerst und berichte kurz im Chat. **Erst nach „Weiter“ von Franz** etwas ändern.

- **Wo wird gespeichert?** `submitRegistration` (`src/actions/collective-registration.ts`). Kann der Versand nach dem Speichern laufen, ohne die Antwort an das Formular lange aufzuhalten? Lies dafür in `node_modules/next/dist/docs/` nach, was `after()` aus `next/server` in Server Actions kann.
- **Läuft `nodemailer` in der Node-Laufzeit**, in der die Action bei Vercel läuft (nicht Edge)?
- **Wie ist `docker/compose.yaml` aufgebaut?** Wo kommt Mailpit dazu?

## Umsetzung

### B1 · Versand-Baustein

- **Abhängigkeit:** `nodemailer` und `@types/nodemailer`, jeweils eine Version, die mindestens 2 Wochen alt ist. Begründung: Ein Standard-SMTP-Client ist sicherer als ein eigener.
- **Umgebungsvariablen** (Namen in `.env.example`, Werte setzt Franz bei Vercel):
  - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM`
  - Production: `smtp.gmail.com`, Port `465`, `SMTP_USER` = das Gmail-Postfach, `SMTP_PASSWORD` = Gmail-App-Passwort, `MAIL_FROM` = `Krachparade Orga <mehr.laerm.fuer.muenchen@gmail.com>`
  - Fehlt eine Variable, wird nichts verschickt. Das Log zeigt nur „[mail] nicht eingerichtet“.
- **`src/lib/mail/env.ts`:** liest die Variablen, nur auf dem Server. Werte werden nie geloggt.
- **`src/lib/mail/send.ts`:** `sendMail({ to, cc, subject, text })` mit `nodemailer`.
  - Timeout 10 s.
  - Bei Fehlern wird nur der Fehlername geloggt, nie Adressen oder Inhalt.
  - Rückgabe `true` oder `false`.
- **In der Vercel-Vorschau** wird nur verschickt, wenn `MAIL_ENABLED=1` gesetzt ist. Sonst bekäme das echte Postfach Mails aus Klicktests.

### B2 · Inhalt der Mail

- **Reine Funktion `confirmationMail(registration, edition)`** in `src/lib/collectives/confirmation-mail.ts`, mit Tests. Sie gibt `{ subject, text }` zurück.
- **Betreff:** „Eure Anmeldung zur Krachparade 08.05.2027: ‹Name›“
- **Text** (Du-/Ihr-Form wie das Formular):
  - Begrüßung: „Hallo ‹Vorname›, danke für eure Anmeldung!“
  - Die Anmeldung ist **verbindlich**, sobald wir sie bestätigt haben. Überweist erst danach.
  - Angaben:
    - Kollektiv und Schreibweise
    - Fahrzeug, TÜV, Soundkopplung
    - Wagenverantwortliche/r (Name, keine Nummer)
    - Abschnittsleitung ja/nein
    - T-Shirts je Art und Größe
  - Kostenübersicht wie auf der Danke-Seite (Pfand, TÜV, Shirts, Summe)
  - „Änderungen oder Fragen? Antwortet einfach auf diese Mail.“
  - Gruß „Eure Krachparade-Orga – Mehr Lärm für München“
- **Keine** Telefonnummern, keine Forderungen und keine Freitexte. Damit ist die Mail kurz und kann nicht für fremde Inhalte missbraucht werden.
- **Adressen in `to` und `cc`** kommen nur aus der gespeicherten, mit Zod geprüften Anmeldung. Zeilenumbrüche in Namen sind ausgeschlossen, damit niemand zusätzliche Kopfzeilen einschleusen kann.

### B3 · Versand nach dem Speichern

- **`collective_registrations`** bekommt eine neue Spalte `confirmation_sent_at` (`timestamptz`, nullable, nur hinzufügend).
- **In `submitRegistration`,** nachdem die Anmeldung gespeichert ist: Der Versand läuft über `after()` aus `next/server` (falls der Abgleich das bestätigt). So wartet das Formular nicht auf Gmail.
  - Klappt der Versand, wird `confirmation_sent_at` gesetzt.
  - **Höchstens eine Mail pro Anmeldung.** Bei Honeypot, Fehler oder Duplikat wird nichts verschickt.
- **Danke-Seite:** „Wir haben euch eine Bestätigung an ‹die angegebene Adresse› geschickt. Schaut auch im Spam-Ordner nach.“ Die Adresse selbst wird **nicht** angezeigt (keine Kontaktdaten auf der Danke-Seite, Spec 031).
- **Datenschutz-Text** der Checkbox, ergänzt um: „… Eine Bestätigung schicken wir per E-Mail.“

### B4 · Sichtbar in `/kollektive`

- **Detailseite:** Zeile „Bestätigungs-Mail“ mit „verschickt am ‹Datum, Uhrzeit›“ oder „nicht verschickt“.
- **Liste:** kleines Kennzeichen „Mail fehlt“ bei Anmeldungen ohne `confirmation_sent_at`, die älter als 10 Minuten sind.
- **CSV:** neue Spalte „Bestätigung verschickt“.

### B5 · Lokal: Mailpit in Docker

- **`docker/compose.yaml`:** neuer Dienst `mailpit` (Image `axllent/mailpit` mit fester Version).
  - SMTP auf `127.0.0.1:1025`
  - Weboberfläche auf `http://localhost:8025`
- **`docker/local.env`:** `SMTP_HOST=localhost`, `SMTP_PORT=1025`, Fantasie-Absender `orga@example.org`, ohne Passwort.
- **`docker/README.md`:** ein Abschnitt „Mails ansehen“.

### B6 · Klicktest (Pflicht)

- **`e2e/kollektiv-anmeldung.spec.ts`** wird erweitert: Nach dem Absenden fragt der Test die API von Mailpit ab (`http://localhost:8025/api/v1/messages`). Es gibt genau eine Mail:
  - an `robin.beispiel@example.org`, CC `kai.probe@example.org`,
  - im Betreff der Name „E2E Testkollektiv …“,
  - im Text „310 €“ und keine Telefonnummer.
- **Läuft Mailpit nicht** (z. B. in CI gegen die Vercel-Vorschau), überspringt der Test diesen Teil mit Hinweis.
- **Aufräumen:** Die E2E-Mail wird in Mailpit wieder gelöscht.
- **Unit-Tests** für `confirmationMail`:
  - Inhalt, Kosten,
  - keine Telefonnummern,
  - Abschnittsleitung ja/nein,
  - Fahrzeug ohne Motor (keine TÜV-Zeile).

## Neuigkeiten

ID `032-bestaetigungs-mail`, Datum = Tag des Baus, Titel „Bestätigungs-Mail für Kollektive“:

- **Mail nach der Anmeldung:** Kollektive bekommen nach dem Absenden eine Bestätigung mit Kosten, die oder der Wagenverantwortliche in Kopie.
- **Siehst du unter „Kollektive“:** An jeder Anmeldung steht, ob die Mail rausging.

## Akzeptanzkriterien

1. Nach einer Anmeldung geht genau eine Mail an die Hauptansprechperson, die oder der Wagenverantwortliche steht in CC. Absender und Antwort-Adresse ist das Orga-Postfach.
2. Die Mail enthält Zusammenfassung und Kosten, aber keine Telefonnummern und keine Freitexte.
3. Scheitert der Versand, ist die Anmeldung trotzdem gespeichert. Das Formular zeigt keinen Fehler, `/kollektive` zeigt „nicht verschickt“.
4. Ohne SMTP-Variablen und in der Vercel-Vorschau ohne `MAIL_ENABLED=1` wird nichts verschickt.
5. Geheimnisse und Adressen stehen nie im Log.
6. Lokal landen alle Mails in Mailpit. Der Klicktest prüft die Mail und ist grün.
7. `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` grün; bei 375 × 812 und 1280 × 800 geprüft.

## Deploy

Datenbank-Änderung ja (Klasse C, kein Auto-Merge), nach Spec 031:

1. **In Gmail** (Konto mehr.laerm.fuer.muenchen@gmail.com) die Bestätigung in zwei Schritten einschalten und ein **App-Passwort** anlegen (Google-Konto → Sicherheit → App-Passwörter).
2. **Bei Vercel** (Production) setzen: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM`. In der Vorschau **kein** `MAIL_ENABLED`.
3. **Datenbank:** Neon-Backup-Zweig `backup-vor-032` anlegen, dann `pnpm db:push:prod` vom PR-Zweig ausführen.
4. **Mergen, dann `deploy --db-erledigt`.**
5. **Einmal testen:** eine Probe-Anmeldung mit eigener Adresse, danach in `/kollektive` löschen.
