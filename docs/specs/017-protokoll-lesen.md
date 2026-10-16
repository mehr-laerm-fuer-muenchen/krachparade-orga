# SPEC 017 – Protokoll: Lesen und Bearbeiten

Freigabe Franz: ☑
Zweig: `spec/017-protokoll-lesen` · Risikoklasse B (Risiko-Skript stuft wegen Seed-Änderung ggf. C ein – erwartbar) · lokal (Sichtprüfung, Teil A/B), Auto-Modus aus · DB: ja: neue Spalte `meetings.summary`

Stand 16.10.2026 (Sitzung 13, gegen den Stand nach 016 geprüft). 016-checklisten-fortschritt ist live (PR #17). Baut auf 004 (Protokoll), 009 (Rückgängig-Leiste), 014 (Käfer, Kontext), 015 (Neuigkeiten) und 016 („Beschluss“, `save-status.tsx`, `tick-box.tsx`) auf.

## Entscheidungen (Franz, 16.10.2026)

1. Ein Protokoll hat zwei Ansichten: **Bearbeiten** (wie heute) und **Lesen** (zusammengefasst). Ein Knopf wechselt jederzeit hin und her.
2. **Status steuert die Startansicht:** Entwurf öffnet in Bearbeiten, Final öffnet in Lesen. Final sperrt weiterhin nichts.
3. Leseansicht: kurzer Kopf, **Kurzfassung**, Block **Beschlüsse**, Block **To-dos**, darunter je TOP die **Infos**; Diskussionspunkte zugeklappt; volle Notiz/Transkript zugeklappt.
4. **Kurzfassung** als eigenes Feld (ein paar Sätze, von Hand), neue DB-Spalte. Später kann die KI (R3) es füllen.
5. Kein Test-Layout, Abnahme über die Vercel-Vorschau.

## Ziel

Wer ein fertiges Protokoll öffnet, sieht auf einen Blick, was beschlossen wurde und wer was bis wann macht, ohne Eingabefelder. Wer mitschreibt, landet direkt in der Bearbeiten-Ansicht. Ein Knopf wechselt zwischen beiden. Statt des ganzen Transkripts steht oben eine Kurzfassung, das Transkript bleibt zugeklappt erreichbar.

## Nicht in dieser Spec

- Keine KI-Zusammenfassung, kein Claude-API-Aufruf (R3)
- Keine Sperre durch „Final“, keine neuen Rechte (alle aktiven Mitglieder bearbeiten alles; Treffen löschen weiter Admins und wer es angelegt hat)
- Keine Änderung an `/protokolle/beschluesse`, `/protokolle/todos`, `/meine` außer ggf. Links (siehe 11)
- Keine Verknüpfung von Protokoll-To-dos mit Plan-Elementen (R3)
- Keine Änderung an `save-status.tsx` und `tick-box.tsx` außer rein hinzufügenden, optionalen Props (im Abgleich melden)
- Keine Änderung an `src/proxy.ts`, `src/auth.ts`, Login, `.claude/`, `.github/`, `agents/`, `scripts/`, Configs, `.env*`, `AGENTS.md`; keine neuen Laufzeit-Pakete
- Kein `revalidatePath("/", "layout")`

## Vorab: Abgleich mit dem Code

Vor dem Bau berichten, dann auf „Weiter“ warten:

1. **Stand nach 016:** Heißt der Typ in der Oberfläche überall „Beschluss“ (`ITEM_KIND_LABELS` in `src/lib/protocol-rules.ts`)? Wie ist `src/components/save-status.tsx` aufgebaut (Props, Live-Region neben dem Feld, nicht im Label) und wo ist sie im Protokoll-Kopf und an der Notiz eingebunden? Was meldet der Hinweis unten im Protokoll noch?
2. **Seite `/protokolle/[id]`:** Aufbau (Server-Seite, Client-Komponenten, `export const instant = false`), wie Kopf, TOPs, Schnell-Eingabe, Notiz und Export eingebunden sind; wie der Status-Umschalter Entwurf/Final speichert und neu lädt.
3. **`searchParams`** mit `cacheComponents`: Wie lässt sich auf dieser Seite ein Parameter `?ansicht=` lesen, ohne die vorgerenderte Hülle zu brechen (Seite rendert ohnehin zur Laufzeit über `getCurrentMember()`)? Vorschlag melden.
4. **Abhaken von Protokoll-To-dos:** Welche Action (aus 004/009)? Nutzt das Protokoll heute schon `src/components/tick-box.tsx` und die Rückgängig-Leiste (`useUndoBar()` aus `plan-bar.tsx`), oder ein eigenes Kästchen? Lassen sich beide in der Leseansicht ohne Umbau nutzen?
5. **Export** `src/lib/protocol-export.ts` nach 016: Aufbau von `toTelegramText` (mit „Beschlüsse:“) und `toMarkdown`, vorhandene Tests.
6. **Links auf Treffen:** Liste `/protokolle`, `/protokolle/beschluesse`, `/protokolle/todos`, `/meine` – wohin zeigen sie genau?
7. **Seed:** Wie ist das dev-„Testtreffen“ angelegt (Status, idempotent, `SEED_VERSION`, derzeit 7)?
8. Welche bestehenden Klicktests (`e2e/protokoll.spec.ts`, `e2e/checklisten.spec.ts` u. a.) ein Treffen öffnen und danach Eingabefelder erwarten – sie müssen bei Final-Treffen ggf. erst auf „Bearbeiten“ wechseln.
9. **Käfer-Kontext:** Setzt die Seite schon `data-feedback-context`, und passt das Muster aus 014?

Wenn etwas grundlegend anders ist als hier beschrieben: stoppen, Unterschied beschreiben, nichts umbauen. Bestehende Helfer und Komponenten nutzen, keine zweiten bauen.

## Umsetzung

**Grundregeln**

- Rechnen und Zusammenstellen in `src/lib/` als reine Funktionen mit Vitest (relativ importieren, Vitest kennt `@/` nicht). Komponenten zeichnen nur.
- Rechte wie bisher: jede Server Action lädt das handelnde Mitglied bei jedem Aufruf aus `members`, `active = true`, sonst „Kein Zugriff.“.
- E-Mail-Adressen erscheinen nirgends, nur Namen.
- Neue Farben nur als CSS-Variablen in `src/app/globals.css`, hell und dunkel; bestehende Variablen nicht ändern.
- Neue Texte nie mit „D-Day“/„D-N“; im Protokoll „Beschluss“, nie „Entscheidung“ (DB-Wert `entscheidung` bleibt).
- „Gespeichert ✓“ nie ins Feld-Label (Screenreader liest es sonst als Teil des Namens).

### Teil A – Datenmodell, Logik, Kurzfassung im Bearbeiten, Export, Seed

1. **Spalte** in `src/db/schema.ts` (nur hinzufügend): `meetings.summary` text, leer erlaubt.
2. **Reine Funktionen** `src/lib/protocol-read.ts`:
   - `defaultView(status)` → `"bearbeiten"` bei `entwurf`, `"lesen"` bei `final`
   - `resolveView(param, status)` → `"lesen"` oder `"bearbeiten"` aus `?ansicht=`, sonst `defaultView`; unbekannte Werte wie fehlend
   - `readModel(items, departments, names)` → `{ decisions, todos, topics }`:
     - `decisions`: alle Beschlüsse in Reihenfolge der TOPs und Punkte, je Text, TOP, Aufgabenbereich
     - `todos`: alle To-dos, offene zuerst nach `sortTodos` (aus 004), dann erledigte; je Text, Wer (Mitglied oder Freitext), Bis wann, Aufgabenbereich, erledigt
     - `topics`: je TOP in Reihenfolge `{ topic, infos[], discussions[] }`; TOPs ohne Infos und ohne Diskussion entfallen
   - Vitest: Reihenfolge, leere Abschnitte, Freitext-Person, erledigte To-dos hinten, `resolveView` mit `lesen`/`bearbeiten`/Unsinn/fehlend je Status
3. **Server Action** in `src/actions/meetings.ts`: Kurzfassung speichern (Zod: getrimmt, max. 2000 Zeichen, leer erlaubt → `null`), setzt `updated_at`. Bestehende Prüfung des Mitglieds und des Treffens (aktuelle Ausgabe) wiederverwenden.
4. **Feld „Kurzfassung“ in der Bearbeiten-Ansicht:** im Kopf unter Anwesend/Gäste, mehrzeilig (ca. 3 Zeilen, wächst mit), Platzhalter „Ein paar Sätze: Worum ging es, was ist rausgekommen?“, Hinweis darunter „Erscheint oben in der Leseansicht. Keine Telefonnummern, Adressen oder Kontodaten.“ Speichert beim Verlassen mit `src/components/save-status.tsx` (Live-Region neben/unter dem Feld wie an der Notiz; konkrete Server-Meldung allein rot, „Nicht gespeichert – nochmal“ nur bei Ausfall). Zähler „1 234 / 2 000“ erst ab 1 800 Zeichen.
5. **Export** (`toTelegramText`, `toMarkdown`): Ist eine Kurzfassung gesetzt, steht sie nach „Anwesend: …“ als eigener Absatz (Telegram ohne Überschrift, Markdown unter „**Kurzfassung**“). Ohne Kurzfassung unverändert. Vitest ergänzen.
6. **Seed** (nur ohne `--prod`, idempotent): Das dev-„Testtreffen“ bekommt eine ausgedachte Kurzfassung (zwei Sätze), nur wenn `summary` leer ist. `SEED_VERSION` erhöhen, falls der Seed darüber gesteuert wird. Mit `--prod` nichts.

Auftrag 1 endet mit „setze NUR Teil A um“. **Vor `db:push` anhalten** – Franz führt `pnpm db:push` selbst aus. Teil A committen, nicht pushen.

### Teil B – Leseansicht, Umschalten, Links, Neuigkeiten, Tests

7. **Ansicht wählen** auf `/protokolle/[id]` über `resolveView(searchParams.ansicht, status)` (Weg nach Abgleich 3). Umschalten per Link mit `?ansicht=lesen` bzw. `?ansicht=bearbeiten` (ersetzt die URL, keine neuen Verlaufs-Einträge stapeln; „Zurück“ führt wie bisher zur Liste).
8. **Kopfzeile über beiden Ansichten:** Titel, Datum, Status-Pill (Entwurf/Final) und rechts ein Knopf:
   - in **Lesen**: „Bearbeiten“ (Stift-Icon)
   - in **Bearbeiten**: „Leseansicht“ (Augen-Icon)
   - In Bearbeiten bleibt der Umschalter Entwurf/Final. **Wechselt er auf Final, springt die Seite in die Leseansicht** – auch wenn die URL gerade `?ansicht=bearbeiten` trägt (URL wird durch `?ansicht=lesen` ersetzt). Zurück auf Entwurf bleibt man in Bearbeiten.
   - Export-Knöpfe („Als Text kopieren“, „Als Markdown kopieren“) in beiden Ansichten.
9. **Leseansicht** (eine Spalte, am Laptop max. ca. 760 px breit, ruhig, keine Eingabefelder):
   - **Kopf kompakt:** Datum · Ort; „Moderation: …“, „Protokoll: …“; „Anwesend: Namen“, danach Gäste. Leere Angaben entfallen.
   - **Kurzfassung** als Absatz mit Zeilenumbrüchen. Leer: in Final-Treffen nichts anzeigen; in Entwurf-Treffen gedämpft „Noch keine Kurzfassung“ mit Link „Hinzufügen“ (→ Bearbeiten, Fokus auf das Feld).
   - **Beschlüsse** (Überschrift mit Anzahl): je Zeile Badge „Beschluss“, Text, darunter klein TOP · Aufgabenbereich (mit AK wie in 005/016). Keine Beschlüsse: Abschnitt entfällt.
   - **To-dos** (Überschrift mit Anzahl offener): je Zeile Kästchen (`tick-box.tsx`, falls laut Abgleich 4 passend), Text, Wer, „bis TT.MM.“, Aufgabenbereich; überfällige offene rot (`isOverdue` mit `todayInBerlin`); erledigte durchgestrichen am Ende. **Abhaken geht auch hier** (bestehende Action, Rückgängig-Leiste wie in 009/016). Keine To-dos: Abschnitt entfällt.
   - **Tagesordnung:** je TOP Überschrift, darunter die Infos als Liste. Gibt es Diskussionspunkte, darunter ein Knopf „N Diskussionspunkte“ (bei einem: „1 Diskussionspunkt“; `aria-expanded`), der sie aufklappt. Zustand nur für den Seitenbesuch.
   - **Notiz oder Transkript:** zugeklappt am Ende, Knopf „Notiz/Transkript anzeigen“; aufgeklappt mit Zeilenumbrüchen, scrollt im Kasten bei langen Texten (max. ca. 60 % der Fensterhöhe). Leere Notiz: Abschnitt entfällt.
   - Treffen ganz ohne Punkte: „Noch keine Punkte.“ mit Link „Bearbeiten“.
   - Käfer-Kontext (014): Seite setzt `data-feedback-context` auf „Protokoll ‹Titel› ‹Datum›“, falls das Muster dort passt (Abgleich 9, sonst weglassen).
10. **Bearbeiten-Ansicht:** bleibt wie nach 016, plus Feld Kurzfassung (4) und Knopf „Leseansicht“ (8). Sonst keine Änderung.
11. **Links:** Liste `/protokolle`, `/protokolle/beschluesse`, `/protokolle/todos` und `/meine` zeigen weiter auf `/protokolle/[id]` ohne Parameter (Startansicht nach Status). Ausnahme: Link „Hinzufügen“ der leeren Kurzfassung (9).
12. **Handy (375 px):** Kopfzeile mit Knopf einzeilig oder sauber umgebrochen, alle Knöpfe ≥ 44 px, keine waagrechte Scrollleiste, Leseansicht gut lesbar (Grundschrift wie App).
13. **Neuigkeiten:** Eintrag aus dem Abschnitt unten in `src/lib/news/entries.ts` (oben, neueste zuerst), ID `017-protokoll-lesen`, Datum = Tag des Baus; vorher gegen die echten Bezeichnungen prüfen. Der Neuigkeiten-Test prüft über `latestNewsId` – keine festen IDs in Tests.
14. **Klicktest** `e2e/protokoll-lesen.spec.ts` (Dev-Login als Kim Brenner), eigenes Treffen „E2E Lesen ‹Zeit›“, am Ende löschen; Prüfungen relativ; nach Seitenwechseln `expectPageReady`, nie `networkidle`:
    - Neues Treffen öffnet in Bearbeiten (Eingabefelder sichtbar, Knopf „Leseansicht“)
    - TOP mit je einer Info, einer Diskussion, einem Beschluss, einem To-do (Alex Rauch, Datum); Kurzfassung eintragen → „Gespeichert ✓“
    - „Leseansicht“: keine Eingabefelder; Kurzfassung oben; Beschluss unter „Beschlüsse“; To-do mit „Alex Rauch“ unter „To-dos“; Info unter dem TOP; Diskussion erst nach Klick auf „1 Diskussionspunkt“ sichtbar; Notiz zugeklappt
    - To-do in der Leseansicht abhaken → durchgestrichen, Rückgängig-Leiste
    - „Bearbeiten“ → Eingabefelder; Status auf Final → Seite zeigt Leseansicht
    - Neu laden ohne Parameter → Leseansicht (Final); über die Liste `/protokolle` öffnen → Leseansicht
    - „Als Text kopieren“ enthält die Kurzfassung
    - 375 × 812: Leseansicht und Umschalten bedienbar, keine waagrechte Scrollleiste
    - Keine Konsolenfehler; Treffen am Ende löschen
    - Bestehende Klicktests nur anpassen, wo sie ein Final-Treffen bearbeiten (vorher „Bearbeiten“ klicken)
15. **Vitest** für `protocol-read.ts` und den erweiterten Export.

Auftrag 2 beginnt mit „Teil A ist bereits umgesetzt – ändere daran nichts“.

## Neuigkeiten

ID `017-protokoll-lesen` · Datum: Tag des Baus · Titel „Protokolle lesen und bearbeiten“

- **Leseansicht.** Fertige Protokolle zeigen oben die Kurzfassung, dann Beschlüsse und To-dos, darunter die Infos je TOP – ohne Eingabefelder.
- **Ein Knopf zum Wechseln.** Mit „Bearbeiten“ und „Leseansicht“ wechselst du jederzeit. Entwürfe öffnen zum Bearbeiten, finale Protokolle zum Lesen.
- **Kurzfassung.** Ein paar Sätze zum Treffen, die oben in der Leseansicht und im Telegram-Text stehen.

## Akzeptanzkriterien

- Entwurf öffnet in Bearbeiten, Final in Lesen; `?ansicht=lesen|bearbeiten` überschreibt das; Knopf wechselt jederzeit
- Final setzen in Bearbeiten springt in die Leseansicht (auch mit `?ansicht=bearbeiten` in der URL); Final sperrt nichts
- Leseansicht ohne Eingabefelder (außer To-do-Kästchen und Auf/Zu-Knöpfen); Abschnitte Kopf, Kurzfassung, Beschlüsse, To-dos, Tagesordnung, Notiz wie unter 9; leere Abschnitte entfallen
- Diskussionspunkte und Notiz/Transkript zugeklappt, aufklappbar per Tastatur
- To-dos in der Leseansicht abhakbar mit Rückgängig
- Kurzfassung speichert mit „Gespeichert ✓“ (gemeinsame Komponente, nicht im Label), max. 2000 Zeichen, serverseitig geprüft; erscheint im Telegram-Text und Markdown
- Deaktivierte Mitglieder können die Kurzfassung nicht speichern (serverseitig)
- Keine E-Mail-Adressen, kein sichtbares „Entscheidung“, kein „D-Day“
- Helles und dunkles Thema lesbar; kein Hydration-Fehler (Production-Build)
- Neuigkeiten-Eintrag vorhanden, Vitest für `src/lib/news/` grün
- Vitest für `protocol-read.ts` und Export grün; `e2e/protokoll-lesen.spec.ts` und alle bisherigen Klicktests grün bei 375 × 812 und 1280 × 800, gegen `pnpm dev` **und** gegen den lokalen Production-Build (Port 3100: `VERCEL_ENV=preview ENABLE_DEV_LOGIN=1 pnpm build`, `AUTH_TRUST_HOST=1 VERCEL_ENV=preview ENABLE_DEV_LOGIN=1 pnpm start -p 3100`, `BASE_URL=http://localhost:3100 pnpm e2e`)
- `pnpm typecheck`, `lint`, `test`, `build` grün
- Abweichungen unter „Abweichungen beim Bau“ vermerkt, mit „(von Franz freigegeben)“

## Deploy

DB-Änderung (nur hinzufügende Spalte). `deploy` → hält vor der DB an, PR steht → `gh pr checks spec/017-protokoll-lesen --watch` → Vorschau am iPhone über „Visit Preview“ (Dev-Login, dev-Datenbank) → Neon-Backup `backup-vor-017` von production → `pnpm db:push:prod` (Rückfrage von drizzle-kit: immer „No, add the constraint without truncating the table“, nie „truncate“; im Zweifel Text erst an Claude im Chat) → `deploy --db-erledigt`. Meldet `deploy` „Noch nicht gemergt“: `gh pr checks spec/017-protokoll-lesen --watch`, dann `gh pr view spec/017-protokoll-lesen --json state`, bei `MERGED` `git switch main` und `git pull`. Kein `db:seed:prod`. Danach Live-Check am iPhone: Treffen vom 14.10. öffnen, Kurzfassung eintragen, auf Final setzen, Leseansicht prüfen.

## Abweichungen beim Bau

(von Claude Code zu ergänzen; nie den Freigabe-Haken hier eintragen, stattdessen „(von Franz freigegeben)“)

- **Abgleich 3 – `?ansicht=`:** `searchParams` wird wie `params` an die Suspense-Komponente durchgereicht und erst dort awaited (Muster wie `/protokolle/todos`, `/feedback`); Umschalten per Link mit `replace`, nach Final per `router.replace("?ansicht=lesen")` nur nach erfolgreichem `setMeetingStatus` (Teil B). (von Franz freigegeben)
- **Abgleich 4 – Abhaken in der Leseansicht:** `TickBox` und `useUndoBar()` unverändert, mit `setTodoDone` nach dem Muster von `/meine` (Teil B); die Bearbeiten-Ansicht behält ihr eigenes Kästchen. (von Franz freigegeben)
- **Teil A, kleine Änderungen außerhalb der Liste:** `summary` in `MeetingData` (`src/components/protocol/types.ts`) und in `src/app/(app)/protokolle/[id]/page.tsx` für Feld und Export. `export-buttons.tsx` musste dafür nicht geändert werden, es reicht `meeting` schon samt `summary` an den Export weiter. (von Franz freigegeben)
- **Teil A, Seed:** `SEED_VERSION` „8“; das bestehende „Testtreffen“ bekommt die Kurzfassung nur, wenn `summary` leer ist. (von Franz freigegeben)
- **Teil A, Zähler:** Grenze und Zähler-Text als reine Funktion `summaryCounter` mit `SUMMARY_MAX` in `src/lib/protocol-read.ts` (von der Action mitgenutzt); das Feld hat die feste id `kurzfassung` für den späteren Link „Hinzufügen“ (Teil B). (von Franz freigegeben)
- **Teil B, Leseansicht:** neue Client-Komponente `src/components/protocol/meeting-reader.tsx` mit `TickBox`, `useUndoBar()` (braucht keinen zusätzlichen Rahmen) und `setTodoDone` nach dem Muster von `my-tasks-view.tsx`; `data-feedback-context="Protokoll ‹Titel› ‹Datum›"` als Wrapper der Leseansicht. Der kompakte Kopf heißt dort „Angaben zum Treffen“ (der Bereich „Kopf“ bleibt der Bearbeiten-Ansicht vorbehalten). Export-Meldungen („Kopiert“) laufen in der Leseansicht über die Rückgängig-Leiste. (von Franz freigegeben)
- **Teil B, „Hinzufügen“:** Link auf `?ansicht=bearbeiten#kurzfassung` mit `replace`; das Feld setzt beim Laden den Fokus, wenn der Anker `#kurzfassung` in der URL steht. (von Franz freigegeben)
- **Teil B, Klicktests:** In `e2e/protokoll.spec.ts` zusätzlich zu den Stellen „Final“ und Alex eine Zeile im Aufräum-Helfer `deleteMeeting` (öffnet `?ansicht=bearbeiten`, sonst bliebe das Final-Treffen liegen). `e2e/protokoll-lesen.spec.ts` prüft zusätzlich den Link „Hinzufügen“ samt Fokus und fängt den Export-Text über ein Ersatz-Clipboard ab. (von Franz freigegeben)
