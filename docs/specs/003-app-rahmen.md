# SPEC 003 – App-Rahmen

Freigabe Franz: ☑
Zweig: `spec/003-app-rahmen` · Risikoklasse B · lokal (Sichtprüfung Design) · DB: ja: neue Tabellen `editions`, `departments`

## Ziel

Die App bekommt ihren festen Rahmen nach dem abgenommenen Test-Layout v3: Kopfleiste mit MLfM-Logo und D-Day-Zähler, Navigation für Handy und Laptop, eine aktuelle Ausgabe „Krachparade 2027“ mit D-Day und Einstellungen, in denen Admins Personen und Referate (mit Leitung) pflegen. Darauf bauen Meilensteine und Aufgaben in R1 auf.

## Nicht in dieser Spec

- Meilenstein-Baum, Meilensteine, Aufgaben, Referats-Status (R1)
- Protokolle (Spec 004) und Kollektive (R3) – nur Platzhalter-Seiten
- Vorlage für das Folgejahr (R4)
- Änderungen am Login-Ablauf, an `src/auth.ts`, an `src/proxy.ts` oder an `ADMIN_EMAILS`

## Vorab: Abgleich mit dem Code aus 002

Bevor du etwas änderst, prüfe den aktuellen Stand und berichte kurz:

- Wo liegt die Startseite aus 002 (erwartet: `src/app/page.tsx` mit Name und „Abmelden“)?
- Welcher Helfer lädt das angemeldete Mitglied aus `members` und prüft `active` (erwartet: vorhanden, da deaktivierte Mitglieder bei jedem Aufruf geprüft werden)?
- Wie unterscheidet `src/db/seed.ts` production und dev (erwartet: Argument `--prod`)?
- Wie ermittelt der Dev-Login seine Test-Mitglieder (aus der Datenbank oder fest im Code)?

Wenn etwas davon grundlegend anders ist als hier beschrieben: stoppen, Unterschied beschreiben, nichts umbauen.

## Umsetzung

### Teil A – Gestaltung, Kopfleiste, Navigation, Platzhalter

1. **Farben als CSS-Variablen** in `src/app/globals.css` (Tailwind 4), helles und dunkles Thema über `prefers-color-scheme`. Werte aus Test-Layout v3:
   - Hell: Hintergrund `#F5F6F4`, Fläche `#FFFFFF`, Fläche-2 `#EFF2EF`, Text `#18231E`, gedämpft `#5F6B65`, Linie `#DCE2DE`, Linie-stark `#C3CBC6`, Primär `#0F3A2D` (Text darauf `#FFFFFF`), Akzent Pink `#FF6FA0` (nur Akzentstrich, Fokus, „Heute“-Linie)
   - Kopfleiste: Hintergrund `#0F3A2D`, Text `#F4EFE6`, gedämpft `#B9D3BF`, unten 3 px Pink
   - Status: Erreicht `#0F3A2D`/`#FFFFFF`, On track `#B6DBA9`/`#1E4A26`, Wackelt `#F2B451`/`#5E3600`, Verzug `#C8435C`/`#FFFFFF`
   - Dunkel: Hintergrund `#111614`, Fläche `#191F1C`, Fläche-2 `#212925`, Text `#E7ECE9`, gedämpft `#9AA6A0`, Linie `#2B3430`, Linie-stark `#3A4540`, Kopfleiste `#0B2B21`, Primär `#9FD3A8` (Text darauf `#0E1A14`); Status Erreicht `#2E7D4F`/`#FFFFFF`, On track `#3F6B45`/`#DDF3DD`, Wackelt `#B9832E`/`#1E1200`, Verzug `#B23A51`/`#FFFFFF`
   - Schrift Inter Tight über `next/font/google` (400/500/600/700), Grundgröße 14 px, Ecken 6 px, keine harten Schatten, keine Plakat-Elemente.
   - Die Seite `/login` aus 002 übernimmt nur die neuen Farbvariablen, sonst bleibt sie unverändert.
2. **Logo**: `public/mlfm-logo.png` (Franz legt die Datei vor dem Bauen ins Repo). Anzeige in einem weißen Kreis (44 px) links in der Kopfleiste, Alt-Text „Mehr Lärm für München“.
3. **Komponente `StatusPill`** (`src/components/status-pill.tsx`) mit Varianten `done`, `ok`, `warn`, `late` und Texten „Erreicht“, „On track“, „Wackelt“, „Verzug“; optional Zusatz „· Einschätzung“. Wird in R1 genutzt, hier nur gebaut.
4. **Startseite verschieben**: Die Startseite aus 002 wandert von `src/app/page.tsx` nach `src/app/(app)/page.tsx` (es darf nur eine Seite für `/` geben). Name und „Abmelden“ verschwinden dort, beides sitzt künftig in der Kopfleiste bzw. unter „Mehr“. Den Klicktest `e2e/login.spec.ts` aus 002 nur so weit anpassen, wie es der neue Ort von Name und „Abmelden“ verlangt.
5. **Layout** `src/app/(app)/layout.tsx` für alle angemeldeten Seiten:
   - Lädt bei jedem Aufruf das angemeldete Mitglied über den bestehenden Helfer aus 002 aus der Datenbank. Fehlt es oder ist es deaktiviert → Weiterleitung auf `/login`. Keinen zweiten Helfer bauen.
   - Kopfleiste (sticky, sichere Bereiche beachten): Logo, „Krachparade Orga“ mit Unterzeile „Mehr Lärm für München“, Navigation, rechts D-Day-Zähler („D-206“, darunter „Krachparade 08.05.2027“), Name der angemeldeten Person mit „Abmelden“.
   - Bis 900 px Breite: Navigation und Personenname in der Kopfleiste ausgeblendet, stattdessen untere Tab-Leiste mit fünf Einträgen: Überblick, Referate, Protokolle, Meine, Mehr. „Mehr“ führt zu `/einstellungen`, dort oben Links zu Kollektive und „Abmelden“.
6. **Navigation** (Reihenfolge): Überblick `/` · Referate `/referate` · Protokolle `/protokolle` · Meine Aufgaben `/meine` · Kollektive `/kollektive` (Kennzeichen „R3“) · Einstellungen `/einstellungen`. Aktiver Eintrag hervorgehoben; Unterseiten (z. B. `/protokolle/…`) markieren ihren Hauptpunkt.
7. **Platzhalter-Seiten**: `/` Titel „Weg zur Krachparade“, `/referate`, `/meine` mit Hinweis „Kommt mit Release R1“. `/protokolle` mit Hinweis „Kommt mit Spec 004“ (wird dort ersetzt). `/kollektive` mit „Kommt mit Release R3“ und den vier Punkten aus Test-Layout v3.
8. **Reine Funktionen** in `src/lib/dday.ts`:
   - `daysUntil(dDay, today)` und `formatDLabel(today, dDay)` (`D-206`, `D-Day`, `D+4`), Daten als Kalendertage ohne Uhrzeit.
   - `todayInBerlin(now)` liefert den Kalendertag in `Europe/Berlin` für einen Zeitpunkt. Der Server läuft in UTC; „heute“ wird immer serverseitig über diese Funktion bestimmt, nie über die lokale Server-Zeit und nie im Browser.
   - Vitest-Tests inkl. Sommerzeit-Wechsel (Ende März, Ende Oktober), Jahreswechsel und der Zeit zwischen 0 und 2 Uhr Berliner Zeit (z. B. `2026-10-14T23:30:00Z` → 15.10.2026).

Auftrag 1 endet mit „setze NUR Teil A um“. Teil A committen, nicht pushen.

### Teil B – Ausgabe, Personen, Referate

9. **Tabellen** in `src/db/schema.ts` (nur hinzufügend):
   - `editions`: `id` uuid, `name` text, `d_day` date, `is_current` boolean, `created_at`. Genau eine Ausgabe ist aktuell.
   - `departments` (Oberfläche: „Referate“): `id` uuid, `edition_id` → `editions`, `name` text, `lead_id` → `members` (leer erlaubt), `sort_order` int, `created_at`.
10. **Server Actions** in `src/actions/` mit Zod-Prüfung:
    - Rechteprüfung bei **jedem** Aufruf aus der Datenbank: Das handelnde Mitglied wird über `memberId` aus `members` geladen; es muss `active = true` und für Schreibaktionen `is_admin = true` sein. `isAdmin` aus der Session reicht nicht, weil sie nach einem Entzug veraltet sein kann. Sonst Fehlermeldung „Nur Admins können das ändern.“
    - D-Day der aktuellen Ausgabe ändern
    - Person einladen (E-Mail + Name; E-Mail getrimmt und klein geschrieben; doppelte E-Mail ablehnen mit „Diese Adresse ist schon eingeladen.“). Nach Erfolg Hinweis: „Eingeladen. Solange die Google-Anmeldung im Testmodus ist, die Adresse zusätzlich in der Google Console als Testnutzer eintragen – sonst klappt der Login nicht.“
    - Person deaktivieren / wieder aktivieren. Sich selbst deaktivieren geht nicht („Du kannst dich nicht selbst deaktivieren.“).
    - Admin-Recht geben / nehmen. Sich selbst das Admin-Recht nehmen geht nicht. Für Adressen aus `ADMIN_EMAILS` (über `parseAdminEmails` aus `src/lib/access.ts`) ist Nehmen gesperrt mit „Admin über Server-Einstellung festgelegt.“, weil 002 das Recht bei jedem Login wieder setzt.
    - Referat anlegen, umbenennen, Leitung setzen (nur aktive Personen), Reihenfolge ändern (hoch/runter)
11. **Seite `/einstellungen`** mit drei Bereichen:
    - **Ausgabe:** Name (Anzeige), D-Day als Datumsfeld (Admins), Hinweis „Ab R1 rechnen sich alle Meilensteine rückwärts vom D-Day neu.“; Button „Vorlage für KP28 erzeugen“ deaktiviert mit Hinweis „ab R4“.
    - **Personen:** Liste mit Name, Kennzeichen „Admin“ oder „Kern-Orga“, „deaktiviert“ ausgegraut; für Admins Formular „Person einladen“ und Aktionen je Zeile. Bei Personen aus `ADMIN_EMAILS` ist „Admin nehmen“ gesperrt und zeigt „Admin über Server-Einstellung festgelegt“; bei der eigenen Zeile sind „Deaktivieren“ und „Admin nehmen“ gesperrt. Hinweis: „Login mit Google-Konto. Nur eingeladene Adressen kommen rein.“ E-Mail-Adressen nur für Admins sichtbar; der Inhalt von `ADMIN_EMAILS` wird nie an den Browser gegeben, nur das Ergebnis je Person (gesperrt ja/nein), und auch das nur für Admins.
    - **Referate:** Tabelle mit Name, Leitung (Auswahl aus aktiven Personen), Reihenfolge-Pfeile; für Nicht-Admins nur lesend.
12. **Seed** `src/db/seed.ts` (idempotent, nur ausgedachte Personen):
    - Ausgabe „Krachparade 2027“, D-Day 2027-05-08, aktuell (auch mit `--prod`).
    - 15 Referate in dieser Reihenfolge (auch mit `--prod`, dort **ohne Leitung**): Demoleitung · Planung Auftakt/Abschlussfläche · Bühne / Soundkopplung · Route · Wagenreihung · Wagenpakete · Bühnenprogramm politisch · Bühnenprogramm musikalisch · Social Media · Kommunikation E-Mails · Kollektiv-Chats · Teaser / Aftermovie · Pressearbeit · Finanzen · Ressourcen / Material
    - Nur ohne `--prod` – Mitglieder zusätzlich zu 002: „Robin Tal“, „Jo Kranz“, „Mika Sonnleitner“, „Luca Pfeffer“, „Noa Fink“, „Ivy Lamm“ – Adressen nach Muster `vorname.nachname@example.org` – und Leitungen: Demoleitung (Kim Brenner) · Planung Auftakt/Abschlussfläche (Alex Rauch) · Bühne / Soundkopplung (Sascha Möller) · Route (Kim Brenner) · Wagenreihung (Robin Tal) · Wagenpakete (Alex Rauch) · Bühnenprogramm politisch (Jo Kranz) · Bühnenprogramm musikalisch (Mika Sonnleitner) · Social Media (Luca Pfeffer) · Kommunikation E-Mails (Mika Sonnleitner) · Kollektiv-Chats (Noa Fink) · Teaser / Aftermovie (Ivy Lamm) · Pressearbeit (Jo Kranz) · Finanzen (Noa Fink) · Ressourcen / Material (Ivy Lamm)
    - Mit `--prod` werden keine Mitglieder angelegt oder verändert.
    - `db:reset:dev` aus 001 leert auch die neuen Tabellen.
13. **Kopfleiste und Einstellungen** lesen Name und D-Day aus `editions` (in Teil A fest eingetragen).
14. **Klicktest** `e2e/rahmen.spec.ts` (nach Dev-Login als Kim Brenner):
    - Alle sechs Navigationsziele erreichbar, Titel stimmt; Logo sichtbar; Abmelden führt auf `/login`
    - Bei 375 × 812 ist die untere Tab-Leiste sichtbar und die Kopf-Navigation nicht; bei 1280 × 800 umgekehrt
    - D-Day auf 2027-05-15 ändern → Kopfleiste zeigt den neuen Abstand; danach zurück auf 2027-05-08
    - Person „Test Person“ (`test.person@example.org`) einladen → erscheint in der Liste mit dem Testnutzer-Hinweis; danach deaktivieren
    - In der eigenen Zeile (Kim Brenner) sind „Deaktivieren“ und „Admin nehmen“ gesperrt
    - Leitung von „Route“ auf „Alex Rauch“ ändern → bleibt nach Neuladen erhalten; danach zurück auf „Kim Brenner“
    - Als Nicht-Admin (Dev-Login als Alex Rauch) sind D-Day-Feld und Einladen-Formular nicht bedienbar
    - Tests prüfen relativ (keine festen Gesamtzahlen), damit Testreste in dev nicht stören
15. **Vitest** für die Rechteprüfung als reine Funktion (z. B. `canManage(actor, target, adminEmails, action)` in `src/lib/`): Nicht-Admin, deaktivierter Admin, Selbst-Deaktivieren, Selbst-Admin-Nehmen, Admin-Nehmen bei Adresse aus `ADMIN_EMAILS`.

Auftrag 2 beginnt mit „Teil A ist bereits umgesetzt – ändere daran nichts“.

## Akzeptanzkriterien

- Optik entspricht Test-Layout v3 (Forest-Kopfleiste mit Logo und Pink-Strich, sonst ruhig und hell), helles und dunkles Thema lesbar
- Es gibt genau eine Seite für `/` (unter `(app)`); `/login` funktioniert unverändert
- Navigation auf Handy (untere Leiste) und Laptop (Kopfleiste) vollständig bedienbar, keine waagrechte Scrollleiste bei 375 px
- D-Day-Abstand stimmt (heute in Berliner Zeit bis 08.05.2027), Vitest für `src/lib/dday.ts` grün
- Admin-Aktionen sind serverseitig über die Datenbank abgesichert, nicht nur im Browser ausgeblendet und nicht nur über die Session
- Deaktivierte Mitglieder landen auf `/login`, auch mit gültigem Sitzungs-Cookie
- Seed enthält nur ausgedachte Namen und `@example.org`-Adressen; `--prod` legt nur Ausgabe und Referate ohne Leitung an
- Keine E-Mail-Adressen in Logs; `ADMIN_EMAILS` erreicht nie den Browser
- Klicktest `e2e/rahmen.spec.ts` grün bei 375 × 812 und 1280 × 800; Klicktests aus 001 und 002 weiter grün
- `pnpm typecheck`, `lint`, `test`, `build` grün

## Deploy

DB-Änderung: Neon-Backup-Zweig `backup-vor-003` → `pnpm db:push:prod` → `pnpm db:seed:prod` (legt auf production nur die Ausgabe „Krachparade 2027“ und die 15 Referate **ohne Leitung** an, keine Test-Mitglieder) → `deploy --db-erledigt`. Danach live am iPhone: Kopfleiste, Tab-Leiste, D-Day-Zähler, Einstellungen; Leitungen der Referate setzt Franz, sobald die Kern-Orga eingeladen ist.
