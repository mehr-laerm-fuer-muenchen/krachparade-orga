# SPEC 027 – Next.js-Sicherheitsupdate

Freigabe Franz: ☑
Zweig: `spec/027-nextjs-update` · Risikoklasse C (`package.json`, `pnpm-lock.yaml`, Framework-Version) · **lokal** · DB: nein

## Ziel

Die App läuft auf **Next.js 16.4.0**. Diese Version ist von mehreren veröffentlichten Sicherheitslücken betroffen:

- **14.10.2026** (behoben in 16.4.1): unter anderem Remote Code Execution. Laut Hinweis sollen alle Apps mit App Router von 16.0.0 bis 16.4.0 sofort aktualisieren.
- **03.11.2026** (behoben in **16.4.5**): sieben Lücken, eine davon hoch. Mehrere betreffen **Cache Components** und `use cache`. Die App nutzt `cacheComponents`, ist also direkt betroffen.

Next.js wird auf die **aktuelle 16.4.x-Version, mindestens 16.4.5**, angehoben, ohne dass sich in der App etwas ändert. Danach brechen weder lokaler Build noch `pnpm dev` wegen des Sicherheitshinweises ab.

## Nicht in dieser Spec

- Sprung auf eine neue Minor- oder Major-Version (16.5+, 17)
- Andere Pakete aktualisieren (drizzle-kit, Tailwind, Vitest, Playwright, Auth.js, React), außer Next.js verlangt das zwingend als Peer-Abhängigkeit. Dann nur das Nötigste, im Abgleich begründet.
- Den Upgrade-Assistenten oder Codemods von Next.js (`next upgrade`, `@next/codemod`, das Angebot im Dev-Server)
- Code-Änderungen in `src/`, `e2e/` oder Configs. Nur falls der Build ohne sie nicht durchläuft: anhalten und berichten (siehe Abgleich).
- Backlog-Punkte (Vitest-Alias, Tailwind-PostCSS, Actions Node 24, `requireMember()`)

## Vorab: Abgleich mit dem Code

Prüfe zuerst und berichte kurz im Chat. **Erst nach „Weiter“ von Franz** etwas ändern:

- Welche Versionen stehen heute in `package.json` und `pnpm-lock.yaml` für `next`, `eslint-config-next`, `@next/*` (falls vorhanden), `react`, `react-dom`, `@types/react`, `@types/react-dom`?
- Welche 16.4.x ist die neueste veröffentlichte Version? (`pnpm view next versions --json`, nur 16.4.x nennen.) Ist sie ≥ 16.4.5?
- Verlangt diese Version andere Peer-Versionen von `react`/`react-dom`, als installiert sind? (`pnpm view next@<version> peerDependencies`)
- Gibt es in `next.config.*` Einstellungen, die in den Versionshinweisen 16.4.1–16.4.x als geändert oder veraltet genannt werden? Nur nennen, nicht ändern.
- Wo im Code steht der Umweg für die React-Lücke `_retryCache` (`expectPageReady` in `e2e/`)? Nur nennen.

Würde das Update mehr verlangen als die Versionsnummern in `package.json` und die Lock-Datei (z. B. Code-Änderungen, Config-Änderungen, React-Sprung): **nichts ändern**, Unterschied berichten und anhalten.

## Umsetzung

1. In `package.json` `next` und `eslint-config-next` auf **genau** die neueste 16.4.x setzen (ohne `^`, falls heute auch ohne; sonst die bestehende Schreibweise beibehalten). `@next/*`-Pakete, falls vorhanden, auf dieselbe Version.
2. `pnpm install`. Die Lock-Datei ändert sich nur für diese Pakete und ihre Unterabhängigkeiten.
3. Kontrolle: `pnpm list next eslint-config-next react react-dom` zeigt die erwarteten Versionen.
4. Prüfen mit **sauberem Stand** (den Ordner `.next` löscht Franz, nicht Claude Code, siehe Hinweis):
   - `pnpm typecheck`, `pnpm lint`, `pnpm test`
   - `pnpm build`: muss **beim ersten Lauf** grün sein (heute bricht der erste Lauf wegen des Sicherheitshinweises ab)
   - alle Klicktests gegen `pnpm dev` (`pnpm dev` startet Franz)
   - alle Klicktests gegen den lokalen Production-Build auf Port 3100: `VERCEL_ENV=preview ENABLE_DEV_LOGIN=1 pnpm build`, dann `AUTH_TRUST_HOST=1 VERCEL_ENV=preview ENABLE_DEV_LOGIN=1 pnpm start -p 3100`, dann `BASE_URL=http://localhost:3100 pnpm e2e`. Beende nur den Server, den du selbst gestartet hast.
5. Sichtprüfung mit Playwright bei 375 × 812 und 1280 × 800: Plan (Gantt und Wochenliste), Panel öffnen, `/meine`, ein Protokoll in der Leseansicht, `/arbeitskreise`, Käfer und Glocke öffnen. Achten auf Hydration-Warnungen in der Konsole.
6. Ergebnis im Commit-Text und hier unter „Abweichungen beim Bau“: alte → neue Version, Zahl der Unit- und Klicktests, ob `_retryCache` noch auftritt (Klicktests mit `expectPageReady` grün; nur beobachten, Umweg bleibt).

Hinweis: Claude Code darf `rm -r` nicht. Wenn `.next` gelöscht werden muss, anhalten und Franz den Befehl nennen.

## Akzeptanzkriterien

1. `next` und `eslint-config-next` stehen in `package.json` und `pnpm-lock.yaml` auf derselben 16.4.x ≥ 16.4.5. Sonst ändern sich nur zwingend nötige Unterabhängigkeiten.
2. Keine Änderung in `src/`, `e2e/`, `docs/specs/` (außer „Abweichungen beim Bau“ in dieser Spec), Configs, `.github/`, `.claude/`, `scripts/`.
3. `pnpm build` ist nach dem Löschen von `.next` beim ersten Lauf grün, ohne Sicherheits-Abbruch.
4. `pnpm dev` startet ohne Upgrade-Angebot zu einer neueren 16.4.x.
5. `pnpm typecheck`, `lint`, `test` grün; alle bestehenden Klicktests grün gegen `pnpm dev` und gegen den Production-Build auf 3100 (Zahl wie vorher, 73 + übersprungene).
6. Keine neuen Hydration-Warnungen; Kopfleiste am Handy einzeilig.
7. Im PR sind „Prüfungen“ und „Klicktests“ grün, die Vercel-Vorschau baut.
8. Nach dem Merge zeigt der Vercel-Production-Build die neue Next.js-Version im Build-Log, die App läuft live.

Kein neuer Klicktest: Die Oberfläche ändert sich nicht, Ersatz ist der volle Lauf aller bestehenden Klicktests gegen beide Builds.

## Deploy

Klasse C ohne DB, durch Franz:

1. Diff selbst prüfen: `git --no-pager diff main -- package.json`. Bei `pnpm-lock.yaml` nur die Zeilen zu `next` überfliegen.
2. Risikoklasse: `pnpm exec tsx scripts/risikoklasse.ts --base <Freigabe-Commit>` → C erwartet.
3. `deploy` → Prüfungen grün → Auto-Merge.
4. Live-Check: App öffnen, anmelden, Plan und ein Panel laden. Im Vercel-Build-Log die Next.js-Version prüfen.

## Neuigkeiten

keiner (keine sichtbare Änderung)

## Abweichungen beim Bau

(von Claude Code zu ergänzen; nie den Freigabe-Haken hier eintragen, stattdessen „(von Franz freigegeben)“)

- Keine Abweichung von der Spec.
- `next` und `eslint-config-next`: 16.4.0 → **16.4.5** (neueste 16.4.x). `react`/`react-dom` bleiben 19.3.0 (Peer-Bereich von Next.js `^18.2.0 || ^19.0.0` passt). In der Lock-Datei ändern sich nur `next`, `eslint-config-next` und die `@next/*`-Unterpakete.
- Versionshinweise 16.4.1–16.4.5 nennen keine Änderung an `cacheComponents`, `partialPrefetching` oder `turbopack.rules`.
- `pnpm install` meldet „unmet peer @types/node“ (Vitest 5.0.4 will `@types/node` ≥ 22, installiert 20.19.43). Kommt nicht von diesem Update, bleibt wie es ist.
- `pnpm typecheck`, `pnpm lint` grün; `pnpm test`: 490 Unit-Tests in 42 Dateien grün.
- `pnpm build` nach Löschen von `.next` beim ersten Lauf grün, ohne Sicherheits-Abbruch.
- Klicktests gegen `pnpm dev`: 73 bestanden, 13 übersprungen. Gegen den Production-Build auf Port 3100: 73 bestanden, 13 übersprungen.
- `_retryCache`: In beiden Läufen keine Konsolenfehler, alle Klicktests mit `expectPageReady` grün. Lokal ohne Server-Latenz nicht beobachtbar; React ist unverändert, der Umweg bleibt.
- Sichtprüfung bei 375 × 812 und 1280 × 800 (Plan Gantt und Wochenliste, Panel, `/meine`, Protokoll-Leseansicht, `/arbeitskreise`, Käfer, Glocke): kein Querscrollen, Kopfleiste einzeilig (63 px), keine Warnungen oder Hydration-Fehler in der Konsole.
