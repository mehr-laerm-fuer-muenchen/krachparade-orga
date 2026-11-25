## Was ändert sich?

<!-- Zwei, drei Sätze. Welche Spec (docs/specs/NNN-…) wird umgesetzt? -->

## Selbstprüfung

- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` sind grün
- [ ] Mindestens ein Klicktest in `e2e/` deckt die Änderung ab
- [ ] Bei 375 × 812 und 1280 × 800 angesehen
- [ ] Bei Änderungen an `src/db/schema.ts`: Action „Schema Vorschau“ ist grün (nur hinzufügend, nichts gelöscht oder umbenannt)
- [ ] Vorschau (`https://<PR-Nummer>.preview.krachparade-orga.de`) geöffnet und die neue Funktion einmal durchgeklickt
- [ ] Keine `.env`-Datei, kein Passwort, kein Token im Diff; nur ausgedachte Daten mit `@example.org`
