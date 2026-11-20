# SPEC 035 – Datenschutzerklärung

Freigabe Franz: ☑
Go: Tiago im Chat, 20.11.2026
Zweig: `agent/035-datenschutz` · Risikoklasse C (`src/proxy.ts`: neue Seite ohne Anmeldung; Einschätzung, maßgeblich ist das Skript) · lokal · DB: nein

## Ziel

Google verlangt für den OAuth-Zustimmungsbildschirm einen Link zu einer Datenschutzerklärung, sonst lässt sich die App nicht veröffentlichen und der Google-Login funktioniert nur für einzeln eingetragene Testnutzer. Danach gibt es unter `https://krachparade-orga.de/datenschutz` eine öffentliche Seite, die ohne Anmeldung erreichbar ist. Sie erklärt, welche Daten die App speichert, wofür, wie lange und wer sie sieht. Die Login-Seite und das Anmeldeformular der Kollektive verlinken darauf.

## Nicht in dieser Spec

- Impressum: Das steht schon auf krachparade.de. Die Datenschutzseite verlinkt nur darauf.
- Rechtliche Prüfung: Der Text stammt aus dem kostenlosen Datenschutz-Generator.de (Dr. Schwenke, mit Pflichthinweis) plus drei Abschnitten von Hand. Kein Anwalt hat ihn geprüft. Die Orga liest ihn vor dem Merge gegen.
- Cookie-Banner: Die App setzt nur das technisch nötige Sitzungs-Cookie. Dafür braucht es keine Einwilligung.

## Umsetzung

### B1 · Seite `/datenschutz`

- `src/app/datenschutz/page.tsx`: liegt außerhalb von `(public)`, weil dessen Kopfleiste „Anmeldung“ heißt. Schlichtes Layout wie `/login`, Breite `max-w-2xl`. Titel „Datenschutzerklärung – Krachparade Orga“. `robots: noindex` gilt über das Root-Layout.
- Inhalt: Text aus Datenschutz-Generator.de (Stand 20.11.2026) als statische Konstante `src/app/datenschutz/privacy-html.ts`, ergänzt um die Abschnitte „Anmeldung der Kollektive“, „Datenbank und E-Mail-Versand“ und „Speicherung im Browser“. Er deckt ab:
  1. **Verantwortlich:** Initiative MEHR LÄRM FÜR MÜNCHEN, c/o F. Raabe, Balanstr. 69, 81541 München, mehr.laerm.fuer.muenchen@gmail.com (wie im Impressum auf krachparade.de, darauf verlinken).
  2. **Anmeldung mit Google (Kern-Orga):** Name und E-Mail-Adresse aus dem Google-Konto, Zeitpunkt der letzten Anmeldung. Zweck: Zugang nur für freigeschaltete Mitglieder. Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO. Google erfährt, dass man sich bei der App anmeldet (Verweis auf die Google-Datenschutzerklärung). Gespeichert, solange man Mitglied der Orga ist.
  3. **Inhalte in der App:** Was die Orga einträgt (Planung, Protokolle, Aufgaben, Feedback), mit Namen der beteiligten Mitglieder. Nur für angemeldete Mitglieder sichtbar.
  4. **Anmeldung der Kollektive (`/anmeldung`):** Angaben aus dem Formular, auch Namen, E-Mail und Handynummern der Ansprechpersonen. Rechtsgrundlage: Einwilligung (Art. 6 Abs. 1 lit. a DSGVO, Haken im Formular), widerrufbar per Mail. Bestätigungs-Mail an die angegebene Adresse. Löschung drei Monate nach der Krachparade.
  5. **Cookies und Speicher im Browser:** nur das Sitzungs-Cookie nach der Anmeldung. Der Entwurf des Anmeldeformulars bleibt im `localStorage` des eigenen Geräts, bis man absendet. Die Wahl hell oder dunkel bleibt ebenfalls auf dem Gerät. Keine Analyse, keine Werbung, keine Schriften oder Karten von Dritten.
  6. **Hosting und Dienstleister:** Server bei netcup GmbH (Karlsruhe, Rechenzentrum in Deutschland), Datenbank bei Neon (Rechenzentrum Frankfurt), Google für den Login, ein E-Mail-Dienst für Bestätigungs-Mails. Der Server speichert technisch nötige Zugriffsprotokolle (u. a. IP-Adresse) kurzzeitig.
  7. **Deine Rechte:** Auskunft, Berichtigung, Löschung, Einschränkung, Widerspruch, Datenübertragbarkeit, Widerruf einer Einwilligung, Beschwerde bei einer Aufsichtsbehörde (in Bayern: Bayerisches Landesamt für Datenschutzaufsicht). Anfragen per Mail an die Orga.
  8. Stand-Datum.
- `src/proxy.ts`: `/datenschutz` zu `PUBLIC_PATHS` hinzufügen.
- Links: unter dem Text auf `/login` („Datenschutzerklärung“) und im Datenschutz-Abschnitt von `/anmeldung`.

### B2 · Klicktest (Pflicht)

- `e2e/datenschutz.spec.ts`: Ohne Anmeldung `/datenschutz` öffnen, Überschrift und Verantwortliche sichtbar, kein horizontales Scrollen bei 375 px. Von `/login` aus über den Link erreichbar.

## Neuigkeiten

Keiner (für das Team ändert sich nichts Sichtbares außer einem Link).

## Akzeptanzkriterien

1. `/datenschutz` ist ohne Anmeldung erreichbar und enthält alle Abschnitte aus B1.
2. `/login` und `/anmeldung` verlinken auf `/datenschutz`.
3. Alle anderen Seiten verlangen weiter eine Anmeldung.
4. Mindestens ein Klicktest in `e2e/` deckt die neue Seite ab und ist grün.
5. `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` grün; „Prüfungen“ und „Klicktests“ im PR grün.
6. Bei 375 × 812 und 1280 × 800 geprüft.

## Deploy

Datenbank-Änderung nein → `deploy`. Danach den Link `https://krachparade-orga.de/datenschutz` in der Google Auth Platform unter **Branding** eintragen.
