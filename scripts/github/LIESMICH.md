# GitHub-Einstellungen für Spec 019 (Franz, einmalig)

Ab jetzt sind auf `main` nur noch Merge-Commits erlaubt. Dann ist Franz Autor des Commits auf `main`, und Vercel deployed live. Squash und Rebase werden abgeschaltet: einmal in den Repo-Einstellungen und einmal im Ruleset „main schützen“ (id 25068852).

Ausführen **nach** dem Merge von Spec 019, im Projektordner auf `main` (`git switch main`, `git pull`).

## 1 · Stand vorher ansehen (nur lesen)

```bash
gh api repos/dellingerfranz-dev/krachparade-orga --jq '{allow_merge_commit, allow_squash_merge, allow_rebase_merge}'
gh api repos/dellingerfranz-dev/krachparade-orga/rulesets/25068852 --jq '.rules[] | select(.type == "pull_request") | .parameters.allowed_merge_methods'
```

Erwartet: alle drei `true` bzw. `["merge","squash","rebase"]`.

## 2 · Repo: Squash und Rebase aus

```bash
gh api -X PATCH repos/dellingerfranz-dev/krachparade-orga -F allow_squash_merge=false -F allow_rebase_merge=false --jq '{allow_merge_commit, allow_squash_merge, allow_rebase_merge}'
```

Erwartet: `{"allow_merge_commit":true,"allow_squash_merge":false,"allow_rebase_merge":false}`.

## 3 · Ruleset „main schützen“: nur Merge-Commit

`scripts/github/ruleset-main.json` ist der aktuelle Stand des Rulesets (per GET gelesen am 18.11.2026). Geändert ist nur `allowed_merge_methods`: statt `["merge","squash","rebase"]` jetzt `["merge"]`. Alles andere ist unverändert, auch die Pflicht-Checks „Prüfungen“ und „Klicktests“.

```bash
gh api -X PUT repos/dellingerfranz-dev/krachparade-orga/rulesets/25068852 --input scripts/github/ruleset-main.json --jq '.rules[] | select(.type == "pull_request") | .parameters.allowed_merge_methods'
```

Erwartet: `["merge"]`.

## 4 · Kontrolle

```bash
gh api repos/dellingerfranz-dev/krachparade-orga/rulesets/25068852 --jq '[.enforcement, (.rules[] | .type)]'
gh api repos/dellingerfranz-dev/krachparade-orga/rulesets/25068852 --jq '.rules[] | select(.type == "required_status_checks") | .parameters.required_status_checks[].context'
```

Erwartet: `["active","deletion","non_fast_forward","pull_request","required_status_checks"]`, dann `Prüfungen` und `Klicktests`.

## Zurück, falls nötig

```bash
gh api -X PATCH repos/dellingerfranz-dev/krachparade-orga -F allow_squash_merge=true -F allow_rebase_merge=true
```

Für das Ruleset in `scripts/github/ruleset-main.json` wieder `"allowed_merge_methods": ["merge", "squash", "rebase"]` eintragen und Schritt 3 wiederholen.
