# Mit mehreren Leuten entwickeln (einmalig einrichten)

Ziel: bis zu vier Entwickler:innen. Jede Änderung kommt nur per Pull Request nach `main`. Eine **andere** Person gibt sie frei, „Prüfungen“ und „Klicktests“ müssen grün sein. Dann deployt Coolify automatisch.

GitHub erzwingt das nur in **öffentlichen** Repos (oder mit bezahltem Plan). Deshalb zuerst das Repo öffentlich machen.

## 1. Vor dem Öffentlich-Schalten

- [ ] Alle, deren Commits im Repo sind, sind einverstanden: Die Commit-Historie zeigt ihre Commit-E-Mail-Adresse (heute u. a. private Gmail-Adressen).
- [ ] Keine Geheimnisse im Repo (geprüft am 25.11.2026: nur Platzhalter und ausgedachte Testdaten).
- [ ] Ab jetzt mit GitHub-noreply-Adresse committen (siehe Abschnitt 4).

## 2. Repo öffentlich machen

GitHub → Repo → **Settings** → ganz unten **Danger Zone** → **Change visibility** → **Make public**.

Danach unter **Settings → Actions → General**: „Fork pull request workflows from outside collaborators“ auf **Require approval for all outside collaborators** stellen. Fremde PRs laufen dann erst nach einem Klick, und sie bekommen ohnehin keine Secrets.

## 3. Schutz für `main` einschalten

Im Projektordner (Git Bash, mit Admin-Recht):

```bash
gh api -X POST repos/mehr-laerm-fuer-muenchen/krachparade-orga/rulesets --input scripts/github/ruleset-main-team.json --jq '.id'
```

Prüfen:

```bash
gh api repos/mehr-laerm-fuer-muenchen/krachparade-orga/rulesets --jq '.[] | "\(.id) \(.name) \(.enforcement)"'
```

Das Ruleset verlangt: PR statt direktem Push (auch für Admins), 1 Freigabe einer anderen Person, neue Freigabe nach jedem neuen Commit, offene Review-Kommentare erledigt, „Prüfungen“ und „Klicktests“ grün, kein Force-Push, `main` nicht löschbar, nur Merge-Commits.

## 4. Neue Entwickler:in aufnehmen

1. GitHub → Organisation → **People** → **Invite member**, dann im Repo → **Settings → Collaborators and teams** → Rolle **Write**.
2. Die Person stellt bei sich die noreply-Adresse ein (GitHub → Settings → Emails → „Keep my email addresses private“), dann:

   ```bash
   git config --global user.email "<ID>+<login>@users.noreply.github.com"
   ```

3. Zugang zu Coolify (Team einladen) und zur Neon-Demo nur, wenn nötig. Production-Zugänge (Neon Production, Secrets) bleiben bei wenigen Personen.
4. README lesen, Abschnitt „Mitentwickeln“.

## Ablauf für alle

1. Eigenen Zweig anlegen (`feature/…`, `fix/…`, Specs `agent/NNN-…`).
2. Pushen, PR gegen `main` öffnen. Die Vorschau erscheint unter `https://<PR-Nummer>.preview.krachparade-orga.de`.
3. Eine andere Person sieht sich PR und Vorschau an und klickt **Approve**.
4. Sind die Prüfungen grün, mergen. Coolify deployt `main` auf Production. Schemaänderungen spielt „Schema Production“ ein.
