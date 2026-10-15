# SPEC 011 – Erlaubnisliste für Claude Code

Freigabe Franz: ☑
Zweig: `spec/011-claude-allowlist` · Risikoklasse C (`.claude/settings.json`) · lokal, Auto-Modus aus · DB: nein

Stand 15.10.2026 (Sitzung 5). 010 ist live – kann gebaut werden.

## Ziel

Claude Code soll bei harmlosen, häufigen Befehlen nicht mehr nachfragen: Prüfungen und Tests, der lokale Production-Build-Test, lesende Git-, GitHub- und Datei-Befehle sowie `git add`/`git commit`. Alles, was Daten, Remote-Stände, Pakete oder Prozesse verändert, bleibt bei Rückfrage oder gesperrt. Damit wird der Auto-Modus überflüssig und kann bei Klasse C wieder aus bleiben.

## Nicht in dieser Spec

- Lockern von bestehenden Sperren (`deny`) oder Rückfrage-Regeln (`ask`) – die bleiben alle unverändert
- Änderungen an `AGENTS.md`, Workflows, Risikoklassen-Skript
- Änderungen an `.claude/settings.local.json` oder Nutzer-Einstellungen außerhalb des Repos

## Vorab: Abgleich

Bevor du etwas änderst, zeig mir kurz den aktuellen Aufbau von `.claude/settings.json` (nur die Regeln, keine Werte aus `.env`): welche `allow`, `ask` und `deny` es gibt. Prüfe in der Claude-Code-Dokumentation die aktuelle Schreibweise für Bash-Regeln (exakter Befehl vs. Präfix mit `:*`) und wie verkettete Befehle (`&&`, `|`, `;`) geprüft werden. Wenn eine der unten gewünschten Regeln mit einer bestehenden `deny`- oder `ask`-Regel kollidiert: stoppen und beschreiben.

## Umsetzung

1. In `.claude/settings.json` unter `permissions.allow` ergänzen (Schreibweise nach Doku; Präfix-Regeln nur, wo Argumente folgen dürfen):
   - **Prüfungen:** `pnpm typecheck`, `pnpm lint`, `pnpm test` (mit Argumenten), `pnpm build`, `pnpm e2e` (mit Argumenten), `pnpm exec vitest` (mit Argumenten), `pnpm exec playwright test` (mit Argumenten)
   - **Lokaler Production-Build-Test** (genau diese Befehle):
     - `VERCEL_ENV=preview ENABLE_DEV_LOGIN=1 pnpm build`
     - `AUTH_TRUST_HOST=1 VERCEL_ENV=preview ENABLE_DEV_LOGIN=1 pnpm start -p 3100` und dieselbe Zeile mit `AUTH_TRUST_HOST=true`
     - `BASE_URL=http://localhost:3100 pnpm e2e` (mit Argumenten)
   - **Git:** `git status`, `git diff` (mit Argumenten), `git log` (mit Argumenten), `git show` (mit Argumenten), `git branch --show-current`, `git add` (mit Argumenten), `git commit` (mit Argumenten)
   - **GitHub lesend:** `gh run view`, `gh run list`, `gh pr view`, `gh pr checks` (jeweils mit Argumenten)
   - **Dateien lesend:** `ls`, `grep`, `rg`, `find`, `wc`, `head`, `tail` (jeweils mit Argumenten)
   - **Ports prüfen:** `lsof -i :3000`, `lsof -i :3100`
2. **Unverändert mit Rückfrage bzw. gesperrt** (nur prüfen, nicht ändern): alle `db:*`-Skripte und alles mit `:prod`, `git push`, `git merge`, `git reset`, `git switch`, `git checkout`, `git rebase`, `gh pr merge`, `gh pr edit`, `gh issue`, `kill`/`pkill`, `rm`, `pnpm add`, `pnpm install`, `pnpm remove`, `pnpm dev`, `vercel`, Lesen von `.env*`.
3. `find` darf nicht mit `-delete` oder `-exec` freigegeben werden: falls die Präfix-Regel das mit erfasst, `find … -delete` und `find … -exec` zusätzlich als `deny` eintragen.
4. In `AGENTS.md` nichts ändern. In `docs/specs/011-claude-allowlist.md` unter „Abweichungen beim Bau“ festhalten, falls eine Regel wegen der Schreibweise anders aussieht als hier.

## Akzeptanzkriterien

- Die Befehle aus 1 laufen ohne Rückfrage (Stichprobe: `pnpm typecheck`, `git status`, `gh pr checks`, `lsof -i :3100`)
- `pnpm db:seed`, `git push`, `kill`, `pnpm add` fragen weiterhin nach; `deny`-Regeln unverändert
- `find . -name x -delete` wird abgelehnt
- `pnpm typecheck`, `lint`, `test`, `build` grün; bestehende Klicktests unverändert grün

## Deploy

Keine DB-Änderung: `deploy`. Wirkt ab der nächsten Claude-Code-Sitzung (nach `/clear` bzw. Neustart).
