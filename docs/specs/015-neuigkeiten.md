# SPEC 015 – Neuigkeiten (Glocke mit Release Notes)

Freigabe Franz: ☑
Zweig: `015-neuigkeiten` · Risikoklasse A · lokal · DB: nein

Voraussetzung: **013-begriff-krachparade ist live.** Diese Spec baut auf der Kopfleiste nach 013 auf.

## Ziel

Das Team sieht in der App, was neu ist. In der Kopfleiste sitzt eine **Glocke**. Ein Klick öffnet „Neuigkeiten“, eine Liste der Updates mit Datum, die neueste aufgeklappt, ältere zum Aufklappen (Vorbild: „What's New“-Panel anderer Apps). Ein **pinker Punkt** an der Glocke zeigt, dass es seit dem letzten Öffnen etwas Neues gibt.

Die Einträge stehen in **einer Datei im Repo**. Jede künftige Spec bringt ihren Eintragstext mit, Claude Code trägt ihn beim Bau ein, und mit dem Deploy ist er automatisch live. Keine Datenbank, keine Eingabemaske.

## Nicht in dieser Spec

- Keine DB-Änderung, keine neue Seite, keine Server Action
- Keine Hinweise auf Antworten zu Feedback-Meldungen (braucht „gelesen“ pro Person in der DB, eigene Spec)
- Kein Bearbeiten der Einträge in der App, keine Admin-Maske
- Kein Abgleich „gelesen“ zwischen Geräten (bewusst pro Gerät)
- Keine Push-Nachricht, E-Mail oder Telegram
- Keine Versionsnummern (Einträge haben Titel und Datum)
- Keine Änderung an `AGENTS.md`, `.claude/`, `.github/`, `agents/`, `scripts/`, Configs, `.env*`

## Vorab: Abgleich mit dem Code

Vor dem Bau berichten, dann auf „Weiter“ warten:

1. Kopfleiste nach 013: Reihenfolge der Elemente am Laptop und am Handy, Breite bei 375 px, aktueller Countdown-Text, wo der gekürzte Name „Krachparade…“ gesetzt wird.
2. Wie der Feedback-Dialog (014) und das Blatt am Handy (007/008) gebaut sind: Komponente, `z-index`, Schließen per Esc/Klick daneben, Fokus-Rückgabe. Gibt es eine wiederverwendbare Panel- oder Blatt-Komponente?
3. Welche `z-index`-Stufen es gibt (Kopfleiste `z-35`, Blatt-Abdunklung, Dialoge). Vorschlag, auf welcher Stufe das Neuigkeiten-Panel liegt.
4. Wie `localStorage` bisher gelesen wird (`kp-plan-view` u. a.), damit die Glocke dasselbe Muster nutzt.
5. Ob `docs/specs/_vorlage.md` existiert und wie sie aussieht.
6. Die Starteinträge (siehe unten) gegen die **echten Bezeichnungen** in der Oberfläche prüfen (Navigationspunkte, Knöpfe, Seitennamen). Abweichungen auflisten und einen korrigierten Text vorschlagen. Nichts dazuerfinden, was die App nicht kann.

## Umsetzung

### 1. Daten: `src/lib/news/entries.ts`

```ts
export type NewsItem = { lead: string; text?: string };
export type NewsEntry = {
  id: string;      // eindeutig, z. B. "015-neuigkeiten" oder "r1-start"
  date: string;    // "YYYY-MM-DD", Europe/Berlin
  title: string;   // kurz, max. 60 Zeichen
  items: NewsItem[]; // 1–5 Punkte
};
export const NEWS: NewsEntry[] = [ /* neueste zuerst */ ];
```

Dazu reine Funktionen in `src/lib/news/` (relativ importieren, Vitest kennt `@/` nicht):

- `latestNewsId(entries)` → ID des neuesten Eintrags
- `hasUnread(entries, seenId)` → `true`, wenn `seenId` fehlt oder nicht der neueste ist
- `formatNewsDate("2026-10-16")` → „16.10.2026“

Vitest: IDs eindeutig, Datum gültig, Liste absteigend nach Datum sortiert (bei gleichem Datum gilt die Reihenfolge in der Datei), jeder Eintrag hat 1–5 Punkte, Titel ≤ 60 Zeichen, `hasUnread` für: kein Wert, alter Wert, aktueller Wert, unbekannter Wert.

### 2. Glocke in der Kopfleiste

- Glocken-Icon im Stil der bestehenden Icons (Käfer), gleiche Größe und Trefferfläche (mind. 44 × 44 px am Handy).
- **Laptop:** Glocke direkt links vom Käfer. Sonst bleibt alles wie nach 013.
- **Handy:** Der Schriftzug „Krachparade…“ entfällt, nur das Logo bleibt. Reihenfolge: Logo · Glocke · Käfer · Countdown (bzw. die Reihenfolge nach 013, Glocke immer direkt links vom Käfer). Das Logo bekommt einen zugänglichen Namen „Krachparade Orga“.
- **Pinker Punkt** (kleiner Kreis, Pink-Akzent, ohne Zahl) oben rechts an der Glocke, wenn `hasUnread`. Die pinke Zahl am Käfer für Admins bleibt unverändert.
- `aria-label`: „Neuigkeiten“, mit Punkt „Neuigkeiten – es gibt Neues“. `aria-expanded` und `aria-controls` aufs Panel.

### 3. Gelesen merken (pro Gerät)

- `localStorage`-Schlüssel `kp-news-seen` = ID des zuletzt gesehenen neuesten Eintrags.
- Lesen erst nach dem Laden im Browser (wie `kp-plan-view`); der Server rendert die Glocke **ohne** Punkt, kein Hydration-Fehler. Lesen und Schreiben in `try/catch`; geht `localStorage` nicht, gibt es eben keinen Punkt.
- Beim **Öffnen** des Panels wird `latestNewsId` gespeichert, der Punkt verschwindet sofort.
- Wer die App zum ersten Mal öffnet (kein Wert), sieht den Punkt.

### 4. Panel „Neuigkeiten“

- **Laptop:** Panel von rechts, Breite ca. 420 px, volle Höhe, über der Kopfleiste. Rest der Seite abgedunkelt.
- **Handy:** Blatt von unten bzw. bildschirmfüllend, wie das bestehende Blatt (bei Bedarf dieselbe Komponente).
- `z-index` über der Kopfleiste (`z-35`) und über der Blatt-Abdunklung; Vorschlag aus dem Abgleich.
- Kopf: Überschrift „Neuigkeiten“, Unterzeile „Was sich in der App geändert hat.“, Schließen-Knopf (×).
- Liste der Einträge, neueste zuerst. Jeder Eintrag: **Titel**, darunter das Datum („16.10.2026“), rechts ein Auf/Zu-Pfeil. Der **neueste ist aufgeklappt**, alle anderen zu. Klick auf die Zeile klappt auf/zu (Knopf mit `aria-expanded`).
- Aufgeklappt: Aufzählung, je Punkt **fett der `lead`**, danach normal der `text`.
- Ganz unten klein: „Fehler gefunden oder einen Wunsch? Melde ihn über den Käfer oben.“
- Schließen per ×, Esc und Klick auf die Abdunklung. Fokus beim Öffnen auf die Überschrift, beim Schließen zurück auf die Glocke. Der Inhalt scrollt im Panel, die Seite dahinter nicht.
- Öffnen/Schließen nur mit `transform`/`opacity`, bei `prefers-reduced-motion` ohne Animation.
- Funktioniert auf allen angemeldeten Seiten, auch bei offenem Plan-Panel oder Blatt (dann liegt Neuigkeiten darüber; nach dem Schließen ist das Plan-Panel unverändert offen).

### 5. Starteinträge

Texte so übernehmen, nur nach dem Abgleich (Punkt 6) an die echten Bezeichnungen angepasst. Du-Form, kein „D-Day“.

**`015-neuigkeiten`** · Datum: Tag des Baus · „Neuigkeiten in der App“
- **Glocke in der Kopfleiste.** Hier steht ab jetzt nach jedem Update, was neu ist. Ein pinker Punkt zeigt, dass es seit deinem letzten Blick etwas Neues gibt.
- **Am Handy nur noch das Logo.** Damit Glocke, Käfer und Countdown in eine Zeile passen, entfällt am Handy der Schriftzug.

**`013-begriff-krachparade`** · Datum: Tag, an dem 013 auf `main` gemergt wurde (aus `git log`) · „Krachparade statt D-Day“
- **Neuer Begriff.** Statt „D-Day“ heißt es in der App jetzt „Krachparade“. Der Countdown zeigt die verbleibenden Tage, zum Beispiel „noch 138 T“.

**`014-feedback`** · 2026-10-16 · „Feedback direkt in der App“
- **Käfer in der Kopfleiste.** Fehler oder Wunsch melden, ohne die Seite zu verlassen. Seite, Gerät und das gerade offene Plan-Element hängen automatisch dran.
- **Alle Meldungen einsehbar.** Unter Einstellungen → Feedback (am Handy unter „Mehr“) siehst du alle Meldungen mit Status und Antwort.

**`r1-start`** · 2026-10-15 · „Start der Orga-App“
- **Plan bis zur Krachparade.** Alle Meilensteine und Vorgänge als Gantt am Laptop und als Wochenliste am Handy, rückwärts von der Krachparade gerechnet. Verschiebt sich etwas, rechnet die App alle abhängigen Termine neu und zeigt Puffer und Verzug.
- **Bearbeiten direkt im Plan.** Balken ziehen oder an den Rändern verlängern, am Handy über −7/−1/+1/+7 T. Jedes Element hat To-dos, Notizen und einen Verlauf.
- **Arbeitskreise.** Die vorgeschlagenen AKs mit ihren Aufgabenbereichen. Trag dich selbst ein. Zuschnitt und Leitung entscheidet das Plenum.
- **Protokolle.** Treffen mit TOPs, Beschlüssen und To-dos mitschreiben oder Notizen einfügen.
- **Meine.** Alles, was bei dir liegt, als Zeitliste: eigene Plan-Elemente und To-dos aus Plan und Protokollen. Abhaken direkt in der Liste, die pinke Zahl zeigt Überfälliges.

### 6. Spec-Vorlage ergänzen

In `docs/specs/_vorlage.md` vor „## Akzeptanzkriterien“ einen Abschnitt einfügen:

```markdown
## Neuigkeiten
Eintrag für die Glocke (`src/lib/news/entries.ts`): ID = Spec-Name, Datum = Tag des Baus,
Titel (max. 60 Zeichen) und 1–5 Punkte (fetter Anfang + ein Satz, Du-Form, für das Team verständlich).
Oder „keiner“, wenn sich für das Team nichts Sichtbares ändert.
```

Existiert die Vorlage nicht oder ist anders aufgebaut: im Abgleich melden, nicht neu anlegen.

## Akzeptanzkriterien

- Glocke auf jeder angemeldeten Seite, am Laptop links vom Käfer, am Handy zwischen Logo und Käfer
- **Kopfleiste bei 375 × 812 einzeilig** mit Logo, Glocke, Käfer und Countdown (Klicktest prüft: alle Elemente auf einer Zeile, Kopfleiste nicht höher als vorher); bei 1280 × 800 unverändert bis auf die Glocke
- Klick auf die Glocke öffnet „Neuigkeiten“; neuester Eintrag aufgeklappt, ältere zu und aufklappbar
- Starteinträge vorhanden, Texte nach Abgleich, kein „D-Day“
- Punkt erscheint ohne gespeicherten Wert und bei altem Wert in `kp-news-seen`; verschwindet beim Öffnen und bleibt nach Neuladen weg
- Schließen per ×, Esc und Klick daneben; Fokus zurück auf der Glocke
- Panel liegt über Kopfleiste und offenem Blatt; nach dem Schließen ist ein offenes Plan-Panel unverändert
- Kein Hydration-Fehler in der Konsole (Production-Build)
- Pinke Zahl am Käfer für Admins funktioniert wie vorher
- Vitest für `src/lib/news/`; Klicktest `e2e/neuigkeiten.spec.ts` (Öffnen, Aufklappen, Esc, Punkt mit `localStorage`, Einzeiligkeit bei 375 px)
- `pnpm typecheck`, `lint`, `test`, `build` grün; `pnpm e2e` grün, auch gegen den lokalen Production-Build (Port 3100)
- `scripts/risikoklasse.ts` stuft den Zweig als A oder B ein, nicht C
- `docs/specs/_vorlage.md` hat den Abschnitt „Neuigkeiten“
- Abweichungen in dieser Spec unter „Abweichungen beim Bau“ vermerkt, ohne das Freigabe-Muster

## Neuigkeiten

Siehe Starteintrag `015-neuigkeiten` oben.

## Deploy

Keine DB. Vor dem `deploy` lokale Sichtprüfung bei 375 px und 1280 px. Dann `deploy`, danach Live-Check am iPhone (Punkt sichtbar, Panel, Kopfleiste einzeilig).
