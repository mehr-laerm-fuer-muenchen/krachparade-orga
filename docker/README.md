# Lokale Test-Datenbank mit Docker

Spec 031. Damit läuft die App komplett auf deinem Rechner, ohne Neon. In der Datenbank stehen nur ausgedachte Daten aus dem Seed. Für Claude Code ist das der Weg, die App selbst zu starten und alle Klicktests laufen zu lassen.

**So funktioniert's:** Die App spricht mit der Datenbank über das HTTP-Protokoll von Neon (Treiber `neon-http`). Docker startet ein normales Postgres und davor einen kleinen Übersetzer, den „Neon-HTTP-Proxy“, auf `http://localhost:4444/sql`. Ist `LOCAL_NEON_HTTP_ENDPOINT` gesetzt, schickt `src/db/index.ts` alle Anfragen dorthin. Das passiert nur bei einer `localhost`-Adresse und nie auf einem Server, also wenn `APP_ENV` gesetzt ist (`src/lib/local-db.ts`).

`docker/local.env` enthält nur Fantasie-Werte für diesen Rechner, keine echten Geheimnisse. Google-Login geht damit nicht, du meldest dich über `/dev/login` an.

## Einmal einrichten

Docker Desktop muss laufen. Die Befehle sind für Git Bash, im Projektordner auszuführen.

```bash
# 1. Datenbank und Proxy starten
docker compose -f docker/compose.yaml up -d

# 2. Tabellen anlegen: Schema als SQL erzeugen und einspielen
set -a; . docker/local.env; set +a
pnpm exec drizzle-kit export --sql > /tmp/kp-schema.sql
docker compose -f docker/compose.yaml exec -T postgres psql -v ON_ERROR_STOP=1 -q -U postgres -d main < /tmp/kp-schema.sql

# 3. Testdaten (Seed) einspielen
pnpm exec tsx src/db/seed.ts
```

Schritt 2 geht nur bei einer **leeren** Datenbank. Nach einer Schema-Änderung (neue Spec) einfach alles neu aufsetzen (siehe unten).

## App starten und testen

```bash
set -a; . docker/local.env; set +a
pnpm exec next dev -p 3031          # App auf http://localhost:3031
```

In einem zweiten Terminal:

```bash
BASE_URL=http://localhost:3031 pnpm e2e                                     # alle Klicktests
BASE_URL=http://localhost:3031 pnpm exec playwright test e2e/kollektiv-anmeldung.spec.ts
BASE_URL=http://localhost:3031 pnpm exec playwright test --ui              # Klick-Ansicht zum Zuschauen
```

Port 3031, damit es nicht mit deinem `pnpm dev` auf 3000 (Neon `dev`) kollidiert.

## Mails ansehen (Spec 032)

Mailpit fängt alle Mails ab, die die App lokal verschickt, z. B. die Bestätigung nach einer Anmeldung. Nichts davon verlässt deinen Rechner.

- Postfach im Browser: **http://localhost:8026**
- Die App schickt an `localhost:1026` (steht in `docker/local.env`). Die Ports sind absichtlich nicht die Mailpit-Standards 8025/1025, damit sie nicht mit einem anderen Mailpit auf deinem Rechner kollidieren.
- Der Klicktest `e2e/kollektiv-anmeldung.spec.ts` prüft die Mail über die Mailpit-API und löscht sie danach wieder. Läuft Mailpit nicht, überspringt er diesen Teil.

Hast du die Docker-Umgebung schon vor Spec 032 eingerichtet? Dann reicht:

```bash
docker compose -f docker/compose.yaml up -d
docker compose -f docker/compose.yaml exec -T postgres psql -U postgres -d main -c "alter table collective_registrations add column if not exists confirmation_sent_at timestamp with time zone"
```

Danach die App neu starten, damit sie die neuen Werte aus `docker/local.env` liest.

## Stoppen und neu aufsetzen

```bash
docker compose -f docker/compose.yaml down      # stoppen, Daten bleiben
docker compose -f docker/compose.yaml down -v   # stoppen und alle Daten löschen
```

Nach `down -v` wieder mit „Einmal einrichten“ anfangen.
