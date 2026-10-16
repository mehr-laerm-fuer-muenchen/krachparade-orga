# SPEC 014 – Feedback-Knopf

Freigabe Franz: ☑
Zweig: `spec/014-feedback` · Risikoklasse B (neue Tabelle, Seiten, Server Actions; Seed-Änderung stuft das Skript als C ein – erwartbar) · lokal, Teil A/B, Auto-Modus aus · DB: ja, nur hinzufügend (neue Tabelle `feedback`)

## Ziel

Alle in der Kern-Orga können auf jeder angemeldeten Seite über einen Käfer-Knopf in der Kopfleiste in wenigen Sekunden einen Fehler oder Wunsch melden. Seite, Person, Zeitpunkt, Gerät, Bildschirmgröße und – falls offen – das Plan-Element im Detail-Panel werden automatisch mitgespeichert. Was gerade auf der Seite offen ist (Plan-Panel, Protokoll), bleibt dabei unangetastet. Alle sehen alle Meldungen mit Status und Antwort. Admins pflegen Status und Antwort und sehen am Käfer eine pinke Zahl neuer Meldungen.

Vorbild: Feedback-Knopf der Hausverwaltungs-App (dort Spec 005), angepasst an diese App.

## Nicht in dieser Spec

- Benachrichtigungen jeder Art (an Melder:innen oder Admins), „gelesen“-Markierung – kommt mit dem Benachrichtigungs-Center (R2)
- Release Notes / „Was ist neu“
- Screenshot oder Foto anhängen
- Meldungen als GitHub-Issue, Triage-Agent
- Weitere Arten (Frage, Lob)
- Meldungen löschen oder Meldungstext nachträglich bearbeiten
- Änderungen an Login, `src/auth.ts`, `src/proxy.ts`, `ADMIN_EMAILS`
- Änderungen an der Tab-Leiste am Handy (bleibt bei fünf Einträgen)
- Begriff „D-Day“ in bestehenden Texten (Spec 013). Neue Texte dieser Spec verwenden „D-Day“ nicht.
- Neue Abhängigkeiten (Käfer-Icon als eingebettetes SVG), neue Umgebungsvariablen

## Entscheidungen (Franz, 16.10.2026)

1. **Käfer-Knopf in der Kopfleiste** auf jeder Seite unter `(app)`, nicht auf `/login`.
2. Meldung = **Art (Fehler / Wunsch) + Text**. Automatisch: Pfad, Seitentitel, Person, Zeitpunkt, Gerät + Bildschirmgröße, **offenes Plan-Element** (Titel). Keine IP, kein Standort.
3. Speicherung nur in der App (eigene Tabelle).
4. **Alle sehen alle Meldungen** mit Namen.
5. **Nur Admins** ändern Status und Antwort (Prüfung bei jedem Aufruf aus der Datenbank wie in 003).
6. Status: Neu → In Arbeit → Erledigt / Verworfen, frei wählbar.
7. **Übersicht** `/feedback`, verlinkt oben in `/einstellungen` (am Handy über „Mehr“). **Pinke Zahl** neuer Meldungen am Käfer, **nur für Admins**.
8. Kein Löschen; Unsinn oder Doppeltes → „Verworfen“.
9. Kein Test-Layout; Abnahme über die Vercel-Vorschau.
10. Lokal in Teil A/B.

## Vorab: Abgleich mit dem Code

Bevor du etwas änderst, prüfe und berichte kurz:

- Wo wird die Kopfleiste gebaut (Layout `src/app/(app)/layout.tsx` und zugehörige Komponente), und wo stehen D-Day-Zähler, Name und „Abmelden“ bei 375 px und bei 1280 px?
- Welcher Helfer lädt das angemeldete Mitglied und prüft `active` (erwartet: `requireMember()`), und wie prüfen bestehende Actions `is_admin` aus der Datenbank?
- Wie kommt die pinke Zahl an „Meine“ (009) in die Navigation, und wie wird sie nach Änderungen aktualisiert (erwartet: `countMyOverdue`, `refresh()` der aktuellen Seite)?
- Wo werden Detail-Panel (Laptop) und Blatt (Handy) für Plan-Elemente gerendert (erwartet: `src/components/plan/plan-detail.tsx`), auf `/` und `/meine`?
- Gibt es schon eine deutsche Datum-/Uhrzeit-Formatierung in `src/lib/`?
- Wie leert `db:reset:dev` die Tabellen, und führt `src/db/seed.ts` eine `SEED_VERSION` (erwartet: 6)?
- Welche Playwright-Projekte laufen parallel (Namen, Größen)?

Wenn etwas grundlegend anders ist als hier beschrieben: stoppen, Unterschied beschreiben, nichts umbauen.

## Oberfläche (allgemein)

- Alles unter `src/app/(app)/`, Optik nach Test-Layout v3 (vorhandene Farbvariablen, Inter Tight, Ecken 6 px), helles und dunkles Thema.
- Tippflächen mindestens 44 × 44 px, Eingabefelder mindestens 16 px Schrift (kein Zoom am iPhone).
- Datum/Uhrzeit deutsch in Europe/Berlin, z. B. „16. Oktober 2026, 14:05“. Vorhandene Funktion nutzen oder in `src/lib/` ergänzen (mit Vitest; Import in getesteten Dateien relativ, Vitest kennt `@/` nicht).
- `/feedback` und `/feedback/[id]` markieren in der Navigation „Einstellungen“ bzw. am Handy „Mehr“ als aktiv.
- Kein `revalidatePath("/", "layout")` (führte auf Vercel zu #418). Zustände und Breiten nicht aus `usePathname()` im Layout ableiten.

---

## Umsetzung

### Teil A – Tabelle, Logik, Käfer-Dialog

**A1 · Tabelle `feedback`** (`src/db/schema.ts`, nur hinzufügen; Kommentar „Spec 014: …“ im Stil der anderen Tabellen)

| Spalte | Typ | Hinweis |
|---|---|---|
| `id` | uuid, PK, `defaultRandom()` | |
| `kind` | text, not null | `bug` · `wish` (Zod, kein Postgres-Enum) |
| `message` | text, not null | 1–2000 Zeichen (getrimmt) |
| `page_path` | text, not null | nur Pfad ohne Query/Hash, beginnt mit `/`, max. 300 |
| `page_title` | text, null | `document.title`, max. 200 |
| `context` | text, null | Titel des offenen Plan-Elements, max. 200 |
| `device` | text, null | z. B. „iPhone · Safari“, max. 100 |
| `viewport` | text, null | z. B. „390 × 844“, max. 20 |
| `status` | text, not null, default `'new'` | `new` · `in_progress` · `done` · `rejected` (Zod) |
| `reply` | text, null | 0–2000, leer → null |
| `created_by` | uuid, null, FK → `members.id`, `onDelete: "set null"` | |
| `updated_by` | uuid, null, FK → `members.id`, `onDelete: "set null"` | wer Status/Antwort zuletzt geändert hat |
| `created_at` | timestamptz, not null, `defaultNow()` | |
| `updated_at` | timestamptz, not null, `defaultNow()` | bei Status-/Antwort-Änderung setzen |

Typ `Feedback` exportieren. `db:reset:dev` leert auch `feedback`.

Nach dem Schema: **anhalten** und Franz bitten, `pnpm db:push` gegen dev selbst auszuführen. Nicht selbst ausführen.

**A2 · Reine Funktionen** (`src/lib/feedback/`, mit Vitest)

- `kinds.ts`: `bug` → „Fehler“, `wish` → „Wunsch“.
- `status.ts`: `new` → „Neu“, `in_progress` → „In Arbeit“, `done` → „Erledigt“, `rejected` → „Verworfen“; offene Status = `new`, `in_progress`.
- `schemas.ts`: Zod für Anlegen (Art, Text, Pfad, Titel, Kontext, Gerät, Viewport) und Ändern (Status, Antwort). Deutsche Fehlertexte: „Bitte Fehler oder Wunsch wählen.“, „Bitte kurz beschreiben.“, „Höchstens 2000 Zeichen.“ Pfad muss mit `/` beginnen, Query und Hash werden abgeschnitten; zu lange optionale Felder werden gekürzt statt abgelehnt.
- `device.ts`: `describeDevice(userAgent, maxTouchPoints)` → „iPad · Safari“, „iPhone · Safari“, „Android · Chrome“, „Mac · Safari“, „Mac · Chrome“, „Windows · Edge“, „Windows · Firefox“ usw., sonst „Unbekanntes Gerät“. iPadOS meldet sich als Mac: Mac-Kennung + `maxTouchPoints > 1` → iPad. Tests mit typischen Kennungen (iPad, iPad als Mac, iPhone, Android, Mac, Windows).
- `count.ts`: „Keine neuen Meldungen.“ / „1 neue Meldung“ / „2 neue Meldungen“.

**A3 · Abfragen** (`src/db/feedback.ts` oder passend zur bestehenden Ordnung)

- `listFeedback(filter: "open" | "all")` – neueste zuerst, mit Anzeigename von `created_by` (gelöschte Person → „Unbekannt“).
- `getFeedback(id)` – eine Meldung mit Anzeigenamen von `created_by` und `updated_by`, `null`, wenn es sie nicht gibt.
- `countNewFeedback()` – Anzahl mit Status `new`.

**A4 · Server Actions** (`src/actions/feedback.ts`)

- `createFeedback(input)`: angemeldetes, aktives Mitglied aus der Datenbank (bestehender Helfer), Zod, speichern mit `created_by`. **Ruft weder `revalidatePath` noch `refresh` auf** – sonst würde die offene Seite (Plan mit Panel, Protokoll) neu gerendert.
- `updateFeedback(id, { status, reply })`: Mitglied aktiv **und** `is_admin` aus der Datenbank (nicht aus der Session), sonst „Nur Admins können das ändern.“; ID als UUID prüfen, Meldung muss existieren, Zod, `updated_at` und `updated_by` setzen. Darf `/feedback` und `/feedback/[id]` neu laden (`revalidatePath` nur für diese Pfade, nie `"/", "layout"`).
- Kein Löschen.

**A5 · Käfer-Knopf + Dialog** (`src/components/feedback-button.tsx`, eingebunden in die Kopfleiste)

- Laptop (ab 900 px): links neben Name/„Abmelden“. Handy (bis 900 px, Name ausgeblendet): links neben dem Zähler rechts in der Kopfleiste. Käfer-Icon als eingebettetes SVG, 20 px, `currentColor` in der Kopfleisten-Textfarbe, Tippfläche mindestens 44 × 44 px, Fokus-Ring Pink, `aria-label="Feedback geben"`. Bei 375 px kein Umbruch, kein Überlauf, keine waagrechte Scrollleiste.
- Öffnet ein natives `<dialog>` mit `showModal()`; Escape und „Abbrechen“ schließen, Fokus kehrt zum Knopf zurück. Höhe auf den Bildschirm begrenzt, Inhalt scrollbar (Tastatur am iPhone).
- Inhalt:
  - Titel „Feedback geben“
  - Art als zwei Umschalt-Knöpfe „Fehler“ und „Wunsch“ (`aria-pressed`), keine Vorauswahl, Pflicht
  - Textfeld „Beschreibung“, Hinweis darunter: „Bei Fehlern: Was hast du gemacht, was ist passiert?“
  - Wenn ein Plan-Element offen ist: Zeile „Bezieht sich auf: ‹Titel›“
  - Kleiner Hinweis: „Seite, Zeitpunkt, Gerät und dein Name werden mitgeschickt. Alle in der Kern-Orga können die Meldung lesen. Bitte keine Telefonnummern, Adressen oder Kontodaten eintragen.“
  - Knöpfe „Absenden“ (primär) und „Abbrechen“
- **Kontext offenes Plan-Element:** Detail-Panel (Laptop) und Blatt (Handy) auf `/` und `/meine` bekommen am äußeren Element `data-feedback-context="‹Titel des Elements›"`. Der Dialog liest beim Öffnen das erste solche Element im Dokument. Sonst nichts an Panel und Blatt ändern.
- Erst im Browser beim Öffnen/Absenden ermittelt (kein Hydration-Problem): `location.pathname`, `document.title`, Kontext, `describeDevice(navigator.userAgent, navigator.maxTouchPoints)`, `window.innerWidth × window.innerHeight`.
- Fehler je Feld unter dem Feld; Serverfehler als Hinweis im Dialog; Eingaben bleiben erhalten. „Absenden“ während des Speicherns gesperrt (kein Doppelklick-Doppel).
- Nach Erfolg: „Danke! Deine Meldung ist gespeichert.“ mit „Schließen“ und Link „Alle Meldungen“ (`/feedback`). Beim nächsten Öffnen ist das Formular leer.
- **Nichts auf der Seite darf verloren gehen:** Öffnen, Absenden und Schließen lösen keine Navigation und kein Neu-Rendern der Seite aus; ein offenes Panel bleibt offen, ein Protokoll-Entwurf bleibt erhalten.

**A6 · Seed** (`src/db/seed.ts`, nur ohne `--prod`; `--prod` unverändert)

- Räumt Meldungen auf, deren Text mit „E2E “ beginnt.
- Legt, falls nicht vorhanden, zwei Beispiel-Meldungen von „Alex Rauch“ an: ein Fehler „Neu“ auf `/meine`, ein Wunsch „Erledigt“ auf `/` mit Kontext eines Elements aus `TEST_PLAN` und Antwort von „Kim Brenner“. Wiederholtes Ausführen erzeugt keine Doppelten. `SEED_VERSION` um eins erhöhen, falls vorhanden.

**A7 · Klicktest Teil A** (`e2e/feedback.spec.ts`)

- Dev-Login als Alex Rauch, `/meine` öffnen, Käfer → „Wunsch“ → Text „E2E Feedback ‹Projektname› ‹Zeitstempel›“ (eindeutig je Playwright-Projekt) → „Absenden“ → Danke-Text sichtbar → „Schließen“ → Seite unverändert (Titel, kein Neuladen).
- Absenden ohne Art und Text zeigt beide Fehlermeldungen, Dialog bleibt offen; „Abbrechen“ schließt ihn.
- Auf `/` ein Seed-Element **nur öffnen** (nicht ziehen, nicht abhaken), Käfer → Zeile „Bezieht sich auf: ‹Titel›“ sichtbar → absenden → Panel ist danach noch offen.
- Nie `networkidle`, mit `expectPageReady` bzw. auf eindeutige Elemente warten.

Auftrag 1 endet mit „setze NUR Teil A um“. Teil A committen, nicht pushen.

### Teil B – Übersicht, Detail, Zahl

**B1 · Übersicht `/feedback`**

- Titel „Feedback“, Zurück-Link „Einstellungen“.
- Umschalter „Offen“ (Neu + In Arbeit, Standard) und „Alle“ über `?filter=alle`; Links mindestens 44 px hoch, aktiver Eintrag mit `aria-current`.
- Liste neueste zuerst, je Meldung als Link zur Detailseite:
  - Pill Art („Fehler“/„Wunsch“, neutral) und Pill Status. Eigene kleine Komponente, `StatusPill` aus 003 nicht ändern. Farben aus den vorhandenen Variablen: Neu = Wackelt-Töne, In Arbeit = On-track-Töne, Erledigt = Erreicht-Töne, Verworfen = Fläche-2/gedämpft.
  - Datum/Uhrzeit, „von ‹Name›“
  - Text gekürzt auf etwa 2 Zeilen; falls Kontext: „· ‹Titel›“
  - „Antwort vorhanden“, wenn es eine Antwort gibt
- Leer: „Keine offenen Meldungen.“ bzw. „Noch keine Meldungen.“

**B2 · Detailseite `/feedback/[id]`**

- Zurück-Link „Feedback“, Titel „Fehler“ bzw. „Wunsch“, darunter Status-Pill, Datum/Uhrzeit, „von ‹Name›“.
- Text vollständig (Zeilenumbrüche erhalten, `break-words`).
- Technische Angaben: „Seite: ‹Titel› (‹Pfad›)“ mit Pfad als Link; „Element: ‹Titel›“ falls vorhanden; „Gerät: ‹Gerät› · ‹Viewport›“.
- **Admins:** Formular „Status und Antwort“ mit vier Umschalt-Knöpfen (`aria-pressed`, mind. 44 px), Textfeld „Antwort“, Knopf „Speichern“ (kein Autospeichern). Nach Erfolg „Gespeichert.“; Fehler je Feld.
- **Alle anderen:** Status und Antwort nur lesend; ist eine Antwort da: „Antwort von ‹Name› · ‹Datum›“.
- Unbekannte oder ungültige ID → 404 wie auf den anderen Seiten.

**B3 · Link in `/einstellungen`**

- Ganz oben ein Eintrag „Feedback“ mit Käfer-Icon und Text aus `count.ts`, Link auf `/feedback`, mindestens 44 px hoch, sichtbar für alle. Die Anzahl wird allen gezeigt; die Zahl am Käfer nur Admins.

**B4 · Zahl am Käfer (nur Admins)**

- Admins sehen bei mindestens einer Meldung mit Status `new` eine pinke Zahl am Käfer, im Stil der Zahl an „Meine“ aus 009; `aria-label` dann „Feedback geben, ‹n› neue Meldungen“. Ohne neue Meldungen keine Zahl.
- Anzahl serverseitig über `countNewFeedback()`, Weg wie die Zahl an „Meine“. Nicht-Admins bekommen die Abfrage nicht ausgeführt.
- Nach `updateFeedback` darf die Zahl auf der Feedback-Seite sofort, auf anderen Seiten beim nächsten Laden stimmen. Nach `createFeedback` stimmt sie beim nächsten Laden.

**B5 · Klicktests Teil B** (in `e2e/feedback.spec.ts` ergänzen)

- Als Alex Rauch eine Meldung „E2E …“ anlegen → „Alle Meldungen“ → in „Offen“ sichtbar → Detail zeigt Seite und Gerät; kein Formular „Status und Antwort“ (nur lesend).
- Als Kim Brenner (Admin): Käfer zeigt eine Zahl (nur prüfen, dass sie da ist, keine feste Anzahl); Meldung öffnen → „Erledigt“, Antwort „E2E Antwort“ → „Speichern“ → „Gespeichert.“ → „Offen“ zeigt sie nicht mehr, „Alle“ zeigt sie mit „Antwort vorhanden“.
- Als Alex Rauch: Käfer ohne Zahl; Detail zeigt „Antwort von Kim Brenner“.
- `/einstellungen` zeigt den Eintrag „Feedback“ mit Link zur Übersicht.
- `updateFeedback` als Nicht-Admin per direktem Server-Aufruf wird abgelehnt (Vitest oder Klicktest, je nachdem, was im Projekt üblich ist).
- Aufräumen: Tests setzen eigene Meldungen auf „Erledigt“ bzw. „Verworfen“; `pnpm db:seed` entfernt E2E-Meldungen. Feste Gesamtzahlen nie prüfen. „Feedback“ kommt mehrfach vor → über Rolle + Name ansprechen.

Auftrag 2 beginnt mit „Teil A ist bereits umgesetzt – ändere daran nichts“.

## Akzeptanzkriterien

1. Käfer-Knopf auf jeder Seite unter `(app)` in der Kopfleiste, bei 375 × 812 ohne Umbruch, Überlauf oder waagrechte Scrollleiste; auf `/login` nicht.
2. Meldung (Art + Text) lässt sich absenden; Pfad, Seitentitel, Person, Zeitpunkt, Gerät, Bildschirmgröße und ggf. offenes Plan-Element werden gespeichert.
3. Ohne Art oder Text: deutsche Fehlermeldungen, nichts gespeichert.
4. Öffnen, Absenden und Schließen ändern nichts an der offenen Seite: offenes Plan-Panel bleibt offen, keine Navigation; `createFeedback` ohne `revalidatePath`/`refresh`.
5. `/feedback` zeigt standardmäßig offene Meldungen, mit „Alle“ auch Erledigt/Verworfen, neueste zuerst; erreichbar über `/einstellungen`.
6. Auf `/feedback/[id]` ändern nur Admins Status und Antwort; serverseitig aus der Datenbank geprüft; Nicht-Admins sehen alles lesend. Meldungstext nicht änderbar, kein Löschen.
7. Pinke Zahl am Käfer nur für Admins und nur bei neuen Meldungen.
8. `describeDevice` erkennt iPad (auch als Mac + Touch), iPhone, Android, Mac, Windows; Vitest grün.
9. Seed räumt E2E-Meldungen auf und legt die zwei Beispiele ohne Doppelte an; `--prod` unverändert; `db:reset:dev` leert `feedback`.
10. Klicktests in `e2e/feedback.spec.ts` grün, bestehende Klicktests weiter grün; Seed-Plan-Elemente werden nicht verändert.
11. `pnpm typecheck`, `lint`, `test`, `build` grün; `pnpm e2e` grün auch gegen den lokalen Production-Build (Port 3100); „Prüfungen“ und „Klicktests“ im PR grün.
12. Geprüft bei 375 × 812 und 1280 × 800, helles und dunkles Thema; keine Hydration-Warnungen.
13. Keine neuen Abhängigkeiten, keine neuen Umgebungsvariablen, kein `revalidatePath("/", "layout")`.

## Deploy

DB-Änderung, nur hinzufügend (neue Tabelle `feedback`). Durch Franz vor dem Merge: Neon-Backup-Zweig `backup-vor-014` von `production` → `pnpm db:push:prod` auf dem Feature-Zweig (drizzle-kit-Rückfrage zu Constraints: „No, add the constraint without truncating the table“) → `deploy --db-erledigt`. `db:seed:prod` wird **nicht** ausgeführt. Danach live am iPhone: Käfer, Meldung absenden, Übersicht über „Mehr“, Zahl am Käfer als Admin.

## Abweichungen beim Bau

(von Claude Code zu ergänzen; nie den Freigabe-Haken hier eintragen, stattdessen „(Freigabe Franz)“)
