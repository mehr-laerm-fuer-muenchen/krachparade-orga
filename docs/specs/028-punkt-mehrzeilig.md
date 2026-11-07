# SPEC 028 – Mehrzeilige Punkte im Protokoll

Freigabe Franz: ☑
Zweig: `spec/028-029-protokoll-fixes` · Risikoklasse A (Komponenten, reine Funktion, Tests) · **lokal**, zusammen mit 029 auf einem Zweig · DB: nein

Löst Thema #38 (Meldungen c50c1824, 5dafe581). Grundlage: Spec-Entwurf #44 aus der Triage, geprüft und ergänzt in Sitzung 18.

## Ziel

Beim Mitschreiben im Protokoll sind Punkte (Info, Diskussion, Beschluss, To-do) bisher nur einzeilig. Das Feld „Punkt eingeben, Enter speichert“ ist ein `<input>`, Enter speichert sofort. Längere Beschlüsse oder Diskussionen lassen sich so nicht gegliedert festhalten.

Danach ist das Feld mehrzeilig und wächst mit dem Text. Zeilenumbrüche bleiben beim Bearbeiten, in der Leseansicht, in allen Listen und im Export erhalten. Das schnelle Mitschreiben am Laptop bleibt, wie es ist: Typ per Alt+1–4, Text, Enter.

## Nicht in dieser Spec

- Formatierung (fett, Listen, Markdown-Vorschau)
- Längere Texte als 2000 Zeichen (die Grenze in `itemFields` bleibt)
- Änderungen an „Kurzfassung“ oder „Notiz oder Transkript“ (beide sind schon mehrzeilig)
- Protokoll als freies Dokument, Kommentare (eigenes Thema)
- TOP löschen (Spec 029)
- Datenbank, Server Actions (außer Prüfung, dass nichts Umbrüche entfernt), Login, Configs, `.github/`, `.claude/`, Skripte

## Vorab: Abgleich mit dem Code

Prüfe zuerst und berichte kurz im Chat. **Erst nach „Weiter“ von Franz** etwas ändern.

- `src/components/protocol/quick-entry.tsx`: Die Schnell-Eingabe ist vermutlich ein `<input type="text">` mit Platzhalter „Punkt eingeben, Enter speichert“. Enter schickt das Formular ab (`onSubmit`).
  - **Gibt es einen sichtbaren Knopf „Speichern“, auch am Handy?** Wenn nicht, sag es. Er wird für das Handy gebraucht (siehe B1).
  - Wie funktionieren Alt+1–4 (am Formular oder am Feld)?
- `src/components/protocol/item-row.tsx`: `ItemEditor` mit einzeiligem `<input>`. Wird der Text in der Zeile mit oder ohne `whitespace-pre-line` angezeigt?
- `src/actions/meetings.ts`: `itemFields.text` ist `z.string().trim().min(1).max(2000)`. Prüfen, dass weder diese noch eine andere Stelle Umbrüche im Inneren entfernt.
- **Alle Stellen, die den Text eines Punkts anzeigen**, mit Datei und Baustein auflisten. Erwartet:
  - `meeting-reader.tsx` (Leseansicht)
  - `/protokolle/beschluesse`
  - `/protokolle/todos` (`todo-list.tsx`)
  - `/meine` (`my-tasks-view.tsx`)
  - AK-Arbeitsbereich (`workspace.tsx`: „Aus Protokollen“, Beschlüsse)
  - Element-Karte, falls Protokoll-To-dos dort erscheinen
- `src/lib/protocol-export.ts`: `toTelegramText` und `toMarkdown` hängen `item.text` hinter „– “ bzw. „- **Typ:** “ an. Wo liegt der Vitest dazu?
- **Klicktests**, die das Feld finden (Platzhalter, Rolle `textbox`, Label) und mit `press("Enter")` speichern: `protokoll.spec.ts`, `protokoll-lesen.spec.ts`, `ak-arbeitsbereich.spec.ts`, `meine.spec.ts` und andere. Ein `<textarea>` hat ebenfalls die Rolle `textbox`. Prüfen, ob Platzhalter-Suchen brechen würden.
- **Handy-Projekte in Playwright:** Hat das iPhone-Projekt `hasTouch`/`isMobile`? Trifft dort `matchMedia("(pointer: coarse)")` zu, in Chromium und in WebKit?
- Wo steht `INPUT` (gemeinsame Feld-Klassen)? Gibt es schon eine `<textarea>` mit gleicher Optik (Kurzfassung)?

Weicht der Code grundlegend davon ab: **nichts umbauen**, Unterschied berichten und anhalten.

## Umsetzung

### B1 · Mehrzeiliges Feld in Schnell-Eingabe und Bearbeiten

- In `quick-entry.tsx` und im `ItemEditor` (`item-row.tsx`) wird das Textfeld eine `<textarea rows={1}>`. Gleiche Rahmen-Optik wie `INPUT` (oder wie die Kurzfassung), `text-base` (16 px, damit das iPhone nicht zoomt), `min-h-11`, `resize-none`.
- **Wachsen mit dem Text:** `field-sizing-content`. Weil das noch nicht jeder Browser kann (Safari am iPhone ist unsicher), zusätzlich ein kleiner Ersatz im Browser: beim Tippen `height = auto`, dann `height = scrollHeight`, gedeckelt auf etwa 10 Zeilen, danach scrollt das Feld. Als gemeinsamer kleiner Hook oder Baustein, für beide Felder genutzt.
- Tastatur:
  - **Laptop / feiner Zeiger:** Enter speichert wie bisher, **Umschalt+Enter** macht eine neue Zeile.
  - **Handy / Touch** (`matchMedia("(pointer: coarse)")`): Enter macht eine neue Zeile, gespeichert wird mit dem Knopf „Speichern“. Fehlt der Knopf am Handy (Abgleich), kommt er in die Schnell-Eingabe: Tippfläche ≥ 44 × 44 px, im Stil der vorhandenen Knöpfe. Der `ItemEditor` bekommt denselben Weg, falls er noch keinen Knopf hat.
  - Erkannt wird das Gerät erst nach dem Laden im Browser (`useEffect`), damit keine Hydration-Fehler entstehen. Bis dahin gilt das Laptop-Verhalten.
  - Während einer IME-Eingabe (`event.nativeEvent.isComposing`) speichert Enter nicht.
- Platzhalter wörtlich: Laptop „Punkt eingeben – Enter speichert, Umschalt+Enter neue Zeile“, Handy „Punkt eingeben“. Auch der Platzhalter wechselt erst nach dem Laden.
- Alt+1 bis Alt+4 funktionieren auch in der `<textarea>`.
- Nach dem Speichern ist das Feld leer, der Fokus bleibt drin und die Höhe springt auf eine Zeile zurück.
- Leere Eingabe (nur Leerzeichen oder Umbrüche) speichert nichts, wie heute.

### B2 · Umbrüche anzeigen

- An allen im Abgleich gefundenen Stellen, die den Text eines Punkts zeigen, `whitespace-pre-line` ergänzen, neben dem vorhandenen `break-words [overflow-wrap:anywhere]`. Gemeinsame Bausteine ändern, keine Kopien.
- Kurze Vorschauen, die bewusst auf eine Zeile kürzen (`truncate`, `line-clamp`), bleiben so. Im Abgleich nennen.
- `aria-label`s mit dem Text bleiben, wie sie sind.

### B3 · Export

- In `src/lib/protocol-export.ts` eine kleine reine Funktion, die die Folgezeilen eines Punkts einrückt. Bei Telegram und Markdown mit zwei Leerzeichen, damit die Zeile zum Listenpunkt gehört. Mehrere Leerzeilen innerhalb eines Punkts werden zu einer zusammengezogen.
- Vitest in der bestehenden Testdatei zu `protocol-export.ts`. Fälle: ein Punkt mit zwei Zeilen wird im Telegram-Text und im Markdown eingerückt; einzeilige Punkte bleiben unverändert; Leerzeilen werden zusammengezogen.

### B4 · Klicktest

Neue Datei `e2e/punkt-mehrzeilig.spec.ts`. Nur ausgedachte Daten, nur eigene „E2E …“-Treffen.

- Laptop: Treffen „E2E Mehrzeilig“ und einen TOP anlegen. Typ „Beschluss“, Text „Zeile eins“, Umschalt+Enter, „Zeile zwei“, Enter. Danach steht **ein** Punkt mit beiden Zeilen untereinander in der Liste.
- Leseansicht: zeigt beide Zeilen untereinander.
- Bearbeiten eines bestehenden Punkts: eine dritte Zeile ergänzen und speichern, sie bleibt nach dem Neuladen.
- Handy (375 × 812, Touch): Enter macht eine neue Zeile, „Speichern“ speichert.
- Zum Schluss das Treffen löschen.
- Bestehende Klicktests anpassen (zum Beispiel neuer Platzhalter), nicht löschen. Neuigkeiten-Test über `latestNewsId`.

## Akzeptanzkriterien

1. Schnell-Eingabe und Bearbeiten eines Punkts sind mehrzeilige Felder mit 16 px Schrift, die mit dem Text wachsen, auch im Safari am iPhone.
2. Laptop: Enter speichert, Umschalt+Enter macht eine neue Zeile. Handy (Touch): Enter macht eine neue Zeile, der sichtbare Knopf „Speichern“ speichert.
3. Alt+1 bis Alt+4 wechseln den Typ auch im mehrzeiligen Feld.
4. Umbrüche erscheinen in der Bearbeiten-Zeile, der Leseansicht, bei Beschlüssen und To-dos, in Meine Aufgaben und im AK-Arbeitsbereich.
5. Telegram-Text und Markdown rücken Folgezeilen ein. Der Vitest dazu ist grün.
6. Keine Hydration-Warnung in der Konsole. Kein waagrechtes Scrollen bei 375 × 812 und 1280 × 800.
7. Neuer Klicktest grün, alle bisherigen Klicktests bleiben grün, gegen `pnpm dev` und gegen den Production-Build auf 3100.
8. `pnpm typecheck`, `lint`, `test`, `build` grün.
9. Neuigkeiten-Eintrag (unten) in `src/lib/news/entries.ts`.

## Deploy

Keine DB. Gemeinsam mit 029 auf dem Zweig `spec/028-029-protokoll-fixes`, ein `deploy` am Ende (siehe 029). Danach Live-Check am iPhone: Punkt mit zwei Zeilen anlegen und in der Leseansicht ansehen.

## Neuigkeiten

ID `028-punkt-mehrzeilig`, Datum = Tag des Baus.

**Titel:** Längere Punkte im Protokoll

- **Mehrere Zeilen.** Punkte im Protokoll dürfen jetzt mehrere Zeilen haben. Am Laptop geht das mit Umschalt+Enter, am Handy mit Enter. Gespeichert wird am Handy mit „Speichern“.
- **Bleibt erhalten.** Die Zeilen siehst du auch in der Leseansicht, in deinen Aufgaben und beim Kopieren als Text oder Markdown.

## Abweichungen beim Bau

- **Klicktests am Handy (von Franz freigegeben):** Im Playwright-Projekt „iphone“ (Touch) macht Enter jetzt eine neue Zeile. Die bestehenden Tests speichern deshalb über die Hilfsfunktion `savePoint` in `e2e/punkt-speichern.ts`: bei Touch Tipp auf „Speichern“, sonst Enter. Der neue Test `e2e/punkt-mehrzeilig.spec.ts` prüft am Handy ausdrücklich, dass Enter eine neue Zeile macht und nichts speichert.
- **Kurzfassung unverändert (von Franz freigegeben).**
- **Gemeinsamer Baustein:** `ItemTextArea` in `src/components/protocol/item-text-area.tsx` für Schnell-Eingabe und Bearbeiten. Das Gerät wird mit `useSyncExternalStore` erkannt statt mit `useEffect`. Server und erstes Rendern nutzen das Laptop-Verhalten, danach wechselt der Browser. So gibt es keinen Hydration-Fehler.
- **Platzhalter einzeilig:** `field-sizing: content` richtet die Höhe auch nach dem Platzhalter. Der lange Laptop-Platzhalter brach bei 1280 px um und machte das leere Feld zwei Zeilen hoch. Mit `placeholder:truncate` bleibt er einzeilig, falls nötig mit „…“.
- **Ersatz für das Wachsen:** greift nur, wenn der Browser `field-sizing` nicht kann. Die Testbrowser können es, den Ersatz prüft also nur der Live-Check am iPhone.
- **`protokoll.spec.ts` strenger:** Nach dem Speichern im Editor wartet der Test, bis sich der Editor schließt. Grund: React schreibt den Wert einer `<textarea>` auch als Textinhalt, deshalb passte `hasText` schon vor der Antwort des Servers, und `reload()` brach das Speichern ab.
- **Risikoklasse:** `src/app/(app)/protokolle/beschluesse/page.tsx` ist geändert (nur `whitespace-pre-line`). Das Skript stuft das vermutlich als B ein. Zusammen mit 029 ist der Zweig ohnehin B.
