# SPEC 005 – Arbeitskreise (AKs)

Freigabe Franz: ☑
Zweig: `spec/005-arbeitskreise` · Risikoklasse B (Risiko-Skript stuft wegen Seed-Änderung C ein – erwartbar) · lokal (Teil A/B, Seed für production) · DB: ja: neue Tabellen `working_groups`, `working_group_members`; neue Spalten `departments.working_group_id`, `editions.working_groups_final`

Stand 15.10.2026 (Sitzung 3). **Erst bauen, wenn 004 live ist.** Baut auf 002, 003 und 004 auf.

## Ziel

Die Kern-Orga arbeitet künftig in wenigen Arbeitskreisen (AKs) statt in 15 Referaten. Die bisherigen Referate werden zu **Aufgabenbereichen** und gehören jeweils zu einem AK. Wer in welchem AK mitmacht, trägt jede Person selbst ein. Die AKs sind noch nicht beschlossen: Die App startet mit einer vorgeschlagenen Gruppierung und sagt das sichtbar dazu. Die AKs werden später die Swimlanes im Gantt-Plan (ab Spec 007).

Oberfläche: Navigation „AKs“, jeder AK erscheint als „AK ‹Name›“ (z. B. „AK Kommunikation“). Gespeichert wird der Name ohne „AK“.

## Nicht in dieser Spec

- Leitung oder Rollen innerhalb eines AK – wird erst demokratisch entschieden; dafür kommt bei Bedarf eine eigene kleine Spec (nur hinzufügende Spalte)
- Plan-Elemente, Gantt, Aufgaben je AK (Specs 006–009)
- Löschen oder Umbenennen von Tabellen oder Spalten; `departments.lead_id` bleibt in der Datenbank, wird nur nicht mehr angezeigt
- Änderungen an `src/proxy.ts`, `src/auth.ts`, Login-Ablauf, `ADMIN_EMAILS`, `canManage()`
- Neue Laufzeit-Pakete

## Vorab: Abgleich mit dem Code nach 004

Bevor du etwas änderst, prüfe den aktuellen Stand und berichte kurz:

- Layout `src/app/(app)/layout.tsx` lädt das Mitglied über `getCurrentMember()` (mit `await connection()`), deaktivierte Mitglieder landen auf `/login`.
- Wie prüfen die Server Actions aus 004 das handelnde Mitglied (erwartet: bei jedem Aufruf aus `members`, `active = true`)? Diesen Weg wiederverwenden.
- Helfer für die aktuelle Ausgabe (`editions.is_current`) – Name und Ort.
- Wo stehen Navigation (Kopfleiste und Tab-Leiste) und der Platzhalter `src/app/(app)/referate/page.tsx`?
- Wo verwendet 004 `departments` (Schnell-Eingabe, Punkt bearbeiten, Beschlüsse, To-dos, Filter, Klicktest `e2e/protokoll.spec.ts`)?
- Bereich „Referate“ in `/einstellungen` aus 003 (Server Actions für Anlegen, Umbenennen, Leitung, Reihenfolge).
- `src/db/seed.ts`: Unterscheidung `--prod`, Reihenfolge der 15 Referate, Test-Mitglieder.

Wenn etwas davon grundlegend anders ist als hier beschrieben: stoppen, Unterschied beschreiben, nichts umbauen. Bestehende Helfer nutzen, keine zweiten bauen.

## Umsetzung

**Grundregeln**

- Alles hängt an der **aktuellen Ausgabe**.
- Rechte: Jede Server Action lädt das handelnde Mitglied bei **jedem** Aufruf über `memberId` aus `members`; es muss `active = true` sein, sonst „Kein Zugriff.“. Admin-Rechte nur aus `is_admin` der Datenbank, nie aus der Session.
- **Alle** aktiven Mitglieder dürfen AKs und Aufgabenbereiche anlegen, umbenennen, sortieren, zuordnen und (wenn erlaubt, s. u.) löschen sowie sich selbst ein- und austragen.
- **Nur Admins** dürfen andere Personen in einen AK eintragen oder austragen und die Aufteilung als „beschlossen“ markieren.
- E-Mail-Adressen erscheinen auf keiner AK-Seite, nur Namen.

### Teil A – Datenmodell, Logik, Server Actions, Seed

1. **Tabellen** in `src/db/schema.ts` (nur hinzufügend):
   - `working_groups`: `id` uuid, `edition_id` → `editions` (Pflicht), `name` text (ohne „AK“-Präfix), `sort_order` int, `created_by` → `members` (leer erlaubt), `created_at`, `updated_at`. Eindeutig je Ausgabe ohne Groß/Klein: Index auf (`edition_id`, `lower(name)`).
   - `working_group_members`: `working_group_id` → `working_groups` (löschen kaskadiert), `member_id` → `members`, `created_at`; Primärschlüssel aus beiden. Eine Person darf in mehreren AKs sein.
   - `departments`: neue Spalte `working_group_id` → `working_groups` (leer erlaubt, beim Löschen des AK `set null`).
   - `editions`: neue Spalte `working_groups_final` boolean, Standard `false`.
2. **Reine Funktionen** `src/lib/working-groups.ts` mit Vitest:
   - `normalizeGroupName(input)`: trimmt, entfernt ein führendes „AK “ (Groß/Klein egal), fasst Leerzeichen zusammen; leer oder länger als 60 Zeichen → Fehler „Name fehlt.“ bzw. „Name ist zu lang (max. 60 Zeichen).“
   - `displayGroupName(name)`: `"AK " + name`.
   - `canChangeMembership(actor, targetMemberId)`: `true`, wenn `actor.active` und (`actor.id === targetMemberId` oder `actor.isAdmin`).
   - `canMarkFinal(actor)`: `actor.active && actor.isAdmin`.
   - `canDeleteGroup(departmentCount)`: nur bei 0 zugeordneten Aufgabenbereichen.
   - `canDeleteDepartment(referenceCount)`: nur wenn kein Protokoll-Punkt (`meeting_items.department_id`) darauf verweist.
   - Tests: Präfix „AK“/„ak “, Leerzeichen, Länge 60/61, leer; Mitgliedschaft selbst/fremd/Admin/deaktiviert; Löschregeln.
3. **Server Actions** `src/actions/working-groups.ts` mit Zod (Grundregeln beachten, `updated_at` setzen):
   - AK anlegen (Name über `normalizeGroupName`, doppelter Name in der Ausgabe → „Diesen AK gibt es schon.“; ans Ende der Reihenfolge), umbenennen, hoch/runter
   - AK löschen: nur über `canDeleteGroup`, sonst „Erst die Aufgabenbereiche in einen anderen AK verschieben.“; Teilnahmen werden mitgelöscht
   - Aufgabenbereich anlegen (Name getrimmt, 1–60 Zeichen, eindeutig je Ausgabe ohne Groß/Klein → „Diesen Aufgabenbereich gibt es schon.“; optional direkt einem AK zugeordnet), umbenennen, einem anderen AK zuordnen oder „ohne AK“ setzen, hoch/runter (bestehendes `sort_order`)
   - Aufgabenbereich löschen: nur über `canDeleteDepartment`, sonst „Wird in Protokollen verwendet – stattdessen umbenennen oder verschieben.“
   - Mitmachen / Austreten: über `canChangeMembership`; fremde Person ohne Admin → „Nur Admins können andere eintragen.“; Ziel muss ein aktives Mitglied sein
   - Aufteilung beschlossen / wieder Vorschlag: über `canMarkFinal`, sonst „Nur Admins können das ändern.“
   - AK bzw. Aufgabenbereich muss zur aktuellen Ausgabe gehören, sonst Fehlermeldung, nichts speichern.
4. **Seed** `src/db/seed.ts` (idempotent):
   - **Auch mit `--prod`:** Nur wenn die aktuelle Ausgabe **noch keinen** AK hat, diese fünf in dieser Reihenfolge anlegen und Aufgabenbereiche nach Namen zuordnen – und dabei nur Aufgabenbereiche mit leerem `working_group_id` anfassen:
     - Demo & Route: Demoleitung · Route · Wagenreihung
     - Flächen & Technik: Planung Auftakt/Abschlussfläche · Bühne / Soundkopplung · Wagenpakete · Ressourcen / Material
     - Programm: Bühnenprogramm politisch · Bühnenprogramm musikalisch
     - Kommunikation: Social Media · Kommunikation E-Mails · Kollektiv-Chats · Teaser / Aftermovie · Pressearbeit
     - Finanzen: Finanzen
     - `working_groups_final` bleibt `false`. Keine Teilnahmen in production.
   - **Nur ohne `--prod`:** Teilnahmen der Test-Mitglieder: Kim Brenner (Demo & Route, Flächen & Technik), Alex Rauch (Flächen & Technik), Sascha Möller (Programm), Jo Kranz (Programm, Kommunikation), Luca Pfeffer (Kommunikation), Noa Fink (Finanzen). Robin Tal, Mika Sonnleitner, Ivy Lamm bleiben ohne AK.
   - Seed-Teile aus 003 und 004 unverändert lassen. `db:reset:dev` leert auch die neuen Tabellen (Reihenfolge wegen Fremdschlüsseln: `working_group_members` vor `working_groups`, `departments.working_group_id` vorher leeren oder `departments` vorher löschen – wie bisher üblich).

Auftrag 1 endet mit „setze NUR Teil A um“. Teil A committen, nicht pushen.

### Teil B – Oberfläche, Anpassungen in 003/004, Tests

5. **Navigation:** Punkt „Referate“ heißt in Kopfleiste und Tab-Leiste **„AKs“** und führt auf `/arbeitskreise`. `/referate` leitet dauerhaft auf `/arbeitskreise` weiter. Unterseiten markieren den Hauptpunkt. Sonst keine Änderung an Kopfleiste oder Tab-Leiste.
6. **Seite `/arbeitskreise`** (ersetzt den Platzhalter `/referate`), Titel „AKs“:
   - **Hinweis oben**, solange `working_groups_final = false` (ruhige Hinweisfläche, kein Alarm-Rot): „Die AKs müssen noch gemeinsam definiert werden. Die aktuelle Gruppierung dient nur der Darstellung.“ Für Admins darunter „Als beschlossen markieren“. Ist sie beschlossen, steht dort nur für Admins „Wieder als Vorschlag markieren“, sonst nichts.
   - **Je AK eine Karte** in `sort_order`: Überschrift „AK ‹Name›“, Aufgabenbereiche als Liste, Teilnehmende als Namen (deaktivierte ausgegraut mit „(deaktiviert)“), Anzahl Teilnehmende. Button „Mach ich mit“ bzw. „Austreten“ für die angemeldete Person. Menü je AK: Umbenennen, Hoch, Runter, Löschen (mit Bestätigung; gesperrt mit Hinweis, solange Aufgabenbereiche zugeordnet sind).
   - **Aufgabenbereiche in der Karte:** Umbenennen, „In anderen AK verschieben“ (Auswahl aller AKs plus „Ohne AK“), Hoch, Runter, Löschen (mit Bestätigung; gesperrt mit Hinweis, wenn in Protokollen verwendet). Unten „Aufgabenbereich hinzufügen“.
   - **Admins:** in jeder Karte „Person eintragen“ (Auswahl aktiver Mitglieder, die noch nicht drin sind) und „Austragen“ je Person.
   - **Karte „Ohne AK“** am Ende, nur wenn es Aufgabenbereiche ohne AK gibt.
   - **„AK hinzufügen“** (Name) am Ende der Liste.
   - Handy: Karten untereinander, alle Aktionen bedienbar, keine waagrechte Scrollleiste bei 375 px. Laptop: zwei Spalten.
   - Leerer Zustand: „Noch keine AKs.“
7. **`/einstellungen`:** Der Bereich „Referate“ aus 003 entfällt und wird ersetzt durch einen kurzen Bereich „AKs und Aufgabenbereiche“ mit Link „Auf der Seite AKs pflegen“. Ausgabe und Personen bleiben unverändert. Server Actions für Referats-Leitung nicht mehr aufrufen, aber nicht löschen, wenn sie sonst noch verwendet werden.
8. **Anpassungen in 004** (nur Beschriftung und Auswahlfelder, keine Logik-Änderung):
   - Überall „Referat“ → „Aufgabenbereich“ (Schnell-Eingabe, Punkt bearbeiten, Beschlüsse, To-dos, Filter).
   - Auswahlfelder für Aufgabenbereiche gruppiert nach AK (`optgroup` mit „AK ‹Name›“, „Ohne AK“ zuletzt), innerhalb in `sort_order`.
   - In Listen erscheint hinter dem Aufgabenbereich klein der AK (z. B. „Finanzen · AK Finanzen“).
   - Export (`toTelegramText`, `toMarkdown`) bleibt unverändert.
   - Klicktest `e2e/protokoll.spec.ts` nur so weit anpassen, wie es die neue Beschriftung verlangt.
9. **Klicktest** `e2e/arbeitskreise.spec.ts`; alle Prüfungen relativ, Namen je Lauf eindeutig (Zeitstempel), am Ende aufräumen:
   - Dev-Login als Kim Brenner: `/referate` leitet auf `/arbeitskreise`; Navigation zeigt „AKs“; Hinweis „Die AKs müssen noch gemeinsam definiert werden …“ sichtbar
   - AK „Test ‹Zeit›“ anlegen → erscheint als „AK Test ‹Zeit›“; Eingabe „AK Doppelt ‹Zeit›“ wird als „AK Doppelt ‹Zeit›“ gespeichert (kein „AK AK“); gleicher Name nochmal → Fehlermeldung
   - Aufgabenbereich „Bereich ‹Zeit›“ im Test-AK anlegen, in einen anderen AK verschieben, zurückschieben; nach Neuladen am richtigen Ort
   - Test-AK löschen ist gesperrt, solange der Bereich drin ist; Bereich löschen, dann AK löschen
   - „Mach ich mit“ bei einem AK → Name erscheint; „Austreten“ → verschwindet
   - Dev-Login als Alex Rauch (kein Admin): kann einen AK anlegen und wieder löschen, kann sich eintragen; „Person eintragen“ und „Als beschlossen markieren“ sind nicht sichtbar
   - Ein Aufgabenbereich, der in einem Protokoll-Punkt verwendet wird, lässt sich nicht löschen (Hinweis sichtbar)
   - In der Schnell-Eingabe eines Treffens heißt das Feld „Aufgabenbereich“ und zeigt die AK-Gruppen
   - Bei 375 × 812 alle Aktionen bedienbar, keine waagrechte Scrollleiste
10. **Vitest** für `src/lib/working-groups.ts` (siehe 2).

Auftrag 2 beginnt mit „Teil A ist bereits umgesetzt – ändere daran nichts“.

## Akzeptanzkriterien

- Navigation zeigt „AKs“, `/referate` leitet weiter, AKs erscheinen als „AK ‹Name›“
- Hinweis zur offenen Definition sichtbar, solange nicht beschlossen; nur Admins können umschalten – serverseitig aus der Datenbank geprüft
- Alle aktiven Mitglieder können AKs und Aufgabenbereiche anlegen, umbenennen, sortieren und zuordnen und sich selbst ein- und austragen; andere eintragen nur Admins – serverseitig geprüft, nicht nur ausgeblendet
- AK löschen nur ohne Aufgabenbereiche; Aufgabenbereich löschen nur ohne Verwendung in Protokollen
- Deaktivierte Mitglieder können keine Aktion ausführen, auch mit gültigem Sitzungs-Cookie
- 004 funktioniert unverändert, nur mit „Aufgabenbereich“ und nach AK gruppierten Auswahlfeldern
- Seed mit `--prod` legt die fünf Vorschlags-AKs nur an, wenn noch keine existieren, und überschreibt keine bestehende Zuordnung; keine Teilnahmen in production
- Keine E-Mail-Adressen auf AK-Seiten
- Vitest für `working-groups` grün; Klicktests `e2e/arbeitskreise.spec.ts`, `e2e/protokoll.spec.ts` und alle bisherigen grün bei 375 × 812 und 1280 × 800, gegen `pnpm dev` **und** gegen den lokalen Production-Build
- `pnpm typecheck`, `lint`, `test`, `build` grün

## Deploy

DB-Änderung: Neon-Backup-Zweig `backup-vor-005` von production → `pnpm db:push:prod` auf dem Zweig → `pnpm db:seed:prod` (legt in production nur die fünf Vorschlags-AKs an und ordnet die 15 Aufgabenbereiche zu) → `deploy --db-erledigt`. Danach am iPhone: Seite AKs, Hinweis sichtbar, „Mach ich mit“ bei einem AK, in einem Treffen das Feld „Aufgabenbereich“ prüfen.
