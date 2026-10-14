# SPEC 004 – Protokoll

Freigabe Franz: ☑
Zweig: `spec/004-protokoll` · Risikoklasse B (Risiko-Skript stuft wegen Seed-Änderung C ein – erwartbar) · lokal (echte Daten, Sichtprüfung, Teil A/B) · DB: ja: neue Tabellen `meetings`, `meeting_attendees`, `meeting_items`

Überarbeitet 14.10.2026 (Sitzung 3) gegen den Stand nach 003: Layout `(app)` mit `getCurrentMember()`, Rechte aus der Datenbank, `editions`, `departments`, `todayInBerlin()`. Circleback-spezifische Funktion ersetzt durch allgemeines „Notiz oder Transkript einfügen“. Status „Final“ ist nur ein Kennzeichen. To-dos können zusätzlich eine Person ohne Account (Freitext) haben. Treffen löschen dürfen Admins und wer das Treffen angelegt hat.

## Ziel

Nach jedem Orga-Treffen (anfangs alle 2–4 Wochen, erstes Treffen am 14.10.2026) steht ein sauberes Protokoll in der App: live mitgeschrieben oder aus einer eingefügten Notiz bzw. einem Transkript übertragen. Jeder Punkt ist Info, Diskussion, Entscheidung oder To-do. To-dos haben eine verantwortliche Person (Mitglied der Kern-Orga oder Name ohne Account), ein Fälligkeitsdatum und optional ein Referat. Entscheidungen bilden ein Beschluss-Log, To-dos eine gemeinsame Liste. Das Protokoll lässt sich als Text für Telegram kopieren.

## Nicht in dieser Spec

- Automatisches Zerlegen von Notizen oder Transkripten per KI (R2)
- Anbindung an Circleback oder andere Notiz-Dienste
- Auto-Agenda aus Meilensteinen, To-dos als Aufgaben im Meilenstein-Baum (R2)
- Benachrichtigungen
- Änderungen an `src/proxy.ts`, `src/auth.ts`, am Login-Ablauf, an `ADMIN_EMAILS`, an `canManage()` und an den Seiten `/einstellungen`, `/login`
- Neue Laufzeit-Pakete

## Vorab: Abgleich mit dem Code aus 003

Bevor du etwas änderst, prüfe den aktuellen Stand und berichte kurz:

- Das Layout `src/app/(app)/layout.tsx` lädt das Mitglied über `getCurrentMember()` aus `src/components/current-member.ts`, und `getCurrentMember()` ruft `await connection()` vor `requireMember()`.
- Wie werden Rechte in Server Actions geprüft? Erwartet: Mitglied über `memberId` aus `members` laden, `active` und `is_admin` aus der Datenbank, reine Funktion `canManage()` in `src/lib/`.
- Wie wird die aktuelle Ausgabe geladen (`editions.is_current`)? Gibt es dafür schon einen Helfer?
- `todayInBerlin(now)` liegt in `src/lib/dday.ts`.
- Platzhalter-Seiten `src/app/(app)/protokolle/page.tsx` („Kommt mit Spec 004“) und `src/app/(app)/meine/page.tsx` („Kommt mit Release R1“).
- `src/db/seed.ts` unterscheidet production und dev über `--prod`; `db:reset:dev` leert alle Tabellen.
- Welche Test-Mitglieder kennt der Dev-Login (erwartet u. a. Kim Brenner als Admin, Alex Rauch ohne Admin)?

Wenn etwas davon grundlegend anders ist als hier beschrieben: stoppen, Unterschied beschreiben, nichts umbauen. Bestehende Helfer nutzen, keine zweiten bauen.

## Umsetzung

Baut auf 002 (`members`) und 003 (`editions`, `departments`, Layout `(app)`, `getCurrentMember()`, `StatusPill`, Farben, `todayInBerlin()`) auf. Ersetzt die Platzhalter `/protokolle` und `/meine` aus 003.

**Grundregeln für alle Teile**

- „Heute“ wird immer serverseitig über `todayInBerlin(new Date())` bestimmt, nie über die lokale Server-Zeit und nie im Browser. Datumslogik nur in `src/lib/` mit „heute“ als Parameter.
- Alle Daten hängen an der **aktuellen Ausgabe** (`editions.is_current = true`). Referate in Auswahlfeldern nur aus der aktuellen Ausgabe, in `sort_order`.
- Auswahlfelder für Personen zeigen nur **aktive** Mitglieder. Bereits eingetragene, inzwischen deaktivierte Mitglieder werden weiter mit Namen angezeigt, Zusatz „(deaktiviert)“.
- Rechte (Entscheidung „alle bearbeiten alles“): Jede Server Action lädt das handelnde Mitglied bei **jedem** Aufruf über `memberId` aus `members`; es muss `active = true` sein, sonst Fehlermeldung „Kein Zugriff.“. Die Session allein reicht nicht.
- Status „Final“ ist nur ein Kennzeichen. Alles bleibt für alle Angemeldeten bearbeitbar, auch To-dos abhaken.
- E-Mail-Adressen erscheinen auf keiner Protokoll-Seite und in keinem Export, nur Namen.
- Keine Inhalte aus Notizen oder Punkten in Logs.

### Teil A – Datenmodell, Logik, Treffen-Seiten

1. **Zusätzliche Farb-Variablen** in `src/app/globals.css` für Punkt-Typen (Hintergrund / Text), hell und dunkel wie die bestehenden Variablen aus 003:
   - Info `#E7ECF5`/`#2B3F66` · dunkel `#1E2636`/`#B9C8E8`
   - Diskussion `#F1ECF7`/`#4D2F70` · dunkel `#2A2236`/`#D3C2EA`
   - Entscheidung `#0F3A2D`/`#FFFFFF` · dunkel `#2E7D4F`/`#FFFFFF`
   - To-do `#FCEBD5`/`#8A4B07` · dunkel `#3A2B15`/`#F2C27E`
   Komponente `ItemKindBadge` (`src/components/item-kind-badge.tsx`) mit Texten „Info“, „Diskussion“, „Entscheidung“, „To-do“. Bestehende Variablen nicht ändern.
2. **Tabellen** in `src/db/schema.ts` (nur hinzufügend):
   - `meetings`: `id` uuid, `edition_id` → `editions` (Pflicht), `date` date, `title` text (Standard „Orga-Treffen“), `place` text (leer erlaubt), `moderator_id` → `members` (leer erlaubt), `minute_taker_id` → `members` (leer erlaubt), `guests` text (Gäste ohne Account, Freitext, leer erlaubt), `raw_notes` text (eingefügte Notiz oder Transkript, leer erlaubt), `status` text `entwurf` | `final` (Standard `entwurf`, CHECK-Regel), `created_by` → `members`, `created_at`, `updated_at`
   - `meeting_attendees`: `meeting_id` → `meetings` (löschen kaskadiert), `member_id` → `members`; Primärschlüssel aus beiden
   - `meeting_items`: `id` uuid, `meeting_id` → `meetings` (löschen kaskadiert), `topic` text (TOP-Überschrift), `kind` text `info` | `diskussion` | `entscheidung` | `todo` (CHECK-Regel), `text` text, `owner_id` → `members` (nur To-do, leer erlaubt), `owner_name` text (nur To-do, Person ohne Account, leer erlaubt), `due_date` date (nur To-do, leer erlaubt), `department_id` → `departments` (leer erlaubt), `done` boolean (Standard false, nur To-do), `done_at` timestamp, `sort_order` int, `created_by` → `members`, `created_at`, `updated_at`
   - CHECK-Regel `meeting_items_owner_one`: `owner_id` und `owner_name` sind nicht beide gesetzt.
   - Leere TOPs gibt es nicht als eigene Zeile: Ein TOP existiert, solange er mindestens einen Punkt hat. „TOP hinzufügen“ öffnet die Schnell-Eingabe unter einer neuen Überschrift; erst der erste Punkt speichert den TOP. Ein noch leerer TOP darf nach Neuladen verschwinden.
3. **Reine Funktionen** in `src/lib/` mit Vitest:
   - `src/lib/protocol-export.ts`:
     - `toTelegramText(meeting, items, names)`: fließender Text ohne Tabellen: Titel und Datum (TT.MM.JJJJ), „Anwesend: …“ (Namen, dann Gäste), dann „Entscheidungen:“ (je Zeile „– …“), „To-dos:“ (je Zeile „– … (Wer, bis TT.MM.)“; ohne Wer bzw. ohne Datum entfällt der jeweilige Teil, erledigte mit „✓“), danach je TOP die Infos und Diskussionspunkte. Leere Abschnitte entfallen. Wer = Name des Mitglieds oder `owner_name`.
     - `toMarkdown(meeting, items, names)`: Kopf mit Datum, Ort, Moderation, Protokoll, Anwesende, Gäste; Überschrift je TOP, Punkte mit Typ-Präfix (**Info**, **Diskussion**, **Entscheidung**, **To-do**).
   - `src/lib/protocol-rules.ts`:
     - `isOverdue(item, today)`: offenes To-do mit `due_date` vor `today`.
     - `canDeleteMeeting(actor, meeting)`: `true`, wenn `actor.active` und (`actor.isAdmin` oder `actor.id === meeting.createdBy`).
     - `sortTodos(items)`: nach `due_date` aufsteigend, ohne Datum zuletzt, dann nach Erstellzeit.
   - Tests: Reihenfolge der Abschnitte, leere Abschnitte, Datumsformat, Wer als Mitglied und als Freitext, überfällig (gestern/heute/morgen, erledigt), Löschrecht (Admin, Ersteller, andere, deaktiviert).
4. **Server Actions** `src/actions/meetings.ts` mit Zod; jede Aktion prüft das Mitglied aus der Datenbank (siehe Grundregeln) und setzt `updated_at`:
   - Treffen anlegen (Datum = `todayInBerlin`, aktuelle Ausgabe, `created_by` = handelndes Mitglied), Kopfdaten ändern (inkl. Datum), Anwesende setzen, Status setzen, Notiz speichern
   - Treffen löschen: serverseitig über `canDeleteMeeting` mit `is_admin` und `active` aus der Datenbank; sonst „Nur Admins oder wer das Treffen angelegt hat, können es löschen.“
   - Punkt anlegen, ändern, löschen, hoch/runter schieben; TOP umbenennen (ändert `topic` aller Punkte dieses TOPs im Treffen); TOP hoch/runter
   - Bei Typ ≠ To-do werden `owner_id`, `owner_name`, `due_date`, `done`, `done_at` geleert. Zod lehnt `owner_id` und `owner_name` gleichzeitig ab. `owner_name` getrimmt, max. 80 Zeichen; `text` max. 2000; `raw_notes` max. 200 000.
   - To-do erledigt umschalten (setzt bzw. leert `done_at`)
   - Referat muss zur aktuellen Ausgabe gehören, Mitglieder müssen existieren; sonst Fehlermeldung, nichts speichern.
   - Gleichzeitige Änderungen in zwei Tabs: letzte Änderung gewinnt, kein Fehler.
5. **Seite `/protokolle`** (ersetzt den Platzhalter): Reiter oben „Treffen“ · „Beschlüsse“ · „To-dos“ (Beschlüsse/To-dos folgen in Teil B, in Teil A nur Links). Button „Neues Treffen“ (legt an und öffnet). Liste aller Treffen der aktuellen Ausgabe, neuestes Datum oben: Datum, Titel, Kennzeichen Entwurf/Final, Anzahl Entscheidungen und offener To-dos. Leerer Zustand: „Noch keine Treffen.“
6. **Seite `/protokolle/[id]`**, optimiert fürs Live-Mitschreiben am Laptop und Nacharbeiten am Handy. Treffen einer anderen oder nicht vorhandenen Ausgabe → 404.
   - **Kopf:** Datum, Titel, Ort, Moderation und Protokoll (Auswahl aus aktiven Mitgliedern, leer erlaubt), Anwesend (abhakbare Liste aktiver Mitglieder), Gäste (Freitext). Felder speichern beim Verlassen, kurze Meldung „Gespeichert“. Umschalter Entwurf/Final. „Treffen löschen“ nur sichtbar, wenn `canDeleteMeeting` erfüllt ist, mit Bestätigung.
   - **TOPs:** „TOP hinzufügen“ legt eine Überschrift an; unter jedem TOP die Punkte in Reihenfolge mit `ItemKindBadge`; TOP umbenennen, hoch/runter.
   - **Schnell-Eingabe** am Ende jedes TOPs: Typ-Auswahl (Info, Diskussion, Entscheidung, To-do; Tastenkürzel Alt+1 bis Alt+4, auch auf dem Mac mit Option), Textfeld; bei To-do zusätzlich **Wer** (Auswahl aus aktiven Mitgliedern, Tippen filtert; passt kein Mitglied, lässt sich der getippte Name als „Ohne Account: …“ übernehmen), **Bis wann** (Datum), **Referat** (Auswahl). Enter speichert, leert das Textfeld, Fokus bleibt; Typ und Referat bleiben für den nächsten Punkt stehen.
   - **Punkt bearbeiten:** Klick auf den Text macht ihn bearbeitbar; Typ, Wer, Bis wann, Referat änderbar; Löschen; hoch/runter. To-dos lassen sich direkt abhaken.
   - **Notiz oder Transkript** (einklappbar): großes Textfeld zum Einfügen plus „Datei laden“ (.txt, .md, .vtt; wird im Browser gelesen und ins Feld übernommen, nichts wird hochgeladen). Hinweis darunter: „Keine Telefonnummern, Adressen oder Kontodaten einfügen.“ Speichert beim Verlassen. Am Laptop rechts neben den TOPs (eigene Scrollfläche), am Handy oberhalb der TOPs, damit man beim Übertragen beides sieht.
7. **Seed** (`src/db/seed.ts`, idempotent, nur ohne `--prod`): ein ausgedachtes „Testtreffen“ in der aktuellen Ausgabe mit drei TOPs und je einem Punkt jeder Art; Personen aus dem Test-Seed (Kim Brenner, Alex Rauch, Sascha Möller); ein To-do überfällig, ein To-do mit Wer „Ohne Account“ (ausgedachter Name „Gast Beispiel“). Mit `--prod` nichts Neues. `db:reset:dev` leert auch die neuen Tabellen (Reihenfolge wegen Fremdschlüsseln beachten).

Auftrag 1 endet mit „setze NUR Teil A um“. Teil A committen, nicht pushen.

### Teil B – Export, Beschlüsse, To-dos, Meine

8. **Export** auf `/protokolle/[id]`: „Als Text kopieren“ (`toTelegramText`) und „Als Markdown kopieren“ (`toMarkdown`); Meldung „Kopiert“, bei verweigerter Zwischenablage den Text markiert in einem Feld zeigen.
9. **Seite `/protokolle/beschluesse`**: alle Entscheidungen der aktuellen Ausgabe, neuestes Treffen oben: Text, Datum des Treffens (Link), TOP, Referat; Filter nach Referat; Suche im Text (Groß/Klein egal). Leerer Zustand: „Noch keine Beschlüsse.“
10. **Seite `/protokolle/todos`**: alle To-dos der aktuellen Ausgabe; Umschalter „Offen“ / „Erledigt“; Sortierung über `sortTodos`; Text, Wer, Bis wann, Referat, Treffen (Link); Filter nach Person (aktive und eingetragene Mitglieder plus Eintrag „Ohne Account“) und nach Referat; direkt abhaken; überfällige offene markiert (`isOverdue` mit `todayInBerlin`).
11. **Seite `/meine`** (ersetzt den Platzhalter): offene To-dos der angemeldeten Person (`owner_id` = eigenes Mitglied) in derselben Darstellung wie unter 10, darüber Hinweis „Meilenstein-Aufgaben kommen mit R1“. Leerer Zustand: „Keine offenen To-dos.“
12. **Navigation:** Unterseiten `/protokolle/…` markieren den Hauptpunkt „Protokolle“ (wie in 003 vorgesehen); sonst keine Änderung an Kopfleiste oder Tab-Leiste.
13. **Klicktest** `e2e/protokoll.spec.ts` (Dev-Login als Kim Brenner); alle Prüfungen relativ, mit eindeutigen Titeln je Lauf (z. B. Zeitstempel im Titel), damit Testreste in dev nicht stören:
    - Neues Treffen anlegen, Titel, Anwesende (zwei Personen) und Gäste eintragen, neu laden → bleibt
    - TOP anlegen, per Schnell-Eingabe je einen Punkt jeder Art (To-do mit Wer = Alex Rauch, Bis wann, Referat Finanzen); zweites To-do mit Wer „Ohne Account: Gast Test“
    - Notiz einfügen, neu laden → bleibt
    - Entscheidung erscheint unter „Beschlüsse“, beide To-dos unter „To-dos“; eines abhaken → wandert zu „Erledigt“
    - Status auf Final → Punkte bleiben bearbeitbar
    - Dev-Login als Alex Rauch → To-do erscheint unter `/meine`; „Treffen löschen“ ist für Alex beim Treffen von Kim nicht sichtbar
    - Alex legt ein eigenes Treffen an und kann es löschen
    - „Als Text kopieren“ zeigt „Kopiert“ oder das Textfeld
    - Bei 375 × 812 sind Kopf, Schnell-Eingabe und Notiz bedienbar, keine waagrechte Scrollleiste
    - Am Ende räumt der Test seine Treffen wieder ab (als Kim löschen)

Auftrag 2 beginnt mit „Teil A ist bereits umgesetzt – ändere daran nichts“.

## Akzeptanzkriterien

- Live-Mitschreiben geht nur mit Tastatur flüssig: Typ per Alt+1–4, Text, Enter, nächster Punkt
- Daten bleiben nach Neuladen erhalten, auch bei zwei geöffneten Tabs (letzte Änderung gewinnt, kein Fehler)
- Löschen eines Treffens nur für Admins und die Person, die es angelegt hat – serverseitig aus der Datenbank geprüft, nicht nur ausgeblendet
- Deaktivierte Mitglieder können keine Aktion ausführen (serverseitig), auch mit gültigem Sitzungs-Cookie
- „Heute“ (neues Treffen, überfällig) in Berliner Zeit
- Status Final sperrt nichts
- To-dos mit Freitext-Person erscheinen in To-dos und Export, aber bei niemandem unter `/meine`
- Keine E-Mail-Adressen auf Protokoll-Seiten oder im Export
- Vitest für `protocol-export` und `protocol-rules` grün
- Klicktest `e2e/protokoll.spec.ts` und alle bisherigen Klicktests grün bei 375 × 812 und 1280 × 800, sowohl gegen `pnpm dev` als auch gegen den lokalen Production-Build
- Seed und Tests nur mit ausgedachten Namen; production bekommt keinen Protokoll-Seed
- `pnpm typecheck`, `lint`, `test`, `build` grün

## Deploy

DB-Änderung: Neon-Backup-Zweig `backup-vor-004` von production → `pnpm db:push:prod` auf dem Zweig → `deploy --db-erledigt`. Kein `db:seed:prod`. Danach am iPhone: einloggen, Treffen anlegen, einen Punkt erfassen, Treffen wieder löschen. Dann das Treffen vom 14.10.2026 direkt in der App nachtragen (Datum im Kopf auf 14.10.2026 setzen).
