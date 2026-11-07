# SPEC 029 – TOP löschen

Freigabe Franz: ☑
Zweig: `spec/028-029-protokoll-fixes` · Risikoklasse B (Server Action, Komponenten, Tests) · **lokal**, nach 028 auf demselben Zweig · DB: nein

Löst Thema #39 (Meldungen cbd33227, 88083c9a). Grundlage: Spec-Entwurf #45 aus der Triage, geprüft und ergänzt in Sitzung 18.

## Ziel

Im Protokoll lässt sich ein TOP umbenennen und verschieben, aber nicht löschen. Wer einen TOP aus Versehen oder doppelt anlegt, muss jeden Punkt einzeln löschen. Ein leerer, neu angelegter TOP bleibt stehen, bis man die Seite neu lädt.

Danach hat jeder TOP im Bearbeiten-Modus einen Knopf „TOP löschen“. Nach einer Rückfrage entfernt er den TOP mit allen seinen Punkten. Die Rückfrage nennt, wie viele Beschlüsse und To-dos dabei mit verschwinden, damit niemand aus Versehen das Beschluss-Log leert.

## Nicht in dieser Spec

- Rückgängig nach dem Löschen (die Rückfrage mit Zahlen reicht, Entscheidung Sitzung 18)
- Papierkorb oder Verlauf für Protokolle
- Andere Rechte als bisher (Spec 004: Alle aktiven Mitglieder dürfen Punkte löschen.)
- TOPs in der Leseansicht löschen (nur im Bearbeiten-Modus)
- Datenbank, Login, Configs, `.github/`, `.claude/`, Skripte
- Mehrzeilige Punkte (Spec 028, schon auf dem Zweig – daran nichts ändern)

## Vorab: Abgleich mit dem Code

Prüfe zuerst und berichte kurz im Chat. **Erst nach „Weiter“ von Franz** etwas ändern. Den Abgleich für 028 und 029 kannst du in einem Bericht zusammen machen.

- `src/components/protocol/meeting-editor.tsx`, `TopicSection`: Im Kopf stehen „✎“ (umbenennen), „↑“ und „↓“ (`ICON_BUTTON`), ein Löschen fehlt. TOPs sind keine eigene Tabelle, sondern ergeben sich aus `meeting_items.topic` (`groupByTopic` in `src/lib/protocol-rules.ts`). Neue TOPs ohne Punkt leben nur im Zustand `drafts` von `Topics`.
- `src/actions/meetings.ts`: Wie arbeiten `deleteMeetingItem`, `renameTopic` und `loadMeetingContext`? Gibt es `touchMeeting`, `refresh()` und `revalidateMyTasks()`? Eine Action zum Löschen eines TOPs fehlt.
- **Wie fragen bestehende Löschvorgänge nach?** Etwa „Treffen löschen“ und „Punkt löschen“: mit `window.confirm`, eigenem Dialog oder gar nicht? Der neue Knopf übernimmt dasselbe Muster.
- Gibt es die Farbe `text-status-late` (oder die Klasse der vorhandenen Lösch-Knöpfe)?
- Wie heißt der Typ eines Punkts im Code (`entscheidung` für Beschluss, `todo`, …)? Gibt es `ITEM_KIND_LABELS`?
- Hängen Protokoll-To-dos an Plan-Elementen (Spalte aus 006)? Löschen ist trotzdem in Ordnung, nur berichten.

Weicht der Code grundlegend davon ab: **nichts umbauen**, Unterschied berichten und anhalten.

## Umsetzung

### B1 · Server Action `deleteTopic`

- In `src/actions/meetings.ts`: `deleteTopic(meetingId: string, topic: string): Promise<MeetingActionResult>`.
  - `loadMeetingContext(meetingId)` prüft Anmeldung, aktives Mitglied und dass das Treffen zur aktuellen Ausgabe gehört.
  - `meetingId` und `topic` mit Zod prüfen (`topic`: `z.string().min(1).max(200)`, gleiche Grenze wie beim Anlegen/Umbenennen, falls dort anders). Ungültig → `GENERIC_ERROR`.
  - In einem `db.batch` alle `meeting_items` mit dieser `meeting_id` und diesem `topic` löschen und `touchMeeting` aufrufen.
  - Danach `refresh()` und `revalidateMyTasks()`, weil To-dos aus dem TOP auch aus Meine Aufgaben und dem AK-Arbeitsbereich verschwinden. Rückgabe `OK`. Gibt es keine Punkte mit diesem TOP, ist das ebenfalls `OK`.
- Rechte wie beim Löschen von Punkten: alle aktiven Mitglieder. Texte von Punkten nicht loggen.

### B2 · Rückfragetext als reine Funktion

- `deleteTopicPrompt(topic, counts)` in `src/lib/` (z. B. `protocol-rules.ts`), mit Vitest. `counts` = Zahl aller Punkte, davon Beschlüsse und To-dos.
- Wörtlich, mit richtiger Ein- und Mehrzahl:
  - „TOP „Finanzen“ mit 1 Punkt löschen?“
  - „TOP „Finanzen“ mit 5 Punkten löschen? Darunter 1 Beschluss und 2 To-dos.“
  - Nur Beschlüsse: „… Darunter 2 Beschlüsse.“ · nur To-dos: „… Darunter 1 To-do.“ · weder noch: kein Zusatz.
- Vitest: 1 und mehrere Punkte; mit Beschlüssen und To-dos, nur mit einem davon, ohne beide.

### B3 · Knopf im TOP-Kopf

- In `TopicSection` kommt neben „↓“ ein vierter `ICON_BUTTON` „🗑“ mit `aria-label="‹TOP› löschen"` und `title="TOP löschen"`, in der Farbe der vorhandenen Lösch-Knöpfe, Tippfläche ≥ 44 × 44 px.
- **Gespeicherter TOP:** Rückfrage im Muster aus dem Abgleich, Text aus `deleteTopicPrompt`. Nach „OK“ `deleteTopic` aufrufen, Meldung „Gelöscht“ über `report`, bei Fehler die Fehlermeldung. „Abbrechen“ ändert nichts.
- **Entwurf ohne Punkt:** ohne Rückfrage nur aus `drafts` entfernen, keine Action. Dafür gibt `Topics` die Funktion `onRemoveDraft` an `TopicSection`.
- Wird ein gespeicherter TOP gelöscht, der in dieser Sitzung als Entwurf entstanden ist, verschwindet er auch aus `drafts`, damit er nicht leer wieder auftaucht.
- Am Handy (375 px) passen Überschrift und vier Knöpfe in eine Zeile, oder die Überschrift bricht um. Kein waagrechtes Scrollen.

### B4 · Klicktest

Neue Datei `e2e/top-loeschen.spec.ts`. Nur ausgedachte Daten, nur eigene „E2E …“-Treffen.

- Treffen „E2E TOP löschen“ mit zwei TOPs anlegen. Im ersten stehen ein Beschluss und ein To-do, im zweiten eine Info.
- Den ersten TOP löschen: Die Rückfrage nennt „2 Punkten“, „1 Beschluss“ und „1 To-do“, dann bestätigen. Der TOP und seine Punkte sind weg, der zweite TOP bleibt. Nach dem Neuladen bleibt der erste weg.
- Das To-do aus dem gelöschten TOP erscheint nicht mehr unter `/protokolle/todos` (und `/meine`, falls dort zugeordnet).
- Rückfrage abbrechen: Der TOP bleibt.
- Einen leeren Entwurfs-TOP anlegen und löschen: Er verschwindet ohne Rückfrage.
- Zum Schluss das Treffen löschen.

## Akzeptanzkriterien

1. Jeder TOP im Bearbeiten-Modus hat einen Knopf „TOP löschen“ (≥ 44 × 44 px, Screenreader-Name „‹TOP› löschen“).
2. Ein gespeicherter TOP wird nach Bestätigung mit allen Punkten gelöscht. Die Rückfrage nennt die Zahl der Punkte und, falls vorhanden, Beschlüsse und To-dos, in richtiger Ein- und Mehrzahl.
3. Abbrechen ändert nichts. Ein leerer Entwurfs-TOP verschwindet sofort ohne Rückfrage.
4. To-dos aus dem gelöschten TOP verschwinden auch aus Meine Aufgaben, der To-do-Liste und dem AK-Arbeitsbereich.
5. Die Action prüft Anmeldung, aktives Mitglied, Treffen der aktuellen Ausgabe und die Eingabe mit Zod.
6. `deleteTopicPrompt` mit Vitest. Neuer Klicktest grün, alle bisherigen Klicktests (inkl. 028) bleiben grün, gegen `pnpm dev` und gegen den Production-Build auf 3100.
7. `pnpm typecheck`, `lint`, `test`, `build` grün. Keine Hydration-Warnung. Bei 375 × 812 und 1280 × 800 geprüft, kein waagrechtes Scrollen.
8. Neuigkeiten-Eintrag (unten) in `src/lib/news/entries.ts`, als neuester Eintrag vor dem von 028.

## Deploy

Keine DB. Gemeinsamer Zweig `spec/028-029-protokoll-fixes` mit je einem Commit für 028 und 029, durch Franz:

1. Risikoklasse gegen den ersten Freigabe-Commit prüfen. Erwartet ist B ohne DB.
2. Lokal durchklicken (Chrome-Geräteansicht): einen mehrzeiligen Punkt anlegen, einen TOP löschen.
3. `deploy` → Prüfungen grün → Auto-Merge.
4. Live-Check am iPhone: einen Punkt mit zwei Zeilen anlegen und speichern, einen Test-TOP anlegen und löschen.

## Neuigkeiten

ID `029-top-loeschen`, Datum = Tag des Baus.

**Titel:** TOPs löschen

- **Papierkorb am TOP.** Im Bearbeiten-Modus löschst du einen TOP jetzt samt seinen Punkten. Vorher fragt die App nach und sagt dir, wie viele Beschlüsse und To-dos dabei mit verschwinden.

## Abweichungen beim Bau

(von Claude Code zu ergänzen; nie den Freigabe-Haken hier eintragen, stattdessen „(von Franz freigegeben)“)
