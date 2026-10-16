# SPEC 021 – Neuigkeiten am Handy scrollbar

Freigabe Franz: ☑
Zweig: `spec/021-neuigkeiten-handy` · Risikoklasse A · lokal (Sichtprüfung), Auto-Modus aus · DB: nein

Stand 16.10.2026 (Sitzung 14). Fehler aus dem Live-Betrieb nach 018: Am Handy erscheinen die Neuigkeiten (Glocke, 015) nur ganz unten am Bildschirm, der Inhalt lässt sich nicht scrollen. Mit den Einträgen zu 016, 017 und 018 ist der Inhalt höher als der Bildschirm.

## Ziel

Am Handy öffnet die Glocke ein Blatt von unten, das höchstens den größten Teil des Bildschirms einnimmt. Kopf mit Titel und Schließen bleibt oben im Blatt sichtbar, der Inhalt scrollt im Blatt, alle Einträge sind erreichbar. Am Laptop bleibt alles wie es ist.

## Nicht in dieser Spec

- Keine Änderung an Inhalt, Reihenfolge oder Logik der Neuigkeiten (`src/lib/news/`), an „gelesen“ (`kp-news-seen`) oder an der Glocke selbst
- Keine Änderung am Laptop-Panel (von rechts, 420 px)
- Andere Blätter (Panel/Blatt im Plan, Käfer) nur, wenn der Abgleich zeigt, dass sie **denselben** Baustein bzw. dieselben Styles nutzen und denselben Fehler haben – dann dort mit beheben und melden; sonst nicht anfassen
- Keine neuen Laufzeit-Pakete; keine Änderung an `src/proxy.ts`, `src/auth.ts`, Login, `.claude/`, `.github/`, `agents/`, `scripts/`, Configs, `.env*`, `AGENTS.md`

## Vorab: Abgleich mit dem Code

Vor dem Bau berichten, dann auf „Weiter“ warten:

1. Aufbau des Neuigkeiten-Panels (Komponente, `<dialog>`, `showModal()`?), Styles für Handy und Laptop (Breakpoint, Position, Höhe, `overflow`).
2. Ursache am Handy (375 × 812 und 375 × 667, Chromium und WebKit in Playwright): Wo sitzt das Blatt, wie hoch ist es, welches Element müsste scrollen und tut es nicht? Spielt `100vh` gegenüber der sichtbaren Höhe auf iOS eine Rolle?
3. Nutzen Panel/Blatt des Plans oder der Käfer denselben Baustein bzw. dieselben Styles? Haben sie denselben Fehler bei langem Inhalt?

Wenn etwas grundlegend anders ist als hier beschrieben: stoppen, Unterschied beschreiben, nichts umbauen.

## Umsetzung

1. **Blatt am Handy** (Breakpoint wie bisher):
   - unten angedockt, volle Breite, obere Ecken gerundet wie bisher
   - Höhe nach Inhalt, **höchstens 85 % der sichtbaren Höhe** (`85dvh`, Rückfall `85vh`)
   - **Kopf** (Titel „Neuigkeiten“, Schließen-Knopf) bleibt oben im Blatt stehen; **nur der Inhalt darunter scrollt** (`overflow-y: auto`, `overscroll-behavior: contain`, flüssiges Scrollen auf iOS)
   - Abstand unten für die Home-Leiste (`env(safe-area-inset-bottom)`)
   - Die Seite dahinter scrollt nicht mit, solange das Blatt offen ist; nach dem Schließen steht sie an derselben Stelle
   - Schließen per Knopf, Escape und Tippen auf den Hintergrund wie bisher; Fokus wie bisher
2. **Laptop:** unverändert.
3. **Klicktest** in der bestehenden Neuigkeiten-Testdatei ergänzen (oder `e2e/neuigkeiten-handy.spec.ts`), Prüfungen ohne feste Eintrags-IDs (`latestNewsId`):
   - 375 × 667 und 375 × 812: Glocke antippen → Kopf mit „Neuigkeiten“ und Schließen-Knopf liegt vollständig im sichtbaren Bereich; Blatt ist nicht höher als der Bildschirm
   - Im Blatt nach unten scrollen → der **älteste** Eintrag wird sichtbar; die Seite dahinter hat sich nicht bewegt
   - Schließen → Seite an derselben Stelle, Glocke ohne Punkt
   - 1280 × 800: Panel von rechts wie bisher
   - Keine Konsolenfehler; `expectPageReady` nach Seitenwechseln
4. **Neuigkeiten:** keiner (reiner Fehler-Fix).

## Akzeptanzkriterien

- Am Handy ist das Blatt höchstens 85 % der sichtbaren Höhe hoch, Kopf und Schließen-Knopf sind immer sichtbar, alle Einträge sind durch Scrollen im Blatt erreichbar
- Seite dahinter scrollt nicht mit; nach dem Schließen unverändert
- Laptop-Panel unverändert
- Helles und dunkles Thema lesbar; kein Hydration-Fehler (Production-Build)
- Neuer bzw. ergänzter Klicktest und alle bisherigen grün bei 375 × 812 und 1280 × 800, gegen `pnpm dev` **und** gegen den lokalen Production-Build (Port 3100)
- `pnpm typecheck`, `lint`, `test`, `build` grün
- Abweichungen unter „Abweichungen beim Bau“ vermerkt, mit „(von Franz freigegeben)“

## Deploy

Keine DB-Änderung: `deploy` merged nach grünen Prüfungen automatisch. Deshalb **vorher** lokal in der Chrome-Geräteansicht (iPhone SE und iPhone 12) durchklicken. Danach Live-Check am iPhone: Glocke antippen, bis zum ältesten Eintrag scrollen, schließen.

## Abweichungen beim Bau

(von Claude Code zu ergänzen; nie den Freigabe-Haken hier eintragen, stattdessen „(von Franz freigegeben)“)
